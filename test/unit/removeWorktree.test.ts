import * as assert from 'assert';
import * as vscode from 'vscode';
import { removeWorktree, describeRemoval, type RemoveWorktreeDependencies } from '../../src/commands';
import { describeGitFailure } from '../../src/git/gitIntegrationService';
import type { TicketInfo } from '../../src/ticket';
import type { BaseComparison, WorktreeDescriptor } from '../../src/common/types';

const linked: WorktreeDescriptor = {
  repositoryRoot: vscode.Uri.file('/repo'),
  rootUri: vscode.Uri.file('/repo/.wt/PROJ-1'),
  displayName: 'PROJ-1',
  ref: 'task/jd/PROJ-1-done',
  isMain: false,
  isDetached: false
};

function comparison(uncommitted: number): BaseComparison {
  return {
    baseRef: 'develop',
    baseSource: 'default',
    mergeBase: 'm',
    ahead: 0,
    changedVsBase: [],
    uncommitted: Array.from({ length: uncommitted }, () => ({ uri: vscode.Uri.file('/repo/.wt/PROJ-1/a'), status: 'modified' as const })),
    baseCommitMessages: []
  };
}

function setup(info: TicketInfo | undefined, confirmed: boolean) {
  const removed: string[] = [];
  const confirmations: string[] = [];
  let refreshed = 0;
  const deps: RemoveWorktreeDependencies = {
    git: {
      removeWorktree: async (uri) => {
        removed.push(uri.fsPath);
      }
    },
    tickets: { getTicket: async () => info },
    refresh: () => {
      refreshed += 1;
    },
    confirm: async (message) => {
      confirmations.push(message);
      return confirmed;
    }
  };
  return { deps, removed, confirmations, refreshed: () => refreshed };
}

suite('Remove worktree (#24)', () => {
  const clean: TicketInfo = { worktree: linked, metadata: { key: 'PROJ-1', devDatabases: [], testDatabases: [] }, comparison: comparison(0) };

  test('removes only after the user confirms', async () => {
    const yes = setup(clean, true);
    assert.strictEqual(await removeWorktree(yes.deps, { rootUri: linked.rootUri }), true);
    assert.deepStrictEqual(yes.confirmations, ['Remove worktree PROJ-1?']);
    assert.deepStrictEqual(yes.removed, [linked.rootUri.fsPath]);
    assert.strictEqual(yes.refreshed(), 1);

    const no = setup(clean, false);
    assert.strictEqual(await removeWorktree(no.deps, { rootUri: linked.rootUri }), false);
    assert.deepStrictEqual(no.removed, []);
  });

  test('refuses before asking when there are uncommitted changes', async () => {
    const dirty = setup({ ...clean, comparison: comparison(2) }, true);
    assert.strictEqual(await removeWorktree(dirty.deps, { rootUri: linked.rootUri }), false);
    assert.deepStrictEqual(dirty.confirmations, []);
    assert.deepStrictEqual(dirty.removed, []);
  });

  test('never removes the main checkout or an unknown worktree', async () => {
    const main = setup({ ...clean, worktree: { ...linked, isMain: true, rootUri: linked.repositoryRoot } }, true);
    assert.strictEqual(await removeWorktree(main.deps, { rootUri: linked.repositoryRoot }), false);
    const unknown = setup(undefined, true);
    assert.strictEqual(await removeWorktree(unknown.deps, { rootUri: linked.rootUri }), false);
    assert.strictEqual(await removeWorktree(unknown.deps, undefined), false);
    assert.deepStrictEqual([...main.removed, ...unknown.removed], []);
  });

  test('the confirmation names the folder, keeps the branch, and mentions databases', () => {
    const { message, detail } = describeRemoval(clean, 'tiggit drop PROJ-1');
    assert.strictEqual(message, 'Remove worktree PROJ-1?');
    assert.ok(detail.includes(linked.rootUri.fsPath));
    assert.ok(detail.includes('The branch task/jd/PROJ-1-done is kept.'));
    assert.ok(detail.includes('Run "tiggit drop PROJ-1"'));
    assert.ok(describeRemoval(clean, undefined).detail.includes('Cloned databases, if any, are not dropped.'));
  });

  test('Git failures become plain explanations', () => {
    assert.match(describeGitFailure({ gitErrorCode: 'WorktreeContainsChanges' }), /uncommitted or untracked/);
    assert.match(describeGitFailure({ stderr: "fatal: '/x' contains modified or untracked files, use --force to delete it" }), /uncommitted or untracked/);
    assert.match(describeGitFailure({ stderr: 'fatal: cannot remove a locked working tree' }), /locked/);
    assert.strictEqual(describeGitFailure({ stderr: 'fatal: something else\nmore' }), 'Git could not remove the worktree: fatal: something else');
    assert.strictEqual(describeGitFailure(undefined), 'Git could not remove the worktree.');
  });
});
