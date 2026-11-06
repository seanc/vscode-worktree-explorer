import * as vscode from 'vscode';

// #17: ticket context derived without any network access — the key from the branch (or worktree
// folder) name, everything else from an optional notes file in the worktree root (by default the
// CLAUDE.local.md that a start-ticket style workflow writes). The notes file is untrusted input: it
// is size-capped, only specific line shapes are matched, and links are validated before use.

export const DEFAULT_KEY_PATTERN = '[A-Z][A-Z0-9]+-\\d+';
export const DEFAULT_NOTES_FILE = 'CLAUDE.local.md';
export const MAX_NOTES_BYTES = 64 * 1024;

const MAX_SUMMARY_LENGTH = 200;
const MAX_COMMAND_LENGTH = 500;
const DATABASE_NAME = /^[A-Za-z0-9_$-]{1,64}$/;

export interface TicketConfig {
  readonly keyPattern: string;
  readonly urlTemplate: string;
  readonly notesFile: string;
}

export interface TicketNotes {
  readonly key?: string;
  readonly summary?: string;
  readonly rawTicketUrl?: string;
  readonly devDatabases: readonly string[];
  readonly testDatabases: readonly string[];
  readonly testCommand?: string;
}

export interface TicketMetadata {
  readonly key: string;
  /** First path segment of the branch (e.g. "fix" in "fix/jd/PROJ-1-x"), when there is one. */
  readonly branchType?: string;
  readonly summary?: string;
  /** A validated https link, or undefined. Never the raw value from the notes file. */
  readonly ticketUrl?: string;
  readonly devDatabases: readonly string[];
  readonly testDatabases: readonly string[];
  readonly testCommand?: string;
  /** The notes file, when it exists and was read. */
  readonly notesUri?: vscode.Uri;
}

export function readTicketConfig(): TicketConfig {
  const config = vscode.workspace.getConfiguration('worktreeExplorer.ticket');
  return {
    keyPattern: config.get<string>('keyPattern', DEFAULT_KEY_PATTERN),
    urlTemplate: config.get<string>('urlTemplate', ''),
    notesFile: config.get<string>('notesFile', DEFAULT_NOTES_FILE)
  };
}

/** Wraps the configured key pattern so it only matches a whole token; an empty or invalid pattern
 *  falls back to the default rather than throwing. */
export function compileKeyPattern(pattern: string): RegExp {
  const source = pattern.trim() || DEFAULT_KEY_PATTERN;
  try {
    return new RegExp(`(?:^|[^A-Za-z0-9])(${source})(?![A-Za-z0-9])`);
  } catch {
    return new RegExp(`(?:^|[^A-Za-z0-9])(${DEFAULT_KEY_PATTERN})(?![A-Za-z0-9])`);
  }
}

/** The first candidate (branch name, then worktree folder name) that contains a ticket key. */
export function findTicketKey(candidates: readonly (string | undefined)[], keyPattern: RegExp): string | undefined {
  for (const candidate of candidates) {
    const match = candidate ? keyPattern.exec(candidate) : null;
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

export function branchType(branch: string | undefined): string | undefined {
  if (!branch || !branch.includes('/')) {
    return undefined;
  }
  const first = branch.split('/')[0];
  return /^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(first) ? first : undefined;
}

/** Parses the notes file's known line shapes. Anything else in the file is ignored. */
export function parseTicketNotes(text: string): TicketNotes {
  let key: string | undefined;
  let summary: string | undefined;
  let rawTicketUrl: string | undefined;
  let devDatabases: string[] = [];
  let testDatabases: string[] = [];
  let testCommand: string | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    const heading = /^#\s+([A-Za-z][A-Za-z0-9_]*-\d+):\s*(.+)$/.exec(line);
    if (heading && key === undefined) {
      key = heading[1];
      summary = heading[2].trim().slice(0, MAX_SUMMARY_LENGTH);
      continue;
    }

    const link = /^-\s*(?:Jira|Ticket):\s*(\S+)$/i.exec(line);
    if (link && rawTicketUrl === undefined) {
      rawTicketUrl = link[1];
      continue;
    }

    const dev = /^-\s*Dev databases?\b[^:]*:\s*(.+)$/i.exec(line);
    if (dev && devDatabases.length === 0) {
      devDatabases = backtickedNames(dev[1]);
      continue;
    }

    const test = /^-\s*Test databases?\b[^:]*:\s*(.+)$/i.exec(line);
    if (test && testDatabases.length === 0) {
      testDatabases = backtickedNames(test[1]);
      continue;
    }

    const command = /^-\s*Tests:\s*`([^`]+)`/i.exec(line);
    if (command && testCommand === undefined && command[1].length <= MAX_COMMAND_LENGTH) {
      testCommand = command[1].trim();
    }
  }

  return { key, summary, rawTicketUrl, devDatabases, testDatabases, testCommand };
}

function backtickedNames(value: string): string[] {
  const names: string[] = [];
  for (const match of value.matchAll(/`([^`]+)`/g)) {
    if (DATABASE_NAME.test(match[1])) {
      names.push(match[1]);
    }
  }
  return names;
}

