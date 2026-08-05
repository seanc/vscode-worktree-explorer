import * as assert from 'assert';
import * as vscode from 'vscode';
import { FileSystemService } from '../../../src/filesystem';
import { WorktreeTreeProvider } from '../../../src/tree';

// Live check (#6): browses the real #3 git fixture (main repo root) through the full
// FileSystemService -> WorktreeTreeProvider pipeline, confirming workspace.fs.readDirectory and
// the default PRD §10.4 exclusions work end to end against a real filesystem, not just the
// pure-function unit tests in sorting.test.ts/exclude.test.ts.
suite('Worktree Tree browsing (#6)', function () {
  this.timeout(20000);

  test('lists real files while excluding .git by default', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder, 'the gitDiscoveryTests workspace folder should be open');

    const provider = new WorktreeTreeProvider(new FileSystemService());
    provider.setActiveRoot(workspaceFolder.uri);

    const children = await provider.getChildren();
    const names = children.map((c) => c.entry.name);

    assert.ok(names.includes('README.md'), 'the fixture repo\'s README.md should be listed');
    assert.ok(!names.includes('.git'), '.git should be excluded by default (PRD §10.4)');
  });

  test('an empty active root yields no children', async () => {
    const provider = new WorktreeTreeProvider(new FileSystemService());
    const children = await provider.getChildren();
    assert.deepStrictEqual(children, []);
  });
});
