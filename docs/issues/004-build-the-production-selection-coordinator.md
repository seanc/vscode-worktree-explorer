# #4 — Build the production selection coordinator

**Milestone:** 1 — Read-only MVP
**Depends on:** #2, #3
**Labels:** `type: feature`, `priority: critical`, `area: selection`

## Objective

Implement the real `SelectionCoordinator` state machine per PRD §15.

## Deliverables

- `SelectionState` (PRD §15.1): `activeWorktreeUri`, `activeSource`
  (`'scm' | 'manual' | 'restored'`), `selectionEpoch`, `scmSelected` map, `lastSelectedEpoch` map,
  `rootGeneration`.
- SCM transition handling (PRD §15.2): on every repository UI change, detect `false → true`
  transitions, increment the global selection epoch, store it per worktree.
- Resolution precedence (PRD §15.3, all 5 rules), including clearing manual override on a new SCM
  selection and clearing an invalid active root.
- Root-generation increments on every root switch (feeds #7's stale-watcher handling and #8's
  stale-command guard).

## Acceptance criteria

- FR-010 … FR-018 (SCM tracking, automatic display, multi-selection resolution, deterministic
  fallback, visibility with root+linked both selected, hide on main-only, manual selection, manual
  selection stability, `followScmSelection` disable support).
- AC-01, AC-02, AC-03, AC-04, AC-14.
- PRD §9.4–§9.11 behaviors: main-only hides; one worktree selected shows/activates/updates
  description/refreshes tree/replaces watcher/clears manual override; multiple selections resolve to
  latest epoch; main+linked selected together keeps the linked worktree visible; manual override set
  by picker persists until SCM selection changes; no-linked-worktrees state; removed active worktree
  handled safely; Git-unavailable state surfaced.

## Validation

Unit tests per PRD §28.1: selection epoch handling, manual override lifecycle, main-vs-linked
resolution, deterministic activation fallback. This is the highest-value unit-test surface in the
project — cover it exhaustively before #5/#6 consume it.
