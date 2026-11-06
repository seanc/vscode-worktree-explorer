import * as vscode from 'vscode';
import type { GitIntegrationService } from '../git';
import type { TicketInfo, TicketService } from '../ticket';
import { formatRef } from '../common/format';
import {
  OPEN_WORKTREE_IN_NEW_WINDOW_COMMAND,
  SHOW_IN_WORKTREE_EXPLORER_COMMAND,
  COPY_CLEANUP_COMMAND_COMMAND,
  REMOVE_WORKTREE_COMMAND,
  REFRESH_TICKETS_COMMAND
} from './constants';

// #22/#24: Tickets-view actions. The cleanup command is only copied, never run. Removing a
// worktree is the one destructive action: linked worktrees only, always behind a modal
// confirmation, never forced, and refused in an untrusted workspace.

interface RootTarget {
  readonly rootUri: vscode.Uri;
}

interface TicketTarget extends RootTarget {
  readonly info?: TicketInfo;
}

export interface TicketsViewCommandDependencies {
  readonly selection: { selectManually(uri: vscode.Uri): void };
  readonly refresh: () => void;
}

export interface RemoveWorktreeDependencies {
  readonly git: Pick<GitIntegrationService, 'removeWorktree'>;
  readonly tickets: Pick<TicketService, 'getTicket'>;
  readonly refresh: () => void;
  /** Injectable for tests; defaults to a modal warning with a single "Remove worktree" button. */
  readonly confirm?: (message: string, detail: string) => Thenable<boolean>;
}

const REMOVE_BUTTON = 'Remove worktree';

/** Fills `{key}` in the configured cleanup command; undefined without a template or a key. */
export function buildCleanupCommand(template: string, key: string | undefined): string | undefined {
  if (!template.trim() || !key || !template.includes('{key}')) {
    return undefined;
  }
  return template.trim().replace(/\{key\}/g, key);
}

function readCleanupTemplate(): string {
  return vscode.workspace.getConfiguration('worktreeExplorer.ticket').get<string>('cleanupCommand', '');
}

export async function openWorktreeInNewWindow(target: RootTarget | undefined): Promise<void> {
  if (target) {
    await vscode.commands.executeCommand('vscode.openFolder', target.rootUri, { forceNewWindow: true });
  }
}

export async function showInWorktreeExplorer(deps: TicketsViewCommandDependencies, target: RootTarget | undefined): Promise<void> {
  if (!target) {
    return;
  }
  deps.selection.selectManually(target.rootUri);
  await vscode.commands.executeCommand('worktreeExplorer.files.focus');
}

export async function copyCleanupCommand(target: TicketTarget | undefined): Promise<boolean> {
  const command = buildCleanupCommand(readCleanupTemplate(), target?.info?.metadata?.key);
  if (!command) {
    void vscode.window.showInformationMessage('Set worktreeExplorer.ticket.cleanupCommand (with a {key} placeholder) to copy a cleanup command.');
    return false;
  }
  await vscode.env.clipboard.writeText(command);
  void vscode.window.showInformationMessage(`Copied: ${command}`);
  return true;
}

/** The confirmation text for removing `info`'s worktree. */
export function describeRemoval(info: TicketInfo, cleanupCommand: string | undefined): { message: string; detail: string } {
  const label = info.metadata?.key ?? info.worktree.displayName;
  const lines = [
    'This deletes the worktree folder:',
    info.worktree.rootUri.fsPath,
    '',
    `The branch ${formatRef(info.worktree)} is kept.`,
    cleanupCommand ? `Cloned databases are not dropped. Run "${cleanupCommand}" for that.` : 'Cloned databases, if any, are not dropped.'
  ];
  return { message: `Remove worktree ${label}?`, detail: lines.join('\n') };
}

/** #24: removes a linked worktree after a modal confirmation. */
export async function removeWorktree(deps: RemoveWorktreeDependencies, target: RootTarget | undefined): Promise<boolean> {
  if (!target) {
    return false;
  }
  if (!vscode.workspace.isTrusted) {
    void vscode.window.showErrorMessage('This action is disabled because the workspace is not trusted.');
    return false;
  }
  const info = await deps.tickets.getTicket(target.rootUri);
  if (!info || info.worktree.isMain) {
    void vscode.window.showErrorMessage('Only a linked worktree can be removed.');
    return false;
  }
  const uncommitted = info.comparison?.uncommitted.length ?? 0;
  if (uncommitted > 0) {
    void vscode.window.showWarningMessage(
      `${info.metadata?.key ?? info.worktree.displayName} has ${uncommitted} uncommitted change${uncommitted === 1 ? '' : 's'}. Commit, stash, or delete them before removing the worktree.`
    );
    return false;
  }

  const cleanupCommand = buildCleanupCommand(readCleanupTemplate(), info.metadata?.key);
  const { message, detail } = describeRemoval(info, cleanupCommand);
  const confirm =
    deps.confirm ??
    ((m: string, d: string) => vscode.window.showWarningMessage(m, { modal: true, detail: d }, REMOVE_BUTTON).then((choice) => choice === REMOVE_BUTTON));
  if (!(await confirm(message, detail))) {
    return false;
  }

  try {
    await deps.git.removeWorktree(target.rootUri);
  } catch (error) {
    void vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Git could not remove the worktree.');
    deps.refresh();
    return false;
  }
  deps.refresh();

  const label = info.metadata?.key ?? info.worktree.displayName;
  if (cleanupCommand) {
    void vscode.window.showInformationMessage(`Removed worktree ${label}. Its databases are still there.`, 'Copy cleanup command').then((choice) => {
      if (choice) {
        void vscode.env.clipboard.writeText(cleanupCommand);
      }
    });
  } else {
    void vscode.window.showInformationMessage(`Removed worktree ${label}. The branch was kept.`);
  }
  return true;
}

export function registerTicketsViewCommands(deps: TicketsViewCommandDependencies & RemoveWorktreeDependencies): vscode.Disposable {
  return vscode.Disposable.from(
    vscode.commands.registerCommand(OPEN_WORKTREE_IN_NEW_WINDOW_COMMAND, (target?: RootTarget) => openWorktreeInNewWindow(target)),
    vscode.commands.registerCommand(SHOW_IN_WORKTREE_EXPLORER_COMMAND, (target?: RootTarget) => showInWorktreeExplorer(deps, target)),
    vscode.commands.registerCommand(COPY_CLEANUP_COMMAND_COMMAND, (target?: TicketTarget) => copyCleanupCommand(target)),
    vscode.commands.registerCommand(REMOVE_WORKTREE_COMMAND, (target?: RootTarget) => removeWorktree(deps, target)),
    vscode.commands.registerCommand(REFRESH_TICKETS_COMMAND, () => deps.refresh())
  );
}
