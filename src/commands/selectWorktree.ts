import * as vscode from 'vscode';
import type { GitIntegrationService } from '../git';
import type { SelectionCoordinator, SelectionSnapshot } from '../selection';
import { showWorktreeQuickPick } from '../ui';
import { SELECT_WORKTREE_COMMAND } from './constants';

/** PRD §25 "Git unavailable" row, verbatim — checked before the §9.9 "no linked worktrees"
 *  message so the two distinct causes get distinct explanations (§9.11: "show a clear
 *  explanation if the user invokes a command" while Git is unavailable). */
export const GIT_UNAVAILABLE_MESSAGE = "Worktree Explorer requires VS Code's built-in Git extension.";

type GitIntegrationSource = Pick<GitIntegrationService, 'isAvailable' | 'listWorktrees' | 'isRepositorySelected'>;
type SelectionSource = { readonly snapshot: SelectionSnapshot; selectManually(uri: vscode.Uri): void };

/** PRD §12 command table / §13.1 primary view-title action. Exported as a plain function (see
 *  #11's pathCommands.ts for why) — the running extension already owns this command id, so a
 *  test can't re-register it to inject fakes and must call this directly instead. */
export async function selectWorktree(gitIntegration: GitIntegrationSource, selection: SelectionSource): Promise<void> {
  if (!gitIntegration.isAvailable) {
    void vscode.window.showErrorMessage(GIT_UNAVAILABLE_MESSAGE);
    return;
  }
  const linkedWorktrees = gitIntegration.listWorktrees().filter((w) => !w.isMain);
  const chosen = await showWorktreeQuickPick(linkedWorktrees, {
    activeUri: selection.snapshot.activeWorktreeUri,
    isScmSelected: (uri) => gitIntegration.isRepositorySelected(uri)
  });
  if (chosen) {
    selection.selectManually(chosen.rootUri);
  }
}

export function registerSelectWorktreeCommand(gitIntegration: GitIntegrationService, selection: SelectionCoordinator): vscode.Disposable {
  return vscode.commands.registerCommand(SELECT_WORKTREE_COMMAND, () => selectWorktree(gitIntegration, selection));
}
