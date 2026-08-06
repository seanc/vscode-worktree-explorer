import * as assert from 'assert';
import * as vscode from 'vscode';
import { SelectionCoordinator } from '../../src/selection';
import type { GitIntegrationSource } from '../../src/selection';
import type { WorktreeDescriptor } from '../../src/common/types';
import { descriptor } from './fixtures';

class FakeGitIntegration implements GitIntegrationSource {
  isAvailable = true;

  private worktrees: WorktreeDescriptor[] = [];
  private selected = new Set<string>();

  private readonly selectionEmitter = new vscode.EventEmitter<void>();
  private readonly worktreesEmitter = new vscode.EventEmitter<void>();
  private readonly availabilityEmitter = new vscode.EventEmitter<boolean>();

  readonly onDidChangeRepositorySelection = this.selectionEmitter.event;
  readonly onDidChangeWorktrees = this.worktreesEmitter.event;
  readonly onDidChangeAvailability = this.availabilityEmitter.event;

  listWorktrees(): WorktreeDescriptor[] {
    // Mirrors the real GitIntegrationService: no repositories are reported while unavailable.
    return this.isAvailable ? this.worktrees : [];
  }

  isRepositorySelected(uri: vscode.Uri): boolean {
    return this.selected.has(uri.toString());
  }

  /** Replaces the discovered worktree set without firing a selection-change event. */
  setWorktrees(worktrees: WorktreeDescriptor[]): void {
    this.worktrees = worktrees;
    this.worktreesEmitter.fire();
  }

  /** Simulates a repository's `ui.selected` becoming true (an SCM selection change event). */
  select(uri: vscode.Uri): void {
    this.selected.add(uri.toString());
    this.selectionEmitter.fire();
  }

  /** Simulates several repositories becoming selected in the same transition batch (e.g. all
   *  already selected at discovery time, with no prior epoch history) — a single event, not one
   *  per URI, so a SelectionCoordinator observing it sees them all as "newly selected" together. */
  selectMultiple(uris: vscode.Uri[]): void {
    for (const uri of uris) {
      this.selected.add(uri.toString());
    }
    this.selectionEmitter.fire();
  }

  /** Simulates a repository's `ui.selected` becoming false (an SCM selection change event). */
  deselect(uri: vscode.Uri): void {
    this.selected.delete(uri.toString());
    this.selectionEmitter.fire();
  }

  setAvailable(available: boolean): void {
    this.isAvailable = available;
    this.availabilityEmitter.fire(available);
  }
}

