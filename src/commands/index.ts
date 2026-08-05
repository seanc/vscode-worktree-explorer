// Command registrations for the worktreeExplorer.* command table (PRD §12), added by the issue
// that implements each command: #5 (selectWorktree), #6 (open, refresh), #9 (newFile, newFolder),
// #10 (rename, delete), #11 (copy*/reveal*).
export { registerSelectWorktreeCommand } from './selectWorktree';
export { registerOpenCommand } from './openFile';
export { registerRefreshCommand } from './refresh';
export { registerNewFileCommand, registerNewFolderCommand, createEntry } from './newEntry';
export type { NewEntryDependencies, NewEntryKind } from './newEntry';
export { registerRenameCommand, renameEntry } from './renameEntry';
export type { RenameDependencies } from './renameEntry';
export { registerDeleteCommand, deleteEntry } from './deleteEntry';
export type { DeleteDependencies } from './deleteEntry';
export {
  SELECT_WORKTREE_COMMAND,
  OPEN_COMMAND,
  REFRESH_COMMAND,
  NEW_FILE_COMMAND,
  NEW_FOLDER_COMMAND,
  RENAME_COMMAND,
  DELETE_COMMAND
} from './constants';
