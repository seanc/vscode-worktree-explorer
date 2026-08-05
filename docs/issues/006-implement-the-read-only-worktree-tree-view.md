# #6 — Implement the read-only worktree Tree View

**Milestone:** 1 — Read-only MVP
**Depends on:** #4, #2
**Labels:** `type: feature`, `priority: critical`, `area: tree`

## Objective

Implement `WorktreeTreeProvider` plus a minimal read-only `FileSystemService` (directory listing
only — mutation methods are added in Milestone 2).

## Deliverables

- Lazy directory loading: read a directory only when its node expands (PRD §10.1).
- Sorting: directories-first default, all three `sortOrder` values (`foldersFirst`, `mixed`,
  `filesFirst`), case-insensitive locale-aware name, URI tie-breaker (PRD §10.2).
- Hidden files shown by default (PRD §10.3).
- Extension-specific glob exclusions (default `**/.git`, `**/node_modules`) without touching global
  VS Code settings (PRD §10.4).
- Symlink identification; resolve target before mutation (mutation logic lands in #8); external
  symlinks may render read-only/non-expandable for MVP (PRD §10.5).
- Open-file command using VS Code document APIs; must not add the file's directory to the workspace
  (PRD §10.6).
- View description format `<branch-or-ref> · <folder-name>` (PRD §9.2).
- Collapse All and manual Refresh (automatic refresh from filesystem events is #7).

## Acceptance criteria

- FR-020 … FR-023, FR-025, FR-026.
- AC-06 (activating a file opens it in an editor).
- DoD items 6–8 (active worktree clearly identified; browse; open).
- Performance target tracked here, formally verified in #15: directories under 500 entries visible
  within 200ms (PRD §23).

## Validation

Integration tests per PRD §28.2 fixtures: no linked worktrees, one linked worktree, three linked
worktrees, detached worktree, nested directories and symlinks. UI tests for description and title
actions per §28.4.
