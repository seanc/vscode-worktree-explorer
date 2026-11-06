import * as assert from 'assert';
import * as vscode from 'vscode';
import { detectCleanup, findMergeEvidence } from '../../src/ticket';
import type { BaseComparison } from '../../src/common/types';

function comparison(messages: string[], uncommitted = 0): BaseComparison {
  return {
    baseRef: 'develop',
    baseSource: 'created-from',
    mergeBase: 'm',
    ahead: 0,
    changedVsBase: [],
    uncommitted: Array.from({ length: uncommitted }, (_, i) => ({ uri: vscode.Uri.file(`/wt/f${i}`), status: 'modified' as const })),
    baseCommitMessages: messages
  };
}

suite('Ready to clean up (#24)', () => {
  test('a squash commit or merge commit that mentions the key counts as merged', () => {
    assert.strictEqual(findMergeEvidence('PROJ-3251', ['PROJ-3251 Remove the legacy newsletter opt-in (#412)']), 'PROJ-3251 Remove the legacy newsletter opt-in (#412)');
    assert.strictEqual(
      findMergeEvidence('PROJ-3251', ["Merge pull request #981 from org/task/jd/PROJ-3251-remove-newsletter\n\nbody"]),
      'Merge pull request #981 from org/task/jd/PROJ-3251-remove-newsletter'
    );
  });

  test('a different key that merely starts with the same digits does not match', () => {
    assert.strictEqual(findMergeEvidence('PROJ-3251', ['PROJ-32512 Something else', 'XPROJ-3251 nope', 'PROJ-3251a nope']), undefined);
  });

  test('merged with a clean worktree is ready; with uncommitted work it says so', () => {
    assert.deepStrictEqual(detectCleanup('PROJ-1', comparison(['PROJ-1 Done'])), { kind: 'merged', evidence: 'PROJ-1 Done' });
    assert.deepStrictEqual(detectCleanup('PROJ-1', comparison(['PROJ-1 Done'], 2)), { kind: 'mergedWithChanges', evidence: 'PROJ-1 Done', uncommitted: 2 });
  });

  test('nothing to clean up without a key, a comparison, or a mention', () => {
    assert.strictEqual(detectCleanup(undefined, comparison(['PROJ-1 Done'])), undefined);
    assert.strictEqual(detectCleanup('PROJ-1', undefined), undefined);
    assert.strictEqual(detectCleanup('PROJ-1', comparison(['PROJ-2 Other'])), undefined);
  });

  test('long evidence is truncated', () => {
    const evidence = findMergeEvidence('PROJ-1', [`PROJ-1 ${'x'.repeat(300)}`]);
    assert.ok(evidence && evidence.length === 120 && evidence.endsWith('…'));
  });
});