suite('SelectionCoordinator', () => {
  let git: FakeGitIntegration;
  let coordinator: SelectionCoordinator;

  setup(() => {
    git = new FakeGitIntegration();
  });

  teardown(() => {
    coordinator?.dispose();
  });

  test('AC-01: selecting a linked worktree via SCM makes it active', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    git.setWorktrees([main, linked]);
    coordinator = new SelectionCoordinator(git);

    git.select(linked.rootUri);

    assert.strictEqual(coordinator.snapshot.activeWorktreeUri?.toString(), linked.rootUri.toString());
    assert.strictEqual(coordinator.snapshot.activeSource, 'scm');
  });

  test('AC-02: selecting only the main repository with no prior history resolves to no active worktree', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    git.setWorktrees([main, linked]);
    coordinator = new SelectionCoordinator(git);

    git.select(main.rootUri);

    // No worktree has ever been active in this session, so there's nothing to fall back to yet
    // (the extension's startup restore()/first-worktree fallback, not SelectionCoordinator's own
    // resolve(), is what claims the slot in that case — see extension.ts).
    assert.strictEqual(coordinator.snapshot.activeWorktreeUri, undefined);
    assert.strictEqual(coordinator.snapshot.activeSource, undefined);
  });

  test('selecting the main repository after a worktree was SCM-active keeps showing that worktree', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    git.setWorktrees([main, linked]);
    coordinator = new SelectionCoordinator(git);

    git.select(linked.rootUri);
    assert.strictEqual(coordinator.snapshot.activeWorktreeUri?.toString(), linked.rootUri.toString());

    git.deselect(linked.rootUri);
    git.select(main.rootUri);

    assert.strictEqual(coordinator.snapshot.activeWorktreeUri?.toString(), linked.rootUri.toString());
  });

  test('manual pick then selecting the main repository falls back to the manually-picked worktree', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    const other = descriptor('/repo-other-wt', false);
    git.setWorktrees([main, linked, other]);
    coordinator = new SelectionCoordinator(git);

    coordinator.selectManually(linked.rootUri);
    assert.strictEqual(coordinator.snapshot.activeSource, 'manual');

    // A real SCM change clears the manual override (rule 1), but since nothing linked is now
    // SCM-selected either, the manually-picked worktree is still the "last known" one and wins.
    git.select(main.rootUri);

    assert.strictEqual(coordinator.snapshot.activeWorktreeUri?.toString(), linked.rootUri.toString());
    assert.strictEqual(coordinator.snapshot.activeSource, 'restored');
  });

  test('a removed worktree is not resurrected as the fallback after root is selected', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    git.setWorktrees([main, linked]);
    coordinator = new SelectionCoordinator(git);

    git.select(linked.rootUri);
    git.deselect(linked.rootUri);
    git.setWorktrees([main]); // the linked worktree disappears entirely

    assert.strictEqual(coordinator.snapshot.activeWorktreeUri, undefined);
  });

  test('AC-03/§9.6: among multiple SCM-selected linked worktrees, the most recently selected wins', () => {
    const a = descriptor('/repo-a', false);
    const b = descriptor('/repo-b', false);
    git.setWorktrees([descriptor('/repo', true), a, b]);
    coordinator = new SelectionCoordinator(git);

    git.select(a.rootUri);
    assert.strictEqual(coordinator.snapshot.activeWorktreeUri?.toString(), a.rootUri.toString());

    git.select(b.rootUri);
    assert.strictEqual(coordinator.snapshot.activeWorktreeUri?.toString(), b.rootUri.toString(), 'later selection should win');

    // a is still selected too, but its epoch is older than b's.
    git.deselect(b.rootUri);
    git.select(b.rootUri);
    assert.strictEqual(coordinator.snapshot.activeWorktreeUri?.toString(), b.rootUri.toString());
  });

  test('§9.6 deterministic fallback: several worktrees selected together with no prior epoch history resolve the same way every time', () => {
    const a = descriptor('/repo-a', false);
    const b = descriptor('/repo-b', false);
    const c = descriptor('/repo-c', false);
    git.setWorktrees([descriptor('/repo', true), a, b, c]);
    coordinator = new SelectionCoordinator(git);
    // All three become selected in the *same* transition batch — none has prior selection
    // history, so nothing but a deterministic tiebreak (Git API repository order, PRD §9.6 step 1)
    // distinguishes them.
    git.selectMultiple([a.rootUri, b.rootUri, c.rootUri]);
    const firstResult = coordinator.snapshot.activeWorktreeUri?.toString();
    assert.ok(firstResult, 'a winner should be resolved');
    coordinator.dispose();

    // A second, independent coordinator built against the identical (already-selected) fake state
    // must resolve to the identical winner — proving the resolution has no hidden randomness
    // (e.g. Map iteration order) and is reproducible.
    coordinator = new SelectionCoordinator(git);
    assert.strictEqual(coordinator.snapshot.activeWorktreeUri?.toString(), firstResult);
  });

  test('§9.7: main and a linked worktree selected together keeps the linked worktree visible', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    git.setWorktrees([main, linked]);
    coordinator = new SelectionCoordinator(git);

    git.select(linked.rootUri);
    git.select(main.rootUri);

    assert.strictEqual(coordinator.snapshot.activeWorktreeUri?.toString(), linked.rootUri.toString());
  });

  test('AC-04/§9.8: manual override survives an unrelated worktree-list change but not an SCM change', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    const other = descriptor('/repo-other-wt', false);
    git.setWorktrees([main, linked, other]);
    coordinator = new SelectionCoordinator(git);

    coordinator.selectManually(linked.rootUri);
    assert.strictEqual(coordinator.snapshot.activeSource, 'manual');

    // Worktree list churn (not a selection change) must not clear the manual choice.
    git.setWorktrees([main, linked, other]);
    assert.strictEqual(coordinator.snapshot.activeWorktreeUri?.toString(), linked.rootUri.toString());
    assert.strictEqual(coordinator.snapshot.activeSource, 'manual');

    // An actual SCM selection change clears manual override; nothing is SCM-selected here, so
    // the view hides.
    git.select(other.rootUri);
    git.deselect(other.rootUri);
    assert.notStrictEqual(coordinator.snapshot.activeSource, 'manual');
  });

  test('a new SCM selection clears manual override and wins', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    const other = descriptor('/repo-other-wt', false);
    git.setWorktrees([main, linked, other]);
    coordinator = new SelectionCoordinator(git);

    coordinator.selectManually(linked.rootUri);
    git.select(other.rootUri);

    assert.strictEqual(coordinator.snapshot.activeWorktreeUri?.toString(), other.rootUri.toString());
    assert.strictEqual(coordinator.snapshot.activeSource, 'scm');
  });

  test('AC-14: a removed active worktree is cleared', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    git.setWorktrees([main, linked]);
    coordinator = new SelectionCoordinator(git);
    git.select(linked.rootUri);
    assert.strictEqual(coordinator.snapshot.activeWorktreeUri?.toString(), linked.rootUri.toString());

    git.setWorktrees([main]);

    assert.strictEqual(coordinator.snapshot.activeWorktreeUri, undefined);
  });

  test('§9.10/§25: onWorktreeRemoved fires with the URI of a worktree that disappears while active', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    git.setWorktrees([main, linked]);
    coordinator = new SelectionCoordinator(git);
    git.select(linked.rootUri);

    const removed: string[] = [];
    coordinator.onWorktreeRemoved((uri) => removed.push(uri.toString()));
    git.setWorktrees([main]);

    assert.deepStrictEqual(removed, [linked.rootUri.toString()]);
  });

  test('onWorktreeRemoved does not fire for an ordinary hide (main-only selected)', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    git.setWorktrees([main, linked]);
    coordinator = new SelectionCoordinator(git);
    git.select(linked.rootUri);

    const removed: string[] = [];
    coordinator.onWorktreeRemoved((uri) => removed.push(uri.toString()));
    git.select(main.rootUri);

    assert.deepStrictEqual(removed, []);
  });

  test('onWorktreeRemoved does not fire for a manual-override clear (still a valid worktree)', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    const other = descriptor('/repo-other-wt', false);
    git.setWorktrees([main, linked, other]);
    coordinator = new SelectionCoordinator(git);
    coordinator.selectManually(linked.rootUri);

    const removed: string[] = [];
    coordinator.onWorktreeRemoved((uri) => removed.push(uri.toString()));
    git.select(other.rootUri);

    assert.deepStrictEqual(removed, []);
  });

  test('root generation increments only when the active root actually changes', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    git.setWorktrees([main, linked]);
    coordinator = new SelectionCoordinator(git);
    const initialGeneration = coordinator.snapshot.rootGeneration;

    git.select(linked.rootUri);
    const afterSelect = coordinator.snapshot.rootGeneration;
    assert.strictEqual(afterSelect, initialGeneration + 1);

    // An unrelated worktree-list refresh that doesn't change the outcome must not bump it again.
    git.setWorktrees([main, linked]);
    assert.strictEqual(coordinator.snapshot.rootGeneration, afterSelect);
  });

  test('Git becoming unavailable clears the active selection (feeds AC-16)', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    git.setWorktrees([main, linked]);
    coordinator = new SelectionCoordinator(git);
    git.select(linked.rootUri);
    assert.strictEqual(coordinator.snapshot.activeWorktreeUri?.toString(), linked.rootUri.toString());

    git.setAvailable(false);

    assert.strictEqual(coordinator.snapshot.activeWorktreeUri, undefined);
  });

  test('restore() seeds the initial selection only when nothing has resolved yet', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    git.setWorktrees([main, linked]);
    coordinator = new SelectionCoordinator(git);

    coordinator.restore(linked.rootUri);

    assert.strictEqual(coordinator.snapshot.activeWorktreeUri?.toString(), linked.rootUri.toString());
    assert.strictEqual(coordinator.snapshot.activeSource, 'restored');
  });

  test('restore() is a no-op once a live selection has already resolved', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    const other = descriptor('/repo-other-wt', false);
    git.setWorktrees([main, linked, other]);
    coordinator = new SelectionCoordinator(git);
    git.select(linked.rootUri);

    coordinator.restore(other.rootUri);

    assert.strictEqual(coordinator.snapshot.activeWorktreeUri?.toString(), linked.rootUri.toString());
    assert.strictEqual(coordinator.snapshot.activeSource, 'scm');
  });

  test('restore() ignores a worktree that no longer exists', () => {
    const main = descriptor('/repo', true);
    git.setWorktrees([main]);
    coordinator = new SelectionCoordinator(git);

    coordinator.restore(vscode.Uri.file('/gone-wt'));

    assert.strictEqual(coordinator.snapshot.activeWorktreeUri, undefined);
  });
});

