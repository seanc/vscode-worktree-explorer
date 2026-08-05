# #11 — Add path and operating-system utility commands

**Milestone:** 2 — Safe file operations
**Depends on:** #6 (no dependency on #8/#9/#10 — parallelizable any time after #6)
**Labels:** `type: feature`, `priority: medium`, `area: commands`

## Objective

Implement the remaining low-risk leaf commands: `copyRelativePath`, `copyAbsolutePath`,
`revealInOperatingSystem`, `copyWorktreePath`, `revealWorktreeRoot`, and `collapseAll` (if not
already covered by #6).

## Deliverables

- Command registrations and context-menu placement per PRD §13.2 (file context menu) and §13.3
  (directory context menu).
- View-title overflow actions: Copy Worktree Path, Reveal Worktree Root, Extension Settings
  (PRD §13.1).

## Acceptance criteria

- FR-036 (copy relative path), FR-037 (copy absolute path), FR-038 (reveal in operating system).
- Full command table (PRD §12) implemented.

## Validation

UI tests per PRD §28.4: context-menu conditions, command enablement.
