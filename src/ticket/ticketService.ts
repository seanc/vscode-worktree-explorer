import * as vscode from 'vscode';
import type { GitIntegrationService } from '../git';
import type { BaseComparison, WorktreeDescriptor } from '../common/types';
import { buildTicketMetadata, readTicketConfig, readTicketNotes, type TicketMetadata } from './ticketMetadata';
import { detectCleanup, type CleanupState } from './cleanup';

const CHANGE_DEBOUNCE_MS = 300;

/** Everything the ticket UI shows for one worktree. Metadata/comparison are absent when the
 *  worktree has no ticket key or no base branch. */
export interface TicketInfo {
  readonly worktree: WorktreeDescriptor;
  readonly metadata?: TicketMetadata;
  readonly comparison?: BaseComparison;
  /** #24: present when the ticket looks merged into its base branch. */
  readonly cleanup?: CleanupState;
}

export type TicketGitSource = Pick<GitIntegrationService, 'listWorktrees' | 'compareWithBase' | 'onDidChangeWorktrees'>;

/**
 * #19/#22: joins discovery (#2), base comparison (#18), and ticket metadata (#17) per worktree.
 * Reads are on demand (the notes file is small and capped); onDidChange is debounced because the
 * underlying repository-state events fire on every Git status refresh.
 */
export class TicketService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly git: TicketGitSource) {
    this.disposables.push(
      git.onDidChangeWorktrees(() => this.scheduleChange()),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('worktreeExplorer.ticket')) {
          this.scheduleChange();
        }
      })
    );
  }

  async getTicket(rootUri: vscode.Uri): Promise<TicketInfo | undefined> {
    const worktree = this.git.listWorktrees().find((w) => w.rootUri.toString() === rootUri.toString());
    return worktree ? this.load(worktree) : undefined;
  }

  /** Linked worktrees only, in discovery order. */
  async listTickets(): Promise<TicketInfo[]> {
    return Promise.all(this.git.listWorktrees().filter((w) => !w.isMain).map((w) => this.load(w)));
  }

  /** Forces listeners to re-read (e.g. the manual Refresh command). */
  refresh(): void {
    this.scheduleChange();
  }

  private async load(worktree: WorktreeDescriptor): Promise<TicketInfo> {
    const config = readTicketConfig();
    const [notes, comparison] = await Promise.all([
      readTicketNotes(worktree.rootUri, config.notesFile),
      this.git.compareWithBase(worktree.rootUri)
    ]);
    const metadata = buildTicketMetadata(
      {
        branch: worktree.isDetached ? undefined : worktree.ref,
        folderName: worktree.displayName,
        notes: notes?.notes,
        notesUri: notes?.uri
      },
      config
    );
    return { worktree, metadata, comparison, cleanup: detectCleanup(metadata?.key, comparison) };
  }

  private scheduleChange(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      this._onDidChange.fire();
    }, CHANGE_DEBOUNCE_MS);
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.disposables.forEach((d) => d.dispose());
    this._onDidChange.dispose();
  }
}
