import * as path from 'path';
import * as vscode from 'vscode';
import type { GitIntegrationService } from '../git';
import type { SelectionSnapshot } from '../selection';
import type { WorktreeTreeItem } from '../tree';
import { isDescendantPath } from '../common/paths';
import { basename } from '../common/format';
import { COMPARE_WITH_BASE_COMMAND, COMPARE_WITH_MAIN_CHECKOUT_COMMAND, OPEN_IN_MAIN_CHECKOUT_COMMAND } from './constants';

// #21: read-only comparison commands for a file in the active worktree. They only open editors.

export interface CompareCommandDependencies {
  readonly git: Pick<GitIntegrationService, 'listWorktrees' | 'compareWithBase' | 'toGitUri'>;
  readonly selection: { readonly snapshot: SelectionSnapshot };
}

/** Maps a file in `worktreeRoot` to the same relative path in `mainRoot`; undefined if the file
 *  is not inside the worktree. */
export function mapToMainCheckout(worktreeRoot: vscode.Uri, mainRoot: vscode.Uri, fileUri: vscode.Uri): vscode.Uri | undefined {
  if (!isDescendantPath(worktreeRoot.fsPath, fileUri.fsPath)) {
    return undefined;
  }
  const relative = path.relative(worktreeRoot.fsPath, fileUri.fsPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return undefined;
  }
  return vscode.Uri.joinPath(mainRoot, ...relative.split(path.sep));
}

function mainCheckoutUriFor(deps: CompareCommandDependencies, item: WorktreeTreeItem): vscode.Uri | undefined {
  const activeUri = deps.selection.snapshot.activeWorktreeUri;
  if (!activeUri) {
    return undefined;
  }
  const worktree = deps.git.listWorktrees().find((w) => w.rootUri.toString() === activeUri.toString());
  if (!worktree || worktree.isMain) {
    return undefined;
  }
  return mapToMainCheckout(activeUri, worktree.repositoryRoot, item.entry.uri);
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

export async function compareWithBase(deps: CompareCommandDependencies, item: WorktreeTreeItem | undefined): Promise<boolean> {
  const activeUri = deps.selection.snapshot.activeWorktreeUri;
  if (!activeUri || !item) {
    return false;
  }
  return openBaseDiff(deps.git, activeUri, item.entry.uri, item.itemType === 'deletedFile');
}

/** #21/#25: opens `fileUri` (inside `rootUri`) against its version at the merge base. A deleted
 *  file has nothing on disk to diff against, so its base version opens on its own. */
export async function openBaseDiff(
  git: CompareCommandDependencies['git'],
  rootUri: vscode.Uri,
  fileUri: vscode.Uri,
  deleted: boolean
): Promise<boolean> {
  if (!isDescendantPath(rootUri.fsPath, fileUri.fsPath)) {
    return false;
  }
  const comparison = await git.compareWithBase(rootUri);
  const baseUri = comparison ? git.toGitUri(fileUri, comparison.mergeBase) : undefined;
  if (!comparison || !baseUri) {
    void vscode.window.showInformationMessage('No base branch found. Set worktreeExplorer.baseBranch.');
    return false;
  }
  if (deleted) {
    await vscode.commands.executeCommand('vscode.open', baseUri);
    return true;
  }
  const title = `${basename(fileUri)} (${comparison.baseRef.replace(/^origin\//, '')} ↔ ${basename(rootUri)})`;
  await vscode.commands.executeCommand('vscode.diff', baseUri, fileUri, title);
  return true;
}

export async function compareWithMainCheckout(deps: CompareCommandDependencies, item: WorktreeTreeItem | undefined): Promise<boolean> {
  if (!item) {
    return false;
  }
  const mainUri = mainCheckoutUriFor(deps, item);
  if (!mainUri || !(await exists(mainUri))) {
    void vscode.window.showInformationMessage(`${item.entry.name} does not exist in the main checkout.`);
    return false;
  }
  await vscode.commands.executeCommand('vscode.diff', mainUri, item.entry.uri, `${item.entry.name} (main checkout ↔ worktree)`);
  return true;
}

export async function openInMainCheckout(deps: CompareCommandDependencies, item: WorktreeTreeItem | undefined): Promise<boolean> {
  if (!item) {
    return false;
  }
  const mainUri = mainCheckoutUriFor(deps, item);
  if (!mainUri || !(await exists(mainUri))) {
    void vscode.window.showInformationMessage(`${item.entry.name} does not exist in the main checkout.`);
    return false;
  }
  await vscode.commands.executeCommand('vscode.open', mainUri);
  return true;
}

export function registerCompareCommands(deps: CompareCommandDependencies): vscode.Disposable {
  return vscode.Disposable.from(
    vscode.commands.registerCommand(COMPARE_WITH_BASE_COMMAND, (item?: WorktreeTreeItem) => compareWithBase(deps, item)),
    vscode.commands.registerCommand(COMPARE_WITH_MAIN_CHECKOUT_COMMAND, (item?: WorktreeTreeItem) => compareWithMainCheckout(deps, item)),
    vscode.commands.registerCommand(OPEN_IN_MAIN_CHECKOUT_COMMAND, (item?: WorktreeTreeItem) => openInMainCheckout(deps, item))
  );
}
