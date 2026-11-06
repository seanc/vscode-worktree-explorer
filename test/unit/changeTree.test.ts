import * as assert from 'assert';
import * as vscode from 'vscode';
import { buildChangeTree, isFilterMode, WorktreeTreeItem } from '../../src/tree';
import type { WorktreeChange } from '../../src/common/types';

const root = vscode.Uri.file('/wt');

function change(path: string, status: WorktreeChange['status']): WorktreeChange {
  return { uri: vscode.Uri.file(`/wt/${path}`), status };
}

function names(tree: ReturnType<typeof buildChangeTree>, parent: vscode.Uri): string[] {
  return (tree.get(parent.toString()) ?? []).map((n) => `${n.isDirectory ? 'dir:' : ''}${n.name}${n.status ? `:${n.status}` : ''}`);
}

suite('Changed-files tree (#20)', () => {
  test('includes only changed files and the folders that contain them, folders first', () => {
    const tree = buildChangeTree(root, [
      change('app/Jobs/Export.php', 'modified'),
      change('README.md', 'modified'),
      change('app/Services/Old.php', 'deleted'),
      change('tests/ExportTest.php', 'added')
    ]);

    assert.deepStrictEqual(names(tree, root), ['dir:app', 'dir:tests', 'README.md:modified']);
    assert.deepStrictEqual(names(tree, vscode.Uri.joinPath(root, 'app')), ['dir:Jobs', 'dir:Services']);
    assert.deepStrictEqual(names(tree, vscode.Uri.joinPath(root, 'app', 'Services')), ['Old.php:deleted']);
  });

  test('skips changes outside the root and hidden segments', () => {
    const tree = buildChangeTree(
      root,
      [{ uri: vscode.Uri.file('/elsewhere/x.txt'), status: 'modified' }, change('node_modules/pkg/index.js', 'untracked'), change('src/a.ts', 'added')],
      (name) => name === 'node_modules'
    );
    assert.deepStrictEqual(names(tree, root), ['dir:src']);
  });

  test('an empty change list yields an empty tree', () => {
    assert.strictEqual(buildChangeTree(root, []).size, 0);
  });

  test('filter modes are validated when restored', () => {
    assert.ok(isFilterMode('all'));
    assert.ok(isFilterMode('changedVsBase'));
    assert.ok(isFilterMode('uncommitted'));
    assert.ok(!isFilterMode('bogus'));
    assert.ok(!isFilterMode(undefined));
  });

  test('a deleted file is shown with its status, cannot be opened, and has its own context value', () => {
    const uri = vscode.Uri.file('/wt/gone.txt');
    const item = new WorktreeTreeItem({ uri, name: 'gone.txt', type: vscode.FileType.File }, { status: 'deleted' });
    assert.strictEqual(item.itemType, 'deletedFile');
    assert.strictEqual(item.contextValue, 'deletedFile');
    assert.strictEqual(item.command, undefined);
    assert.strictEqual(item.description, 'D');
    assert.strictEqual(item.tooltip, 'gone.txt · Deleted');
  });

  test('a changed file opens normally and shows its status as text; folders start expanded', () => {
    const file = new WorktreeTreeItem({ uri: vscode.Uri.file('/wt/a.ts'), name: 'a.ts', type: vscode.FileType.File }, { status: 'modified' });
    assert.strictEqual(file.description, 'M');
    assert.ok(file.command);
    const folder = new WorktreeTreeItem({ uri: vscode.Uri.file('/wt/src'), name: 'src', type: vscode.FileType.Directory }, {});
    assert.strictEqual(folder.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
  });
});
