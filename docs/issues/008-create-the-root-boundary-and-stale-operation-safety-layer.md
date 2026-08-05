# #8 — Create the root-boundary and stale-operation safety layer

**Milestone:** 2 — Safe file operations
**Depends on:** #4
**Labels:** `type: security`, `priority: critical`, `area: security`

## Objective

Implement `RootBoundaryGuard`, the single shared component every filesystem mutation must pass
through (PRD §17.1, FR-FILE-05).

## Deliverables

- Path normalization for both the active root and the mutation candidate.
- Filesystem case-sensitivity handling per platform.
- Symlink resolution where required.
- Descendant-relationship confirmation (candidate must resolve inside the active root).
- Root itself rejected for destructive operations.
- Root-generation revalidation immediately before every mutation (PRD SEC-03).

## Acceptance criteria

- SEC-01 (reject absolute names, URI injection, `..` traversal escaping the root).
- SEC-02 (resolve symlink targets before mutation; reject targets outside the active root).
- SEC-03 (capture root generation when a command starts; revalidate immediately before mutation).
- SEC-06 (never mutate the active root, `.git`, worktree administration files, or paths outside the
  active worktree).
- AC-10 (the active worktree root cannot be renamed or deleted).
- AC-11 (inputs such as `../../outside.txt` are rejected).

## Validation

Unit tests per PRD §28.1: root containment, case-sensitive and case-insensitive paths, symlink
escape, stale root generation. This component is pure logic — test it exhaustively before #9/#10
build on it.
