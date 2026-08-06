# #5 — Add the worktree Quick Pick and manual override

**Milestone:** 1 — Read-only MVP
**Depends on:** #4, #2
**Labels:** `type: feature`, `priority: high`, `area: ui`

## Objective

Implement the `worktreeExplorer.selectWorktree` command and its Quick Pick UI.

## Deliverables

- Quick Pick items per PRD §9.3: branch/ref/detached identifier, worktree folder name, complete path,
  owning repository (when multiple unrelated repositories are open), active-selection indicator,
  optional SCM-selected indicator.
- Grouping by owning repository when unrelated repositories are open (PRD §16.4).
- No-linked-worktrees message ("No linked Git worktrees were found") when invoked with none available
  (PRD §9.9), reachable from the Command Palette even while the view is hidden.

## Acceptance criteria

- FR-016, FR-017 (manual selection, preserved until SCM selection changes).
- AC-04 (manual override remains active until SCM selection changes).
- AC-15 (picker items grouped by owning repository).

## Validation

UI test per PRD §28.4 (Quick Pick grouping, active indicator); integration test using the two-
unrelated-repositories fixture (PRD §28.2).
