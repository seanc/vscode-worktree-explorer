import * as vscode from 'vscode';
import type { SortOrder } from './sorting';

export interface TreeConfig {
  readonly showHiddenFiles: boolean;
  readonly sortOrder: SortOrder;
  readonly exclude: Readonly<Record<string, boolean>>;
  readonly openFilesInPreview: boolean;
}

const DEFAULT_EXCLUDE: Readonly<Record<string, boolean>> = { '**/.git': true, '**/node_modules': true };

/** PRD §19: reads the worktreeExplorer.* settings this tree/open-command needs. */
export function readTreeConfig(): TreeConfig {
  const config = vscode.workspace.getConfiguration('worktreeExplorer');
  return {
    showHiddenFiles: config.get<boolean>('showHiddenFiles', true),
    sortOrder: config.get<SortOrder>('sortOrder', 'foldersFirst'),
    exclude: config.get<Record<string, boolean>>('exclude', DEFAULT_EXCLUDE),
    openFilesInPreview: config.get<boolean>('openFilesInPreview', true)
  };
}
