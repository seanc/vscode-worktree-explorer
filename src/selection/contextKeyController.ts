import * as vscode from 'vscode';
import type { GitIntegrationService } from '../git';

export interface ContextKeyValues {
  gitAvailable: boolean;
  hasWorktrees: boolean;
  visible: boolean;
}

export const CONTEXT_KEYS = {
  gitAvailable: 'worktreeExplorer.gitAvailable',
  hasWorktrees: 'worktreeExplorer.hasWorktrees',
  visible: 'worktreeExplorer.visible'
} as const;

type GitIntegrationSource = Pick<GitIntegrationService, 'isAvailable' | 'listWorktrees' | 'onDidChangeAvailability' | 'onDidChangeWorktrees'>;

/** Only what the pure computation needs — narrower than the constructor's full source type so
 *  tests for computeContextKeyValues don't have to stub unused event members. */
type ContextKeyGitSource = Pick<GitIntegrationSource, 'isAvailable' | 'listWorktrees'>;

/** Pure computation, split out from the setContext side effect so it's unit-testable. */
export function computeContextKeyValues(gitIntegration: ContextKeyGitSource): ContextKeyValues {
  const gitAvailable = gitIntegration.isAvailable;
  const hasWorktrees = gitAvailable && gitIntegration.listWorktrees().some((w) => !w.isMain);
  // The view is visible whenever the project has any linked worktree, independent of which one (if
  // any) is currently resolved as active - SelectionCoordinator.resolve() always falls back to
  // showing the last-known or first worktree rather than leaving an active-but-empty view visible.
  const visible = hasWorktrees;
  return { gitAvailable, hasWorktrees, visible };
}

/**
 * Sets the context keys that gate contributes.views.explorer's "when" clause (PRD §14) from
 * GitIntegrationService (availability/discovery). `visible` no longer depends on the resolved
 * active worktree (SelectionCoordinator) — it tracks `hasWorktrees` only, so the view stays shown
 * regardless of which worktree, if any, is currently selected.
 */
export class ContextKeyController implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private _values: ContextKeyValues = { gitAvailable: false, hasWorktrees: false, visible: false };

  constructor(private readonly gitIntegration: GitIntegrationSource) {
    this.disposables.push(
      gitIntegration.onDidChangeAvailability(() => this.refresh()),
      gitIntegration.onDidChangeWorktrees(() => this.refresh())
    );
    this.refresh();
  }

  /** Last computed values — exposed so tests can assert without a public "getContext" API. */
  get values(): ContextKeyValues {
    return this._values;
  }

  private refresh(): void {
    this._values = computeContextKeyValues(this.gitIntegration);
    void vscode.commands.executeCommand('setContext', CONTEXT_KEYS.gitAvailable, this._values.gitAvailable);
    void vscode.commands.executeCommand('setContext', CONTEXT_KEYS.hasWorktrees, this._values.hasWorktrees);
    void vscode.commands.executeCommand('setContext', CONTEXT_KEYS.visible, this._values.visible);
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
