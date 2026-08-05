import * as vscode from 'vscode';

const DEFAULT_DEBOUNCE_MS = 200;

/**
 * PRD §17.1/§18: exactly one active-root filesystem watcher, debounced, disposed and replaced on
 * every root switch (AC-12). Requests a full-tree refresh for MVP — affected-parent refresh is a
 * deferred optimization (#15) if profiling shows it's needed.
 *
 * Finding: VS Code's public `FileSystemWatcher` API has no failure/error event, so there is no
 * reliable signal to detect "the underlying OS watcher stopped working" and show the §25 message
 * ("Automatic refresh is unavailable. Use Refresh to update the view.") from a real failure
 * condition. Manual Refresh (#6) is always available regardless, which is the PRD's own stated
 * fallback (§18: "retain manual Refresh as a fallback") — this class does not attempt to fabricate
 * a failure signal that doesn't exist.
 *
 * Finding: because PRD G-02 means the active root is never a workspace folder, this watcher is
 * always scoped outside the open workspace — and out-of-workspace watchers have observed
 * multi-second startup latency before they reliably deliver events (verified in
 * test/integration/git/watcherRefresh.test.ts), unlike in-workspace watching which responds in
 * well under a second. A change made in the first moments after switching roots can be missed by
 * the automatic refresh; browsing itself always reads live disk state regardless, and manual
 * Refresh covers the gap. Worth profiling in #15.
 *
 * Also observed: an out-of-workspace recursive watcher can occasionally deliver a straggling
 * duplicate event for the same change after the debounce window already fired, matching a known
 * upstream quirk (microsoft/vscode#163352). Harmless here — it costs one extra (still-cheap,
 * full-tree) refresh, not incorrect data.
 */
export class WorktreeWatcher implements vscode.Disposable {
  private fsWatcher: vscode.FileSystemWatcher | undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly _onDidChange = new vscode.EventEmitter<void>();
  /** Debounced signal that the active root's contents may have changed. */
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly debounceMs: number = DEFAULT_DEBOUNCE_MS) {}

  /** PRD §9.5/AC-12: disposes the previous watcher, if any, then creates a fresh one scoped to
   *  `uri` (or none, if `uri` is undefined — e.g. the view is hidden). */
  setActiveRoot(uri: vscode.Uri | undefined): void {
    this.disposeWatcher();
    if (!uri) {
      return;
    }
    const pattern = new vscode.RelativePattern(uri, '**/*');
    this.fsWatcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.fsWatcher.onDidCreate(() => this.scheduleRefresh());
    this.fsWatcher.onDidDelete(() => this.scheduleRefresh());
    this.fsWatcher.onDidChange(() => this.scheduleRefresh());
  }

  private scheduleRefresh(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      this._onDidChange.fire();
    }, this.debounceMs);
  }

  private disposeWatcher(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    this.fsWatcher?.dispose();
    this.fsWatcher = undefined;
  }

  dispose(): void {
    this.disposeWatcher();
    this._onDidChange.dispose();
  }
}
