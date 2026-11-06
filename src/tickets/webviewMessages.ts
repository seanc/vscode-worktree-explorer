import * as vscode from 'vscode';
import { isDescendantPath } from '../common/paths';

// #25: everything a webview posts is untrusted. Only these actions exist; the worktree must be one
// the extension itself discovered, and a file must resolve inside that worktree. URLs and commands
// are never taken from a webview — every action maps to an existing extension command.

export const WEBVIEW_ACTIONS = [
  'openWindow',
  'showInExplorer',
  'openLink',
  'openNotes',
  'copyTest',
  'copyCleanup',
  'removeWorktree',
  'serve',
  'openOverview',
  'compare',
  'refresh'
] as const;

export type WebviewAction = (typeof WEBVIEW_ACTIONS)[number];

export interface WebviewRequest {
  readonly action: WebviewAction;
  readonly rootUri?: vscode.Uri;
  readonly fileUri?: vscode.Uri;
  readonly deleted?: boolean;
}

const MAX_PATH_LENGTH = 1024;

function isAction(value: unknown): value is WebviewAction {
  return typeof value === 'string' && (WEBVIEW_ACTIONS as readonly string[]).includes(value);
}

/**
 * Validates a raw message against the worktree roots the extension currently knows about.
 * Returns undefined for anything malformed or out of bounds.
 */
export function parseWebviewMessage(raw: unknown, knownRoots: ReadonlyMap<string, vscode.Uri>): WebviewRequest | undefined {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const message = raw as Record<string, unknown>;
  if (!isAction(message.action)) {
    return undefined;
  }
  if (message.action === 'refresh') {
    return { action: 'refresh' };
  }
  const rootUri = typeof message.id === 'string' ? knownRoots.get(message.id) : undefined;
  if (!rootUri) {
    return undefined;
  }
  if (message.action !== 'compare') {
    return { action: message.action, rootUri };
  }

  const relative = message.path;
  if (typeof relative !== 'string' || relative.length === 0 || relative.length > MAX_PATH_LENGTH) {
    return undefined;
  }
  const segments = relative.split('/');
  if (relative.startsWith('/') || relative.includes('\\') || segments.some((s) => s === '' || s === '.' || s === '..')) {
    return undefined;
  }
  const fileUri = vscode.Uri.joinPath(rootUri, ...segments);
  if (!isDescendantPath(rootUri.fsPath, fileUri.fsPath)) {
    return undefined;
  }
  return { action: 'compare', rootUri, fileUri, deleted: message.deleted === true };
}

/** A fresh random nonce for each rendered page's Content-Security-Policy. */
export function createNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/**
 * The page shell for both webviews. Static except for resource URIs, the CSP source and the
 * nonce — no ticket data is ever placed in the HTML; it arrives later by postMessage.
 */
export function renderWebviewShell(options: { cspSource: string; nonce: string; styleUri: string; scriptUris: readonly string[]; title: string }): string {
  const { cspSource, nonce, styleUri, scriptUris, title } = options;
  const scripts = scriptUris.map((uri) => `<script nonce="${nonce}" src="${uri}"></script>`).join('\n');
  const csp = [
    "default-src 'none'",
    `style-src ${cspSource}`,
    `img-src ${cspSource}`,
    `font-src ${cspSource}`,
    `script-src 'nonce-${nonce}'`
  ].join('; ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${styleUri}">
<title>${title}</title>
</head>
<body>
<main id="root"></main>
${scripts}
</body>
</html>`;
}
