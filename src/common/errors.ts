import type { OutputChannel } from 'vscode';
// Imported from the concrete module rather than the src/filesystem barrel to avoid a module
// cycle (fileSystemService.ts, part of that barrel, imports OperationError from this file).
import type { GuardFailureReason } from '../filesystem/rootBoundaryGuard';

export type OperationErrorReason = GuardFailureReason | 'destinationExists' | 'permissionDenied';

// PRD §25's exact error-table text, reused verbatim rather than inventing new copy.
const OUTSIDE_ROOT_MESSAGE = 'The operation was blocked because the target is outside the selected worktree.';

const MESSAGES: Record<OperationErrorReason, string> = {
  traversal: OUTSIDE_ROOT_MESSAGE,
  symlinkEscape: OUTSIDE_ROOT_MESSAGE,
  // SEC-06/AC-10 protection (root itself, .git) has no dedicated §25 row — "outside root" is the
  // closest documented message and is honest about the effect (the mutation was blocked).
  protectedPath: OUTSIDE_ROOT_MESSAGE,
  staleRoot: 'The selected worktree changed before the operation completed.',
  destinationExists: 'A file or folder with this name already exists.',
  permissionDenied: 'Unable to modify this item because permission was denied.'
};

export function userMessageFor(reason: OperationErrorReason): string {
  return MESSAGES[reason];
}

export class OperationError extends Error {
  constructor(readonly reason: OperationErrorReason) {
    super(MESSAGES[reason]);
  }
}

/** PRD §25: unexpected failures go to an output channel; file contents are never logged. */
export function reportUnexpectedError(outputChannel: OutputChannel, context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  outputChannel.appendLine(`[${new Date().toISOString()}] ${context}: ${message}`);
}
