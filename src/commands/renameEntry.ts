import * as vscode from 'vscode';
import type { FileSystemService, RootBoundaryGuard, GuardContext } from '../filesystem';
import type { SelectionSnapshot } from '../selection';
import type { WorktreeTreeProvider, WorktreeTreeItem } from '../tree';
import { OperationError, userMessageFor, reportUnexpectedError } from '../common';
import { RENAME_COMMAND } from './constants';

export interface RenameDependencies {
  readonly fileSystem: Pick<FileSystemService, 'rename'>;
  readonly guard: Pick<RootBoundaryGuard, 'resolveNewPath' | 'validateExistingTarget'>;
  readonly selection: { readonly snapshot: SelectionSnapshot };
  readonly treeProvider: Pick<WorktreeTreeProvider, 'refresh'>;
  readonly outputChannel: vscode.OutputChannel;
}

/** PRD §12/§13.2/§13.3: rename a file or folder. */
export function registerRenameCommand(deps: RenameDependencies): vscode.Disposable {
  return vscode.commands.registerCommand(RENAME_COMMAND, (item?: WorktreeTreeItem) => promptAndRename(deps, item));
}

async function promptAndRename(deps: RenameDependencies, item: WorktreeTreeItem | undefined): Promise<void> {
  if (!checkTrust()) {
    return;
  }
  const activeUri = deps.selection.snapshot.activeWorktreeUri;
  if (!activeUri || !item) {
    return;
  }

  const newName = await vscode.window.showInputBox({
    prompt: 'New name',
    value: item.entry.name,
    valueSelection: [0, item.entry.name.lastIndexOf('.') > 0 ? item.entry.name.lastIndexOf('.') : item.entry.name.length],
    validateInput: quickValidate
  });
  if (!newName || newName === item.entry.name) {
    return; // cancelled, or unchanged
  }

  const context: GuardContext = { rootUri: activeUri, rootGeneration: deps.selection.snapshot.rootGeneration };
  await renameEntry(deps, context, item.entry.uri, newName);
}

function checkTrust(): boolean {
  if (vscode.workspace.isTrusted) {
    return true;
  }
  void vscode.window.showErrorMessage('This action is disabled because the workspace is not trusted.');
  return false;
}

/**
 * The scriptable core of Rename (see #9's createEntry for why this is split from the interactive
 * prompt). AC-08: renaming changes the filesystem item without changing the active worktree —
 * this never touches SelectionCoordinator, only the filesystem and the tree.
 */
export async function renameEntry(
  deps: RenameDependencies,
  context: GuardContext,
  sourceUri: vscode.Uri,
  newName: string
): Promise<vscode.Uri | undefined> {
  const currentGeneration = deps.selection.snapshot.rootGeneration;

  const sourceCheck = await deps.guard.validateExistingTarget(context, sourceUri, currentGeneration);
  if (!sourceCheck.ok) {
    void vscode.window.showErrorMessage(userMessageFor(sourceCheck.reason!));
    return undefined;
  }

  // FR-FILE-03: path separators are prohibited in the new name for MVP. RootBoundaryGuard's
  // resolveNewPath permits nested paths generically (it's shared with #9's create, which needs
  // that) — rename is the one that must reject them, authoritatively, not just in the input box's
  // quickValidate above.
  if (/[\\/]/.test(newName)) {
    void vscode.window.showErrorMessage(userMessageFor('traversal'));
    return undefined;
  }

  const parentUri = vscode.Uri.joinPath(sourceUri, '..');
  const destinationCheck = deps.guard.resolveNewPath(context, parentUri, newName, currentGeneration);
  if (!destinationCheck.ok) {
    void vscode.window.showErrorMessage(userMessageFor(destinationCheck.reason!));
    return undefined;
  }

  try {
    await deps.fileSystem.rename(sourceUri, destinationCheck.uri!);
  } catch (error) {
    if (error instanceof OperationError) {
      void vscode.window.showErrorMessage(error.message);
    } else {
      // FR-FILE-06: a concurrent change (e.g. the source was already moved/deleted) — refresh
      // rather than retry.
      reportUnexpectedError(deps.outputChannel, 'rename', error);
      void vscode.window.showErrorMessage('Unable to complete the operation. See the Worktree Explorer output channel for details.');
    }
    deps.treeProvider.refresh();
    return undefined;
  }

  deps.treeProvider.refresh();
  return destinationCheck.uri;
}

/** FR-FILE-03: path separators are prohibited in the new name for MVP — RootBoundaryGuard's
 *  resolveNewPath permits nested paths generically (for #9's create), so rename enforces this
 *  itself, both here (fast UX feedback) and authoritatively in renameEntry(). */
function quickValidate(value: string): string | undefined {
  if (value.length === 0) {
    return 'A name is required.';
  }
  if (/[\\/]/.test(value)) {
    return 'The name cannot contain a path separator.';
  }
  return undefined;
}
