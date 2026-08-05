import * as assert from 'assert';
import * as vscode from 'vscode';
import { listWorktreeDescriptors, type RepositorySnapshot } from '../../src/git/worktreeNormalization';

interface FakeRepositoryOptions {
  path: string;
  kind: 'repository' | 'submodule' | 'worktree';
  branch?: string;
  commit?: string;
  /** Only meaningful on a 'repository'-kind fake: the full `git worktree list` inventory. */
  worktreePaths?: string[];
}

function fakeRepository(options: FakeRepositoryOptions): RepositorySnapshot {
  return {
    rootUri: vscode.Uri.file(options.path),
    kind: options.kind,
    state: {
      HEAD:
        options.branch !== undefined || options.commit !== undefined
          ? { name: options.branch, commit: options.commit }
          : undefined,
      worktrees: (options.worktreePaths ?? []).map((path) => ({
        name: '',
        path: vscode.Uri.file(path).fsPath,
        ref: '',
        main: false,
        detached: false
      }))
    }
  };
}

suite('worktreeNormalization', () => {
  test('FR-001/FR-002: detects a linked worktree and distinguishes it from the main repository', () => {
    const main = fakeRepository({
      path: '/repo',
      kind: 'repository',
      branch: 'main',
      worktreePaths: ['/repo', '/repo-wt']
    });
    const worktree = fakeRepository({ path: '/repo-wt', kind: 'worktree', branch: 'feature/x' });

    const descriptors = listWorktreeDescriptors([main, worktree]);

    assert.strictEqual(descriptors.length, 2);
    const mainDescriptor = descriptors.find((d) => d.isMain);
    const worktreeDescriptor = descriptors.find((d) => !d.isMain);
    assert.ok(mainDescriptor && worktreeDescriptor);
    assert.strictEqual(mainDescriptor.repositoryRoot.toString(), mainDescriptor.rootUri.toString());
    assert.strictEqual(worktreeDescriptor.repositoryRoot.toString(), mainDescriptor.rootUri.toString());
    assert.strictEqual(worktreeDescriptor.ref, 'feature/x');
    assert.strictEqual(worktreeDescriptor.isDetached, false);
  });

  test('excludes submodules from the discovered worktree list', () => {
    const main = fakeRepository({ path: '/repo', kind: 'repository', branch: 'main' });
    const submodule = fakeRepository({ path: '/repo/vendor/lib', kind: 'submodule', branch: 'main' });

    const descriptors = listWorktreeDescriptors([main, submodule]);

    assert.strictEqual(descriptors.length, 1);
    assert.strictEqual(descriptors[0].rootUri.toString(), main.rootUri.toString());
  });

  test('normalizes a detached worktree using a short commit sha', () => {
    const main = fakeRepository({
      path: '/repo',
      kind: 'repository',
      branch: 'main',
      worktreePaths: ['/repo', '/repo-detached']
    });
    const detached = fakeRepository({ path: '/repo-detached', kind: 'worktree', commit: '0123456789abcdef' });

    const [descriptor] = listWorktreeDescriptors([main, detached]).filter((d) => !d.isMain);

    assert.strictEqual(descriptor.isDetached, true);
    assert.strictEqual(descriptor.ref, '0123456');
  });

  test('FR-004: multiple unrelated repositories do not cross-match each other\'s worktrees', () => {
    const mainA = fakeRepository({ path: '/a', kind: 'repository', branch: 'main', worktreePaths: ['/a', '/a-wt'] });
    const worktreeA = fakeRepository({ path: '/a-wt', kind: 'worktree', branch: 'feature/a' });
    const mainB = fakeRepository({ path: '/b', kind: 'repository', branch: 'main', worktreePaths: ['/b', '/b-wt'] });
    const worktreeB = fakeRepository({ path: '/b-wt', kind: 'worktree', branch: 'feature/b' });

    const descriptors = listWorktreeDescriptors([mainA, worktreeA, mainB, worktreeB]);

    const descriptorA = descriptors.find((d) => d.rootUri.toString() === worktreeA.rootUri.toString());
    const descriptorB = descriptors.find((d) => d.rootUri.toString() === worktreeB.rootUri.toString());
    assert.ok(descriptorA && descriptorB);
    assert.strictEqual(descriptorA.repositoryRoot.toString(), mainA.rootUri.toString());
    assert.strictEqual(descriptorB.repositoryRoot.toString(), mainB.rootUri.toString());
  });

  test('falls back to its own root when no owning repository can be found', () => {
    const orphan = fakeRepository({ path: '/orphan-wt', kind: 'worktree', branch: 'feature/orphan' });

    const [descriptor] = listWorktreeDescriptors([orphan]);

    assert.strictEqual(descriptor.repositoryRoot.toString(), orphan.rootUri.toString());
  });
});