suite('SelectionCoordinator followScmSelection=false (PRD §19.1)', () => {
  let git: FakeGitIntegration;
  let coordinator: SelectionCoordinator;

  setup(async () => {
    git = new FakeGitIntegration();
    await vscode.workspace.getConfiguration('worktreeExplorer').update('followScmSelection', false, vscode.ConfigurationTarget.Global);
  });

  teardown(async () => {
    coordinator?.dispose();
    await vscode.workspace.getConfiguration('worktreeExplorer').update('followScmSelection', undefined, vscode.ConfigurationTarget.Global);
  });

  test('live SCM selection does not switch the tree', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    git.setWorktrees([main, linked]);
    coordinator = new SelectionCoordinator(git);

    git.select(linked.rootUri);

    assert.strictEqual(coordinator.snapshot.activeWorktreeUri, undefined);
  });

  test('manual selection still works', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    git.setWorktrees([main, linked]);
    coordinator = new SelectionCoordinator(git);

    coordinator.selectManually(linked.rootUri);

    assert.strictEqual(coordinator.snapshot.activeWorktreeUri?.toString(), linked.rootUri.toString());
    assert.strictEqual(coordinator.snapshot.activeSource, 'manual');
  });

  test('an invalid active root is still cleared even though SCM is ignored', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    git.setWorktrees([main, linked]);
    coordinator = new SelectionCoordinator(git);
    coordinator.selectManually(linked.rootUri);

    git.setWorktrees([main]);

    assert.strictEqual(coordinator.snapshot.activeWorktreeUri, undefined);
  });
});
