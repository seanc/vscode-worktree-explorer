import type { BaseComparison } from '../common/types';
import { compileKeyPattern, DEFAULT_KEY_PATTERN, findTicketKey } from './ticketMetadata';
import type { TicketInfo } from './ticketService';

export interface TicketHeader {
  /** View description, e.g. "PROJ-12345 · ↑2 vs develop". Undefined: keep the default description. */
  readonly description?: string;
  /** View message shown above the tree, e.g. the ticket summary. */
  readonly message?: string;
  readonly hasUrl: boolean;
  readonly hasNotes: boolean;
  readonly hasTestCommand: boolean;
}

/**
 * #23: a short name for the comparison base. "origin/develop" → "develop"; another ticket's
 * branch (a stacked branch) → "PROJ-1290 branch", since its full name rarely fits.
 */
export function shortBaseName(comparison: Pick<BaseComparison, 'baseRef'>, keyPattern: string = DEFAULT_KEY_PATTERN): string {
  const name = comparison.baseRef.replace(/^origin\//, '');
  if (['develop', 'main', 'master'].includes(name)) {
    return name;
  }
  const key = findTicketKey([name], compileKeyPattern(keyPattern));
  return key ? `${key} branch` : name;
}

/** #19: the Worktree Explorer header for the active worktree. State is spelled out as text
 *  ("↑2 vs develop"), never carried by colour. */
export function describeTicketHeader(info: TicketInfo | undefined, keyPattern?: string): TicketHeader {
  const metadata = info?.metadata;
  const comparison = info?.comparison;
  if (!metadata) {
    return { hasUrl: false, hasNotes: false, hasTestCommand: false };
  }
  const parts = [metadata.key];
  if (comparison) {
    parts.push(`↑${comparison.ahead} vs ${shortBaseName(comparison, keyPattern)}`);
  }
  return {
    description: parts.join(' · '),
    message: metadata.summary,
    hasUrl: metadata.ticketUrl !== undefined,
    hasNotes: metadata.notesUri !== undefined,
    hasTestCommand: metadata.testCommand !== undefined
  };
}
