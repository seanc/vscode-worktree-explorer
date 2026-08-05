import * as assert from 'assert';
import * as vscode from 'vscode';

// Confirms the packaged extension activates cleanly in a real Extension Development Host — the
// primary risk called out in issue #1 (esbuild must mark `vscode` external, or this fails at
// runtime even though the build succeeds).
suite('Extension activation', () => {
  test('extension is present and activates without throwing', async () => {
    const extension = vscode.extensions.getExtension('worktree-explorer.worktree-explorer');
    assert.ok(extension, 'Extension should be discoverable by its id');
    await extension!.activate();
    assert.strictEqual(extension!.isActive, true);
  });
});
