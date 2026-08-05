# #15 — Profile and optimize large-worktree behavior

**Milestone:** 3 — Hardening
**Depends on:** #6, #7
**Labels:** `type: performance`, `priority: medium`, `area: performance`

## Objective

Verify, and optimize if needed, the extension's behavior against the PRD §23 performance targets
under realistic large-repository conditions.

## Deliverables

- Profiling harness and a large-directory-tree fixture.
- If the 1-second external-refresh target isn't met under profiling, optimize from full-tree refresh
  to affected-parent-only refresh, as anticipated by PRD §18's stated fallback.

## Acceptance criteria (PRD §23)

- Extension-owned synchronous activation with no active root: under 100ms.
- Active root switch: under 250ms in normal local repositories.
- Directory with fewer than 500 entries: visible within 200ms.
- Inactive worktree tree retention: none.
- Active watchers: exactly one.
- External change refresh: under 1 second in normal conditions.

(Targets explicitly exclude slow disks, remote extension hosts, and OS watcher delays, per the PRD.)

## Validation

Benchmark script results recorded against each target above; add a regression check to CI if
feasible.
