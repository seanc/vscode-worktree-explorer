import * as assert from 'assert';
import type { SelectionSnapshot } from '../../src/selection/selectionCoordinator';
import { computeContextKeyValues } from '../../src/selection';
import { descriptor } from './fixtures';

interface FakeGitIntegration {
  isAvailable: boolean;
  listWorktrees: () => ReturnType<typeof descriptor>[];
}

function fakeGitIntegration(available: boolean, worktrees: ReturnType<typeof descriptor>[]): FakeGitIntegration {
  return { isAvailable: available, listWorktrees: () => worktrees };
}

function fakeSelection(snapshot: Partial<SelectionSnapshot> = {}): { snapshot: SelectionSnapshot } {
  return { snapshot: { activeWorktreeUri: undefined, activeSource: undefined, rootGeneration: 0, ...snapshot } };
}

suite('computeContextKeyValues', () => {
  test('Git unavailable: everything false (feeds AC-16)', () => {
    const values = computeContextKeyValues(fakeGitIntegration(false, [descriptor('/repo-wt', false)]), fakeSelection());
    assert.deepStrictEqual(values, { gitAvailable: false, hasWorktrees: false, visible: false });
  });

  test('AC-02: only the main repository present, nothing selectable as a worktree', () => {
    const main = descriptor('/repo', true);
    const values = computeContextKeyValues(fakeGitIntegration(true, [main]), fakeSelection());
    assert.deepStrictEqual(values, { gitAvailable: true, hasWorktrees: false, visible: false });
  });

  test('a linked worktree exists but SelectionCoordinator has not activated it: hidden', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    const values = computeContextKeyValues(fakeGitIntegration(true, [main, linked]), fakeSelection());
    assert.deepStrictEqual(values, { gitAvailable: true, hasWorktrees: true, visible: false });
  });

  test('AC-01: SelectionCoordinator resolving an active worktree makes the view visible', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    const values = computeContextKeyValues(
      fakeGitIntegration(true, [main, linked]),
      fakeSelection({ activeWorktreeUri: linked.rootUri, activeSource: 'scm' })
    );
    assert.deepStrictEqual(values, { gitAvailable: true, hasWorktrees: true, visible: true });
  });
});
