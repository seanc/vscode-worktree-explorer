import type { Uri } from 'vscode';
import type { WorktreeDescriptor } from './types';

/** The "<branch-or-ref>" portion of PRD §9.2's "<branch-or-ref> · <folder-name>" format, e.g.
 *  "feature/payments" or "detached@a8cf231". Presentation-only; GitIntegrationService leaves
 *  `ref`/`isDetached` unformatted so this stays independent of discovery. */
export function formatRef(worktree: Pick<WorktreeDescriptor, 'ref' | 'isDetached'>): string {
  if (worktree.isDetached) {
    return `detached@${worktree.ref ?? 'unknown'}`;
  }
  return worktree.ref ?? '(unknown)';
}

export function basename(uri: Uri): string {
  const segments = uri.path.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? uri.path;
}
