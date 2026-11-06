import * as vscode from 'vscode';
import { Status, type Change } from './gitExtensionApi';
import type { BaseComparison, ChangeStatus, WorktreeChange } from '../common/types';

// #18: pure helpers for comparing a worktree against its base branch. Kept apart from
// GitIntegrationService so they can be unit tested with plain fakes.

export const DEFAULT_BASE_CANDIDATES: readonly string[] = ['develop', 'main', 'master'];
const MAX_AHEAD_COUNT = 1000;
const MAX_BASE_COMMITS = 200;
const MAX_REFLOG_BYTES = 256 * 1024;

/** The subset of a Git API Repository that comparison needs. */
export interface ComparableRepository {
  readonly state: {
    readonly mergeChanges: readonly Change[];
    readonly indexChanges: readonly Change[];
    readonly workingTreeChanges: readonly Change[];
    readonly untrackedChanges: readonly Change[];
  };
  getBranch(name: string): Promise<unknown>;
  getMergeBase(ref1: string, ref2: string): Promise<string | undefined>;
  diffWith(ref: string): Promise<Change[]>;
  log(options?: { maxEntries?: number; range?: string }): Promise<{ hash: string; message?: string }[]>;
}

export function readBaseBranchSetting(): string {
  return vscode.workspace.getConfiguration('worktreeExplorer').get<string>('baseBranch', '').trim();
}

/** A configured branch name must look like a branch, not an option or a revision expression. */
export function isPlausibleBranchName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(name) && !name.includes('..') && !name.endsWith('/') && !name.endsWith('.lock');
}

/** The configured base branch if it exists, else the first default candidate that exists. */
export async function pickBaseBranch(repository: Pick<ComparableRepository, 'getBranch'>, configured: string): Promise<string | undefined> {
  const candidates = configured ? [configured] : DEFAULT_BASE_CANDIDATES;
  for (const name of candidates) {
    if (!isPlausibleBranchName(name)) {
      continue;
    }
    try {
      await repository.getBranch(name);
      return name;
    } catch {
      // Not a local branch; try the next candidate.
    }
  }
  return undefined;
}

export function toChangeStatus(status: Status): ChangeStatus | undefined {
  switch (status) {
    case Status.INDEX_MODIFIED:
    case Status.MODIFIED:
    case Status.TYPE_CHANGED:
      return 'modified';
    case Status.INDEX_ADDED:
    case Status.INDEX_COPIED:
    case Status.INTENT_TO_ADD:
      return 'added';
    case Status.INDEX_DELETED:
    case Status.DELETED:
      return 'deleted';
    case Status.INDEX_RENAMED:
    case Status.INTENT_TO_RENAME:
      return 'renamed';
    case Status.UNTRACKED:
      return 'untracked';
    case Status.IGNORED:
      return undefined;
    default:
      return 'conflict';
  }
}

/** Normalizes and de-duplicates by URI; a later list's entry for the same file wins. */
export function normalizeChanges(...lists: readonly (readonly Change[])[]): WorktreeChange[] {
  const byUri = new Map<string, WorktreeChange>();
  for (const list of lists) {
    for (const change of list) {
      const status = toChangeStatus(change.status);
      if (status) {
        byUri.set(change.uri.toString(), { uri: change.uri, status });
      }
    }
  }
  return [...byUri.values()].sort((a, b) => a.uri.path.localeCompare(b.uri.path));
}

export function uncommittedChanges(repository: Pick<ComparableRepository, 'state'>): WorktreeChange[] {
  const { indexChanges, workingTreeChanges, untrackedChanges, mergeChanges } = repository.state;
  return normalizeChanges(indexChanges, workingTreeChanges, untrackedChanges, mergeChanges);
}

/** #23: the ref named in a reflog's first line ("branch: Created from <ref>"), when it is a
 *  plausible branch name (local or remote-tracking). HEAD, commit ids and revision expressions
 *  (e.g. "<sha>^{commit}") are not a base branch and yield undefined. */
