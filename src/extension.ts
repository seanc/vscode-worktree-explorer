import * as vscode from 'vscode';
import { GitIntegrationService } from './git';
import { ContextKeyController, SelectionCoordinator } from './selection';
import { FileSystemService, WorktreeWatcher, RootBoundaryGuard } from './filesystem';
import { WorktreeTreeProvider, describeActiveWorktree } from './tree';
import {
  registerSelectWorktreeCommand,
  registerOpenCommand,
  registerRefreshCommand,
  registerNewFileCommand,
  registerNewFolderCommand
} from './commands';

// #3: activationEvents includes "onStartupFinished" (package.json) — contributes.views.explorer's
// own "when" clause can never trigger activation, since only this extension can set the context
// key it depends on.
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const gitIntegration = new GitIntegrationService();
  context.subscriptions.push(gitIntegration);
  await gitIntegration.activate();

  // #4: SelectionCoordinator resolves the active worktree (PRD §15); ContextKeyController just
  // reflects that resolution into the view's "when" context keys. Persistence-based restore()
  // is wired by #12.
  const selectionCoordinator = new SelectionCoordinator(gitIntegration);
  context.subscriptions.push(selectionCoordinator);
  context.subscriptions.push(new ContextKeyController(gitIntegration, selectionCoordinator));

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

  // #8/#9: create files/folders through the shared RootBoundaryGuard.
  const outputChannel = vscode.window.createOutputChannel('Worktree Explorer');
  context.subscriptions.push(outputChannel);
  const guard = new RootBoundaryGuard();
  const newEntryDeps = { fileSystem, guard, selection: selectionCoordinator, treeProvider, outputChannel };
  context.subscriptions.push(registerNewFileCommand(newEntryDeps));
  context.subscriptions.push(registerNewFolderCommand(newEntryDeps));
}

export function deactivate(): void {
  // Disposal is handled via context.subscriptions.
}
