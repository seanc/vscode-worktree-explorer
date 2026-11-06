import * as vscode from 'vscode';
import type { GitIntegrationService } from '../git';
import type { TicketService } from '../ticket';
import { readTicketConfig } from '../ticket';
import type { SelectionSnapshot } from '../selection';
import {
  openTicketLink,
  openTicketNotes,
  copyTestCommand,
  openWorktreeInNewWindow,
  showInWorktreeExplorer,
  copyCleanupCommand,
  removeWorktree,
  openBaseDiff
} from '../commands';
import { buildOverviewModel, buildSidebarModel, type TunnelState } from './viewModel';
import { readTunnelConfig, readServedPath, serveViaTunnel } from '../tunnel';
import { createNonce, parseWebviewMessage, renderWebviewShell, type WebviewRequest } from './webviewMessages';

// #25: the design-A Tickets sidebar (WebviewView) and ticket overview (WebviewPanel). Both render
// a JSON model with textContent in media/*.js under a nonce-only CSP; every message coming back is
// validated by parseWebviewMessage and mapped to an existing command.

export interface TicketWebviewDependencies {
  readonly extensionUri: vscode.Uri;
  readonly tickets: Pick<TicketService, 'getTicket' | 'listTickets' | 'refresh'>;
  readonly git: Pick<GitIntegrationService, 'listWorktrees' | 'compareWithBase' | 'toGitUri' | 'removeWorktree'>;
  readonly selection: { readonly snapshot: SelectionSnapshot; selectManually(uri: vscode.Uri): void };
}

const TUNNEL_POLL_MS = 4000;

function cleanupCommandConfigured(): boolean {
  return vscode.workspace.getConfiguration('worktreeExplorer.ticket').get<string>('cleanupCommand', '').includes('{key}');
}

/** #26: the served checkout (from the configured site link) and whether serving is set up. */
async function readTunnelState(): Promise<TunnelState> {
  const config = readTunnelConfig();
  return { servedPath: await readServedPath(config.siteLink), serveConfigured: config.serveCommand.includes('{target}') };
}

function knownRoots(git: TicketWebviewDependencies['git']): Map<string, vscode.Uri> {
  return new Map(git.listWorktrees().map((w) => [w.rootUri.toString(), w.rootUri]));
}

function configureWebview(webview: vscode.Webview, extensionUri: vscode.Uri, script: string, title: string): void {
  const media = vscode.Uri.joinPath(extensionUri, 'media');
  webview.options = { enableScripts: true, enableCommandUris: false, localResourceRoots: [media] };
  webview.html = renderWebviewShell({
    cspSource: webview.cspSource,
    nonce: createNonce(),
    styleUri: webview.asWebviewUri(vscode.Uri.joinPath(media, 'tickets.css')).toString(),
    scriptUris: ['common.js', script].map((name) => webview.asWebviewUri(vscode.Uri.joinPath(media, name)).toString()),
    title
  });
}

/** Runs a validated request through the existing commands. */
async function runRequest(deps: TicketWebviewDependencies, request: WebviewRequest, overview: TicketOverviewPanel): Promise<void> {
  const target = request.rootUri ? { rootUri: request.rootUri } : undefined;
  const ticketDeps = { tickets: deps.tickets, selection: deps.selection };
  switch (request.action) {
    case 'refresh':
      deps.tickets.refresh();
      return;
    case 'openWindow':
      return openWorktreeInNewWindow(target);
    case 'showInExplorer':
      return showInWorktreeExplorer({ selection: deps.selection, refresh: () => deps.tickets.refresh() }, target);
    case 'openLink':
      await openTicketLink(ticketDeps, target);
      return;
    case 'openNotes':
      await openTicketNotes(ticketDeps, target);
      return;
    case 'copyTest':
      await copyTestCommand(ticketDeps, target);
      return;
    case 'copyCleanup': {
      const info = request.rootUri ? await deps.tickets.getTicket(request.rootUri) : undefined;
      if (info) {
        await copyCleanupCommand({ rootUri: info.worktree.rootUri, info });
      }
      return;
    }
    case 'removeWorktree':
      await removeWorktree({ git: deps.git, tickets: deps.tickets, refresh: () => deps.tickets.refresh() }, target);
      return;
    case 'openOverview':
      if (request.rootUri) {
        await overview.show(request.rootUri);
      }
      return;
    case 'serve':
      await serveViaTunnel({ tickets: deps.tickets }, target);
      return;
    case 'compare':
      if (request.rootUri && request.fileUri) {
        await openBaseDiff(deps.git, request.rootUri, request.fileUri, request.deleted === true);
      }
      return;
  }
}

