import type { BaseComparison } from '../common/types';

// #24: "Ready to clean up", decided locally. A ticket looks merged when a commit that landed on
// its base branch after the split mentions the ticket key as a whole token — that catches both
// squash merges (PR title as the commit subject) and merge commits ("Merge … PROJ-123 …"). It only
// sees the local copy of the base branch, so it is as fresh as the user's last pull.

export type CleanupState =
  | { readonly kind: 'merged'; readonly evidence: string }
  | { readonly kind: 'mergedWithChanges'; readonly evidence: string; readonly uncommitted: number };

const MAX_EVIDENCE_LENGTH = 120;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The first line of the first base commit that mentions `key` as a whole token, if any. */
export function findMergeEvidence(key: string, baseCommitMessages: readonly string[]): string | undefined {
  const token = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(key)}(?![A-Za-z0-9])`);
  for (const message of baseCommitMessages) {
    if (token.test(message)) {
      const subject = message.split('\n', 1)[0].trim();
      return subject.length > MAX_EVIDENCE_LENGTH ? `${subject.slice(0, MAX_EVIDENCE_LENGTH - 1)}…` : subject;
    }
  }
  return undefined;
}

export function detectCleanup(key: string | undefined, comparison: BaseComparison | undefined): CleanupState | undefined {
  if (!key || !comparison) {
    return undefined;
  }
  const evidence = findMergeEvidence(key, comparison.baseCommitMessages);
  if (!evidence) {
    return undefined;
  }
  return comparison.uncommitted.length > 0
    ? { kind: 'mergedWithChanges', evidence, uncommitted: comparison.uncommitted.length }
    : { kind: 'merged', evidence };
}
