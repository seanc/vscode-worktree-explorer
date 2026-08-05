import * as vscode from 'vscode';
import type { GitIntegrationService } from '../git';
import type { SelectionCoordinator } from '../selection';
import { showWorktreeQuickPick } from '../ui';

export const SELECT_WORKTREE_COMMAND = 'worktreeExplorer.selectWorktree';

/** PRD §12 command table / §13.1 primary view-title action. */
export function registerSelectWorktreeCommand(
  gitIntegration: GitIntegrationService,
  selection: SelectionCoordinator
): vscode.Disposable {
  return vscode.commands.registerCommand(SELECT_WORKTREE_COMMAND, async () => {
    const linkedWorktrees = gitIntegration.listWorktrees().filter((w) => !w.isMain);
    const chosen = await showWorktreeQuickPick(linkedWorktrees, {
      activeUri: selection.snapshot.activeWorktreeUri,
      isScmSelected: (uri) => gitIntegration.isRepositorySelected(uri)
    });
    if (chosen) {
      selection.selectManually(chosen.rootUri);
    }
  });
}
