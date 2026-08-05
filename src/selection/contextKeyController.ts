import * as vscode from 'vscode';
import type { GitIntegrationService } from '../git';
import type { SelectionSnapshot } from './selectionCoordinator';

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
type SelectionSource = { readonly snapshot: SelectionSnapshot; readonly onDidChangeSelection: vscode.Event<SelectionSnapshot> };

/** Only what the pure computation needs — narrower than the constructor's full source types so
 *  tests for computeContextKeyValues don't have to stub unused event members. */
type ContextKeyGitSource = Pick<GitIntegrationSource, 'isAvailable' | 'listWorktrees'>;
type ContextKeySelectionSource = Pick<SelectionSource, 'snapshot'>;

/** Pure computation, split out from the setContext side effect so it's unit-testable. */
export function computeContextKeyValues(gitIntegration: ContextKeyGitSource, selection: ContextKeySelectionSource): ContextKeyValues {
  const gitAvailable = gitIntegration.isAvailable;
  const hasWorktrees = gitAvailable && gitIntegration.listWorktrees().some((w) => !w.isMain);
  const visible = selection.snapshot.activeWorktreeUri !== undefined;
  return { gitAvailable, hasWorktrees, visible };
}

/**
 * Sets the context keys that gate contributes.views.explorer's "when" clause (PRD §14) from
 * GitIntegrationService (availability/discovery) and SelectionCoordinator (resolved active root).
 * As of #4, `visible` reflects the full SS15.3 precedence algorithm rather than the #3 spike's
 * naive "any linked worktree selected" check.
 */
export class ContextKeyController implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private _values: ContextKeyValues = { gitAvailable: false, hasWorktrees: false, visible: false };

  constructor(
    private readonly gitIntegration: GitIntegrationSource,
    private readonly selection: SelectionSource
  ) {
    this.disposables.push(
      gitIntegration.onDidChangeAvailability(() => this.refresh()),
      gitIntegration.onDidChangeWorktrees(() => this.refresh()),
      selection.onDidChangeSelection(() => this.refresh())
    );
    this.refresh();
  }

  /** Last computed values — exposed so tests can assert without a public "getContext" API. */
  get values(): ContextKeyValues {
    return this._values;
  }

  private refresh(): void {
    this._values = computeContextKeyValues(this.gitIntegration, this.selection);
    void vscode.commands.executeCommand('setContext', CONTEXT_KEYS.gitAvailable, this._values.gitAvailable);
    void vscode.commands.executeCommand('setContext', CONTEXT_KEYS.hasWorktrees, this._values.hasWorktrees);
    void vscode.commands.executeCommand('setContext', CONTEXT_KEYS.visible, this._values.visible);
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
