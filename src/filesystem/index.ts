// Owned by FileSystemService (read-only listing in #6; mutations in #9/#10) and
// RootBoundaryGuard (issue #8, PRD §11, §17.1, §20).
export { FileSystemService, isDirectory, isSymbolicLink } from './fileSystemService';
export type { FileSystemEntry, DeleteOptions } from './fileSystemService';
export { WorktreeWatcher } from './worktreeWatcher';
export { RootBoundaryGuard } from './rootBoundaryGuard';
export type { GuardContext, GuardResult, GuardFailureReason } from './rootBoundaryGuard';
