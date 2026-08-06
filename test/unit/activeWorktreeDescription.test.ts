import * as assert from 'assert';
import { describeActiveWorktree } from '../../src/tree';
import { descriptor } from './fixtures';

suite('describeActiveWorktree', () => {
  test('undefined active root yields no description', () => {
    assert.strictEqual(describeActiveWorktree([descriptor('/repo-wt', false)], undefined), undefined);
  });

  test('PRD §9.2 format: "<branch-or-ref> · <folder-name>"', () => {
    const worktree = { ...descriptor('/repo-wt', false), ref: 'feature/payments' };
    assert.strictEqual(describeActiveWorktree([worktree], worktree.rootUri), 'feature/payments · repo-wt');
  });

  test('a detached worktree is described as "detached@<ref>"', () => {
    const worktree = { ...descriptor('/repo-wt', false), ref: 'a8cf231', isDetached: true };
    assert.strictEqual(describeActiveWorktree([worktree], worktree.rootUri), 'detached@a8cf231 · repo-wt');
  });

  test('an active root that is not in the discovered list yields no description', () => {
    const worktree = descriptor('/repo-wt', false);
    assert.strictEqual(describeActiveWorktree([worktree], descriptor('/gone', false).rootUri), undefined);
  });
});
