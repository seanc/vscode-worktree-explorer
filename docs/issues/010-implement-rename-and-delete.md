# #10 — Implement Rename and Delete

**Milestone:** 2 — Safe file operations
**Depends on:** #8, #6
**Labels:** `type: feature`, `priority: high`, `area: filesystem`

## Objective

Implement the `worktreeExplorer.rename` and `worktreeExplorer.delete` commands via
`FileSystemService`, gated by the `RootBoundaryGuard` from #8.

## Deliverables

- FR-FILE-03 (rename): prohibit path separators in the new name for MVP, prohibit overwrite,
  preserve root containment, support case-only rename where the filesystem permits it, refresh
  affected nodes, reject stale commands.
- FR-FILE-04 (delete): confirm destructive operations showing item name, type, relative path, and
  owning worktree (SEC-07); distinguish file vs. recursive directory deletion; use trash when
  `useTrash` is enabled and supported (fall back to confirmed permanent deletion if trash is
  unavailable, per PRD §19.4); prohibit active-root deletion and Git administrative-path deletion;
  revalidate immediately before deletion; abort if the active root changed while the confirmation
  dialog was open.
- FR-FILE-06 (concurrent changes): report a concise actionable error, refresh the affected parent,
  never auto-retry a destructive action.

## Acceptance criteria

- AC-08 (renaming changes the filesystem item without changing the active worktree).
- AC-09 (confirmed deletion removes the item and refreshes the tree).
- AC-10 (root protection — reaffirmed at the command layer, not just the guard).
- FR-032, FR-033, FR-034, FR-035.

## Validation

File-operation tests per PRD §28.3: rename, case-only rename, delete file, recursive directory
delete, duplicate destination, root-deletion rejection, symlink-escape rejection, stale-command
rejection.
