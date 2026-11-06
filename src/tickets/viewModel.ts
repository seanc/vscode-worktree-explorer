import * as vscode from 'vscode';
import type { TicketInfo } from '../ticket';
import { shortBaseName } from '../ticket';
import type { ChangeStatus, WorktreeDescriptor } from '../common/types';
import { formatRef } from '../common/format';
import { isServed } from '../tunnel/tunnel';

// #25: plain JSON view models for the Tickets sidebar and the ticket overview webviews. Pure, so
// they are unit tested here; the webview scripts render them with textContent only. `id` is the
// worktree root URI string — the only handle a webview can send back, re-validated on receipt.

export type Tone = 'neutral' | 'info' | 'success' | 'warning';

export interface Badge {
  readonly text: string;
  readonly tone: Tone;
}

export interface TicketCard {
  readonly id: string;
  readonly key?: string;
  readonly title: string;
  readonly branch: string;
  readonly badges: readonly Badge[];
  readonly isActive: boolean;
  readonly hasUrl: boolean;
  readonly hasNotes: boolean;
  readonly hasTest: boolean;
  /** #26: the tunnel serves this checkout now / a Serve button can be offered. */
  readonly served: boolean;
  readonly canServe: boolean;
  /** Shown when the card is expanded. */
  readonly devDatabases: readonly string[];
  readonly testDatabases: readonly string[];
  readonly cleanup?: { readonly evidence: string; readonly uncommitted: number };
}

export interface MainCheckoutRow {
  readonly id: string;
  readonly branch: string;
  readonly served: boolean;
  readonly canServe: boolean;
}

/** #26: what the views need to know about the tunnel. */
export interface TunnelState {
  readonly servedPath?: string;
  readonly serveConfigured: boolean;
}

export interface SidebarModel {
  readonly active: readonly TicketCard[];
  readonly cleanup: readonly TicketCard[];
  readonly main: readonly MainCheckoutRow[];
  readonly cleanupCommandConfigured: boolean;
}

export interface OverviewChange {
  /** Path relative to the worktree root, "/"-separated. */
  readonly path: string;
  readonly letter: string;
  readonly label: string;
  readonly deleted: boolean;
}

export interface OverviewModel {
  readonly id: string;
  readonly key?: string;
  readonly kind?: string;
  readonly title: string;
  readonly branch: string;
  readonly aheadText?: string;
  readonly baseText?: string;
  readonly environment: readonly { readonly label: string; readonly value: string }[];
  readonly testCommand?: string;
  readonly changes: readonly OverviewChange[];
  readonly changesTruncated: boolean;
  readonly hasUrl: boolean;
  readonly hasNotes: boolean;
  readonly isActive: boolean;
  readonly served: boolean;
  readonly canServe: boolean;
  readonly cleanup?: { readonly evidence: string; readonly uncommitted: number };
  readonly cleanupCommandConfigured: boolean;
}

const MAX_OVERVIEW_CHANGES = 300;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const STATUS: Record<ChangeStatus, { letter: string; label: string }> = {
  modified: { letter: 'M', label: 'Modified' },
  added: { letter: 'A', label: 'Added' },
  deleted: { letter: 'D', label: 'Deleted' },
  renamed: { letter: 'R', label: 'Renamed' },
  untracked: { letter: 'U', label: 'Untracked' },
  conflict: { letter: '!', label: 'Conflict' }
};

function baseSourceText(source: 'created-from' | 'setting' | 'default'): string {
  return source === 'created-from' ? 'the branch it was created from' : source === 'setting' ? 'your base branch setting' : 'the default base branch';
}

export function buildCard(info: TicketInfo, isActive: boolean, keyPattern?: string, tunnel: TunnelState = { serveConfigured: false }): TicketCard {
  const { worktree, metadata, comparison, cleanup } = info;
  const served = isServed(worktree.rootUri, tunnel.servedPath);
  const badges: Badge[] = [];
  if (served) {
    badges.push({ text: '● Tunnel', tone: 'success' });
  }
  if (comparison) {
    badges.push({ text: `↑${comparison.ahead} · ${comparison.changedVsBase.length} changed`, tone: 'neutral' });
    badges.push({ text: `vs ${shortBaseName(comparison, keyPattern)}`, tone: comparison.baseSource === 'created-from' ? 'info' : 'neutral' });
    if (comparison.uncommitted.length > 0) {
      badges.push({ text: `${comparison.uncommitted.length} uncommitted`, tone: 'warning' });
    }
  } else {
    badges.push({ text: 'No base branch', tone: 'neutral' });
  }
  return {
    id: worktree.rootUri.toString(),
    key: metadata?.key,
    title: metadata?.summary ?? worktree.displayName,
    branch: formatRef(worktree),
    badges,
    isActive,
    hasUrl: metadata?.ticketUrl !== undefined,
    hasNotes: metadata?.notesUri !== undefined,
    hasTest: metadata?.testCommand !== undefined,
    served,
    canServe: tunnel.serveConfigured && metadata?.key !== undefined && !served,
    devDatabases: metadata?.devDatabases ?? [],
    testDatabases: metadata?.testDatabases ?? [],
    cleanup: cleanup ? { evidence: cleanup.evidence, uncommitted: cleanup.kind === 'mergedWithChanges' ? cleanup.uncommitted : 0 } : undefined
  };
}

