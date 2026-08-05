import * as vscode from 'vscode';
import { GitIntegrationService } from './git';
import { ContextKeyController, SelectionCoordinator } from './selection';
import { registerSelectWorktreeCommand } from './commands';

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

  // #5: manual worktree selection via the Quick Pick.
  context.subscriptions.push(registerSelectWorktreeCommand(gitIntegration, selectionCoordinator));
}

export function deactivate(): void {
  // Disposal is handled via context.subscriptions.
}
