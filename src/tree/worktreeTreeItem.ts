import * as vscode from 'vscode';
import type { FileSystemEntry } from '../filesystem';
import { isDirectory, isSymbolicLink } from '../filesystem';
import { OPEN_COMMAND } from '../commands/constants';
import type { ChangeStatus } from '../common/types';
import { statusLabel, statusLetter } from './changeTree';

/** 'deletedFile' (#20): listed in a changed-files view but no longer on disk — not openable and
 *  excluded from the rename/delete/reveal menus. */
export type TreeItemType = 'file' | 'folder' | 'symlink' | 'deletedFile';

/** #20: present when the item is shown in a changed-files view. */
export interface TreeItemChange {
  readonly status?: ChangeStatus;
}

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

  constructor(entry: FileSystemEntry, change?: TreeItemChange) {
    const itemType = change?.status === 'deleted' ? 'deletedFile' : toItemType(entry);
    // In a changed-files view (#20) folders start expanded: the tree only holds changed paths.
    const collapsibleState =
      itemType !== 'folder'
        ? vscode.TreeItemCollapsibleState.None
        : change
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed;
    super(entry.name, collapsibleState);
    this.entry = entry;
    this.itemType = itemType;
    this.resourceUri = entry.uri;
    this.contextValue = itemType;
    this.iconPath = itemType === 'symlink' ? new vscode.ThemeIcon('file-symlink-file') : vscode.ThemeIcon.File;

    if (change?.status) {
      // Status as text, not colour (PRD §5 rules out file decorations; accessibility needs text).
      this.description = statusLetter(change.status);
      this.tooltip = `${entry.name} · ${statusLabel(change.status)}`;
    }

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
