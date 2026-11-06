import * as assert from 'assert';
import * as vscode from 'vscode';
import { mapToMainCheckout, compareWithBase, compareWithMainCheckout, openInMainCheckout, type CompareCommandDependencies } from '../../src/commands';
import { WorktreeTreeItem } from '../../src/tree';

suite('Compare commands (#21)', () => {
  const worktreeRoot = vscode.Uri.file('/repos/app-wt');
  const mainRoot = vscode.Uri.file('/repos/app');

  test('maps a worktree file to the same relative path in the main checkout', () => {
    const mapped = mapToMainCheckout(worktreeRoot, mainRoot, vscode.Uri.file('/repos/app-wt/src/a/b.ts'));
    assert.strictEqual(mapped?.fsPath, vscode.Uri.file('/repos/app/src/a/b.ts').fsPath);
  });

  test('refuses files outside the worktree and the worktree root itself', () => {
    assert.strictEqual(mapToMainCheckout(worktreeRoot, mainRoot, vscode.Uri.file('/repos/other/x.ts')), undefined);
    assert.strictEqual(mapToMainCheckout(worktreeRoot, mainRoot, vscode.Uri.file('/repos/app-wt-2/x.ts')), undefined);
    assert.strictEqual(mapToMainCheckout(worktreeRoot, mainRoot, worktreeRoot), undefined);
  });

  test('commands no-op safely without an active root, an item, or a base branch', async () => {
    const deps: CompareCommandDependencies = {
      git: { listWorktrees: () => [], compareWithBase: async () => undefined, toGitUri: () => undefined },
      selection: { snapshot: { activeWorktreeUri: undefined, activeSource: undefined, rootGeneration: 0 } }
    };
    const item = new WorktreeTreeItem({ uri: vscode.Uri.file('/repos/app-wt/a.ts'), name: 'a.ts', type: vscode.FileType.File });
    assert.strictEqual(await compareWithBase(deps, item), false);
    assert.strictEqual(await compareWithBase(deps, undefined), false);
    assert.strictEqual(await compareWithMainCheckout(deps, item), false);
    assert.strictEqual(await openInMainCheckout(deps, undefined), false);

    const withRoot: CompareCommandDependencies = {
      ...deps,
      selection: { snapshot: { activeWorktreeUri: worktreeRoot, activeSource: 'scm', rootGeneration: 1 } }
    };
    assert.strictEqual(await compareWithBase(withRoot, item), false, 'no base branch → no diff');
  });
});
