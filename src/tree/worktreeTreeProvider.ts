import * as vscode from 'vscode';
import type { FileSystemService } from '../filesystem';
import type { WorktreeChange } from '../common/types';
import { WorktreeTreeItem } from './worktreeTreeItem';
import { sortEntries } from './sorting';
import { compileExcludeMatcher } from './exclude';
import { readTreeConfig } from './treeConfig';
import { buildChangeTree, type ChangeTree, type FilterMode } from './changeTree';

/** #20: supplies the change list for the active root in a filtered mode; undefined means the list
 *  is unavailable (e.g. no base branch), explained through onDidChangeFilterNotice. */
export type ChangeSource = (mode: Exclude<FilterMode, 'all'>, rootUri: vscode.Uri) => Promise<readonly WorktreeChange[] | undefined>;

/**
 * WorktreeTreeProvider (PRD §17.1, §10). Read-only for #6 — lazily lists directories, applies
 * PRD §10.2-§10.4's sorting/hidden-file/exclusion rules. The active root is set explicitly via
 * setActiveRoot() rather than the provider owning a live selection subscription itself, so it
 * stays simple to construct and unit test.
 *
 * #20: in a filtered mode the tree comes from the change list instead of from disk.
 */
export class WorktreeTreeProvider implements vscode.TreeDataProvider<WorktreeTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<WorktreeTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly _onDidChangeFilterNotice = new vscode.EventEmitter<string | undefined>();
  /** #20: fires with an explanation when a filtered view is empty or unavailable (shown as the
   *  view message), or undefined when there is nothing to explain. */
  readonly onDidChangeFilterNotice = this._onDidChangeFilterNotice.event;
  private notice: string | undefined;

  private activeRoot: vscode.Uri | undefined;
  private filterMode: FilterMode = 'all';
  private changeTree: ChangeTree | undefined;

  constructor(
    private readonly fileSystem: FileSystemService,
    private readonly changeSource?: ChangeSource
  ) {}

  setActiveRoot(uri: vscode.Uri | undefined): void {
    this.activeRoot = uri;
    this.refresh();
  }

  setFilterMode(mode: FilterMode): void {
    this.filterMode = mode;
    if (mode === 'all') {
      this.setNotice(undefined);
    }
    this.refresh();
  }

  get mode(): FilterMode {
    return this.filterMode;
  }

  get filterNotice(): string | undefined {
    return this.notice;
  }

  /** PRD §10.7: manual refresh, and the entry point for #7's filesystem-event-driven refresh. */
  refresh(item?: WorktreeTreeItem): void {
    this._onDidChangeTreeData.fire(item);
  }

  getTreeItem(element: WorktreeTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorktreeTreeItem): Promise<WorktreeTreeItem[]> {
    if (this.filterMode !== 'all') {
      return this.getChangedChildren(element);
    }
    const parentUri = element ? element.entry.uri : this.activeRoot;
    if (!parentUri) {
      return [];
    }

    const entries = await this.fileSystem.listDirectory(parentUri);
    const isVisible = this.visibilityFilter();
    return sortEntries(entries.filter((entry) => isVisible(entry.name)), readTreeConfig().sortOrder).map((entry) => new WorktreeTreeItem(entry));
  }

  private async getChangedChildren(element: WorktreeTreeItem | undefined): Promise<WorktreeTreeItem[]> {
    const root = this.activeRoot;
    if (!root || this.filterMode === 'all') {
      return [];
    }
    if (!element) {
      // Rebuilt once per refresh, at the root; child requests reuse it.
      const mode = this.filterMode;
      const changes = this.changeSource ? await this.changeSource(mode, root) : undefined;
      if (!changes) {
        this.changeTree = undefined;
        this.setNotice(mode === 'changedVsBase' ? 'No base branch found. Set worktreeExplorer.baseBranch.' : 'Changes are not available yet.');
        return [];
      }
      const isVisible = this.visibilityFilter();
      this.changeTree = buildChangeTree(root, changes, (name) => !isVisible(name));
      const empty = (this.changeTree.get(root.toString()) ?? []).length === 0;
      this.setNotice(empty ? (mode === 'changedVsBase' ? 'No files changed against the base branch.' : 'No uncommitted changes.') : undefined);
    }
    const parentKey = (element ? element.entry.uri : root).toString();
    const nodes = this.changeTree?.get(parentKey) ?? [];
    return nodes.map(
      (node) =>
        new WorktreeTreeItem(
          { uri: node.uri, name: node.name, type: node.isDirectory ? vscode.FileType.Directory : vscode.FileType.File },
          { status: node.status }
        )
    );
  }

  private visibilityFilter(): (name: string) => boolean {
    const config = readTreeConfig();
    const isExcluded = compileExcludeMatcher(config.exclude);
    return (name) => (config.showHiddenFiles || !name.startsWith('.')) && !isExcluded(name);
  }

  private setNotice(notice: string | undefined): void {
    if (notice !== this.notice) {
      this.notice = notice;
      this._onDidChangeFilterNotice.fire(notice);
    }
  }
}
