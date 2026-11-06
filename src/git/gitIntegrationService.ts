import * as vscode from 'vscode';
import type { API, GitExtension, Repository } from './gitExtensionApi';
import type { BaseComparison, WorktreeChange, WorktreeDescriptor } from '../common/types';
import { listWorktreeDescriptors } from './worktreeNormalization';
import { compareRepositoryWithBase, readBaseBranchSetting, readBranchOrigin, uncommittedChanges } from './baseComparison';
import { pathsEqual } from '../common/paths';

export type GitErrorReporter = (context: string, error: unknown) => void;

/** A short, user-facing reason for a failed worktree removal (Git's own stderr where available). */
export function describeGitFailure(error: unknown): string {
  const details = error as { gitErrorCode?: string; stderr?: string; message?: string } | undefined;
  const stderr = (details?.stderr ?? details?.message ?? '').toLowerCase();
  if (details?.gitErrorCode === 'WorktreeContainsChanges' || stderr.includes('modified or untracked')) {
    return 'The worktree has uncommitted or untracked files. Commit, stash, or delete them first.';
  }
  if (stderr.includes('locked')) {
    return 'The worktree is locked. Unlock it with "git worktree unlock" first.';
  }
  const firstLine = (details?.stderr ?? details?.message ?? '').split('\n').find((line) => line.trim().length > 0);
  return firstLine ? `Git could not remove the worktree: ${firstLine.trim().slice(0, 200)}` : 'Git could not remove the worktree.';
}

const GIT_EXTENSION_ID = 'vscode.git';

/**
 * The only component permitted to depend on the built-in Git extension's API (PRD §16.2, §17.1).
 * Every other module consumes WorktreeDescriptor values and the vscode.Event streams below
 * instead of Git API types.
 */
