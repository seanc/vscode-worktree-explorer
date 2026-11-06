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
export const COPY_RELATIVE_PATH_COMMAND = 'worktreeExplorer.copyRelativePath';
export const COPY_ABSOLUTE_PATH_COMMAND = 'worktreeExplorer.copyAbsolutePath';
export const REVEAL_IN_OS_COMMAND = 'worktreeExplorer.revealInOperatingSystem';
export const COPY_WORKTREE_PATH_COMMAND = 'worktreeExplorer.copyWorktreePath';
export const REVEAL_WORKTREE_ROOT_COMMAND = 'worktreeExplorer.revealWorktreeRoot';
export const OPEN_SETTINGS_COMMAND = 'worktreeExplorer.openSettings';
// #19
export const OPEN_TICKET_LINK_COMMAND = 'worktreeExplorer.openTicketLink';
export const OPEN_TICKET_NOTES_COMMAND = 'worktreeExplorer.openTicketNotes';
export const COPY_TEST_COMMAND_COMMAND = 'worktreeExplorer.copyTestCommand';
// #20
export const CHOOSE_FILTER_COMMAND = 'worktreeExplorer.chooseFilter';
export const CHOOSE_FILTER_ACTIVE_COMMAND = 'worktreeExplorer.chooseFilterActive';
// #21
export const COMPARE_WITH_BASE_COMMAND = 'worktreeExplorer.compareWithBase';
export const COMPARE_WITH_MAIN_CHECKOUT_COMMAND = 'worktreeExplorer.compareWithMainCheckout';
export const OPEN_IN_MAIN_CHECKOUT_COMMAND = 'worktreeExplorer.openInMainCheckout';
// #22
export const OPEN_WORKTREE_IN_NEW_WINDOW_COMMAND = 'worktreeExplorer.openWorktreeInNewWindow';
export const SHOW_IN_WORKTREE_EXPLORER_COMMAND = 'worktreeExplorer.showInWorktreeExplorer';
export const COPY_CLEANUP_COMMAND_COMMAND = 'worktreeExplorer.copyCleanupCommand';
export const REFRESH_TICKETS_COMMAND = 'worktreeExplorer.refreshTickets';
// #24
export const REMOVE_WORKTREE_COMMAND = 'worktreeExplorer.removeWorktree';
// #25
export const OPEN_TICKET_OVERVIEW_COMMAND = 'worktreeExplorer.openTicketOverview';
