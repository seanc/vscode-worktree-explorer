import * as vscode from 'vscode';
import { GitIntegrationService } from './git';
import { ContextKeyController } from './selection';

// #3: activationEvents now includes "onStartupFinished" (package.json). contributes.views.explorer
// gates on "worktreeExplorer.visible", which only this extension can set — the view contribution
// itself can never trigger activation (its "when" clause depends on a key nothing else would ever
// flip), so an explicit startup activation event is required to break that chicken-and-egg cycle.
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const gitIntegration = new GitIntegrationService();
  context.subscriptions.push(gitIntegration);
  await gitIntegration.activate();

  // Feasibility-quality only (#3) — real behavior lands with SelectionCoordinator in #4.
  context.subscriptions.push(new ContextKeyController(gitIntegration));
}

export function deactivate(): void {
  // Disposal is handled via context.subscriptions.
}
