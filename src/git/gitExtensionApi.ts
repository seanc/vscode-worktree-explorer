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
}

export type RepositoryKind = 'repository' | 'submodule' | 'worktree';

export interface Repository {
  readonly rootUri: Uri;
  readonly state: RepositoryState;
  readonly ui: RepositoryUIState;
  readonly kind: RepositoryKind;
}

export interface RepositoryState {
  readonly HEAD: Branch | undefined;
  /** Full `git worktree list` inventory known to this (main) repository. */
  readonly worktrees: Worktree[];
  readonly onDidChange: Event<void>;
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
