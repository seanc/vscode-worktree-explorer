import * as vscode from 'vscode';

// Bootstrap only (issue #1): no Git, selection, tree, or filesystem logic yet.
// - Git discovery lands in #2 (src/git).
// - SCM-driven view visibility lands in #3 (src/selection).
// - Read-only browsing lands in #6 (src/tree, src/filesystem).
export function activate(_context: vscode.ExtensionContext): void {
  // Intentionally empty: contributes.views.explorer is declared in package.json with
  // "when": "worktreeExplorer.visible", and nothing here ever sets that context key, so the
  // view stays hidden until #3 wires real SCM-selection tracking.
}

export function deactivate(): void {
  // Nothing to dispose yet.
}
