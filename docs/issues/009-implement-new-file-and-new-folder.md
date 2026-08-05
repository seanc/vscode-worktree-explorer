# #9 — Implement New File and New Folder

**Milestone:** 2 — Safe file operations
**Depends on:** #8, #6
**Labels:** `type: feature`, `priority: high`, `area: filesystem`

## Objective

Implement the `worktreeExplorer.newFile` and `worktreeExplorer.newFolder` commands via
`FileSystemService`, gated by the `RootBoundaryGuard` from #8.

## Deliverables

- FR-FILE-01 (create file): reject absolute paths, reject traversal outside the root, reject
  existing destinations, create an empty file, refresh the parent, open the new file, revalidate the
  current root generation before writing.
- FR-FILE-02 (create directory): as above; nested relative paths supported when every path component
  stays inside the root.
- Workspace Trust gating: mutating commands disabled by default when the window is untrusted
  (PRD SEC-04) — this is the first issue to implement that gating; #13 hardens it across all
  mutating commands.

## Acceptance criteria

- AC-07 (creating a file writes inside the active worktree, refreshes its parent, and opens it).
- FR-030, FR-031.

## Validation

File-operation tests per PRD §28.3: create file, create nested directory, permission failure,
traversal rejection.
