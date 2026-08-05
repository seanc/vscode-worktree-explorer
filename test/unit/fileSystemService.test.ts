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
});
