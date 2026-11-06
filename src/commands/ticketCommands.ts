import * as vscode from 'vscode';
import type { SelectionSnapshot } from '../selection';
import type { TicketInfo, TicketService } from '../ticket';
import { OPEN_TICKET_LINK_COMMAND, OPEN_TICKET_NOTES_COMMAND, COPY_TEST_COMMAND_COMMAND } from './constants';

// #19: ticket actions. None of these runs a shell or a terminal: the link opens through
// env.openExternal (validated https only, see src/ticket/ticketMetadata.ts), the notes open in
// VS Code's own Markdown preview, and the test command is only copied to the clipboard.

export interface TicketCommandDependencies {
  readonly tickets: Pick<TicketService, 'getTicket'>;
  readonly selection: { readonly snapshot: SelectionSnapshot };
  /** Injectable for tests; defaults to vscode.env.openExternal. */
  readonly openExternal?: (uri: vscode.Uri) => Thenable<boolean>;
}

/** A command target: a Tickets-view row (anything carrying `rootUri`), else the active worktree. */
export interface TicketTarget {
  readonly rootUri: vscode.Uri;
}

async function resolveTicket(deps: TicketCommandDependencies, target: TicketTarget | undefined): Promise<TicketInfo | undefined> {
  const rootUri = target?.rootUri ?? deps.selection.snapshot.activeWorktreeUri;
  return rootUri ? deps.tickets.getTicket(rootUri) : undefined;
}

export async function openTicketLink(deps: TicketCommandDependencies, target?: TicketTarget): Promise<boolean> {
  const info = await resolveTicket(deps, target);
  const url = info?.metadata?.ticketUrl;
  if (!url) {
    void vscode.window.showInformationMessage(
      'No ticket link found. Add one to the notes file, or set worktreeExplorer.ticket.urlTemplate.'
    );
    return false;
  }
  const open = deps.openExternal ?? ((uri: vscode.Uri) => vscode.env.openExternal(uri));
  return open(vscode.Uri.parse(url, true));
}

export async function openTicketNotes(deps: TicketCommandDependencies, target?: TicketTarget): Promise<boolean> {
  const info = await resolveTicket(deps, target);
  const notesUri = info?.metadata?.notesUri;
  if (!notesUri) {
    void vscode.window.showInformationMessage('This worktree has no ticket notes file.');
    return false;
  }
  await vscode.commands.executeCommand('markdown.showPreview', notesUri);
  return true;
}

export async function copyTestCommand(deps: TicketCommandDependencies, target?: TicketTarget): Promise<boolean> {
  const info = await resolveTicket(deps, target);
  const command = info?.metadata?.testCommand;
  if (!command) {
    void vscode.window.showInformationMessage('No test command found in the ticket notes file.');
    return false;
  }
  await vscode.env.clipboard.writeText(command);
  const hint = /<[a-z]+>/i.test(command) ? ' Replace the placeholder before running it.' : '';
  void vscode.window.showInformationMessage(`Test command copied.${hint}`);
  return true;
}

export function registerTicketCommands(deps: TicketCommandDependencies): vscode.Disposable {
  return vscode.Disposable.from(
    vscode.commands.registerCommand(OPEN_TICKET_LINK_COMMAND, (target?: TicketTarget) => openTicketLink(deps, target)),
    vscode.commands.registerCommand(OPEN_TICKET_NOTES_COMMAND, (target?: TicketTarget) => openTicketNotes(deps, target)),
    vscode.commands.registerCommand(COPY_TEST_COMMAND_COMMAND, (target?: TicketTarget) => copyTestCommand(deps, target))
  );
}
