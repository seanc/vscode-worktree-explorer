import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  pickBaseBranch,
  isPlausibleBranchName,
  toChangeStatus,
  normalizeChanges,
  compareRepositoryWithBase,
  parseBranchOrigin,
  readBranchOrigin,
  baseLabel,
  type ComparableRepository
} from '../../src/git/baseComparison';
import { Status, type Change } from '../../src/git/gitExtensionApi';

function change(path: string, status: Status): Change {
  const uri = vscode.Uri.file(path);
  return { uri, originalUri: uri, renameUri: undefined, status };
}

interface FakeOptions {
  branches?: string[];
  mergeBase?: string;
  /** Per-ref merge bases; a ref missing here falls back to `mergeBase`. `null` → the ref is unknown. */
  mergeBases?: Record<string, string | null>;
  baseMessages?: string[];
  diff?: Change[];
  ahead?: number;
  workingTree?: Change[];
  index?: Change[];
  untracked?: Change[];
}

function fakeRepository(options: FakeOptions): ComparableRepository & { ranges: string[] } {
  const ranges: string[] = [];
  return {
    ranges,
    state: {
      mergeChanges: [],
      indexChanges: options.index ?? [],
      workingTreeChanges: options.workingTree ?? [],
      untrackedChanges: options.untracked ?? []
    },
    getBranch: async (name) => {
      if (!(options.branches ?? []).includes(name)) {
        throw new Error(`No such branch: ${name}`);
      }
      return { name };
    },
    getMergeBase: async (ref) => {
      const known = options.mergeBases?.[ref];
      if (known === null) {
        throw new Error(`fatal: Not a valid object name ${ref}`);
      }
      return known ?? options.mergeBase;
    },
    diffWith: async () => options.diff ?? [],
    log: async (logOptions) => {
      const range = logOptions?.range ?? '';
      ranges.push(range);
      if (range.endsWith('..HEAD')) {
        return Array.from({ length: options.ahead ?? 0 }, (_, i) => ({ hash: `c${i}`, message: `work ${i}` }));
      }
      return (options.baseMessages ?? []).map((message, i) => ({ hash: `b${i}`, message }));
    }
  };
}

