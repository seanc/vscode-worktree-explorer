import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { pathsEqual } from '../common/paths';

// #26: "serve this checkout through the tunnel". Which checkout is served is read from a symlink
// (e.g. the Herd site link a `serve` script repoints); serving runs the user's own configured
// command in a visible terminal. Both settings are application-scoped, so a repository's workspace
// settings can never supply the command.

export interface TunnelConfig {
  /** Absolute path (a leading "~/" is allowed) to the symlink whose target is the served checkout. */
  readonly siteLink: string;
  /** Command with a `{target}` placeholder, e.g. "tiggit serve {target}". Empty: no Serve button. */
  readonly serveCommand: string;
}

export function readTunnelConfig(): TunnelConfig {
  const config = vscode.workspace.getConfiguration('worktreeExplorer.tunnel');
  return {
    siteLink: config.get<string>('siteLink', '').trim(),
    serveCommand: config.get<string>('serveCommand', '').trim()
  };
}

export function expandHome(value: string): string {
  return value === '~' || value.startsWith('~/') ? path.join(os.homedir(), value.slice(1)) : value;
}

/** The checkout the tunnel serves now (the link's resolved target), or undefined. */
export async function readServedPath(siteLink: string): Promise<string | undefined> {
  if (!siteLink) {
    return undefined;
  }
  const link = expandHome(siteLink);
  if (!path.isAbsolute(link)) {
    return undefined;
  }
  try {
    const target = await fs.promises.readlink(link);
    return path.resolve(path.dirname(link), target);
  } catch {
    return undefined;
  }
}

export function isServed(rootUri: vscode.Uri, servedPath: string | undefined): boolean {
  return servedPath !== undefined && pathsEqual(rootUri.fsPath.replace(/[\\/]+$/, ''), servedPath.replace(/[\\/]+$/, ''));
}

/** A serve target is "main" or a ticket key: plain characters only, never anything a shell reads. */
export function isSafeServeTarget(target: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(target);
}

/** Fills `{target}`; undefined without a template, a placeholder, or a safe target. */
export function buildServeCommand(template: string, target: string | undefined): string | undefined {
  if (!template || !template.includes('{target}') || !target || !isSafeServeTarget(target)) {
    return undefined;
  }
  return template.replace(/\{target\}/g, target);
}
