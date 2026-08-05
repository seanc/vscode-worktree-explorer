import * as vscode from 'vscode';
import type { ActiveSelectionSource, SelectionSnapshot } from '../selection';
import type { GitIntegrationService } from '../git';

const STORAGE_KEY = 'worktreeExplorer.persistedSelection';

export interface PersistedSelection {
  readonly lastActiveWorktreeUri?: string;
  readonly lastManualWorktreeUri?: string;
  readonly activeSource?: ActiveSelectionSource;
}

/** Narrowed to just what pruning needs, so tests can pass a fake without a live GitIntegrationService. */
export type PersistenceGitSource = Pick<GitIntegrationService, 'listWorktrees'>;

/**
 * PersistenceService (PRD §17.1, §15.4): stores per-workspace valid selection state via
 * `ExtensionContext.workspaceState` and prunes stale entries (FR-050/FR-051). Selection epochs
 * are never persisted (FR-052) — PersistedSelection's shape has no field for them at all.
 */
export class PersistenceService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly memento: vscode.Memento,
    private readonly gitIntegration: PersistenceGitSource,
    selection: { readonly onDidChangeSelection: vscode.Event<SelectionSnapshot> }
  ) {
    this.disposables.push(selection.onDidChangeSelection((snapshot) => this.persist(snapshot)));
  }

  load(): PersistedSelection | undefined {
    return this.memento.get<PersistedSelection>(STORAGE_KEY);
  }

  private persist(snapshot: SelectionSnapshot): void {
    if (!snapshot.activeWorktreeUri) {
      // PRD §9.4: hiding the view (e.g. only the main repository selected) does not clear the
      // user's previous worktree history.
      return;
    }
    const activeUriString = snapshot.activeWorktreeUri.toString();
    const previous = this.load();
    const next: PersistedSelection = {
      lastActiveWorktreeUri: activeUriString,
      activeSource: snapshot.activeSource,
      lastManualWorktreeUri: snapshot.activeSource === 'manual' ? activeUriString : this.pruneIfInvalid(previous?.lastManualWorktreeUri)
    };
    void this.memento.update(STORAGE_KEY, next);
  }

  /**
   * FR-051: drops a persisted URI once it's checked against a live discovery result and found
   * invalid. Checked opportunistically alongside a real selection change (when discovery has
   * demonstrably run), not at raw startup — GitIntegrationService's own discovery for newly
   * opened worktrees is asynchronous (see #3's finding), so validating too early risks a false
   * negative that prunes a worktree that merely hasn't been discovered yet. This means a stale
   * entry unrelated to the current selection can persist for the rest of a session with no
   * further selection changes; full eager pruning is left to #13 if a real need surfaces.
   */
  private pruneIfInvalid(uriString: string | undefined): string | undefined {
    if (!uriString) {
      return undefined;
    }
    const stillValid = this.gitIntegration.listWorktrees().some((w) => !w.isMain && w.rootUri.toString() === uriString);
    return stillValid ? uriString : undefined;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

/** PRD §19.2: "If true, restore the last valid worktree when no current linked-worktree SCM
 *  selection takes precedence." Default true. */
export function isRestoreLastSelectionEnabled(): boolean {
  return vscode.workspace.getConfiguration('worktreeExplorer').get<boolean>('restoreLastSelection', true);
}
