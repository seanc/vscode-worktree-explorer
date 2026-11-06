import * as vscode from 'vscode';
import type { TicketService } from '../ticket';
import { buildServeCommand, readTunnelConfig, readServedPath, isServed } from './tunnel';

export const SERVE_VIA_TUNNEL_COMMAND = 'worktreeExplorer.serveViaTunnel';

export interface ServeDependencies {
  readonly tickets: Pick<TicketService, 'getTicket' | 'refresh'>;
  /** Injectable for tests. */
  readonly confirm?: (message: string, detail: string, button: string) => Thenable<boolean>;
  readonly runInTerminal?: (name: string, cwd: vscode.Uri, command: string) => void;
}

export function describeServe(label: string, command: string): { message: string; detail: string; button: string } {
  return {
    message: `Serve ${label} through the tunnel?`,
    detail: [
      'Every session using the tunnel switches to this checkout, so check that nobody is in the middle of using it.',
      '',
      `Runs in a new terminal: ${command}`,
      'Answer its questions there; it keeps the queue workers running until you stop it.'
    ].join('\n'),
    button: `Serve ${label}`
  };
}

/**
 * #26: points the tunnel at a checkout by running the user's configured serve command in a
 * visible terminal, after a modal confirmation. The target is the ticket key, or "main" for the
 * main checkout, and must be plain characters (see isSafeServeTarget).
 */
export async function serveViaTunnel(deps: ServeDependencies, target: { rootUri: vscode.Uri } | undefined): Promise<boolean> {
  if (!target) {
    return false;
  }
  if (!vscode.workspace.isTrusted) {
    void vscode.window.showErrorMessage('This action is disabled because the workspace is not trusted.');
    return false;
  }
  const config = readTunnelConfig();
  const info = await deps.tickets.getTicket(target.rootUri);
  if (!info) {
    return false;
  }
  const serveTarget = info.worktree.isMain ? 'main' : info.metadata?.key;
  const command = buildServeCommand(config.serveCommand, serveTarget);
  if (!command) {
    void vscode.window.showInformationMessage(
      info.worktree.isMain || info.metadata?.key
        ? 'Set worktreeExplorer.tunnel.serveCommand in your user settings, with a {target} placeholder.'
        : 'This worktree has no ticket key to serve.'
    );
    return false;
  }
  if (isServed(info.worktree.rootUri, await readServedPath(config.siteLink))) {
    void vscode.window.showInformationMessage(`The tunnel already serves ${serveTarget}.`);
    return false;
  }

  const label = serveTarget === 'main' ? 'the main checkout' : serveTarget!;
  const text = describeServe(label, command);
  const confirm =
    deps.confirm ??
    ((m: string, d: string, b: string) => vscode.window.showWarningMessage(m, { modal: true, detail: d }, b).then((choice) => choice === b));
  if (!(await confirm(text.message, text.detail, text.button))) {
    return false;
  }

  const run =
    deps.runInTerminal ??
    ((name: string, cwd: vscode.Uri, line: string) => {
      const terminal = vscode.window.createTerminal({ name, cwd });
      terminal.show();
      terminal.sendText(line);
    });
  run(`tunnel: ${serveTarget}`, info.worktree.rootUri, command);
  deps.tickets.refresh();
  return true;
}

export function registerServeCommand(deps: ServeDependencies): vscode.Disposable {
  return vscode.commands.registerCommand(SERVE_VIA_TUNNEL_COMMAND, (target?: { rootUri: vscode.Uri }) => serveViaTunnel(deps, target));
}
