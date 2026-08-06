import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { RootBoundaryGuard, type GuardContext } from '../../src/filesystem';

// Directory symlinks require elevated privileges on Windows unless Developer Mode is enabled;
// junctions (Windows-only) behave like directory symlinks for our purposes (FileType.SymbolicLink,
// fs.realpath resolves through them) and don't require elevation. File symlinks have no
// unprivileged Windows equivalent, so that specific case is skipped there rather than failed.
function createDirLink(target: string, link: string): void {
  fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
}

suite('RootBoundaryGuard', () => {
  let root: string;
  let context: GuardContext;
  let guard: RootBoundaryGuard;

  setup(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'root-guard-'));
    fs.mkdirSync(path.join(root, '.git'));
    fs.mkdirSync(path.join(root, 'sub'));
    fs.writeFileSync(path.join(root, 'sub', 'file.txt'), 'x');
    context = { rootUri: vscode.Uri.file(root), rootGeneration: 1 };
    guard = new RootBoundaryGuard();
  });

  teardown(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  suite('resolveNewPath', () => {
    test('accepts a simple name directly under the root', () => {
      const result = guard.resolveNewPath(context, context.rootUri, 'new-file.txt', 1);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.uri?.fsPath, vscode.Uri.joinPath(context.rootUri, 'new-file.txt').fsPath);
    });

    test('FR-FILE-02: accepts a nested relative path when every component stays inside the root', () => {
      const result = guard.resolveNewPath(context, context.rootUri, 'a/b/c.txt', 1);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.uri?.fsPath, vscode.Uri.joinPath(context.rootUri, 'a', 'b', 'c.txt').fsPath);
    });

    test('SEC-01/AC-11: rejects ".." traversal', () => {
      assert.strictEqual(guard.resolveNewPath(context, context.rootUri, '../outside.txt', 1).reason, 'traversal');
      assert.strictEqual(guard.resolveNewPath(context, context.rootUri, 'a/../../outside.txt', 1).reason, 'traversal');
    });

    test('SEC-01: rejects an absolute path', () => {
      const absolute = path.join(os.tmpdir(), 'outside.txt');
      assert.strictEqual(guard.resolveNewPath(context, context.rootUri, absolute, 1).reason, 'traversal');
    });

    test('SEC-01: rejects an empty or malformed name', () => {
      assert.strictEqual(guard.resolveNewPath(context, context.rootUri, '', 1).reason, 'traversal');
      assert.strictEqual(guard.resolveNewPath(context, context.rootUri, 'a//b.txt', 1).reason, 'traversal');
    });

    test('SEC-06: rejects a path that includes a .git segment', () => {
      assert.strictEqual(guard.resolveNewPath(context, context.rootUri, '.git/hooks/evil', 1).reason, 'protectedPath');
    });

    test('SEC-03: rejects a stale root generation', () => {
      assert.strictEqual(guard.resolveNewPath(context, context.rootUri, 'file.txt', 2).reason, 'staleRoot');
    });
  });

  suite('validateExistingTarget', () => {
    test('accepts a real file inside the root', async () => {
      const target = vscode.Uri.joinPath(context.rootUri, 'sub', 'file.txt');
      const result = await guard.validateExistingTarget(context, target, 1);
      assert.strictEqual(result.ok, true);
    });

    test('AC-10: rejects the active root itself', async () => {
      const result = await guard.validateExistingTarget(context, context.rootUri, 1);
      assert.strictEqual(result.reason, 'protectedPath');
    });

    test('SEC-06: rejects a path under .git', async () => {
      const target = vscode.Uri.joinPath(context.rootUri, '.git', 'config');
      const result = await guard.validateExistingTarget(context, target, 1);
      assert.strictEqual(result.reason, 'protectedPath');
    });

    test('SEC-01: rejects a target outside the root', async () => {
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'root-guard-outside-'));
      try {
        const target = vscode.Uri.file(path.join(outside, 'file.txt'));
        const result = await guard.validateExistingTarget(context, target, 1);
        assert.strictEqual(result.reason, 'traversal');
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    });

    test('SEC-03: rejects a stale root generation', async () => {
      const target = vscode.Uri.joinPath(context.rootUri, 'sub', 'file.txt');
      const result = await guard.validateExistingTarget(context, target, 2);
      assert.strictEqual(result.reason, 'staleRoot');
    });

    // On Windows this uses a junction rather than a true symlink (see createDirLink) — it still
    // exercises the same FileType.SymbolicLink + realpath escape-detection path.
    test('SEC-02: rejects a symlink whose target resolves outside the root', async () => {
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'root-guard-outside-'));
      try {
        const link = path.join(root, 'escape-link');
        createDirLink(outside, link);
        const result = await guard.validateExistingTarget(context, vscode.Uri.file(link), 1);
        assert.strictEqual(result.reason, 'symlinkEscape');
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    });

    test('SEC-02: accepts a symlink whose target resolves inside the root', async () => {
      const link = path.join(root, 'internal-link');
      createDirLink(path.join(root, 'sub'), link);
      const result = await guard.validateExistingTarget(context, vscode.Uri.file(link), 1);
      assert.strictEqual(result.ok, true);
    });
  });
});
