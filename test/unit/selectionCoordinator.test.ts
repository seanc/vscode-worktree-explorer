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

  test('AC-02: selecting only the main repository hides the view', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    git.setWorktrees([main, linked]);
    coordinator = new SelectionCoordinator(git);

    git.select(main.rootUri);

    assert.strictEqual(coordinator.snapshot.activeWorktreeUri, undefined);
    assert.strictEqual(coordinator.snapshot.activeSource, undefined);
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
