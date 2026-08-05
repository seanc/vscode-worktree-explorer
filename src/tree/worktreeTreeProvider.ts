import * as vscode from 'vscode';
import type { FileSystemService } from '../filesystem';
import { WorktreeTreeItem } from './worktreeTreeItem';
import { sortEntries } from './sorting';
import { compileExcludeMatcher } from './exclude';
import { readTreeConfig } from './treeConfig';

/**
 * WorktreeTreeProvider (PRD §17.1, §10). Read-only for #6 — lazily lists directories, applies
 * PRD §10.2-§10.4's sorting/hidden-file/exclusion rules. The active root is set explicitly via
 * setActiveRoot() rather than the provider owning a live selection subscription itself, so it
 * stays simple to construct and unit test.
 */
export class WorktreeTreeProvider implements vscode.TreeDataProvider<WorktreeTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<WorktreeTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private activeRoot: vscode.Uri | undefined;

  constructor(private readonly fileSystem: FileSystemService) {}

  setActiveRoot(uri: vscode.Uri | undefined): void {
    this.activeRoot = uri;
    this.refresh();
  }

  /** PRD §10.7: manual refresh, and the entry point for #7's filesystem-event-driven refresh. */
  refresh(item?: WorktreeTreeItem): void {
    this._onDidChangeTreeData.fire(item);
  }

  getTreeItem(element: WorktreeTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorktreeTreeItem): Promise<WorktreeTreeItem[]> {
    const parentUri = element ? element.entry.uri : this.activeRoot;
    if (!parentUri) {
      return [];
    }

    const entries = await this.fileSystem.listDirectory(parentUri);
    const config = readTreeConfig();
    const isExcluded = compileExcludeMatcher(config.exclude);

    const visible = entries.filter((entry) => {
      if (!config.showHiddenFiles && entry.name.startsWith('.')) {
        return false;
      }
      return !isExcluded(entry.name);
    });

    return sortEntries(visible, config.sortOrder).map((entry) => new WorktreeTreeItem(entry));
  }
}
