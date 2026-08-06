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

  test('§28.2 nested-directories scenario: a nested file is reachable by expanding folders', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder);
    const provider = new WorktreeTreeProvider(new FileSystemService());
    provider.setActiveRoot(workspaceFolder.uri);

    const rootChildren = await provider.getChildren();
    const sub = rootChildren.find((c) => c.entry.name === 'sub' && c.itemType === 'folder');
    assert.ok(sub, 'the fixture\'s sub/ directory should be listed as a folder');

    const subChildren = await provider.getChildren(sub);
    const nested = subChildren.find((c) => c.entry.name === 'nested' && c.itemType === 'folder');
    assert.ok(nested, 'sub/nested should be listed as a folder');

    const nestedChildren = await provider.getChildren(nested);
    assert.ok(nestedChildren.some((c) => c.entry.name === 'file.txt' && c.itemType === 'file'));
  });

  test('§28.2 symlink scenario: a directory symlink is listed as a non-expandable symlink, not a folder', async function () {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder);
    const provider = new WorktreeTreeProvider(new FileSystemService());
    provider.setActiveRoot(workspaceFolder.uri);

    const rootChildren = await provider.getChildren();
    const link = rootChildren.find((c) => c.entry.name === 'sub-link');
    if (!link) {
      // Directory symlinks need elevation/Developer Mode on Windows without either — the fixture
      // generator already logs and skips creating it in that case (see createGitFixture.js).
      this.skip();
      return;
    }

    assert.strictEqual(link.itemType, 'symlink');
    assert.strictEqual(link.collapsibleState, vscode.TreeItemCollapsibleState.None, 'PRD §10.5: non-expandable for MVP');
  });
});
