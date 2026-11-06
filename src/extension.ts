import * as vscode from 'vscode';
import { GitIntegrationService } from './git';
import { ContextKeyController, SelectionCoordinator } from './selection';
import { FileSystemService, WorktreeWatcher, RootBoundaryGuard } from './filesystem';
import { WorktreeTreeProvider, describeActiveWorktree, isFilterMode, type ChangeSource } from './tree';
import { PersistenceService, isRestoreLastSelectionEnabled } from './persistence';
import { TicketService, describeTicketHeader, readTicketConfig } from './ticket';
import { reportUnexpectedError } from './common';
import {
  registerSelectWorktreeCommand,
  registerOpenCommand,
  registerRefreshCommand,
  registerNewFileCommand,
  registerNewFolderCommand,
  registerRenameCommand,
  registerDeleteCommand,
  registerCopyRelativePathCommand,
  registerCopyAbsolutePathCommand,
  registerRevealInOperatingSystemCommand,
  registerCopyWorktreePathCommand,
  registerRevealWorktreeRootCommand,
  registerOpenSettingsCommand,
  registerTicketCommands,
  registerFilterCommands,
  registerCompareCommands,
  registerTicketsViewCommands
} from './commands';
import { TicketsSidebarProvider, TicketOverviewPanel } from './tickets';
import { registerServeCommand } from './tunnel';
import { OPEN_TICKET_OVERVIEW_COMMAND } from './commands/constants';

/** #20: per-workspace filter mode (workspaceState, like #12's persisted selection). */
const FILTER_MODE_STATE_KEY = 'worktreeExplorer.filterMode';

