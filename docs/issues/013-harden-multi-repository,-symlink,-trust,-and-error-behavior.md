# #13 — Harden multi-repository, symlink, trust, and error behavior

**Milestone:** 3 — Hardening
**Depends on:** #2, #8
**Labels:** `type: hardening`, `priority: high`, `area: security`

## Objective

Close remaining PRD gaps not fully covered by earlier issues: multi-repository edge cases, symlink
edge cases, Workspace Trust gating applied consistently across every mutating command, and the full
error-message table.

## Deliverables

- SEC-04 enforced consistently across all mutating commands from #9/#10/#11 (disabled by default
  when the window is untrusted; browsing and opening remain available).
- Every condition in the PRD §25 error table mapped to its exact user-facing message: Git
  unavailable, no linked worktrees, active worktree removed, permission denied, outside root,
  existing destination, stale command, watcher failure. Unexpected failures routed to an output
  channel named "Worktree Explorer" with file contents never logged.
- PRD §9.11 Git-unavailable recovery: extension recovers automatically if Git becomes available
  later, without requiring a reload.
- Multi-repository picker/tree edge cases beyond the #5 happy path.

## Acceptance criteria

- AC-16 (Git unavailable: view hides, commands fail with a clear explanation).
- Remaining SEC-* items not already fully closed by #8 alone.
- DoD items 15–16 (removed worktrees handled safely; Git-unavailable behavior is clear).

## Validation

Integration tests per PRD §28.2 using the full fixture set (all 7 scenarios), plus explicit
untrusted-workspace test runs.
