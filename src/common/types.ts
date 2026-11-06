import type { Uri } from 'vscode';

/**
 * Normalized description of a repository or linked worktree, produced by GitIntegrationService
 * (PRD §15.1, §16.2). This is the only Git-derived shape other modules may depend on — none of
 * them may import Git extension API types directly.
 */
export interface WorktreeDescriptor {
  /** Root of the main repository that owns this worktree (equals rootUri when isMain is true). */
  readonly repositoryRoot: Uri;
  /** Root of this worktree (or the main repository, when isMain is true) on disk. */
  readonly rootUri: Uri;
  /** Worktree folder name, e.g. "payments-wt". Branch/ref formatting is a presentation concern. */
  readonly displayName: string;
  /** Checked-out branch name, or a short commit sha when detached. Undefined if unknown. */
  readonly ref?: string;
  readonly isMain: boolean;
  readonly isDetached: boolean;
}

/** #18: a file's change status, normalized from the Git API so no other module needs its types. */
export type ChangeStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflict';

export interface WorktreeChange {
  readonly uri: Uri;
  readonly status: ChangeStatus;
}

/** #18: how a linked worktree differs from its base branch, measured from the merge base. */
export interface BaseComparison {
  /** The base branch name, e.g. "develop", "origin/develop", or another feature branch. */
  readonly baseRef: string;
  /** #23: where baseRef came from — the branch this one was created from (Git's reflog), the
   *  worktreeExplorer.baseBranch setting, or the develop/main/master default. */
  readonly baseSource: 'created-from' | 'setting' | 'default';
  readonly mergeBase: string;
  /** Commits in mergeBase..HEAD. */
  readonly ahead: number;
  /** Committed and uncommitted changes since the merge base, plus untracked files. */
  readonly changedVsBase: readonly WorktreeChange[];
  /** Staged, unstaged, conflicted, and untracked changes only. */
  readonly uncommitted: readonly WorktreeChange[];
  /** #24: messages of commits on the base since the merge base (newest first, capped). */
  readonly baseCommitMessages: readonly string[];
}
