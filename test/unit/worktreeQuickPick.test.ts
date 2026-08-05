import * as assert from 'assert';
import * as vscode from 'vscode';
import { buildQuickPickItems, type WorktreeQuickPickItem } from '../../src/ui';
import type { WorktreeDescriptor } from '../../src/common/types';

function worktree(path: string, repositoryPath: string, ref: string, isDetached = false): WorktreeDescriptor {
  return {
    repositoryRoot: vscode.Uri.file(repositoryPath),
    rootUri: vscode.Uri.file(path),
    displayName: path.split('/').pop() ?? path,
    ref,
    isMain: false,
    isDetached
  };
}

function isRealItem(item: vscode.QuickPickItem | WorktreeQuickPickItem): item is WorktreeQuickPickItem {
  return 'worktree' in item;
}

suite('buildQuickPickItems', () => {
  test('a single repository is shown as a flat list with no group separators', () => {
    const items = buildQuickPickItems(
      [worktree('/repo-a-wt1', '/repo-a', 'feature/x'), worktree('/repo-a-wt2', '/repo-a', 'feature/y')],
      { activeUri: undefined, isScmSelected: () => false }
    );

    assert.strictEqual(items.length, 2);
    assert.ok(items.every(isRealItem));
  });

  test('AC-15/§16.4: multiple unrelated repositories are grouped under separator headers', () => {
    const items = buildQuickPickItems(
      [worktree('/repo-a-wt', '/repo-a', 'feature/x'), worktree('/repo-b-wt', '/repo-b', 'feature/y')],
      { activeUri: undefined, isScmSelected: () => false }
    );

    assert.strictEqual(items.length, 4);
    assert.strictEqual(items[0].kind, vscode.QuickPickItemKind.Separator);
    assert.strictEqual(items[0].label, 'repo-a');
    assert.ok(isRealItem(items[1]));
    assert.strictEqual(items[2].kind, vscode.QuickPickItemKind.Separator);
    assert.strictEqual(items[2].label, 'repo-b');
    assert.ok(isRealItem(items[3]));
  });

  test('the active worktree is marked with a check and pre-picked', () => {
    const active = worktree('/repo-wt', '/repo', 'feature/x');
    const [item] = buildQuickPickItems([active], { activeUri: active.rootUri, isScmSelected: () => false });

    assert.ok(isRealItem(item));
    assert.ok(item.label.startsWith('$(check) '));
    assert.strictEqual(item.picked, true);
  });

  test('an SCM-selected worktree gets the source-control indicator', () => {
    const selected = worktree('/repo-wt', '/repo', 'feature/x');
    const [item] = buildQuickPickItems([selected], {
      activeUri: undefined,
      isScmSelected: (uri) => uri.toString() === selected.rootUri.toString()
    });

    assert.ok(isRealItem(item));
    assert.ok(item.label.includes('$(source-control)'));
  });

  test('a detached worktree is labeled "detached@<ref>"', () => {
    const detached = worktree('/repo-wt', '/repo', 'a8cf231', true);
    const [item] = buildQuickPickItems([detached], { activeUri: undefined, isScmSelected: () => false });

    assert.ok(isRealItem(item));
    assert.strictEqual(item.label, 'detached@a8cf231');
  });

  test('description and detail carry the folder name and full path', () => {
    const w = worktree('/repo-wt', '/repo', 'feature/x');
    const [item] = buildQuickPickItems([w], { activeUri: undefined, isScmSelected: () => false });

    assert.ok(isRealItem(item));
    assert.strictEqual(item.description, w.displayName);
    assert.strictEqual(item.detail, w.rootUri.fsPath);
  });
});
