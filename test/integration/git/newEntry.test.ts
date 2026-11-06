import * as assert from 'assert';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { FileSystemService, RootBoundaryGuard } from '../../../src/filesystem';
import { WorktreeTreeProvider } from '../../../src/tree';
import { createEntry } from '../../../src/commands';

// Live end-to-end check (#9): real RootBoundaryGuard validation, a real workspace.fs write, a
// real tree refresh, and (via the OPEN_COMMAND this depends on) a real editor open — the pieces
// that are actually our code. The interactive showInputBox prompt is not exercised here (no
// public API to script it, the same constraint noted for showQuickPick in #5); createEntry() is
// the testable core createEntry.test.ts (unit, with fakes) and this file both exercise.
suite('New File / New Folder (#9) live', function () {
  this.timeout(20000);

  let outputChannel: vscode.OutputChannel;

  suiteSetup(async () => {
    await vscode.extensions.getExtension('seanc-local.worktree-explorer')?.activate();
    outputChannel = vscode.window.createOutputChannel('Worktree Explorer Test (#9)');
  });

  suiteTeardown(() => {
    outputChannel.dispose();
  });

  test('AC-07: creates a file inside the active root, refreshes the tree, and opens it', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder, 'the gitDiscoveryTests workspace folder should be open');
    const root = workspaceFolder.uri;

    const fileSystem = new FileSystemService();
    const guard = new RootBoundaryGuard();
    const treeProvider = new WorktreeTreeProvider(fileSystem);
    treeProvider.setActiveRoot(root);
    const selection = { snapshot: { activeWorktreeUri: root, activeSource: 'scm' as const, rootGeneration: 1 } };
    const context = { rootUri: root, rootGeneration: 1 };
    const name = `created-${Date.now()}.txt`;
    const expectedUri = vscode.Uri.joinPath(root, name);

    try {
      const uri = await createEntry({ fileSystem, guard, selection, treeProvider, outputChannel }, context, root, name, 'file');

      assert.strictEqual(uri?.toString(), expectedUri.toString());
      assert.ok(fs.existsSync(expectedUri.fsPath));

      const children = await treeProvider.getChildren();
      assert.ok(children.some((c) => c.entry.name === name));

      assert.strictEqual(vscode.window.activeTextEditor?.document.uri.toString(), expectedUri.toString());
    } finally {
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      fs.rmSync(expectedUri.fsPath, { force: true });
    }
  });

  test('FR-FILE-01: rejects an existing destination without touching it', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder);
    const root = workspaceFolder.uri;
    const readmeUri = vscode.Uri.joinPath(root, 'README.md');
    const originalContent = fs.readFileSync(readmeUri.fsPath, 'utf8');

    const fileSystem = new FileSystemService();
    const guard = new RootBoundaryGuard();
    const treeProvider = new WorktreeTreeProvider(fileSystem);
    const selection = { snapshot: { activeWorktreeUri: root, activeSource: 'scm' as const, rootGeneration: 1 } };
    const context = { rootUri: root, rootGeneration: 1 };

    const uri = await createEntry({ fileSystem, guard, selection, treeProvider, outputChannel }, context, root, 'README.md', 'file');
    assert.strictEqual(uri, undefined);
    assert.strictEqual(fs.readFileSync(readmeUri.fsPath, 'utf8'), originalContent);
  });
});
