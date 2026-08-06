import * as path from 'path';
import * as vscode from 'vscode';
import type { SelectionSnapshot } from '../selection';
import type { WorktreeTreeItem } from '../tree';
import {
  COPY_RELATIVE_PATH_COMMAND,
  COPY_ABSOLUTE_PATH_COMMAND,
  REVEAL_IN_OS_COMMAND,
  COPY_WORKTREE_PATH_COMMAND,
  REVEAL_WORKTREE_ROOT_COMMAND,
  OPEN_SETTINGS_COMMAND
} from './constants';

// Matches package.json's publisher.name — the argument workbench.action.openSettings expects to
// filter its search box to just this extension's settings.
const EXTENSION_ID = 'worktree-explorer.worktree-explorer';

export interface PathCommandDependencies {
  readonly selection: { readonly snapshot: SelectionSnapshot };
}

// Each command is a plain, directly-callable function, with register*Command as a thin
// vscode.commands.registerCommand wrapper — tests call the functions directly rather than
// re-registering the same command id the running extension already owns (which would collide).

/** FR-036, PRD §13.2/§13.3 (file and directory context menus). */
export async function copyRelativePath(deps: PathCommandDependencies, item: WorktreeTreeItem | undefined): Promise<void> {
  const activeUri = deps.selection.snapshot.activeWorktreeUri;
  if (!activeUri || !item) {
    return;
  }
  await vscode.env.clipboard.writeText(path.relative(activeUri.fsPath, item.entry.uri.fsPath));
}

export function registerCopyRelativePathCommand(deps: PathCommandDependencies): vscode.Disposable {
  return vscode.commands.registerCommand(COPY_RELATIVE_PATH_COMMAND, (item?: WorktreeTreeItem) => copyRelativePath(deps, item));
}

/** FR-037, PRD §13.2/§13.3. */
export async function copyAbsolutePath(item: WorktreeTreeItem | undefined): Promise<void> {
  if (!item) {
    return;
  }
  await vscode.env.clipboard.writeText(item.entry.uri.fsPath);
}

export function registerCopyAbsolutePathCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(COPY_ABSOLUTE_PATH_COMMAND, (item?: WorktreeTreeItem) => copyAbsolutePath(item));
}

/** FR-038, PRD §13.2/§13.3, via the built-in `revealFileInOS` command. */
export async function revealInOperatingSystem(item: WorktreeTreeItem | undefined): Promise<void> {
  if (!item) {
    return;
  }
  await vscode.commands.executeCommand('revealFileInOS', item.entry.uri);
}

export function registerRevealInOperatingSystemCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(REVEAL_IN_OS_COMMAND, (item?: WorktreeTreeItem) => revealInOperatingSystem(item));
}

/** PRD §13.1 overflow action: copies the active worktree root's absolute path. */
export async function copyWorktreePath(deps: PathCommandDependencies): Promise<void> {
  const activeUri = deps.selection.snapshot.activeWorktreeUri;
  if (!activeUri) {
    return;
  }
  await vscode.env.clipboard.writeText(activeUri.fsPath);
}

export function registerCopyWorktreePathCommand(deps: PathCommandDependencies): vscode.Disposable {
  return vscode.commands.registerCommand(COPY_WORKTREE_PATH_COMMAND, () => copyWorktreePath(deps));
}

/** PRD §13.1 overflow action: reveals the active worktree root itself. */
export async function revealWorktreeRoot(deps: PathCommandDependencies): Promise<void> {
  const activeUri = deps.selection.snapshot.activeWorktreeUri;
  if (!activeUri) {
    return;
  }
  await vscode.commands.executeCommand('revealFileInOS', activeUri);
}

export function registerRevealWorktreeRootCommand(deps: PathCommandDependencies): vscode.Disposable {
  return vscode.commands.registerCommand(REVEAL_WORKTREE_ROOT_COMMAND, () => revealWorktreeRoot(deps));
}

/** PRD §13.1 overflow action: opens Settings filtered to this extension. package.json menu
 *  contributions can't pass arguments to a built-in command directly, hence this wrapper. */
export async function openSettings(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${EXTENSION_ID}`);
}

export function registerOpenSettingsCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(OPEN_SETTINGS_COMMAND, () => openSettings());
}