suite('baseComparison (#18)', () => {
  test('detects develop, then main, then master when no base branch is configured', async () => {
    assert.strictEqual(await pickBaseBranch(fakeRepository({ branches: ['main', 'develop'] }), ''), 'develop');
    assert.strictEqual(await pickBaseBranch(fakeRepository({ branches: ['main'] }), ''), 'main');
    assert.strictEqual(await pickBaseBranch(fakeRepository({ branches: ['master'] }), ''), 'master');
    assert.strictEqual(await pickBaseBranch(fakeRepository({ branches: ['trunk'] }), ''), undefined);
  });

  test('uses only the configured base branch when one is set', async () => {
    assert.strictEqual(await pickBaseBranch(fakeRepository({ branches: ['develop', 'release/2.0'] }), 'release/2.0'), 'release/2.0');
    assert.strictEqual(await pickBaseBranch(fakeRepository({ branches: ['develop'] }), 'release/2.0'), undefined);
  });

  test('rejects configured names that are options or revision expressions', () => {
    assert.ok(isPlausibleBranchName('develop'));
    assert.ok(isPlausibleBranchName('release/2.0'));
    assert.ok(!isPlausibleBranchName('--output=/tmp/x'));
    assert.ok(!isPlausibleBranchName('main..HEAD'));
    assert.ok(!isPlausibleBranchName('HEAD@{1}'));
    assert.ok(!isPlausibleBranchName(''));
  });

  test('maps Git statuses to change statuses and skips ignored files', () => {
    assert.strictEqual(toChangeStatus(Status.MODIFIED), 'modified');
    assert.strictEqual(toChangeStatus(Status.INDEX_ADDED), 'added');
    assert.strictEqual(toChangeStatus(Status.DELETED), 'deleted');
    assert.strictEqual(toChangeStatus(Status.INDEX_RENAMED), 'renamed');
    assert.strictEqual(toChangeStatus(Status.UNTRACKED), 'untracked');
    assert.strictEqual(toChangeStatus(Status.BOTH_MODIFIED), 'conflict');
    assert.strictEqual(toChangeStatus(Status.IGNORED), undefined);
  });

  test('normalizeChanges de-duplicates by file, later lists winning, sorted by path', () => {
    const result = normalizeChanges([change('/wt/b.txt', Status.MODIFIED), change('/wt/a.txt', Status.INDEX_ADDED)], [change('/wt/b.txt', Status.DELETED)]);
    assert.deepStrictEqual(
      result.map((c) => [c.uri.path, c.status]),
      [
        ['/wt/a.txt', 'added'],
        ['/wt/b.txt', 'deleted']
      ]
    );
  });

  test('compares from the merge base: ahead count, committed + uncommitted + untracked changes', async () => {
    const repository = fakeRepository({
      branches: ['develop'],
      mergeBase: 'abc123',
      ahead: 2,
      diff: [change('/wt/app/Job.php', Status.MODIFIED), change('/wt/tests/JobTest.php', Status.INDEX_ADDED)],
      workingTree: [change('/wt/app/Job.php', Status.MODIFIED), change('/wt/scratch.txt', Status.UNTRACKED)]
    });

    const comparison = await compareRepositoryWithBase(repository, '');

    assert.ok(comparison);
    assert.strictEqual(comparison.baseRef, 'develop');
    assert.strictEqual(comparison.mergeBase, 'abc123');
    assert.strictEqual(comparison.ahead, 2);
    assert.strictEqual(comparison.baseSource, 'default');
    assert.deepStrictEqual(repository.ranges.sort(), ['abc123..HEAD', 'abc123..develop']);
    assert.deepStrictEqual(
      comparison.changedVsBase.map((c) => [c.uri.path, c.status]),
      [
        ['/wt/app/Job.php', 'modified'],
        ['/wt/scratch.txt', 'untracked'],
        ['/wt/tests/JobTest.php', 'added']
      ]
    );
    assert.deepStrictEqual(
      comparison.uncommitted.map((c) => c.uri.path),
      ['/wt/app/Job.php', '/wt/scratch.txt']
    );
  });

  suite('#23 branch origin', () => {
    const line = (from: string) => `0000000000000000000000000000000000000000 abc Dev <dev@example.com> 1700000000 +0000\tbranch: Created from ${from}\nnext entry\n`;

    test('reads the branch a branch was created from', () => {
      assert.strictEqual(parseBranchOrigin(line('feature/ab/PROJ-1290-dashboard-redesign')), 'feature/ab/PROJ-1290-dashboard-redesign');
      assert.strictEqual(parseBranchOrigin(line('origin/develop')), 'origin/develop');
      assert.strictEqual(parseBranchOrigin(line('refs/remotes/origin/develop')), 'origin/develop');
    });

    test('ignores HEAD, commit ids, revision expressions and other first lines', () => {
      assert.strictEqual(parseBranchOrigin(line('HEAD')), undefined);
      assert.strictEqual(parseBranchOrigin(line('2b9897943de71eb7c4b95c4ec16cb3616914757e')), undefined);
      assert.strictEqual(parseBranchOrigin(line('2b9897943de71eb7c4b95c4ec16cb3616914757e^{commit}')), undefined);
      assert.strictEqual(parseBranchOrigin(line('main~2')), undefined);
      assert.strictEqual(parseBranchOrigin(line('../../etc')), undefined);
      assert.strictEqual(parseBranchOrigin('abc def\tcommit: something\n'), undefined);
      assert.strictEqual(parseBranchOrigin(''), undefined);
    });

    test('readBranchOrigin refuses branch names that could escape the logs folder', async () => {
      const root = vscode.Uri.file('/nonexistent-repo');
      assert.strictEqual(await readBranchOrigin(root, '../../secrets'), undefined);
      assert.strictEqual(await readBranchOrigin(root, undefined), undefined);
      assert.strictEqual(await readBranchOrigin(root, 'feature/x'), undefined, 'missing file is not an error');
    });

    test('prefers the created-from branch when it still resolves', async () => {
      const repository = fakeRepository({ branches: ['develop'], mergeBases: { 'feature/cc/PROJ-1-x': 'stack1', develop: 'dev1' } });
      const comparison = await compareRepositoryWithBase(repository, '', 'feature/cc/PROJ-1-x');
      assert.strictEqual(comparison?.baseRef, 'feature/cc/PROJ-1-x');
      assert.strictEqual(comparison?.baseSource, 'created-from');
      assert.strictEqual(comparison?.mergeBase, 'stack1');
    });

    test('falls back to the setting, then the defaults, when the created-from branch is gone', async () => {
      const gone = { 'feature/deleted': null };
      const viaDefault = await compareRepositoryWithBase(fakeRepository({ branches: ['develop'], mergeBase: 'd', mergeBases: gone }), '', 'feature/deleted');
      assert.strictEqual(viaDefault?.baseRef, 'develop');
      assert.strictEqual(viaDefault?.baseSource, 'default');
      const viaSetting = await compareRepositoryWithBase(fakeRepository({ branches: ['release'], mergeBase: 'r', mergeBases: gone }), 'release', 'feature/deleted');
      assert.strictEqual(viaSetting?.baseRef, 'release');
      assert.strictEqual(viaSetting?.baseSource, 'setting');
    });

    test('baseLabel drops a leading origin/', () => {
      assert.strictEqual(baseLabel('origin/develop'), 'develop');
      assert.strictEqual(baseLabel('feature/x'), 'feature/x');
    });
  });

  test('#24: returns commit messages that landed on the base since the split', async () => {
    const comparison = await compareRepositoryWithBase(
      fakeRepository({ branches: ['develop'], mergeBase: 'm', baseMessages: ['PROJ-9 Fix things (#12)', 'Merge branch x'] }),
      ''
    );
    assert.deepStrictEqual(comparison?.baseCommitMessages, ['PROJ-9 Fix things (#12)', 'Merge branch x']);
  });

  test('is undefined with no base branch or no common history', async () => {
    assert.strictEqual(await compareRepositoryWithBase(fakeRepository({ branches: [] }), ''), undefined);
    assert.strictEqual(await compareRepositoryWithBase(fakeRepository({ branches: ['main'], mergeBase: undefined }), ''), undefined);
  });
});
