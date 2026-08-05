// Command ID constants only (PRD §12) — kept separate from the register*Command functions so
// src/tree can reference a command id (for TreeItem.command) without importing command
// registration code, which would otherwise import back from src/tree and create a cycle.
export const SELECT_WORKTREE_COMMAND = 'worktreeExplorer.selectWorktree';
export const OPEN_COMMAND = 'worktreeExplorer.open';
export const REFRESH_COMMAND = 'worktreeExplorer.refresh';
export const NEW_FILE_COMMAND = 'worktreeExplorer.newFile';
export const NEW_FOLDER_COMMAND = 'worktreeExplorer.newFolder';
export const RENAME_COMMAND = 'worktreeExplorer.rename';
export const DELETE_COMMAND = 'worktreeExplorer.delete';
