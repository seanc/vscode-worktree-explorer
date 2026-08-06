import * as vscode from 'vscode';
import type { WorktreeTreeProvider } from '../tree';
import { REFRESH_COMMAND } from './constants';

/**
 * PRD §10.7/§13.1 manual Refresh. "Collapse All" (also listed in PRD §12) has no public API for
 * an extension to trigger programmatically — the only way to get that behavior is
 * `createTreeView`'s built-in `showCollapseAll` option (wired in extension.ts), which supplies
 * its own button rather than a command this extension can register and still have work.
 */
export function registerRefreshCommand(treeProvider: WorktreeTreeProvider): vscode.Disposable {
  return vscode.commands.registerCommand(REFRESH_COMMAND, () => treeProvider.refresh());
}
