import * as vscode from 'vscode';
import { FILTER_MODES, type FilterMode } from '../tree/changeTree';
import { CHOOSE_FILTER_COMMAND, CHOOSE_FILTER_ACTIVE_COMMAND } from './constants';

const FILTER_LABELS: Record<FilterMode, { label: string; detail: string }> = {
  all: { label: 'All files', detail: 'Browse the whole worktree.' },
  changedVsBase: { label: 'Changed against base branch', detail: 'Committed and uncommitted changes since the branch split off.' },
  uncommitted: { label: 'Uncommitted changes', detail: 'Staged, unstaged, and untracked files only.' }
};

export function filterModeLabel(mode: FilterMode): string {
  return FILTER_LABELS[mode].label;
}

export interface FilterCommandDependencies {
  readonly getMode: () => FilterMode;
  readonly setMode: (mode: FilterMode) => void;
}

/** #20: one Quick Pick for all three modes — explicit and keyboard-accessible, unlike a cycling toggle. */
export async function chooseFilter(deps: FilterCommandDependencies): Promise<void> {
  const current = deps.getMode();
  const picked = await vscode.window.showQuickPick(
    FILTER_MODES.map((mode) => ({
      mode,
      label: `${mode === current ? '$(check) ' : ''}${FILTER_LABELS[mode].label}`,
      detail: FILTER_LABELS[mode].detail
    })),
    { placeHolder: 'Show in Worktree Explorer' }
  );
  if (picked && picked.mode !== current) {
    deps.setMode(picked.mode);
  }
}

/** Two command ids for the same action so the view-title icon can show whether a filter is on. */
export function registerFilterCommands(deps: FilterCommandDependencies): vscode.Disposable {
  return vscode.Disposable.from(
    vscode.commands.registerCommand(CHOOSE_FILTER_COMMAND, () => chooseFilter(deps)),
    vscode.commands.registerCommand(CHOOSE_FILTER_ACTIVE_COMMAND, () => chooseFilter(deps))
  );
}
