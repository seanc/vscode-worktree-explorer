import * as vscode from 'vscode';
import type { WorktreeDescriptor } from '../common/types';
import { formatRef } from '../common/format';

/** PRD §9.2: the view description format "<branch-or-ref> · <folder-name>". */
export function describeActiveWorktree(
  worktrees: readonly WorktreeDescriptor[],
  activeUri: vscode.Uri | undefined
): string | undefined {
  if (!activeUri) {
    return undefined;
  }
  const active = worktrees.find((w) => w.rootUri.toString() === activeUri.toString());
  return active ? `${formatRef(active)} · ${active.displayName}` : undefined;
}
