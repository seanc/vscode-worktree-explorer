import * as vscode from 'vscode';
import type { Branch, RepositoryKind, RepositoryState, Worktree } from './gitExtensionApi';
import type { WorktreeDescriptor } from '../common/types';
import { basename } from '../common/format';

/**
 * The subset of a Git API Repository that normalization needs — narrower than the full
 * `Repository` interface so unit tests can build fakes without stubbing unused members (e.g.
 * `ui`, `state.onDidChange`). A real `Repository` is structurally assignable here.
 */
export interface RepositorySnapshot {
  readonly rootUri: vscode.Uri;
  readonly kind: RepositoryKind;
  readonly state: Pick<RepositoryState, 'HEAD' | 'worktrees'>;
}

/**
 * FR-001/FR-002: distinguishes main repositories from linked worktrees and normalizes both into
 * WorktreeDescriptor. Repositories of kind 'submodule' are not worktrees and are excluded.
 * FR-004: repositories from unrelated main repositories are handled independently — a linked
 * worktree is only ever matched against its own owning repository's worktree inventory.
 */
export function listWorktreeDescriptors(repositories: readonly RepositorySnapshot[]): WorktreeDescriptor[] {
  return repositories
    .filter((repository) => repository.kind === 'repository' || repository.kind === 'worktree')
    .map((repository) => toDescriptor(repository, repositories));
}

function toDescriptor(repository: RepositorySnapshot, allRepositories: readonly RepositorySnapshot[]): WorktreeDescriptor {
  const isMain = repository.kind === 'repository';
  const repositoryRoot = isMain ? repository.rootUri : findOwningRoot(repository, allRepositories) ?? repository.rootUri;
  const head = repository.state.HEAD;
  return {
    repositoryRoot,
    rootUri: repository.rootUri,
    displayName: basename(repository.rootUri),
    ref: toRef(head),
    isMain,
    isDetached: head?.name === undefined
  };
}

function toRef(head: Branch | undefined): string | undefined {
  return head?.name ?? head?.commit?.slice(0, 7);
}

/**
 * A 'worktree'-kind Repository does not expose which main repository owns it directly (PRD §16 —
 * the Git API surfaces worktree inventory only on the main repository's RepositoryState). Cross-
 * reference this worktree's root against every main repository's inventory instead.
 */
function findOwningRoot(
  worktreeRepository: RepositorySnapshot,
  allRepositories: readonly RepositorySnapshot[]
): vscode.Uri | undefined {
  const targetPath = worktreeRepository.rootUri.fsPath;
  for (const candidate of allRepositories) {
    if (candidate.kind !== 'repository') {
      continue;
    }
    if (candidate.state.worktrees.some((worktree: Worktree) => samePath(worktree.path, targetPath))) {
      return candidate.rootUri;
    }
  }
  return undefined;
}

function samePath(a: string, b: string): boolean {
  // Discovery-time matching only, to associate a worktree with its owning repository.
  // RootBoundaryGuard (#8) owns authoritative path comparison for mutations.
  // The Git API can report worktree paths with forward slashes even on Windows, so separators
  // are normalized before the (platform-appropriate) case comparison.
  if (process.platform === 'win32') {
    return normalizeSeparators(a).toLowerCase() === normalizeSeparators(b).toLowerCase();
  }
  if (process.platform === 'darwin') {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

function normalizeSeparators(p: string): string {
  return p.replace(/\\/g, '/');
}
