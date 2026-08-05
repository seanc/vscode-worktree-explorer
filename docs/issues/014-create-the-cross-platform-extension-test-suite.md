# #14 — Create the cross-platform extension test suite

**Milestone:** 3 — Hardening
**Depends on:** #1–#13 (formalizes and fills gaps in tests written incrementally alongside each
prior issue — not a from-scratch test-writing effort)
**Labels:** `type: testing`, `priority: high`, `area: testing`, `area: ci`

## Objective

Assemble and complete the automated test suite across PRD §28.1–§28.4, and promote the CI skeleton
from #1 to the full three-OS matrix.

## Deliverables

- Full CI matrix: Ubuntu, Windows, macOS (PRD §28.5).
- Any missing fixture or test case from §28.1 (unit), §28.2 (integration), §28.3 (file-operation),
  or §28.4 (UI) not already covered by its owning issue.

## Acceptance criteria

- AC-17 (automated tests pass on Windows, macOS, and Linux).
- DoD item 17.

## Validation

CI green on all three operating systems.