export function parseBranchOrigin(reflogText: string): string | undefined {
  const firstLine = reflogText.split('\n', 1)[0] ?? '';
  const match = /\tbranch: Created from (\S+)\s*$/.exec(firstLine);
  if (!match) {
    return undefined;
  }
  const ref = match[1].replace(/^refs\/(heads|remotes)\//, '');
  if (ref === 'HEAD' || /^[0-9a-f]{7,64}$/i.test(ref) || /[\^~:@{}\\]/.test(ref) || !isPlausibleBranchName(ref)) {
    return undefined;
  }
  return ref;
}

/** #23: reads `<repositoryRoot>/.git/logs/refs/heads/<branch>` (no process; capped) and returns
 *  the branch the given branch was created from, if Git recorded one. */
export async function readBranchOrigin(repositoryRoot: vscode.Uri, branch: string | undefined): Promise<string | undefined> {
  if (!branch || !isPlausibleBranchName(branch)) {
    return undefined;
  }
  const uri = vscode.Uri.joinPath(repositoryRoot, '.git', 'logs', 'refs', 'heads', ...branch.split('/'));
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    if ((stat.type & vscode.FileType.File) === 0 || stat.size > MAX_REFLOG_BYTES) {
      return undefined;
    }
    const origin = parseBranchOrigin(new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(uri)));
    return origin === branch ? undefined : origin;
  } catch {
    return undefined;
  }
}

/** Short label for a base ref: "origin/develop" → "develop". */
export function baseLabel(baseRef: string): string {
  return baseRef.replace(/^origin\//, '');
}

async function safeMergeBase(repository: ComparableRepository, ref: string): Promise<string | undefined> {
  try {
    return await repository.getMergeBase(ref, 'HEAD');
  } catch {
    return undefined;
  }
}

/**
 * Compares HEAD and the working tree against the merge base with the base branch: the branch it
 * was created from (#23) when that still resolves, else the configured or default base. Undefined
 * when there is no base branch or no common history. Git errors propagate to the caller.
 */
export async function compareRepositoryWithBase(
  repository: ComparableRepository,
  configuredBase: string,
  createdFrom?: string
): Promise<BaseComparison | undefined> {
  let baseRef: string | undefined;
  let baseSource: BaseComparison['baseSource'] = 'default';
  let mergeBase: string | undefined;

  if (createdFrom) {
    mergeBase = await safeMergeBase(repository, createdFrom);
    if (mergeBase) {
      baseRef = createdFrom;
      baseSource = 'created-from';
    }
  }
  if (!baseRef) {
    baseRef = await pickBaseBranch(repository, configuredBase);
    if (!baseRef) {
      return undefined;
    }
    baseSource = configuredBase ? 'setting' : 'default';
    mergeBase = await repository.getMergeBase(baseRef, 'HEAD');
  }
  if (!mergeBase) {
    return undefined;
  }

  const [diff, commits, baseCommits] = await Promise.all([
    repository.diffWith(mergeBase),
    repository.log({ range: `${mergeBase}..HEAD`, maxEntries: MAX_AHEAD_COUNT }),
    // #24: what landed on the base since this branch split off, for merged-ticket detection.
    repository.log({ range: `${mergeBase}..${baseRef}`, maxEntries: MAX_BASE_COMMITS })
  ]);
  const { untrackedChanges, workingTreeChanges } = repository.state;
  const untracked = [...untrackedChanges, ...workingTreeChanges.filter((c) => c.status === Status.UNTRACKED)];
  return {
    baseRef,
    baseSource,
    mergeBase,
    ahead: commits.length,
    changedVsBase: normalizeChanges(diff, untracked),
    uncommitted: uncommittedChanges(repository),
    baseCommitMessages: baseCommits.map((c) => c.message ?? '')
  };
}