export class TicketsSidebarProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewId = 'worktreeExplorer.tickets';
  private view: vscode.WebviewView | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private renderRequest = 0;
  private lastServedPath: string | undefined;
  private tunnelPoll: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly deps: TicketWebviewDependencies,
    private readonly overview: TicketOverviewPanel
  ) {}

  /** #26: the tunnel can be switched outside VS Code (terminal, menu bar app), so while the view is
   *  visible the site link is re-read every few seconds; it re-renders only when it changed. */
  private syncTunnelPolling(visible: boolean): void {
    if (visible && !this.tunnelPoll && readTunnelConfig().siteLink) {
      this.tunnelPoll = setInterval(() => {
        void readServedPath(readTunnelConfig().siteLink).then((served) => {
          if (served !== this.lastServedPath) {
            void this.render();
            void this.overview.render();
          }
        });
      }, TUNNEL_POLL_MS);
    } else if (!visible && this.tunnelPoll) {
      clearInterval(this.tunnelPoll);
      this.tunnelPoll = undefined;
    }
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    configureWebview(view.webview, this.deps.extensionUri, 'tickets.js', 'Tickets');
    this.disposables.push(
      view.webview.onDidReceiveMessage((raw: unknown) => {
        if (typeof raw === 'object' && raw !== null && (raw as { action?: unknown }).action === 'ready') {
          void this.render();
          return;
        }
        const request = parseWebviewMessage(raw, knownRoots(this.deps.git));
        if (request) {
          void runRequest(this.deps, request, this.overview);
        }
      }),
      view.onDidChangeVisibility(() => {
        this.syncTunnelPolling(view.visible);
        if (view.visible) {
          void this.render();
        }
      }),
      view.onDidDispose(() => {
        this.syncTunnelPolling(false);
        this.view = undefined;
      })
    );
    this.syncTunnelPolling(view.visible);
  }

  async render(): Promise<void> {
    const view = this.view;
    if (!view || !view.visible) {
      return;
    }
    const request = ++this.renderRequest;
    const [tickets, tunnel] = await Promise.all([this.deps.tickets.listTickets(), readTunnelState()]);
    if (request !== this.renderRequest) {
      return;
    }
    this.lastServedPath = tunnel.servedPath;
    const model = buildSidebarModel(tickets, this.deps.git.listWorktrees(), this.deps.selection.snapshot.activeWorktreeUri, {
      keyPattern: readTicketConfig().keyPattern,
      cleanupCommandConfigured: cleanupCommandConfigured(),
      tunnel
    });
    void view.webview.postMessage({ type: 'model', model });
  }

  dispose(): void {
    this.syncTunnelPolling(false);
    this.disposables.forEach((d) => d.dispose());
  }
}

/** One overview editor tab, re-targeted to whichever ticket was opened last. */
export class TicketOverviewPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private rootUri: vscode.Uri | undefined;
  private renderRequest = 0;

  constructor(private readonly deps: TicketWebviewDependencies) {}

  async show(rootUri: vscode.Uri): Promise<void> {
    this.rootUri = rootUri;
    if (!this.panel) {
      const panel = vscode.window.createWebviewPanel('worktreeExplorer.ticketOverview', 'Ticket overview', vscode.ViewColumn.Active, {
        enableScripts: true,
        enableCommandUris: false,
        localResourceRoots: [vscode.Uri.joinPath(this.deps.extensionUri, 'media')]
      });
      configureWebview(panel.webview, this.deps.extensionUri, 'overview.js', 'Ticket overview');
      panel.iconPath = new vscode.ThemeIcon('note');
      panel.webview.onDidReceiveMessage((raw: unknown) => {
        if (typeof raw === 'object' && raw !== null && (raw as { action?: unknown }).action === 'ready') {
          void this.render();
          return;
        }
        const request = parseWebviewMessage(raw, knownRoots(this.deps.git));
        if (request) {
          void runRequest(this.deps, request, this);
        }
      });
      panel.onDidChangeViewState(() => {
        if (panel.visible) {
          void this.render();
        }
      });
      panel.onDidDispose(() => {
        this.panel = undefined;
      });
      this.panel = panel;
    } else {
      this.panel.reveal(vscode.ViewColumn.Active);
    }
    await this.render();
  }

  async render(): Promise<void> {
    const panel = this.panel;
    const rootUri = this.rootUri;
    if (!panel || !rootUri) {
      return;
    }
    const request = ++this.renderRequest;
    const [info, tunnel] = await Promise.all([this.deps.tickets.getTicket(rootUri), readTunnelState()]);
    if (request !== this.renderRequest) {
      return;
    }
    if (!info) {
      void panel.webview.postMessage({ type: 'gone' });
      return;
    }
    const model = buildOverviewModel(info, this.deps.selection.snapshot.activeWorktreeUri?.toString() === rootUri.toString(), {
      keyPattern: readTicketConfig().keyPattern,
      cleanupCommandConfigured: cleanupCommandConfigured(),
      tunnel
    });
    panel.title = model.key ? `${model.key} overview` : 'Ticket overview';
    void panel.webview.postMessage({ type: 'model', model });
  }

  dispose(): void {
    this.panel?.dispose();
  }
}
