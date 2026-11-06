// Minimal subset of the built-in Git extension's public API
// (microsoft/vscode extensions/git/src/api/git.d.ts) that GitIntegrationService needs.
//
// Vendored rather than depending on an unofficial @types package, and kept intentionally small
// (PRD §16.2, risk R-01 "isolate the API; consume only versioned public shapes"): only the shapes
// this extension actually reads. This file is the one place allowed to describe Git API types —
// nothing outside src/git/ may import from it.
import type { Event, Uri } from 'vscode';

export interface GitExtension {
  readonly enabled: boolean;
  readonly onDidChangeEnablement: Event<boolean>;
  getAPI(version: 1): API;
}

export type APIState = 'uninitialized' | 'initialized';

export interface API {
  readonly state: APIState;
  readonly onDidChangeState: Event<APIState>;
  readonly repositories: Repository[];
  readonly onDidOpenRepository: Event<Repository>;
  readonly onDidCloseRepository: Event<Repository>;
  openRepository(root: Uri): Promise<Repository | null>;
  /** #18: a `git:` URI for `uri` at `ref`, for opening the base version in a diff editor. */
  toGitUri(uri: Uri, ref: string): Uri;
}

export type RepositoryKind = 'repository' | 'submodule' | 'worktree';

export interface Repository {
  readonly rootUri: Uri;
  readonly state: RepositoryState;
  readonly ui: RepositoryUIState;
  readonly kind: RepositoryKind;
  // #18: base-branch comparison. Read-only queries only — nothing here mutates the repository.
  getBranch(name: string): Promise<Branch>;
  getMergeBase(ref1: string, ref2: string): Promise<string | undefined>;
  /** Changes between `ref` and the working tree (committed and uncommitted; not untracked). */
  diffWith(ref: string): Promise<Change[]>;
  log(options?: LogOptions): Promise<Commit[]>;
  /** User-confirmed worktree removal (`git worktree remove <path>`, never `--force` here). Optional:
   *  older VS Code versions don't expose it. */
  deleteWorktree?(path: string, options?: { force?: boolean }): Promise<void>;
}

export interface RepositoryState {
  readonly HEAD: Branch | undefined;
  /** Full `git worktree list` inventory known to this (main) repository. */
  readonly worktrees: Worktree[];
  readonly mergeChanges: Change[];
  readonly indexChanges: Change[];
  readonly workingTreeChanges: Change[];
  /** Populated only when the user's `git.untrackedChanges` setting is "separate". */
  readonly untrackedChanges: Change[];
  readonly onDidChange: Event<void>;
}

/** Numeric values match the Git extension's `Status` const enum, which is not importable at
 *  runtime — order matters. */
export enum Status {
  INDEX_MODIFIED,
  INDEX_ADDED,
  INDEX_DELETED,
  INDEX_RENAMED,
  INDEX_COPIED,
  MODIFIED,
  DELETED,
  UNTRACKED,
  IGNORED,
  INTENT_TO_ADD,
  INTENT_TO_RENAME,
  TYPE_CHANGED,
  ADDED_BY_US,
  ADDED_BY_THEM,
  DELETED_BY_US,
  DELETED_BY_THEM,
  BOTH_ADDED,
  BOTH_DELETED,
  BOTH_MODIFIED
}

export interface Change {
  readonly uri: Uri;
  readonly originalUri: Uri;
  readonly renameUri: Uri | undefined;
  readonly status: Status;
}

export interface LogOptions {
  readonly maxEntries?: number;
  /** A commit range, such as "<sha>..HEAD". */
  readonly range?: string;
}

export interface Commit {
  readonly hash: string;
  readonly message: string;
}

export interface RepositoryUIState {
  readonly selected: boolean;
  readonly onDidChange: Event<void>;
}

export interface Branch {
  /** Branch name; undefined when HEAD is detached. */
  readonly name?: string;
  readonly commit?: string;
}

export interface Worktree {
  readonly name: string;
  readonly path: string;
  readonly ref: string;
  readonly main: boolean;
  readonly detached: boolean;
}
