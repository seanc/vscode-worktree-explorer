import * as path from 'path';
import * as vscode from 'vscode';
import type { FileSystemService, RootBoundaryGuard, GuardContext } from '../filesystem';
import type { SelectionSnapshot } from '../selection';
import type { WorktreeTreeProvider, WorktreeTreeItem } from '../tree';
import { OperationError, userMessageFor, reportUnexpectedError, basename } from '../common';
import { DELETE_COMMAND } from './constants';

export interface DeleteDependencies {
  readonly fileSystem: Pick<FileSystemService, 'delete'>;
  readonly guard: Pick<RootBoundaryGuard, 'validateExistingTarget'>;
  readonly selection: { readonly snapshot: SelectionSnapshot };
  readonly treeProvider: Pick<WorktreeTreeProvider, 'refresh'>;
  readonly outputChannel: vscode.OutputChannel;
}

/** PRD §12/§13.2/§13.3: delete a file or (recursively) a folder. */
export function registerDeleteCommand(deps: DeleteDependencies): vscode.Disposable {
  return vscode.commands.registerCommand(DELETE_COMMAND, (item?: WorktreeTreeItem) => confirmAndDelete(deps, item));
}

async function confirmAndDelete(deps: DeleteDependencies, item: WorktreeTreeItem | undefined): Promise<void> {
  if (!checkTrust()) {
    return;
  }
  const activeUri = deps.selection.snapshot.activeWorktreeUri;
  if (!activeUri || !item) {
    return;
  }

  const config = readDeleteConfig();
  if (config.confirmDelete && !(await confirmDeletion(item, activeUri))) {
    return;
  }

  // Re-read the generation now, not the value captured before the (potentially long-lived)
  // confirmation dialog — the guard call inside deleteEntry() re-validates it, so a root switch
  // while the dialog was open is caught rather than silently deleting from the wrong worktree.
  const context: GuardContext = { rootUri: activeUri, rootGeneration: deps.selection.snapshot.rootGeneration };
  await deleteEntry(deps, context, item.entry.uri, item.itemType === 'folder', config.useTrash);
}

function checkTrust(): boolean {
  if (vscode.workspace.isTrusted) {
    return true;
  }
  void vscode.window.showErrorMessage('This action is disabled because the workspace is not trusted.');
  return false;
}

/** SEC-07: name, type, relative path, and owning worktree. */
async function confirmDeletion(item: WorktreeTreeItem, activeUri: vscode.Uri): Promise<boolean> {
  const relativePath = path.relative(activeUri.fsPath, item.entry.uri.fsPath);
  const worktreeName = basename(activeUri);
  const kindLabel = item.itemType === 'folder' ? 'folder' : 'file';
  const message = `Delete ${kindLabel} "${item.entry.name}" (${relativePath}) in worktree "${worktreeName}"? This cannot be undone from within VS Code.`;
  const choice = await vscode.window.showWarningMessage(message, { modal: true }, 'Delete');
  return choice === 'Delete';
}

/**
 * The scriptable core of Delete (see #9's createEntry for why this is split from the interactive
 * prompt). AC-09/AC-10: confirmed deletion removes the item and refreshes the tree; the active
 * worktree root itself is rejected by the guard before any filesystem call.
 */
export async function deleteEntry(
  deps: DeleteDependencies,
  context: GuardContext,
  targetUri: vscode.Uri,
  recursive: boolean,
  useTrash: boolean
): Promise<boolean> {
  const currentGeneration = deps.selection.snapshot.rootGeneration;
  const check = await deps.guard.validateExistingTarget(context, targetUri, currentGeneration);
  if (!check.ok) {
    void vscode.window.showErrorMessage(userMessageFor(check.reason!));
    return false;
  }

  try {
    await deps.fileSystem.delete(targetUri, { recursive, useTrash });
  } catch (error) {
    if (error instanceof OperationError) {
      void vscode.window.showErrorMessage(error.message);
      deps.treeProvider.refresh();
      return false;
    }
    // PRD §19.4: "If trash is unavailable, require confirmation before permanent deletion."
    // There is no documented/stable FileSystemError code specifically for "trash unsupported" to
    // branch on precisely; by this point NoPermissions/FileExists are already ruled out (handled
    // as OperationError above), so any other failure during a useTrash delete is treated as a
    // trash-availability problem and offered this fallback, rather than risking a silent
    // permanent delete the user never confirmed.
    if (useTrash) {
      const proceed = await vscode.window.showWarningMessage(
        'The trash is unavailable on this system. Permanently delete instead?',
        { modal: true },
        'Delete Permanently'
      );
      if (proceed === 'Delete Permanently') {
        return deleteEntry(deps, context, targetUri, recursive, false);
      }
      return false;
    }
    // FR-FILE-06: a concurrent change (e.g. already deleted by another process) — refresh rather
    // than retry.
    reportUnexpectedError(deps.outputChannel, 'delete', error);
    void vscode.window.showErrorMessage('Unable to complete the operation. See the Worktree Explorer output channel for details.');
    deps.treeProvider.refresh();
    return false;
  }

  deps.treeProvider.refresh();
  return true;
}

interface DeleteConfig {
  readonly confirmDelete: boolean;
  readonly useTrash: boolean;
}

function readDeleteConfig(): DeleteConfig {
  const config = vscode.workspace.getConfiguration('worktreeExplorer');
  return {
    confirmDelete: config.get<boolean>('confirmDelete', true),
    useTrash: config.get<boolean>('useTrash', true)
  };
}
