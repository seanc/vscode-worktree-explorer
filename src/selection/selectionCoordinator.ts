import * as vscode from 'vscode';
import type { GitIntegrationService } from '../git';
import type { WorktreeDescriptor } from '../common/types';

export type ActiveSelectionSource = 'scm' | 'manual' | 'restored';

/** PRD §19.1: "When false: SCM selection does not switch the tree; selection is manual/restored
 *  only; invalid active roots are still cleared." Default true. */
export function isFollowScmSelectionEnabled(): boolean {
  return vscode.workspace.getConfiguration('worktreeExplorer').get<boolean>('followScmSelection', true);
}

interface SelectionState {
  activeWorktreeUri: vscode.Uri | undefined;
  activeSource: ActiveSelectionSource | undefined;
  selectionEpoch: number;
  scmSelected: Map<string, boolean>;
  lastSelectedEpoch: Map<string, number>;
  rootGeneration: number;
}

export interface SelectionSnapshot {
  readonly activeWorktreeUri: vscode.Uri | undefined;
  readonly activeSource: ActiveSelectionSource | undefined;
  readonly rootGeneration: number;
}

/** Narrow surface SelectionCoordinator needs, so it is unit-testable against a fake without a
 *  live vscode.git extension (see PRD §28.1's epoch/override/resolution unit-test list). */
export type GitIntegrationSource = Pick<
  GitIntegrationService,
  'isAvailable' | 'listWorktrees' | 'isRepositorySelected' | 'onDidChangeRepositorySelection' | 'onDidChangeWorktrees' | 'onDidChangeAvailability'
>;

/**
 * Production selection state machine (PRD §15). Resolves which linked worktree, if any, should be
 * active from three inputs: live SCM "selected" transitions (epoch-tracked, so the most recently
 * selected worktree wins among several — §15.2/§15.3), manual override (set by #5's Quick Pick via
 * selectManually), and restored state (#12's PersistenceService calls restore() once at startup).
 * Supersedes the #3 feasibility-quality ContextKeyController resolution.
 */
