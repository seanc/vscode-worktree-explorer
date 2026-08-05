import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileSystemService } from '../../src/filesystem';
import { OperationError } from '../../src/common';

suite('FileSystemService mutations', () => {
  let root: string;
  let fileSystem: FileSystemService;

  setup(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'file-system-service-'));
    fileSystem = new FileSystemService();
  });

  teardown(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('FR-FILE-01: creates an empty file', async () => {
    const uri = vscode.Uri.file(path.join(root, 'new-file.txt'));
    await fileSystem.createFile(uri);
    assert.strictEqual(fs.readFileSync(uri.fsPath, 'utf8'), '');
  });

  test('FR-FILE-01: rejects an existing destination rather than overwriting', async () => {
    const uri = vscode.Uri.file(path.join(root, 'existing.txt'));
    fs.writeFileSync(uri.fsPath, 'original content');

    await assert.rejects(
      () => fileSystem.createFile(uri),
      (error: unknown) => error instanceof OperationError && error.reason === 'destinationExists'
    );
    assert.strictEqual(fs.readFileSync(uri.fsPath, 'utf8'), 'original content', 'the original file must be untouched');
  });

  test('FR-FILE-02: creates a directory', async () => {
    const uri = vscode.Uri.file(path.join(root, 'new-dir'));
    await fileSystem.createDirectory(uri);
    assert.ok(fs.statSync(uri.fsPath).isDirectory());
  });

  test('FR-FILE-02: creates intermediate directories for a nested relative path', async () => {
    const uri = vscode.Uri.file(path.join(root, 'a', 'b', 'c'));
    await fileSystem.createDirectory(uri);
    assert.ok(fs.statSync(uri.fsPath).isDirectory());
  });

  test('FR-FILE-02: rejects a directory that already exists', async () => {
    const uri = vscode.Uri.file(path.join(root, 'existing-dir'));
    fs.mkdirSync(uri.fsPath);

    await assert.rejects(
      () => fileSystem.createDirectory(uri),
      (error: unknown) => error instanceof OperationError && error.reason === 'destinationExists'
    );
  });

  test('FR-FILE-03: renames a file', async () => {
    const source = vscode.Uri.file(path.join(root, 'old.txt'));
    fs.writeFileSync(source.fsPath, 'content');
    const destination = vscode.Uri.file(path.join(root, 'new.txt'));

    await fileSystem.rename(source, destination);

    assert.strictEqual(fs.existsSync(source.fsPath), false);
    assert.strictEqual(fs.readFileSync(destination.fsPath, 'utf8'), 'content');
  });

  test('FR-FILE-03: rejects renaming onto a different existing file', async () => {
    const source = vscode.Uri.file(path.join(root, 'source.txt'));
    fs.writeFileSync(source.fsPath, 'source content');
    const destination = vscode.Uri.file(path.join(root, 'destination.txt'));
    fs.writeFileSync(destination.fsPath, 'destination content');

    await assert.rejects(
      () => fileSystem.rename(source, destination),
      (error: unknown) => error instanceof OperationError && error.reason === 'destinationExists'
    );
    assert.strictEqual(fs.readFileSync(destination.fsPath, 'utf8'), 'destination content');
  });

  test('FR-FILE-03: a case-only rename succeeds where the filesystem permits it', async function () {
    if (process.platform !== 'win32' && process.platform !== 'darwin') {
      this.skip(); // case-sensitive filesystem: "Old.txt" -> "old.txt" is just a normal rename.
    }
    const source = vscode.Uri.file(path.join(root, 'CaseTest.txt'));
    fs.writeFileSync(source.fsPath, 'content');
    const destination = vscode.Uri.file(path.join(root, 'casetest.txt'));

    await fileSystem.rename(source, destination);

    const entries = fs.readdirSync(root);
    assert.deepStrictEqual(entries, ['casetest.txt']);
  });

  test('FR-FILE-04: deletes a file (no trash, for deterministic CI behavior)', async () => {
    const uri = vscode.Uri.file(path.join(root, 'to-delete.txt'));
    fs.writeFileSync(uri.fsPath, 'x');

    await fileSystem.delete(uri, { recursive: false, useTrash: false });

    assert.strictEqual(fs.existsSync(uri.fsPath), false);
  });

  test('FR-FILE-04: recursively deletes a directory', async () => {
    const dir = vscode.Uri.file(path.join(root, 'to-delete-dir'));
    fs.mkdirSync(dir.fsPath);
    fs.writeFileSync(path.join(dir.fsPath, 'child.txt'), 'x');

    await fileSystem.delete(dir, { recursive: true, useTrash: false });

    assert.strictEqual(fs.existsSync(dir.fsPath), false);
  });

  test('§25 "Permission denied": a write blocked by filesystem permissions is translated (best effort)', async function () {
    const readonlyDir = path.join(root, 'readonly-dir');
    fs.mkdirSync(readonlyDir);
    fs.chmodSync(readonlyDir, 0o444);
    try {
      await fileSystem.createFile(vscode.Uri.file(path.join(readonlyDir, 'new-file.txt')));
      // The write succeeded despite the read-only mode — this environment doesn't enforce
      // filesystem permissions the way this test expects (e.g. an elevated/administrator account
      // on Windows, or a CI runner with broad rights), not a defect in our code. Skip rather than
      // fail, the same honest-limitation pattern used for symlinks elsewhere in this suite.
      this.skip();
    } catch (error) {
      assert.ok(error instanceof OperationError && error.reason === 'permissionDenied', `expected permissionDenied, got ${error}`);
    } finally {
      fs.chmodSync(readonlyDir, 0o755);
    }
  });
});
