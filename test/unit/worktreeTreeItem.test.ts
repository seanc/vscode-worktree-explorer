import * as assert from 'assert';
import * as vscode from 'vscode';
import { WorktreeTreeItem } from '../../src/tree';
import { OPEN_COMMAND } from '../../src/commands';
import type { FileSystemEntry } from '../../src/filesystem';

function entry(name: string, type: vscode.FileType): FileSystemEntry {
  return { uri: vscode.Uri.file(`/root/${name}`), name, type };
}

suite('WorktreeTreeItem', () => {
  test('a directory is collapsible and has no open command', () => {
    const item = new WorktreeTreeItem(entry('src', vscode.FileType.Directory));
    assert.strictEqual(item.itemType, 'folder');
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    assert.strictEqual(item.command, undefined);
    assert.strictEqual(item.contextValue, 'folder');
  });

  test('a file is a leaf wired to the open command (PRD §10.6/AC-06)', () => {
    const fileEntry = entry('README.md', vscode.FileType.File);
    const item = new WorktreeTreeItem(fileEntry);
    assert.strictEqual(item.itemType, 'file');
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
    assert.strictEqual(item.command?.command, OPEN_COMMAND);
    assert.deepStrictEqual(item.command?.arguments, [fileEntry.uri]);
  });

  test('PRD §10.5: a symlink (even to a directory) is identified distinctly and non-expandable', () => {
    const item = new WorktreeTreeItem(entry('link', vscode.FileType.Directory | vscode.FileType.SymbolicLink));
    assert.strictEqual(item.itemType, 'symlink');
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
    assert.strictEqual(item.command, undefined, 'a symlink is not opened directly, matching its non-expandable treatment');
  });
});
