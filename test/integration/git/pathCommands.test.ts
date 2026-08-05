import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { copyRelativePath, copyAbsolutePath, copyWorktreePath } from '../../../src/commands';
import { WorktreeTreeItem } from '../../../src/tree';
import type { FileSystemEntry } from '../../../src/filesystem';

// Live checks (#11). Clipboard writes are safe and deterministic to actually execute in CI.
// revealFileInOS is NOT exercised here — it opens a real OS file-explorer window, which would be
// disruptive/hanging in a headless test run; registration/no-op-safety coverage for that command
// is in pathCommands.test.ts (unit), and manual verification is the documented way to confirm the
// actual reveal behavior, the same category of limitation as showQuickPick/showInputBox elsewhere.
//
// These call the plain functions directly (see src/commands/pathCommands.ts) rather than
// re-registering the same command ids the running extension already owns.
suite('Path and OS utility commands (#11) live', function () {
  this.timeout(20000);

  test('FR-036: Copy Relative Path writes the path relative to the active worktree root', async () => {
    const root = vscode.workspace.workspaceFolders?.[0].uri;
    assert.ok(root);
    const selection = { snapshot: { activeWorktreeUri: root, activeSource: 'scm' as const, rootGeneration: 1 } };
    const entry: FileSystemEntry = { uri: vscode.Uri.joinPath(root, 'sub', 'file.txt'), name: 'file.txt', type: vscode.FileType.File };
    const item = new WorktreeTreeItem(entry);

    await copyRelativePath({ selection }, item);

    assert.strictEqual(await vscode.env.clipboard.readText(), path.join('sub', 'file.txt'));
  });

  test("FR-037: Copy Absolute Path writes the item's full filesystem path", async () => {
    const root = vscode.workspace.workspaceFolders?.[0].uri;
    assert.ok(root);
    const entry: FileSystemEntry = { uri: vscode.Uri.joinPath(root, 'README.md'), name: 'README.md', type: vscode.FileType.File };
    const item = new WorktreeTreeItem(entry);

    await copyAbsolutePath(item);

    assert.strictEqual(await vscode.env.clipboard.readText(), entry.uri.fsPath);
  });

  test("Copy Worktree Path writes the active root's absolute path", async () => {
    const root = vscode.workspace.workspaceFolders?.[0].uri;
    assert.ok(root);
    const selection = { snapshot: { activeWorktreeUri: root, activeSource: 'scm' as const, rootGeneration: 1 } };

    await copyWorktreePath({ selection });

    assert.strictEqual(await vscode.env.clipboard.readText(), root.fsPath);
  });
});
