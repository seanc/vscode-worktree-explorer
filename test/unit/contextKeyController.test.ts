import * as assert from 'assert';
import { computeContextKeyValues } from '../../src/selection';
import { descriptor } from './fixtures';

interface FakeGitIntegration {
  isAvailable: boolean;
  listWorktrees: () => ReturnType<typeof descriptor>[];
}

function fakeGitIntegration(available: boolean, worktrees: ReturnType<typeof descriptor>[]): FakeGitIntegration {
  return { isAvailable: available, listWorktrees: () => worktrees };
}

suite('computeContextKeyValues', () => {
  test('Git unavailable: everything false (feeds AC-16)', () => {
    const values = computeContextKeyValues(fakeGitIntegration(false, [descriptor('/repo-wt', false)]));
    assert.deepStrictEqual(values, { gitAvailable: false, hasWorktrees: false, visible: false });
  });

  test('AC-02: only the main repository present, nothing selectable as a worktree', () => {
    const main = descriptor('/repo', true);
    const values = computeContextKeyValues(fakeGitIntegration(true, [main]));
    assert.deepStrictEqual(values, { gitAvailable: true, hasWorktrees: false, visible: false });
  });

  test('a linked worktree exists: visible regardless of what is currently active, since ' +
    'SelectionCoordinator always falls back to showing one (last-known or first) rather than nothing', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    const values = computeContextKeyValues(fakeGitIntegration(true, [main, linked]));
    assert.deepStrictEqual(values, { gitAvailable: true, hasWorktrees: true, visible: true });
  });
});
