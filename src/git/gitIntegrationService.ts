import * as vscode from 'vscode';
import type { API, GitExtension, Repository } from './gitExtensionApi';
import type { WorktreeDescriptor } from '../common/types';
import { listWorktreeDescriptors } from './worktreeNormalization';

const GIT_EXTENSION_ID = 'vscode.git';

// Discovery-time matching only (deciding whether a worktree is already open); RootBoundaryGuard
// (#8) owns authoritative path comparison for mutations. Separators are normalized first: the Git
// API can report worktree paths with forward slashes even on Windows.
function samePath(a: string, b: string): boolean {
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

/**
 * The only component permitted to depend on the built-in Git extension's API (PRD §16.2, §17.1).
 * Every other module consumes WorktreeDescriptor values and the vscode.Event streams below
 * instead of Git API types.
 */
export class GitIntegrationService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly repositoryDisposables = new Map<Repository, vscode.Disposable[]>();
  private api: API | undefined;

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
      if (worktree.main || openRoots.some((root) => samePath(root, worktree.path))) {
        continue;
      }
      void api.openRepository(vscode.Uri.file(worktree.path));
    }
  }

  private untrackRepository(repository: Repository): void {
    this.repositoryDisposables.get(repository)?.forEach((d) => d.dispose());
    this.repositoryDisposables.delete(repository);
  }

  private clearRepositoryListeners(): void {
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
