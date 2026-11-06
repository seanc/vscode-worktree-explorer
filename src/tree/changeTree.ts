import * as vscode from 'vscode';
import type { ChangeStatus, WorktreeChange } from '../common/types';
import { isDescendantPath, pathsEqual } from '../common/paths';

// #20: builds the filtered ("changed files only") tree purely from a change list rather than from
// disk, so deleted files and folders still appear. Only the changed files and the folders that
// contain them are included.

export type FilterMode = 'all' | 'changedVsBase' | 'uncommitted';

export const FILTER_MODES: readonly FilterMode[] = ['all', 'changedVsBase', 'uncommitted'];

export interface ChangeNode {
  readonly uri: vscode.Uri;
  readonly name: string;
  readonly isDirectory: boolean;
  /** Files only. */
  readonly status?: ChangeStatus;
}

/** Children keyed by their parent's URI string (the root's own URI string for top-level nodes). */
export type ChangeTree = ReadonlyMap<string, readonly ChangeNode[]>;

const STATUS_LETTER: Record<ChangeStatus, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: 'U',
  conflict: '!'
};

const STATUS_LABEL: Record<ChangeStatus, string> = {
  modified: 'Modified',
  added: 'Added',
  deleted: 'Deleted',
  renamed: 'Renamed',
  untracked: 'Untracked',
  conflict: 'Conflict'
};

export function statusLetter(status: ChangeStatus): string {
  return STATUS_LETTER[status];
}

export function statusLabel(status: ChangeStatus): string {
  return STATUS_LABEL[status];
}

export function isFilterMode(value: unknown): value is FilterMode {
  return typeof value === 'string' && (FILTER_MODES as readonly string[]).includes(value);
}

/**
 * `isHidden` receives each path segment's name (folders and files) so the view's own
 * exclude/hidden-file settings still apply in filtered mode.
 */
export function buildChangeTree(
  rootUri: vscode.Uri,
  changes: readonly WorktreeChange[],
  isHidden: (name: string) => boolean = () => false
): ChangeTree {
  const children = new Map<string, Map<string, ChangeNode>>();
  const add = (parent: vscode.Uri, node: ChangeNode) => {
    const key = parent.toString();
    let siblings = children.get(key);
    if (!siblings) {
      siblings = new Map();
      children.set(key, siblings);
    }
    const existing = siblings.get(node.uri.toString());
    // A folder entry never overwrites a file entry for the same path, and vice versa keeps the first.
    if (!existing) {
      siblings.set(node.uri.toString(), node);
    }
  };

  for (const change of changes) {
    if (!isDescendantPath(rootUri.fsPath, change.uri.fsPath) || pathsEqual(rootUri.fsPath, change.uri.fsPath)) {
      continue;
    }
    const relative = change.uri.path.slice(rootUri.path.replace(/\/+$/, '').length + 1);
    const segments = relative.split('/').filter(Boolean);
    if (segments.length === 0 || segments.some((segment) => isHidden(segment))) {
      continue;
    }
    let parent = rootUri;
    segments.forEach((segment, index) => {
      const uri = vscode.Uri.joinPath(parent, segment);
      const isLast = index === segments.length - 1;
      add(parent, isLast ? { uri, name: segment, isDirectory: false, status: change.status } : { uri, name: segment, isDirectory: true });
      parent = uri;
    });
  }

  const result = new Map<string, ChangeNode[]>();
  for (const [key, siblings] of children) {
    result.set(
      key,
      [...siblings.values()].sort((a, b) => (a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1))
    );
  }
  return result;
}