export function buildSidebarModel(
  tickets: readonly TicketInfo[],
  worktrees: readonly WorktreeDescriptor[],
  activeUri: vscode.Uri | undefined,
  options: { keyPattern?: string; cleanupCommandConfigured: boolean; tunnel?: TunnelState }
): SidebarModel {
  const tunnel = options.tunnel ?? { serveConfigured: false };
  const active = activeUri?.toString();
  const sorted = [...tickets].sort((a, b) =>
    collator.compare(a.metadata?.key ?? a.worktree.displayName, b.metadata?.key ?? b.worktree.displayName)
  );
  const cards = sorted.map((info) => buildCard(info, info.worktree.rootUri.toString() === active, options.keyPattern, tunnel));
  const mains = worktrees.filter((w) => w.isMain && tickets.some((t) => t.worktree.repositoryRoot.toString() === w.rootUri.toString()));
  return {
    active: cards.filter((c) => !c.cleanup),
    cleanup: cards.filter((c) => c.cleanup),
    main: mains.map((w) => {
      const served = isServed(w.rootUri, tunnel.servedPath);
      return { id: w.rootUri.toString(), branch: formatRef(w), served, canServe: tunnel.serveConfigured && !served };
    }),
    cleanupCommandConfigured: options.cleanupCommandConfigured
  };
}

export function buildOverviewModel(
  info: TicketInfo,
  isActive: boolean,
  options: { keyPattern?: string; cleanupCommandConfigured: boolean; tunnel?: TunnelState }
): OverviewModel {
  const { worktree, metadata, comparison, cleanup } = info;
  const tunnel = options.tunnel ?? { serveConfigured: false };
  const served = isServed(worktree.rootUri, tunnel.servedPath);
  const rootPath = worktree.rootUri.path.replace(/\/+$/, '');
  const environment: { label: string; value: string }[] = [];
  if (metadata && metadata.devDatabases.length > 0) {
    environment.push({ label: 'Dev databases', value: metadata.devDatabases.join(', ') });
  }
  if (metadata && metadata.testDatabases.length > 0) {
    environment.push({ label: 'Test databases', value: metadata.testDatabases.join(', ') });
  }
  environment.push({ label: 'Folder', value: worktree.rootUri.fsPath });

  const allChanges = comparison?.changedVsBase ?? [];
  const changes = allChanges
    .filter((c) => c.uri.path.startsWith(`${rootPath}/`))
    .slice(0, MAX_OVERVIEW_CHANGES)
    .map((c) => ({ path: c.uri.path.slice(rootPath.length + 1), letter: STATUS[c.status].letter, label: STATUS[c.status].label, deleted: c.status === 'deleted' }));

  return {
    id: worktree.rootUri.toString(),
    key: metadata?.key,
    kind: metadata?.branchType,
    title: metadata?.summary ?? worktree.displayName,
    branch: formatRef(worktree),
    aheadText: comparison ? `${comparison.ahead} commit${comparison.ahead === 1 ? '' : 's'} ahead of ${shortBaseName(comparison, options.keyPattern)}` : undefined,
    baseText: comparison ? `Compared with ${comparison.baseRef.replace(/^origin\//, '')} (${baseSourceText(comparison.baseSource)})` : 'No base branch found. Set worktreeExplorer.baseBranch.',
    environment,
    testCommand: metadata?.testCommand,
    changes,
    changesTruncated: allChanges.length > MAX_OVERVIEW_CHANGES,
    hasUrl: metadata?.ticketUrl !== undefined,
    hasNotes: metadata?.notesUri !== undefined,
    isActive,
    served,
    canServe: tunnel.serveConfigured && metadata?.key !== undefined && !served,
    cleanup: cleanup ? { evidence: cleanup.evidence, uncommitted: cleanup.kind === 'mergedWithChanges' ? cleanup.uncommitted : 0 } : undefined,
    cleanupCommandConfigured: options.cleanupCommandConfigured
  };
}