/**
 * Accepts a link from the notes file only if it is https, carries no credentials, points at
 * `/browse/<key>` for this ticket, and is on an Atlassian Cloud host or the host of the configured
 * URL template. Returns a rebuilt URL (origin + path only), never the raw string.
 */
export function validateTicketUrl(raw: string | undefined, key: string, urlTemplate: string): string | undefined {
  const url = parseHttpsUrl(raw);
  if (!url) {
    return undefined;
  }
  if (url.pathname.replace(/\/+$/, '') !== `/browse/${key}`) {
    return undefined;
  }
  const host = url.hostname.toLowerCase();
  const templateHost = parseHttpsUrl(urlTemplate.replace(/\{key\}/g, encodeURIComponent(key)))?.hostname.toLowerCase();
  if (!host.endsWith('.atlassian.net') && host !== templateHost) {
    return undefined;
  }
  return `${url.origin}/browse/${key}`;
}

/** Builds a link from the `{key}` template; https only. */
export function urlFromTemplate(urlTemplate: string, key: string): string | undefined {
  if (!urlTemplate.trim() || !urlTemplate.includes('{key}')) {
    return undefined;
  }
  return parseHttpsUrl(urlTemplate.trim().replace(/\{key\}/g, encodeURIComponent(key)))?.toString();
}

function parseHttpsUrl(raw: string | undefined): URL | undefined {
  if (!raw) {
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    return undefined;
  }
  return url;
}

/** A bare file name only, so the notes file can never resolve outside the worktree root. */
export function isSafeNotesFileName(name: string): boolean {
  return /^[A-Za-z0-9_][A-Za-z0-9._-]{0,99}$/.test(name) && !name.includes('..');
}

/** Combines the branch-derived key with the notes file, preferring the branch's key. */
export function buildTicketMetadata(
  input: { branch?: string; folderName?: string; notes?: TicketNotes; notesUri?: vscode.Uri },
  config: TicketConfig
): TicketMetadata | undefined {
  const key = findTicketKey([input.branch, input.folderName], compileKeyPattern(config.keyPattern));
  if (!key) {
    return undefined;
  }
  // Notes written for a different ticket (e.g. copied between worktrees) are ignored entirely.
  const notes = input.notes && (input.notes.key === undefined || input.notes.key === key) ? input.notes : undefined;
  return {
    key,
    branchType: branchType(input.branch),
    summary: notes?.summary,
    ticketUrl: validateTicketUrl(notes?.rawTicketUrl, key, config.urlTemplate) ?? urlFromTemplate(config.urlTemplate, key),
    devDatabases: notes?.devDatabases ?? [],
    testDatabases: notes?.testDatabases ?? [],
    testCommand: notes?.testCommand,
    notesUri: notes ? input.notesUri : undefined
  };
}

/** Reads the notes file from a worktree root. Missing, oversized, or unreadable → undefined. */
export async function readTicketNotes(
  rootUri: vscode.Uri,
  notesFile: string
): Promise<{ notes: TicketNotes; uri: vscode.Uri } | undefined> {
  if (!isSafeNotesFileName(notesFile)) {
    return undefined;
  }
  const uri = vscode.Uri.joinPath(rootUri, notesFile);
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    if ((stat.type & vscode.FileType.File) === 0 || stat.size > MAX_NOTES_BYTES) {
      return undefined;
    }
    const bytes = await vscode.workspace.fs.readFile(uri);
    return { notes: parseTicketNotes(new TextDecoder('utf-8').decode(bytes)), uri };
  } catch {
    return undefined;
  }
}
