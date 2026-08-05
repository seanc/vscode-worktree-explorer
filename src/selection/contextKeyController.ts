import * as vscode from 'vscode';
import type { GitIntegrationService } from '../git';

export interface ContextKeyValues {
  gitAvailable: boolean;
  hasWorktrees: boolean;
  /**
   * Feasibility-quality only: true iff any linked worktree is currently SCM-selected. The full
   * precedence/epoch/manual-override algorithm (PRD §15.3) is #4's job — this exists to prove the
   * false→true transition can be observed and mapped to a context key at all.
   */
  visible: boolean;
}

export const CONTEXT_KEYS = {
  gitAvailable: 'worktreeExplorer.gitAvailable',
  hasWorktrees: 'worktreeExplorer.hasWorktrees',
  visible: 'worktreeExplorer.visible'
} as const;

/** Narrow surface ContextKeyController needs — kept Pick'd so the pure computation below is
 *  unit-testable against a fake without wiring a real GitIntegrationService/vscode.git. */
type GitIntegrationSource = Pick<GitIntegrationService, 'isAvailable' | 'listWorktrees' | 'isRepositorySelected'>;

/** Pure computation, split out from the setContext side effect so it's unit-testable. */
export function computeContextKeyValues(gitIntegration: GitIntegrationSource): ContextKeyValues {
  const gitAvailable = gitIntegration.isAvailable;
  const linkedWorktrees = gitAvailable ? gitIntegration.listWorktrees().filter((w) => !w.isMain) : [];
  const hasWorktrees = linkedWorktrees.length > 0;
  const visible = linkedWorktrees.some((w) => gitIntegration.isRepositorySelected(w.rootUri));
  return { gitAvailable, hasWorktrees, visible };
}

/**
 * Feasibility-quality spike (#3) proving SCM selection changes can be observed and mapped to the
 * context keys that gate contributes.views.explorer's "when" clause (PRD §14). Superseded by the
 * full SelectionCoordinator state machine in #4; AC-01/AC-02 are fully closed there.
 */
export class ContextKeyController implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private _values: ContextKeyValues = { gitAvailable: false, hasWorktrees: false, visible: false };

  constructor(private readonly gitIntegration: GitIntegrationService) {
    this.disposables.push(
      gitIntegration.onDidChangeAvailability(() => this.refresh()),
      gitIntegration.onDidChangeWorktrees(() => this.refresh()),
      gitIntegration.onDidChangeRepositorySelection(() => this.refresh())
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
