import * as vscode from 'vscode';
import { OperationError } from '../common/errors';
import { pathsEqual } from '../common/paths';

export interface FileSystemEntry {
  readonly uri: vscode.Uri;
  readonly name: string;
  readonly type: vscode.FileType;
}

export function isDirectory(type: vscode.FileType): boolean {
  return (type & vscode.FileType.Directory) !== 0;
}

export function isSymbolicLink(type: vscode.FileType): boolean {
  return (type & vscode.FileType.SymbolicLink) !== 0;
}

export interface DeleteOptions {
  readonly recursive: boolean;
  readonly useTrash: boolean;
}

/**
 * Wraps `workspace.fs` (PRD §17.1). Callers must have already validated `uri` through
 * RootBoundaryGuard (#8) — this service does not itself enforce root containment, only the
 * filesystem-level semantics (existence checks, error translation) each operation needs.
 */
export class FileSystemService {
  async listDirectory(uri: vscode.Uri): Promise<FileSystemEntry[]> {
    const entries = await vscode.workspace.fs.readDirectory(uri);
    return entries.map(([name, type]) => ({ uri: vscode.Uri.joinPath(uri, name), name, type }));
  }

  /** FR-FILE-01: creates an empty file. Rejects an existing destination rather than overwriting. */
  async createFile(uri: vscode.Uri): Promise<void> {
    await this.rejectIfExists(uri);
    await this.run(() => vscode.workspace.fs.writeFile(uri, new Uint8Array()));
  }

  /** FR-FILE-02: creates a directory (and any missing intermediate directories). Rejects an
   *  existing destination — workspace.fs.createDirectory is otherwise silently idempotent. */
  async createDirectory(uri: vscode.Uri): Promise<void> {
    await this.rejectIfExists(uri);
    await this.run(() => vscode.workspace.fs.createDirectory(uri));
  }

  /**
   * FR-FILE-03: renames/moves within the same parent. A case-only rename (e.g. "Readme.md" ->
   * "README.md" on a case-insensitive filesystem) needs `overwrite: true` — otherwise VS Code
   * sees the destination as "already existing" (it's the same file) and rejects it, even though
   * PRD explicitly requires case-only rename to work where the filesystem permits it. Any other
   * rename keeps `overwrite: false`, so a genuine collision with a *different* file is rejected.
   */
  async rename(source: vscode.Uri, destination: vscode.Uri): Promise<void> {
    const caseOnlyRename = source.fsPath !== destination.fsPath && pathsEqual(source.fsPath, destination.fsPath);
    await this.run(() => vscode.workspace.fs.rename(source, destination, { overwrite: caseOnlyRename }));
  }

  /** FR-FILE-04: deletes a file or (recursively) a directory, using the OS trash when
   *  `options.useTrash` is true and the platform supports it. */
  async delete(uri: vscode.Uri, options: DeleteOptions): Promise<void> {
    await this.run(() => vscode.workspace.fs.delete(uri, options));
  }

  private async rejectIfExists(uri: vscode.Uri): Promise<void> {
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      return; // stat failing means it doesn't exist yet, which is what we want.
    }
    throw new OperationError('destinationExists');
  }

  private async run<T>(operation: () => Thenable<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw toOperationError(error);
    }
  }
}

function toOperationError(error: unknown): unknown {
  if (!(error instanceof vscode.FileSystemError)) {
    return error;
  }
  if (error.code === 'NoPermissions') {
    return new OperationError('permissionDenied');
  }
  if (error.code === 'FileExists') {
    return new OperationError('destinationExists');
  }
  return error;
}
