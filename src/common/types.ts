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
