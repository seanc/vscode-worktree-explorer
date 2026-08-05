import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileSystemService, WorktreeWatcher } from '../../../src/filesystem';
import { WorktreeTreeProvider } from '../../../src/tree';

// Live end-to-end checks (#7) against the #3 git fixture. The second test is the scenario that
// actually matters for this extension: PRD G-02 means the active worktree is *never* a workspace
// folder, so out-of-workspace watching has to work, not just in-workspace watching.
//
// Finding: a watcher scoped to a path outside any open workspace folder has multi-second startup
// latency before it reliably delivers events (confirmed here; a write issued immediately after
// setActiveRoot() was reliably missed, the same write issued after a short delay was not) — unlike
// in-workspace watching, which responds in well under a second. See
// test/unit/worktreeWatcher.test.ts for the debounce/dispose unit tests this informs.
suite('Active-root watching and refresh (#7)', function () {
  this.timeout(20000);

  test('AC-13: a file created externally appears in the tree without restarting (in-workspace root)', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder, 'the gitDiscoveryTests workspace folder should be open');
    const root = workspaceFolder.uri;

    const provider = new WorktreeTreeProvider(new FileSystemService());
    provider.setActiveRoot(root);
    const watcher = new WorktreeWatcher(100);
    watcher.setActiveRoot(root);

    const newFileName = `watcher-test-${Date.now()}.txt`;
    const newFilePath = path.join(root.fsPath, newFileName);
    try {
      const changed = new Promise<void>((resolve) => {
        const subscription = watcher.onDidChange(() => {
          subscription.dispose();
          resolve();
        });
      });
      fs.writeFileSync(newFilePath, 'hello');
      await changed;

      const children = await provider.getChildren();
      assert.ok(
        children.some((c) => c.entry.name === newFileName),
        'the externally created file should be visible on the next getChildren() call'
      );
    } finally {
      watcher.dispose();
      fs.rmSync(newFilePath, { force: true });
    }
  });

  test('AC-13: watching the real active-worktree shape — a sibling folder outside the workspace', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder);
    // "main" is the open workspace folder; "linked-wt" is its sibling and is NOT part of the
    // workspace — this is the actual shape of an active worktree per PRD G-02.
    const linkedWtRoot = vscode.Uri.joinPath(workspaceFolder.uri, '..', 'linked-wt');

    const watcher = new WorktreeWatcher(100);
    watcher.setActiveRoot(linkedWtRoot);
    const newFilePath = path.join(linkedWtRoot.fsPath, `watcher-test-${Date.now()}.txt`);
    try {
      const changed = new Promise<void>((resolve) => {
        const subscription = watcher.onDidChange(() => {
          subscription.dispose();
          resolve();
        });
      });
      // See the suite-level comment: an out-of-workspace watcher needs a moment to actually start
      // delivering events after setActiveRoot().
      await new Promise((resolve) => setTimeout(resolve, 3000));
      fs.writeFileSync(newFilePath, 'hello');
      await changed;
    } finally {
      watcher.dispose();
      fs.rmSync(newFilePath, { force: true });
    }
  });
});
