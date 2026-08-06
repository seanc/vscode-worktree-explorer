# #12 — Persist valid worktree selections per workspace

**Milestone:** 3 — Hardening
**Depends on:** #4
**Labels:** `type: feature`, `priority: medium`, `area: persistence`

## Objective

Implement `PersistenceService`.

## Deliverables

- Persist per workspace (PRD §15.4): last valid manual worktree URI, last active worktree URI,
  active source. Selection epochs are explicitly never persisted.
- Remove stale/invalid persisted roots.
- Activation sequence (PRD §15.4): discover repositories and worktrees → inspect SCM selection →
  prefer current SCM-selected linked worktrees → otherwise restore the last valid selection when
  `restoreLastSelection` is enabled → otherwise hide the view.

## Acceptance criteria

- FR-050 (persist last valid manual selection per workspace).
- FR-051 (remove invalid persisted roots).
- FR-052 (do not persist multi-selection ordering as authoritative).
- `restoreLastSelection` configuration behavior (PRD §19.2).

## Validation

Unit tests (persistence validation, PRD §28.1); integration test simulating a restart where the
previously-selected worktree has since been removed.
