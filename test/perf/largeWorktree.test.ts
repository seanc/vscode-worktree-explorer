import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileSystemService, WorktreeWatcher } from '../../src/filesystem';
import { WorktreeTreeProvider } from '../../src/tree';
import { GitIntegrationService } from '../../src/git';
import { SelectionCoordinator } from '../../src/selection';

// #15: profiles against the PRD §23 performance targets using the large synthetic tree from
// test/setup/createLargeFixture.js (2000 files in one directory; 500 nested directories x 5
// files). Logs actual timings rather than hard-asserting them — dev/CI machine speed varies too
// much for a reliable pass/fail gate, matching PRD §18's "measure large-tree behavior before
// release" framing rather than a strict regression test. Run via `npm run profile`; not part of
// `npm test`/CI.
suite('Large-worktree performance profile (#15)', function () {
  this.timeout(60000);

  const root = vscode.workspace.workspaceFolders?.[0].uri;

  test('directory listing: a single directory with far more than 500 entries', async () => {
    assert.ok(root);
    const flatDir = vscode.Uri.joinPath(root, 'flat');
    const provider = new WorktreeTreeProvider(new FileSystemService());
    provider.setActiveRoot(flatDir);

    const start = performance.now();
    const children = await provider.getChildren();
    const elapsedMs = performance.now() - start;

    assert.strictEqual(children.length, 2000);
    logResult('flat directory listing (2000 entries)', elapsedMs, 200 * 4, 'PRD §23 target is <500 entries within 200ms; scaled 4x for 2000');
  });

  test('directory listing: lazy loading keeps a single nested directory cheap regardless of overall tree size', async () => {
    assert.ok(root);
    const nestedDir = vscode.Uri.joinPath(root, 'nested', 'dir-0000');
    const provider = new WorktreeTreeProvider(new FileSystemService());
    provider.setActiveRoot(nestedDir);

    const start = performance.now();
    const children = await provider.getChildren();
    const elapsedMs = performance.now() - start;

    assert.strictEqual(children.length, 5);
    logResult('single nested directory listing (5 of 2500 total nested files)', elapsedMs, 200, 'PRD §23 target: <500 entries within 200ms');
  });

  test('extension-owned synchronous construction with no active root', async () => {
    const start = performance.now();
    const gitIntegration = new GitIntegrationService();
    const selectionCoordinator = new SelectionCoordinator(gitIntegration);
    const treeProvider = new WorktreeTreeProvider(new FileSystemService());
    const watcher = new WorktreeWatcher();
    const elapsedMs = performance.now() - start;

    selectionCoordinator.dispose();
    gitIntegration.dispose();
    watcher.dispose();
    treeProvider.setActiveRoot(undefined);

    logResult('synchronous object construction, no active root', elapsedMs, 100, 'PRD §23 target: extension-owned sync activation <100ms');
  });

  test('root switch: setActiveRoot + first getChildren for the new root', async () => {
    assert.ok(root);
    const provider = new WorktreeTreeProvider(new FileSystemService());
    const watcher = new WorktreeWatcher();
    try {
      provider.setActiveRoot(vscode.Uri.joinPath(root, 'nested', 'dir-0000'));
      await provider.getChildren();

      const start = performance.now();
      const newRoot = vscode.Uri.joinPath(root, 'nested', 'dir-0001');
      provider.setActiveRoot(newRoot);
      watcher.setActiveRoot(newRoot);
      await provider.getChildren();
      const elapsedMs = performance.now() - start;

      logResult('root switch + first listing', elapsedMs, 250, 'PRD §23 target: root switch <250ms in normal local repositories');
    } finally {
      watcher.dispose();
    }
  });

  test('external change refresh latency (steady state, out-of-workspace root — see #7)', async () => {
    assert.ok(root);
    const watchedRoot = vscode.Uri.joinPath(root, 'nested', 'dir-0002');
    const watcher = new WorktreeWatcher(100);
    watcher.setActiveRoot(watchedRoot);
    // #7's finding: an out-of-workspace watcher needs a moment to start reliably delivering
    // events; this measures steady-state behavior, not cold-start latency.
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const newFile = path.join(watchedRoot.fsPath, `perf-${Date.now()}.txt`);
    try {
      const start = performance.now();
      const changed = new Promise<void>((resolve) => {
        const subscription = watcher.onDidChange(() => {
          subscription.dispose();
          resolve();
        });
      });
      fs.writeFileSync(newFile, 'x');
      await changed;
      const elapsedMs = performance.now() - start;

      logResult('external change -> debounced refresh (steady state)', elapsedMs, 1000, 'PRD §23 target: external refresh <1s');
    } finally {
      watcher.dispose();
      fs.rmSync(newFile, { force: true });
    }
  });
});

function logResult(label: string, elapsedMs: number, targetMs: number, note: string): void {
  const verdict = elapsedMs <= targetMs ? 'OK' : 'OVER TARGET';
  console.log(`[perf] ${label}: ${elapsedMs.toFixed(1)}ms (target ${targetMs}ms) — ${verdict}. ${note}`);
}
