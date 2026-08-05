import * as vscode from 'vscode';
import type { FileSystemEntry } from '../filesystem';
import { isDirectory, isSymbolicLink } from '../filesystem';
import { OPEN_COMMAND } from '../commands/constants';

export type TreeItemType = 'file' | 'folder' | 'symlink';

/**
 * PRD §10.5: symlinks are identified distinctly and, for MVP, always treated as non-expandable
 * leaves — a conservative superset of "external links are read-only/non-expandable" (PRD §10.5,
 * risk R-05) that avoids needing symlink-target resolution here. RootBoundaryGuard (#8) and its
 * hardening (#13) are what actually resolve a symlink's target and distinguish internal from
 * external; #6 only needs to browse safely, not decide what's mutable.
 */
export class WorktreeTreeItem extends vscode.TreeItem {
  readonly entry: FileSystemEntry;
  readonly itemType: TreeItemType;

  constructor(entry: FileSystemEntry) {
    const itemType = toItemType(entry);
    const collapsibleState =
      itemType === 'folder' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
    super(entry.name, collapsibleState);
    this.entry = entry;
    this.itemType = itemType;
    this.resourceUri = entry.uri;
    this.contextValue = itemType;
    this.iconPath = itemType === 'symlink' ? new vscode.ThemeIcon('file-symlink-file') : vscode.ThemeIcon.File;

    if (itemType === 'file') {
      this.command = { command: OPEN_COMMAND, title: 'Open', arguments: [entry.uri] };
    }
  }
}

function toItemType(entry: FileSystemEntry): TreeItemType {
  if (isSymbolicLink(entry.type)) {
    return 'symlink';
  }
  return isDirectory(entry.type) ? 'folder' : 'file';
}