// #3: activationEvents includes "onStartupFinished" (package.json) — contributes.views.explorer's
// own "when" clause can never trigger activation, since only this extension can set the context
// key it depends on.
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel('Worktree Explorer');
  context.subscriptions.push(outputChannel);

  const gitIntegration = new GitIntegrationService((operation, error) => reportUnexpectedError(outputChannel, operation, error));
  context.subscriptions.push(gitIntegration);
  await gitIntegration.activate();

  // #4: SelectionCoordinator resolves the active worktree (PRD §15); ContextKeyController just
  // reflects that resolution into the view's "when" context keys.
  const selectionCoordinator = new SelectionCoordinator(gitIntegration);
  context.subscriptions.push(selectionCoordinator);
  context.subscriptions.push(new ContextKeyController(gitIntegration));

  // #12: restore the last valid selection (PRD §15.4 step 4) when no live SCM selection already
  // claimed the slot in the constructor call above. restore() is idempotent once activeSource is
  // set, so retrying on every onDidChangeWorktrees event is safe and lets it succeed once
  // discovery catches up to a worktree that was opened asynchronously (#3's finding) without
  // risking a premature "invalid" verdict.
  const persistence = new PersistenceService(context.workspaceState, gitIntegration, selectionCoordinator);
  context.subscriptions.push(persistence);
  const attemptRestore = () => {
    const uriString = persistence.load()?.lastActiveWorktreeUri;
    if (uriString && isRestoreLastSelectionEnabled()) {
      selectionCoordinator.restore(vscode.Uri.parse(uriString));
    }
    // Last resort: nothing else has claimed the active slot (no live SCM selection, nothing
    // persisted, no worktree has ever been active this session) but the view is now always visible
    // whenever worktrees exist (§14 hasWorktrees) - default to the first linked worktree instead of
    // leaving it empty. restore() no-ops once activeSource is already set, so this never overrides
    // a real selection above.
    const firstLinked = gitIntegration.listWorktrees().find((w) => !w.isMain);
    if (firstLinked) {
      selectionCoordinator.restore(firstLinked.rootUri);
    }
  };
  attemptRestore();
  context.subscriptions.push(gitIntegration.onDidChangeWorktrees(attemptRestore));

  // #13/§25 "Active worktree removed": notify once per removal (AC-14 already clears the state;
  // this just tells the user why the view emptied out instead of leaving it unexplained).
  context.subscriptions.push(
    selectionCoordinator.onWorktreeRemoved(() => {
      void vscode.window.showWarningMessage('The selected worktree no longer exists.');
    })
  );

  // #6: read-only tree, rooted at the resolved active worktree. showCollapseAll gives the
  // "Collapse All" button (PRD §12/§13.1) — there is no public API to trigger that behavior from
  // a synthetic command instead (see src/commands/refresh.ts).
  const fileSystem = new FileSystemService();
  // #20: in a filtered mode the tree is built from the change list for the active root.
  const changeSource: ChangeSource = async (mode, rootUri) =>
    mode === 'uncommitted' ? gitIntegration.listUncommittedChanges(rootUri) : (await gitIntegration.compareWithBase(rootUri))?.changedVsBase;
  const treeProvider = new WorktreeTreeProvider(fileSystem, changeSource);
  const savedFilter = context.workspaceState.get<unknown>(FILTER_MODE_STATE_KEY);
  treeProvider.setFilterMode(isFilterMode(savedFilter) ? savedFilter : 'all');
  void vscode.commands.executeCommand('setContext', 'worktreeExplorer.filterActive', treeProvider.mode !== 'all');
  treeProvider.setActiveRoot(selectionCoordinator.snapshot.activeWorktreeUri);
  const treeView = vscode.window.createTreeView('worktreeExplorer.files', {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);

  // #7: exactly one active-root watcher, disposed and replaced on every root switch, debounced
  // and coalesced into a full-tree refresh (PRD §18 — affected-parent refresh is deferred to #15
  // if profiling shows the full-tree refresh doesn't meet the external-refresh performance target).
  const watcher = new WorktreeWatcher();
  context.subscriptions.push(watcher);
  context.subscriptions.push(watcher.onDidChange(() => treeProvider.refresh()));

  // #19: ticket context (key, ahead count, summary) for the active worktree's header. Loaded
  // asynchronously; `headerRequest` drops a stale result if the selection changed meanwhile.
  const ticketService = new TicketService(gitIntegration);
  context.subscriptions.push(ticketService);
  let headerRequest = 0;
  // The view message holds the ticket summary (#19) and, below it, a filtered view's notice (#20).
  let summaryMessage: string | undefined;
  const updateMessage = () => {
    treeView.message = [summaryMessage, treeProvider.filterNotice].filter(Boolean).join('\n') || undefined;
  };
  context.subscriptions.push(treeProvider.onDidChangeFilterNotice(updateMessage));
  const updateTicketHeader = async () => {
    const request = ++headerRequest;
    const activeUri = selectionCoordinator.snapshot.activeWorktreeUri;
    const header = describeTicketHeader(activeUri ? await ticketService.getTicket(activeUri) : undefined, readTicketConfig().keyPattern);
    if (request !== headerRequest) {
      return;
    }
    const base = header.description ?? describeActiveWorktree(gitIntegration.listWorktrees(), activeUri);
    const filterNote = treeProvider.mode === 'changedVsBase' ? 'changed only' : treeProvider.mode === 'uncommitted' ? 'uncommitted only' : undefined;
    treeView.description = base && filterNote ? `${base} · ${filterNote}` : base;
    summaryMessage = header.message;
    updateMessage();
    void vscode.commands.executeCommand('setContext', 'worktreeExplorer.activeTicketHasUrl', header.hasUrl);
    void vscode.commands.executeCommand('setContext', 'worktreeExplorer.activeTicketHasNotes', header.hasNotes);
    void vscode.commands.executeCommand('setContext', 'worktreeExplorer.activeTicketHasTestCommand', header.hasTestCommand);
  };

  const updateTreeView = () => {
    const activeUri = selectionCoordinator.snapshot.activeWorktreeUri;
    treeProvider.setActiveRoot(activeUri);
    watcher.setActiveRoot(activeUri);
    treeView.description = describeActiveWorktree(gitIntegration.listWorktrees(), activeUri);
    void updateTicketHeader();
  };
  updateTreeView();
  context.subscriptions.push(selectionCoordinator.onDidChangeSelection(updateTreeView));
  context.subscriptions.push(
    ticketService.onDidChange(() => {
      void updateTicketHeader();
      // Repository state changed: a filtered tree's change list may be stale.
      if (treeProvider.mode !== 'all') {
        treeProvider.refresh();
      }
    })
  );
  context.subscriptions.push(registerTicketCommands({ tickets: ticketService, selection: selectionCoordinator }));
  context.subscriptions.push(registerCompareCommands({ git: gitIntegration, selection: selectionCoordinator }));

  // #22/#25: the Tickets sidebar (design-A cards) and the ticket overview editor, both webviews
  // fed from the same TicketService data.
  const webviewDeps = { extensionUri: context.extensionUri, tickets: ticketService, git: gitIntegration, selection: selectionCoordinator };
  const overviewPanel = new TicketOverviewPanel(webviewDeps);
  const ticketsSidebar = new TicketsSidebarProvider(webviewDeps, overviewPanel);
  context.subscriptions.push(overviewPanel, ticketsSidebar);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(TicketsSidebarProvider.viewId, ticketsSidebar));
  const renderTicketViews = () => {
    void ticketsSidebar.render();
    void overviewPanel.render();
  };
  context.subscriptions.push(ticketService.onDidChange(renderTicketViews));
  context.subscriptions.push(selectionCoordinator.onDidChangeSelection(renderTicketViews));
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('worktreeExplorer.ticket.cleanupCommand') || event.affectsConfiguration('worktreeExplorer.tunnel')) {
        renderTicketViews();
      }
    })
  );
  context.subscriptions.push(
    registerTicketsViewCommands({
      selection: selectionCoordinator,
      git: gitIntegration,
      tickets: ticketService,
      refresh: () => ticketService.refresh()
    })
  );
  // #26: serve a checkout through the tunnel (user-configured command, visible terminal, confirmed).
  context.subscriptions.push(registerServeCommand({ tickets: ticketService }));
  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_TICKET_OVERVIEW_COMMAND, async (target?: { rootUri?: vscode.Uri }) => {
      const rootUri = target?.rootUri ?? selectionCoordinator.snapshot.activeWorktreeUri;
      if (rootUri) {
        await overviewPanel.show(rootUri);
      } else {
        void vscode.window.showInformationMessage('Select a worktree first.');
      }
    })
  );
  context.subscriptions.push(
    registerFilterCommands({
      getMode: () => treeProvider.mode,
      setMode: (mode) => {
        treeProvider.setFilterMode(mode);
        void context.workspaceState.update(FILTER_MODE_STATE_KEY, mode);
        void vscode.commands.executeCommand('setContext', 'worktreeExplorer.filterActive', mode !== 'all');
        void updateTicketHeader();
      }
    })
  );

  // #5: manual worktree selection via the Quick Pick.
  context.subscriptions.push(registerSelectWorktreeCommand(gitIntegration, selectionCoordinator));
  // #6: open a file, and manually refresh the tree.
  context.subscriptions.push(registerOpenCommand());
  context.subscriptions.push(registerRefreshCommand(treeProvider));

  // #8/#9/#10: create/rename/delete through the shared RootBoundaryGuard.
  const guard = new RootBoundaryGuard();
  const mutationDeps = { fileSystem, guard, selection: selectionCoordinator, treeProvider, outputChannel };
  context.subscriptions.push(registerNewFileCommand(mutationDeps));
  context.subscriptions.push(registerNewFolderCommand(mutationDeps));
  context.subscriptions.push(registerRenameCommand(mutationDeps));
  context.subscriptions.push(registerDeleteCommand(mutationDeps));

  // #11: path/OS utility commands (read-only — not gated by Workspace Trust).
  const pathCommandDeps = { selection: selectionCoordinator };
  context.subscriptions.push(registerCopyRelativePathCommand(pathCommandDeps));
  context.subscriptions.push(registerCopyAbsolutePathCommand());
  context.subscriptions.push(registerRevealInOperatingSystemCommand());
  context.subscriptions.push(registerCopyWorktreePathCommand(pathCommandDeps));
  context.subscriptions.push(registerRevealWorktreeRootCommand(pathCommandDeps));
  context.subscriptions.push(registerOpenSettingsCommand());
}

export function deactivate(): void {
  // Disposal is handled via context.subscriptions.
}
