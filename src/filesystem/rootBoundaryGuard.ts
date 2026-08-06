import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { isDescendantPath, pathsEqual } from '../common/paths';

const GIT_ADMIN_SEGMENT = '.git';

export interface GuardContext {
  /** The active worktree root, captured when the mutating command started. */
  readonly rootUri: vscode.Uri;
  /** SelectionCoordinator's rootGeneration, captured when the mutating command started. */
  readonly rootGeneration: number;
}

export type GuardFailureReason =
  | 'traversal' // SEC-01: absolute path, empty segment, or ".." escaping the root
  | 'symlinkEscape' // SEC-02: resolved symlink target outside the root
  | 'staleRoot' // SEC-03: the active root changed since the command captured its generation
  | 'protectedPath'; // SEC-06: the root itself, or a Git administrative path

export interface GuardResult {
  readonly ok: boolean;
  readonly uri?: vscode.Uri;
  readonly reason?: GuardFailureReason;
}

function ok(uri: vscode.Uri): GuardResult {
  return { ok: true, uri };
}

function fail(reason: GuardFailureReason): GuardResult {
  return { ok: false, reason };
}

/**
 * The single shared component every filesystem mutation must pass through (PRD §17.1,
 * FR-FILE-05). #9/#10 call this before creating/renaming/deleting anything; nothing else should
 * write to the active worktree directly.
 */
export class RootBoundaryGuard {
  /**
   * SEC-01/SEC-03/SEC-06: resolves a new relative path against `parentUri` (itself already
   * confirmed to be inside the root), rejecting absolute paths, empty segments, and ".."
   * traversal. Nested relative paths are allowed when every component stays inside the root
   * (FR-FILE-02) — callers that must forbid path separators entirely (#10's rename, FR-FILE-03)
   * enforce that themselves before calling this. Does not check existence — nothing exists yet
   * for a create.
   */
  resolveNewPath(context: GuardContext, parentUri: vscode.Uri, relativePath: string, currentGeneration: number): GuardResult {
    if (currentGeneration !== context.rootGeneration) {
      return fail('staleRoot');
    }
    if (relativePath.length === 0 || path.isAbsolute(relativePath)) {
      return fail('traversal');
    }
    const segments = relativePath.split(/[\\/]/);
    if (segments.some((segment) => segment.length === 0 || segment === '..')) {
      return fail('traversal');
    }
    if (!isDescendantPath(context.rootUri.fsPath, parentUri.fsPath)) {
      return fail('traversal');
    }
    const candidate = vscode.Uri.joinPath(parentUri, ...segments);
    if (!isDescendantPath(context.rootUri.fsPath, candidate.fsPath)) {
      return fail('traversal');
    }
    if (segments.includes(GIT_ADMIN_SEGMENT)) {
      return fail('protectedPath');
    }
    return ok(candidate);
  }

  /**
   * SEC-01/SEC-02/SEC-03/SEC-06/AC-10/AC-11: validates an existing filesystem target for a
   * mutation (rename source, rename destination, or delete target).
   */
  async validateExistingTarget(context: GuardContext, targetUri: vscode.Uri, currentGeneration: number): Promise<GuardResult> {
    if (currentGeneration !== context.rootGeneration) {
      return fail('staleRoot');
    }
    if (!isDescendantPath(context.rootUri.fsPath, targetUri.fsPath)) {
      return fail('traversal');
    }
    if (pathsEqual(targetUri.fsPath, context.rootUri.fsPath)) {
      // AC-10: the active worktree root itself can never be renamed or deleted.
      return fail('protectedPath');
    }
    if (isUnderGitAdminSegment(context.rootUri.fsPath, targetUri.fsPath)) {
      return fail('protectedPath');
    }

    const symlinkTarget = await resolveSymlinkTarget(targetUri);
    if (symlinkTarget && !isDescendantPath(context.rootUri.fsPath, symlinkTarget.fsPath)) {
      return fail('symlinkEscape');
    }

    return ok(targetUri);
  }
}

function isUnderGitAdminSegment(rootFsPath: string, targetFsPath: string): boolean {
  const relative = path.relative(rootFsPath, targetFsPath);
  return relative.split(path.sep).includes(GIT_ADMIN_SEGMENT);
}

/** Resolves `targetUri`'s real path if it is a symbolic link; undefined otherwise (not a
 *  symlink, doesn't exist, or resolution failed — none of which is an "escape"). */
async function resolveSymlinkTarget(targetUri: vscode.Uri): Promise<vscode.Uri | undefined> {
  let isSymlink = false;
  try {
    const stat = await vscode.workspace.fs.stat(targetUri);
    isSymlink = (stat.type & vscode.FileType.SymbolicLink) !== 0;
  } catch {
    return undefined;
  }
  if (!isSymlink) {
    return undefined;
  }
  try {
    const realPath = await fs.promises.realpath(targetUri.fsPath);
    return vscode.Uri.file(realPath);
  } catch {
    return undefined;
  }
}
