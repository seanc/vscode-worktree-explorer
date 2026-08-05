import * as vscode from 'vscode';
import { OperationError } from '../common/errors';

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
      if (error instanceof vscode.FileSystemError && error.code === 'NoPermissions') {
        throw new OperationError('permissionDenied');
      }
      throw error;
    }
  }
}