export class SelectionCoordinator implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly state: SelectionState = {
    activeWorktreeUri: undefined,
    activeSource: undefined,
    selectionEpoch: 0,
    scmSelected: new Map(),
    lastSelectedEpoch: new Map(),
    rootGeneration: 0
  };

  private readonly _onDidChangeSelection = new vscode.EventEmitter<SelectionSnapshot>();
  /** Fires whenever the resolved active worktree, source, or root generation changes. */
  readonly onDidChangeSelection = this._onDidChangeSelection.event;

  private readonly _onWorktreeRemoved = new vscode.EventEmitter<vscode.Uri>();
  /** AC-14/§9.10/§25 "Active worktree removed": fires with the URI that was active immediately
   *  before it stopped being discovered, so a listener can notify the user once. */
  readonly onWorktreeRemoved = this._onWorktreeRemoved.event;

  constructor(private readonly gitIntegration: GitIntegrationSource) {
    this.disposables.push(
      gitIntegration.onDidChangeRepositorySelection(() => this.handleScmSelectionChanged()),
      gitIntegration.onDidChangeWorktrees(() => this.handleWorktreesChanged()),
      gitIntegration.onDidChangeAvailability(() => this.handleWorktreesChanged())
    );
    // Activation sequence (PRD §15.4, steps 1-3): discover -> inspect SCM selection -> prefer
    // current SCM-selected linked worktrees -> else hide. Step 4 (restore last valid selection)
    // is #12's restore(), called by extension.ts after construction; it only takes effect while
    // activeSource is still undefined (see the guard below).
    this.handleScmSelectionChanged();
  }

  get snapshot(): SelectionSnapshot {
    return {
      activeWorktreeUri: this.state.activeWorktreeUri,
      activeSource: this.state.activeSource,
      rootGeneration: this.state.rootGeneration
    };
  }

  /** #12 hook: seed a restored selection before any live SCM resolution has claimed the slot. */
  restore(uri: vscode.Uri): void {
    if (this.state.activeSource !== undefined) {
      return;
    }
    if (!this.isValidWorktree(uri)) {
      return;
    }
    this.setActive(uri, 'restored');
  }

  /** #5 hook: the user picked a worktree from the Quick Pick. Does not touch SCM selection. */
  selectManually(uri: vscode.Uri): void {
    if (!this.isValidWorktree(uri)) {
      return;
    }
    this.setActive(uri, 'manual');
  }

  private linkedWorktrees(): WorktreeDescriptor[] {
    return this.gitIntegration.listWorktrees().filter((w) => !w.isMain);
  }

  private isValidWorktree(uri: vscode.Uri): boolean {
    const key = uri.toString();
    return this.linkedWorktrees().some((w) => w.rootUri.toString() === key);
  }

  /** PRD §15.2: run for every repository UI ("selected") change. */
  private handleScmSelectionChanged(): void {
    const linked = this.linkedWorktrees();
    const previouslySelected = this.state.scmSelected;
    const currentlySelected = new Map<string, boolean>();

    for (const worktree of linked) {
      const key = worktree.rootUri.toString();
      const isSelected = this.gitIntegration.isRepositorySelected(worktree.rootUri);
      currentlySelected.set(key, isSelected);
      const wasSelected = previouslySelected.get(key) ?? false;
      if (isSelected && !wasSelected) {
        this.state.selectionEpoch += 1;
        this.state.lastSelectedEpoch.set(key, this.state.selectionEpoch);
      }
    }
    this.state.scmSelected = currentlySelected;

    if (!isFollowScmSelectionEnabled()) {
      // PRD §19.1: "SCM selection does not switch the tree; selection is manual/restored only;
      // invalid active roots are still cleared." Epoch bookkeeping above still runs (harmless,
      // and picks back up correctly if the setting is re-enabled later) — only resolution itself
      // ignores live SCM state.
      this.resolve(linked, { clearManualFirst: false, ignoreScmSelection: true });
      return;
    }

    this.resolve(linked, { clearManualFirst: true });
  }

  /** Worktree list or Git availability changed — not itself an SCM selection change. */
  private handleWorktreesChanged(): void {
    const linked = this.linkedWorktrees();
    this.pruneStaleEntries(linked);
    this.resolve(linked, { clearManualFirst: false });
  }

  /** PRD §15.3, applied as one ordered pass so every recompute goes through the same rules. */
  private resolve(linked: WorktreeDescriptor[], options: { clearManualFirst: boolean; ignoreScmSelection?: boolean }): void {
    let candidateUri = this.state.activeWorktreeUri;
    let candidateSource = this.state.activeSource;

    // Rule 1: a newly changed SCM selection clears manual override.
    if (options.clearManualFirst && candidateSource === 'manual') {
      candidateUri = undefined;
      candidateSource = undefined;
    }

    // §19.1 followScmSelection=false: live SCM state never drives resolution (rules 2/3 both
    // become no-ops below); manual/restored selections and rule 5's validity check still apply.
    const selectedLinked = options.ignoreScmSelection ? [] : linked.filter((w) => this.gitIntegration.isRepositorySelected(w.rootUri));
    if (selectedLinked.length > 0) {
      // Rule 2: one or more linked worktrees selected -> the greatest epoch wins.
      const winner = selectedLinked.reduce((best, candidate) => {
        const bestEpoch = this.state.lastSelectedEpoch.get(best.rootUri.toString()) ?? -1;
        const candidateEpoch = this.state.lastSelectedEpoch.get(candidate.rootUri.toString()) ?? -1;
        return candidateEpoch > bestEpoch ? candidate : best;
      });
      candidateUri = winner.rootUri;
      candidateSource = 'scm';
    } else {
      const mainSelected =
        !options.ignoreScmSelection &&
        this.gitIntegration.listWorktrees().some((w) => w.isMain && this.gitIntegration.isRepositorySelected(w.rootUri));
      if (mainSelected) {
        // Rule 3: no linked worktree selected and the main repository is selected -> hide.
        candidateUri = undefined;
        candidateSource = undefined;
      }
      // Rule 4 (else): SCM selection is empty/ambiguous. When this recompute was not itself an
      // SCM change, candidateUri/candidateSource are already the preserved current values —
      // nothing further to do. When it *was* an SCM change and the value was manual, rule 1
      // already cleared it above and nothing here re-claims the slot, matching §9.8 ("hide the
      // view if no linked worktree remains selected").
    }

    // Rule 5: an active root that no longer exists is cleared. Because rules 2-4 above only ever
    // produce a candidateUri that's either undefined or a member of `linked` by construction, the
    // only way this can trigger is when candidateUri is the *previous* active root, preserved by
    // rule 4 — i.e. this is always specifically "the previously active worktree is gone" (AC-14).
    if (candidateUri && !linked.some((w) => w.rootUri.toString() === candidateUri!.toString())) {
      this._onWorktreeRemoved.fire(candidateUri);
      candidateUri = undefined;
      candidateSource = undefined;
    }

    this.setActive(candidateUri, candidateSource);
  }

  private pruneStaleEntries(linked: WorktreeDescriptor[]): void {
    const validKeys = new Set(linked.map((w) => w.rootUri.toString()));
    for (const key of [...this.state.lastSelectedEpoch.keys()]) {
      if (!validKeys.has(key)) {
        this.state.lastSelectedEpoch.delete(key);
      }
    }
    for (const key of [...this.state.scmSelected.keys()]) {
      if (!validKeys.has(key)) {
        this.state.scmSelected.delete(key);
      }
    }
  }

  private setActive(uri: vscode.Uri | undefined, source: ActiveSelectionSource | undefined): void {
    const uriChanged = (this.state.activeWorktreeUri?.toString() ?? undefined) !== (uri?.toString() ?? undefined);
    const sourceChanged = this.state.activeSource !== source;
    if (!uriChanged && !sourceChanged) {
      // Found while building #7: without this guard, every recompute that resolves to the same
      // outcome (e.g. a worktrees-changed event that doesn't affect the winner) still fired
      // onDidChangeSelection, which would needlessly dispose/recreate #7's watcher and force a
      // full tree refresh on every no-op resolve.
      return;
    }
    this.state.activeWorktreeUri = uri;
    this.state.activeSource = source;
    if (uriChanged) {
      this.state.rootGeneration += 1;
    }
    this._onDidChangeSelection.fire(this.snapshot);
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this._onDidChangeSelection.dispose();
    this._onWorktreeRemoved.dispose();
  }
}
