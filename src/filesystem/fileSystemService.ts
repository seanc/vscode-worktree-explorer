import * as vscode from 'vscode';

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
 * Read-only wrapper around `workspace.fs` (PRD §17.1). Mutation methods (create/rename/delete)
 * are added in #9/#10, gated by RootBoundaryGuard (#8) — this issue (#6) only lists directories.
 */
export class FileSystemService {
  async listDirectory(uri: vscode.Uri): Promise<FileSystemEntry[]> {
    const entries = await vscode.workspace.fs.readDirectory(uri);
    return entries.map(([name, type]) => ({ uri: vscode.Uri.joinPath(uri, name), name, type }));
  }
}
