// Command registrations for the worktreeExplorer.* command table (PRD §12), added by the issue
// that implements each command: #5 (selectWorktree), #6 (open, refresh), #9 (newFile, newFolder),
// #10 (rename, delete), #11 (copy*/reveal*/openSettings).
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
  copyRelativePath,
  copyAbsolutePath,
  revealInOperatingSystem,
  copyWorktreePath,
  revealWorktreeRoot,
  openSettings,
  registerCopyRelativePathCommand,
  registerCopyAbsolutePathCommand,
  registerRevealInOperatingSystemCommand,
  registerCopyWorktreePathCommand,
  registerRevealWorktreeRootCommand,
  registerOpenSettingsCommand
} from './pathCommands';
export type { PathCommandDependencies } from './pathCommands';
export {
  SELECT_WORKTREE_COMMAND,
  OPEN_COMMAND,
  REFRESH_COMMAND,
  NEW_FILE_COMMAND,
  NEW_FOLDER_COMMAND,
  RENAME_COMMAND,
  DELETE_COMMAND,
  COPY_RELATIVE_PATH_COMMAND,
  COPY_ABSOLUTE_PATH_COMMAND,
  REVEAL_IN_OS_COMMAND,
  COPY_WORKTREE_PATH_COMMAND,
  REVEAL_WORKTREE_ROOT_COMMAND,
  OPEN_SETTINGS_COMMAND
} from './constants';
