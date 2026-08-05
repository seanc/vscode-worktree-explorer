import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileSystemService, RootBoundaryGuard } from '../../../src/filesystem';
import { WorktreeTreeProvider } from '../../../src/tree';
import { renameEntry, deleteEntry } from '../../../src/commands';

// Live end-to-end checks (#10) against the #3 git fixture's workspace folder. As with #9, the
// interactive prompts (showInputBox for the new name, the delete confirmation dialog, and the
// trash-unavailable fallback dialog) have no public API a test can drive non-interactively —
// renameEntry()/deleteEntry() are the testable cores, exercised directly here and in
// renameEntry.test.ts/deleteEntry.test.ts (unit, with fakes).
suite('Rename / Delete (#10) live', function () {
  this.timeout(20000);

  let outputChannel: vscode.OutputChannel;

  suiteSetup(async () => {
    await vscode.extensions.getExtension('worktree-explorer.worktree-explorer')?.activate();
    outputChannel = vscode.window.createOutputChannel('Worktree Explorer Test (#10)');
  });

  suiteTeardown(() => {
    outputChannel.dispose();
  });

  function makeDeps(root: vscode.Uri) {
    const fileSystem = new FileSystemService();
    const guard = new RootBoundaryGuard();
    const treeProvider = new WorktreeTreeProvider(fileSystem);
    treeProvider.setActiveRoot(root);
    const selection = { snapshot: { activeWorktreeUri: root, activeSource: 'scm' as const, rootGeneration: 1 } };
    return { fileSystem, guard, selection, treeProvider, outputChannel };
  }

  test('AC-08: renames a real file without changing the active worktree', async () => {
    const root = vscode.workspace.workspaceFolders?.[0].uri;
    assert.ok(root);
    const deps = makeDeps(root);
    const context = { rootUri: root, rootGeneration: 1 };
    const sourceName = `rename-source-${Date.now()}.txt`;
    const sourceUri = vscode.Uri.joinPath(root, sourceName);
    fs.writeFileSync(sourceUri.fsPath, 'content');

    try {
      const destination = await renameEntry(deps, context, sourceUri, `renamed-${sourceName}`);
      assert.ok(destination);
      assert.strictEqual(fs.existsSync(sourceUri.fsPath), false);
      assert.strictEqual(fs.readFileSync(destination!.fsPath, 'utf8'), 'content');
      assert.strictEqual(deps.selection.snapshot.activeWorktreeUri.toString(), root.toString());
    } finally {
      fs.rmSync(sourceUri.fsPath, { force: true });
      fs.rmSync(vscode.Uri.joinPath(root, `renamed-${sourceName}`).fsPath, { force: true });
    }
  });

  test('AC-09: deletes a real file and it is gone from the next getChildren() call', async () => {
    const root = vscode.workspace.workspaceFolders?.[0].uri;
    assert.ok(root);
    const deps = makeDeps(root);
    const context = { rootUri: root, rootGeneration: 1 };
    const name = `delete-target-${Date.now()}.txt`;
    const targetUri = vscode.Uri.joinPath(root, name);
    fs.writeFileSync(targetUri.fsPath, 'x');

    const success = await deleteEntry(deps, context, targetUri, false, false);

    assert.strictEqual(success, true);
    assert.strictEqual(fs.existsSync(targetUri.fsPath), false);
    const children = await deps.treeProvider.getChildren();
    assert.ok(!children.some((c) => c.entry.name === name));
  });

  test('AC-10: deleting the active worktree root itself is rejected', async () => {
    const root = vscode.workspace.workspaceFolders?.[0].uri;
    assert.ok(root);
    const deps = makeDeps(root);
    const context = { rootUri: root, rootGeneration: 1 };

    const success = await deleteEntry(deps, context, root, true, false);

    assert.strictEqual(success, false);
    assert.ok(fs.existsSync(root.fsPath), 'the worktree root must still exist');
  });

  test('SEC-06: deleting a path under .git is rejected', async () => {
    const root = vscode.workspace.workspaceFolders?.[0].uri;
    assert.ok(root);
    const deps = makeDeps(root);
    const context = { rootUri: root, rootGeneration: 1 };
    const gitDir = path.join(root.fsPath, '.git');
    assert.ok(fs.existsSync(gitDir), 'the fixture repo should have a real .git directory');

    const success = await deleteEntry(deps, context, vscode.Uri.file(gitDir), true, false);

    assert.strictEqual(success, false);
    assert.ok(fs.existsSync(gitDir));
  });
});