export class GitIntegrationService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly repositoryDisposables = new Map<Repository, vscode.Disposable[]>();
  private api: API | undefined;
  /** #18: per-worktree comparison, keyed by root URI; dropped when that repository's state changes. */
  private readonly comparisonCache = new Map<string, Promise<BaseComparison | undefined>>();

  constructor(private readonly reportError: GitErrorReporter = () => undefined) {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('worktreeExplorer.baseBranch')) {
          this.comparisonCache.clear();
          this._onDidChangeWorktrees.fire();
        }
      })
    );
  }

  private readonly _onDidChangeAvailability = new vscode.EventEmitter<boolean>();
  /** Fires when the built-in Git extension becomes available/unavailable (installed and enabled). */
  readonly onDidChangeAvailability = this._onDidChangeAvailability.event;

  private readonly _onDidChangeWorktrees = new vscode.EventEmitter<void>();
  /** FR-003: fires whenever the set of discovered repositories/worktrees may have changed. */
  readonly onDidChangeWorktrees = this._onDidChangeWorktrees.event;

  private readonly _onDidChangeRepositorySelection = new vscode.EventEmitter<void>();
  /** Fires whenever any repository's Source Control "selected" UI state changes. */
  readonly onDidChangeRepositorySelection = this._onDidChangeRepositorySelection.event;

  /** Activates the built-in Git extension and starts observing it. Call once at startup. */
  async activate(): Promise<void> {
    const extension = vscode.extensions.getExtension<GitExtension>(GIT_EXTENSION_ID);
    if (!extension) {
      this._onDidChangeAvailability.fire(false);
      return;
    }

    const gitExtension = extension.isActive ? extension.exports : await extension.activate();
    this.disposables.push(
      gitExtension.onDidChangeEnablement((enabled) => {
        this.setApi(enabled ? gitExtension.getAPI(1) : undefined);
      })
    );
    this.setApi(gitExtension.enabled ? gitExtension.getAPI(1) : undefined);
  }

  get isAvailable(): boolean {
    return this.api !== undefined;
  }

  /** FR-001/FR-002/FR-004: every discovered repository and linked worktree, normalized. */
  listWorktrees(): WorktreeDescriptor[] {
    return listWorktreeDescriptors(this.api?.repositories ?? []);
  }

  /** Current Source Control "selected" state for the repository rooted at `rootUri`, if known. */
  isRepositorySelected(rootUri: vscode.Uri): boolean {
    const key = rootUri.toString();
    return this.api?.repositories.some((repository) => repository.rootUri.toString() === key && repository.ui.selected) ?? false;
  }

  /**
   * #18/#23: how the worktree at `rootUri` differs from its base branch (the branch it was created
   * from, else worktreeExplorer.baseBranch, else develop/main/master), measured from the merge
   * base. Undefined when Git is unavailable, the
   * repository isn't open, there is no base branch, or a Git query fails (reported, not thrown).
   */
  compareWithBase(rootUri: vscode.Uri): Promise<BaseComparison | undefined> {
    const key = rootUri.toString();
    const repository = this.api?.repositories.find((r) => r.rootUri.toString() === key);
    if (!repository) {
      return Promise.resolve(undefined);
    }
    const cached = this.comparisonCache.get(key);
    if (cached) {
      return cached;
    }
    // #23: prefer the branch this one was created from, per Git's reflog in the owning repository.
    const repositoryRoot = this.listWorktrees().find((w) => w.rootUri.toString() === key)?.repositoryRoot ?? rootUri;
    const pending = readBranchOrigin(repositoryRoot, repository.state.HEAD?.name)
      .then((createdFrom) => compareRepositoryWithBase(repository, readBaseBranchSetting(), createdFrom))
      .catch((error: unknown) => {
      this.comparisonCache.delete(key);
      this.reportError('compare with base branch', error);
      return undefined;
    });
    this.comparisonCache.set(key, pending);
    return pending;
  }

  /** #20: staged, unstaged, conflicted, and untracked changes, from the Git extension's own
   *  status — no base branch needed. Undefined when the repository isn't open. */
  listUncommittedChanges(rootUri: vscode.Uri): WorktreeChange[] | undefined {
    const key = rootUri.toString();
    const repository = this.api?.repositories.find((r) => r.rootUri.toString() === key);
    return repository ? uncommittedChanges(repository) : undefined;
  }

  /**
   * Removes a linked worktree through the built-in Git extension (`git worktree remove`, never
   * forced, so Git itself refuses one with uncommitted or untracked files, or a locked one). The
   * main checkout can never be removed. The branch is kept. Throws with a user-facing message.
   */
  async removeWorktree(rootUri: vscode.Uri): Promise<void> {
    const key = rootUri.toString();
    const worktree = this.listWorktrees().find((w) => w.rootUri.toString() === key);
    if (!worktree || worktree.isMain) {
      throw new Error('Only a linked worktree can be removed.');
    }
    const owner = this.api?.repositories.find((r) => r.kind === 'repository' && r.rootUri.toString() === worktree.repositoryRoot.toString());
    if (!owner?.deleteWorktree) {
      throw new Error("This version of VS Code's Git extension can't remove worktrees.");
    }
    try {
      await owner.deleteWorktree(rootUri.fsPath);
    } catch (error) {
      this.reportError('remove worktree', error);
      throw new Error(describeGitFailure(error));
    }
    this.comparisonCache.delete(key);
    this._onDidChangeWorktrees.fire();
  }

  /** #21: a URI for `uri`'s content at `ref`, for the left side of a diff editor. */
  toGitUri(uri: vscode.Uri, ref: string): vscode.Uri | undefined {
    return this.api?.toGitUri(uri, ref);
  }

  private setApi(api: API | undefined): void {
    if (this.api === api) {
      return;
    }
    this.clearRepositoryListeners();
    this.api = api;
    this._onDidChangeAvailability.fire(api !== undefined);
    if (!api) {
      return;
    }

    for (const repository of api.repositories) {
      this.trackRepository(repository);
    }
    this.disposables.push(
      api.onDidOpenRepository((repository) => {
        this.trackRepository(repository);
        this._onDidChangeWorktrees.fire();
      }),
      api.onDidCloseRepository((repository) => {
        this.untrackRepository(repository);
        this._onDidChangeWorktrees.fire();
      })
    );
    this._onDidChangeWorktrees.fire();
  }

  private trackRepository(repository: Repository): void {
    if (this.repositoryDisposables.has(repository)) {
      return;
    }
    this.repositoryDisposables.set(repository, [
      repository.ui.onDidChange(() => this._onDidChangeRepositorySelection.fire()),
      repository.state.onDidChange(() => {
        this.comparisonCache.delete(repository.rootUri.toString());
        this._onDidChangeWorktrees.fire();
        if (repository.kind === 'repository') {
          this.openMissingWorktrees(repository);
        }
      })
    ]);
    if (repository.kind === 'repository') {
      this.openMissingWorktrees(repository);
    }
  }

  /**
   * FR-001 finding (issue #3 spike): the built-in Git extension does not proactively open linked
   * worktrees as their own Repository objects just because the main repository is open — a
   * worktree only gets a `kind: 'worktree'` Repository (with SCM selection support) once
   * something calls `openRepository` on its path. RepositoryState.worktrees only ever supplies
   * inventory metadata. Explicitly open every worktree the main repository knows about that isn't
   * open yet, so discovery matches the PRD's premise that linked worktrees appear in Source
   * Control without manual action.
   */
  private openMissingWorktrees(mainRepository: Repository): void {
    if (!this.api) {
      return;
    }
    const api = this.api;
    const openRoots = api.repositories.map((repository) => repository.rootUri.fsPath);
    for (const worktree of mainRepository.state.worktrees) {
      if (worktree.main || openRoots.some((root) => pathsEqual(root, worktree.path))) {
        continue;
      }
      void api.openRepository(vscode.Uri.file(worktree.path));
    }
  }

  private untrackRepository(repository: Repository): void {
    this.comparisonCache.delete(repository.rootUri.toString());
    this.repositoryDisposables.get(repository)?.forEach((d) => d.dispose());
    this.repositoryDisposables.delete(repository);
  }

  private clearRepositoryListeners(): void {
    this.comparisonCache.clear();
    for (const disposables of this.repositoryDisposables.values()) {
      disposables.forEach((d) => d.dispose());
    }
    this.repositoryDisposables.clear();
  }

  dispose(): void {
    this.clearRepositoryListeners();
    this.disposables.forEach((d) => d.dispose());
    this._onDidChangeAvailability.dispose();
    this._onDidChangeWorktrees.dispose();
    this._onDidChangeRepositorySelection.dispose();
  }
}
