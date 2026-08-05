import * as assert from 'assert';
import * as vscode from 'vscode';
import { computeContextKeyValues } from '../../src/selection';
import type { WorktreeDescriptor } from '../../src/common/types';

interface FakeGitIntegration {
  isAvailable: boolean;
  listWorktrees(): WorktreeDescriptor[];
  isRepositorySelected(rootUri: vscode.Uri): boolean;
}

function descriptor(path: string, isMain: boolean): WorktreeDescriptor {
  const uri = vscode.Uri.file(path);
  return { repositoryRoot: uri, rootUri: uri, displayName: path, isMain, isDetached: false };
}

function fakeGitIntegration(options: {
  available: boolean;
  worktrees: WorktreeDescriptor[];
  selected?: Set<string>;
}): FakeGitIntegration {
  return {
    isAvailable: options.available,
    listWorktrees: () => options.worktrees,
    isRepositorySelected: (uri) => options.selected?.has(uri.toString()) ?? false
  };
}

suite('computeContextKeyValues', () => {
  test('Git unavailable: everything false (feeds AC-16)', () => {
    const values = computeContextKeyValues(fakeGitIntegration({ available: false, worktrees: [descriptor('/repo-wt', false)] }));
    assert.deepStrictEqual(values, { gitAvailable: false, hasWorktrees: false, visible: false });
  });

  test('AC-02 feasibility: only the main repository present, nothing selectable as a worktree', () => {
    const main = descriptor('/repo', true);
    const values = computeContextKeyValues(fakeGitIntegration({ available: true, worktrees: [main] }));
    assert.deepStrictEqual(values, { gitAvailable: true, hasWorktrees: false, visible: false });
  });

  test('a linked worktree exists but is not SCM-selected: hidden', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    const values = computeContextKeyValues(fakeGitIntegration({ available: true, worktrees: [main, linked] }));
    assert.deepStrictEqual(values, { gitAvailable: true, hasWorktrees: true, visible: false });
  });

  test('AC-01 feasibility: a selected linked worktree makes the view visible', () => {
    const main = descriptor('/repo', true);
    const linked = descriptor('/repo-wt', false);
    const values = computeContextKeyValues(
      fakeGitIntegration({ available: true, worktrees: [main, linked], selected: new Set([linked.rootUri.toString()]) })
    );
    assert.deepStrictEqual(values, { gitAvailable: true, hasWorktrees: true, visible: true });
  });
});
