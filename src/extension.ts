import * as vscode from 'vscode';
import { GitIntegrationService } from './git';

// #2: GitIntegrationService is now wired into the extension lifecycle.
// - SCM-driven view visibility lands in #3 (src/selection).
// - contributes.views.explorer still has "when": "worktreeExplorer.visible", which nothing here
//   sets true yet, so the view stays hidden.
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const gitIntegration = new GitIntegrationService();
  context.subscriptions.push(gitIntegration);
  await gitIntegration.activate();
}

export function deactivate(): void {
  // Disposal is handled via context.subscriptions.
}
