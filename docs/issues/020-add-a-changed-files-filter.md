# #20 — Add a changed-files filter

**Milestone:** 5 — Ticket workflow
**Depends on:** #18
**Labels:** `type: feature`, `priority: medium`, `area: tree`, `area: persistence`

## Objective

Let the Worktree Explorer show only what the ticket changed: all files, files changed against the
base branch, or uncommitted files.

## Deliverables

- A view-title command that cycles the filter mode, reflected in a context key and the view
  description, and persisted per workspace.
- In a changed-files mode the tree shows only changed files and the folders that contain them, with
  the change status as text in each file's description (no file decoration provider, per PRD §5).

## Acceptance criteria

- Deleted files are listed with status `D` and do not open (they no longer exist on disk).
- Switching worktrees keeps the chosen mode; an empty result shows a clear empty-state message.

## Validation

Unit tests for building the filtered tree from a list of changes; live test against the fixture.
