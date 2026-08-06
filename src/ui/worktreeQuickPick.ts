import * as vscode from 'vscode';
import type { WorktreeDescriptor } from '../common/types';
import { basename, formatRef } from '../common/format';

export interface WorktreeQuickPickItem extends vscode.QuickPickItem {
  readonly worktree: WorktreeDescriptor;
}

export interface QuickPickBuildOptions {
  readonly activeUri: vscode.Uri | undefined;
  readonly isScmSelected: (uri: vscode.Uri) => boolean;
}

/**
 * PRD §9.3/§16.4/AC-15: builds Quick Pick entries for every discovered linked worktree. Grouped
 * by owning repository with a separator header, but only when more than one unrelated repository
 * is open — a single-repository workspace shows a flat list.
 */
export function buildQuickPickItems(
  worktrees: readonly WorktreeDescriptor[],
  options: QuickPickBuildOptions
): (vscode.QuickPickItem | WorktreeQuickPickItem)[] {
  const groups = groupByRepository(worktrees);
  const showGroupHeaders = groups.size > 1;
  const items: (vscode.QuickPickItem | WorktreeQuickPickItem)[] = [];

  for (const group of groups.values()) {
    if (showGroupHeaders) {
      items.push({ label: basename(group[0].repositoryRoot), kind: vscode.QuickPickItemKind.Separator });
    }
    for (const worktree of group) {
      items.push(toItem(worktree, options));
    }
  }
  return items;
}

function toItem(worktree: WorktreeDescriptor, options: QuickPickBuildOptions): WorktreeQuickPickItem {
  const isActive = options.activeUri?.toString() === worktree.rootUri.toString();
  const isScmSelected = options.isScmSelected(worktree.rootUri);
  return {
    worktree,
    label: `${isActive ? '$(check) ' : ''}${formatRef(worktree)}${isScmSelected ? ' $(source-control)' : ''}`,
    description: worktree.displayName,
    detail: worktree.rootUri.fsPath,
    picked: isActive
  };
}

function groupByRepository(worktrees: readonly WorktreeDescriptor[]): Map<string, WorktreeDescriptor[]> {
  const groups = new Map<string, WorktreeDescriptor[]>();
  for (const worktree of worktrees) {
    const key = worktree.repositoryRoot.toString();
    const group = groups.get(key);
    if (group) {
      group.push(worktree);
    } else {
      groups.set(key, [worktree]);
    }
  }
  return groups;
}

/**
 * PRD §9.3/§9.9: shows the picker and returns the chosen worktree. Returns undefined if the user
 * cancels, or if there are no linked worktrees to choose from — in which case a message is shown
 * instead (§9.9: "No linked Git worktrees were found"), reachable from the Command Palette even
 * while the tree view itself stays hidden.
 */
export async function showWorktreeQuickPick(
  worktrees: readonly WorktreeDescriptor[],
  options: QuickPickBuildOptions
): Promise<WorktreeDescriptor | undefined> {
  if (worktrees.length === 0) {
    // Not awaited: nothing downstream needs to wait for the user to dismiss the notification.
    void vscode.window.showInformationMessage('No linked Git worktrees were found.');
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(buildQuickPickItems(worktrees, options), {
    placeHolder: 'Select a linked Git worktree',
    matchOnDescription: true,
    matchOnDetail: true
  });
  return picked && 'worktree' in picked ? picked.worktree : undefined;
}
