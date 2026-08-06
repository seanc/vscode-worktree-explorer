import * as vscode from 'vscode';
import { GitIntegrationService } from './git';
import { ContextKeyController, SelectionCoordinator } from './selection';
import { FileSystemService, WorktreeWatcher, RootBoundaryGuard } from './filesystem';
import { WorktreeTreeProvider, describeActiveWorktree } from './tree';
import { PersistenceService, isRestoreLastSelectionEnabled } from './persistence';
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
  registerOpenSettingsCommand
} from './commands';

// #3: activationEvents includes "onStartupFinished" (package.json) — contributes.views.explorer's
// own "when" clause can never trigger activation, since only this extension can set the context
// key it depends on.
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const gitIntegration = new GitIntegrationService();
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
  const treeProvider = new WorktreeTreeProvider(fileSystem);
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

  const updateTreeView = () => {
    const activeUri = selectionCoordinator.snapshot.activeWorktreeUri;
    treeProvider.setActiveRoot(activeUri);
    watcher.setActiveRoot(activeUri);
    treeView.description = describeActiveWorktree(gitIntegration.listWorktrees(), activeUri);
  };
  updateTreeView();
  context.subscriptions.push(selectionCoordinator.onDidChangeSelection(updateTreeView));

  // #5: manual worktree selection via the Quick Pick.
  context.subscriptions.push(registerSelectWorktreeCommand(gitIntegration, selectionCoordinator));
  // #6: open a file, and manually refresh the tree.
  context.subscriptions.push(registerOpenCommand());
  context.subscriptions.push(registerRefreshCommand(treeProvider));

  // #8/#9/#10: create/rename/delete through the shared RootBoundaryGuard.
  const outputChannel = vscode.window.createOutputChannel('Worktree Explorer');
  context.subscriptions.push(outputChannel);
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
