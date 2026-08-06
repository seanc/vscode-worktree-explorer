import * as vscode from 'vscode';
import type { FileSystemService, RootBoundaryGuard, GuardContext } from '../filesystem';
import type { SelectionSnapshot } from '../selection';
import type { WorktreeTreeProvider, WorktreeTreeItem } from '../tree';
import { OperationError, userMessageFor, reportUnexpectedError } from '../common';
import { NEW_FILE_COMMAND, NEW_FOLDER_COMMAND, OPEN_COMMAND } from './constants';

export type NewEntryKind = 'file' | 'folder';

// Narrowed to just what this module needs, rather than the full concrete classes, so tests can
// pass plain fakes (SelectionCoordinator/WorktreeTreeProvider have private fields that make the
// full class types effectively nominal — see SelectionCoordinator's own GitIntegrationSource for
// the same pattern).
export interface NewEntryDependencies {
  readonly fileSystem: Pick<FileSystemService, 'createFile' | 'createDirectory'>;
  readonly guard: Pick<RootBoundaryGuard, 'resolveNewPath'>;
  readonly selection: { readonly snapshot: SelectionSnapshot };
  readonly treeProvider: Pick<WorktreeTreeProvider, 'refresh'>;
  readonly outputChannel: vscode.OutputChannel;
}

/** PRD §12/§13.3: New File and New Folder, invoked either from a folder's context menu
 *  (`item` is that folder) or from the view title / Command Palette (no `item`), in which case
 *  the file is created at the active worktree root (FR-FILE-01: "at the root or within a
 *  selected directory"). */
export function registerNewFileCommand(deps: NewEntryDependencies): vscode.Disposable {
  return vscode.commands.registerCommand(NEW_FILE_COMMAND, (item?: WorktreeTreeItem) => promptAndCreate(deps, item, 'file'));
}

export function registerNewFolderCommand(deps: NewEntryDependencies): vscode.Disposable {
  return vscode.commands.registerCommand(NEW_FOLDER_COMMAND, (item?: WorktreeTreeItem) => promptAndCreate(deps, item, 'folder'));
}

async function promptAndCreate(deps: NewEntryDependencies, item: WorktreeTreeItem | undefined, kind: NewEntryKind): Promise<void> {
  if (!checkTrust()) {
    return;
  }
  const activeUri = deps.selection.snapshot.activeWorktreeUri;
  if (!activeUri) {
    return;
  }
  const parentUri = item?.itemType === 'folder' ? item.entry.uri : activeUri;
  const context: GuardContext = { rootUri: activeUri, rootGeneration: deps.selection.snapshot.rootGeneration };

  const name = await vscode.window.showInputBox({
    prompt: kind === 'file' ? 'New file name' : 'New folder name',
    placeHolder: kind === 'file' ? 'example.txt' : 'example',
    validateInput: quickValidate
  });
  if (!name) {
    return; // cancelled
  }

  await createEntry(deps, context, parentUri, name, kind);
}

/**
 * SEC-04: mutating commands are disabled by default in an untrusted workspace. The view/title and
 * context-menu entries already gate on the built-in `isWorkspaceTrusted` context key; this is the
 * defense-in-depth check for Command Palette / programmatic invocation.
 */
function checkTrust(): boolean {
  if (vscode.workspace.isTrusted) {
    return true;
  }
  void vscode.window.showErrorMessage('This action is disabled because the workspace is not trusted.');
  return false;
}

/**
 * The scriptable core of New File/New Folder, separated from the interactive `showInputBox` call
 * above so it can be exercised directly in tests (`vscode.window.showInputBox` has no public API
 * a test can drive non-interactively, the same constraint noted for showQuickPick in #5).
 * AC-07: validates through RootBoundaryGuard, creates the entry, refreshes the parent, and (for
 * files) opens the new item.
 */
export async function createEntry(
  deps: NewEntryDependencies,
  context: GuardContext,
  parentUri: vscode.Uri,
  name: string,
  kind: NewEntryKind
): Promise<vscode.Uri | undefined> {
  const currentGeneration = deps.selection.snapshot.rootGeneration;
  const resolved = deps.guard.resolveNewPath(context, parentUri, name, currentGeneration);
  if (!resolved.ok) {
    void vscode.window.showErrorMessage(userMessageFor(resolved.reason!));
    return undefined;
  }

  try {
    if (kind === 'file') {
      await deps.fileSystem.createFile(resolved.uri!);
    } else {
      await deps.fileSystem.createDirectory(resolved.uri!);
    }
  } catch (error) {
    if (error instanceof OperationError) {
      void vscode.window.showErrorMessage(error.message);
    } else {
      reportUnexpectedError(deps.outputChannel, `create ${kind}`, error);
      void vscode.window.showErrorMessage('Unable to complete the operation. See the Worktree Explorer output channel for details.');
    }
    return undefined;
  }

  // Full-tree refresh for MVP (affected-parent-only refresh is a #15 optimization).
  deps.treeProvider.refresh();
  if (kind === 'file') {
    await vscode.commands.executeCommand(OPEN_COMMAND, resolved.uri);
  }
  return resolved.uri;
}

/** Fast client-side feedback in the input box; RootBoundaryGuard.resolveNewPath is the
 *  authoritative check run against the submitted value. */
function quickValidate(value: string): string | undefined {
  if (value.length === 0) {
    return 'A name is required.';
  }
  if (value.includes('..')) {
    return 'The name cannot navigate outside the selected worktree.';
  }
  return undefined;
}
