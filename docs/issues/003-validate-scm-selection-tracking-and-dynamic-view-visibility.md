# #3 — Validate SCM selection tracking and dynamic view visibility

**Milestone:** 0 — Technical feasibility
**Depends on:** #2
**Labels:** `type: spike`, `priority: critical`, `area: selection`

## Objective

Prove, in real VS Code, that SCM repository selection `false → true` transitions can be observed and
mapped to context keys (`worktreeExplorer.visible`, `worktreeExplorer.hasWorktrees`,
`worktreeExplorer.gitAvailable`) before building the production `SelectionCoordinator` in #4.

## Deliverables

- Minimal `ContextKeyController` (feasibility-quality; production behavior is driven by #4/#6/#9-11/#13).
- A minimal selection listener proving the SCM-change → context-key mechanism works end-to-end.
- A documented activation-event decision (deferred from #1): confirm whether `onStartupFinished` or
  another trigger is required for context keys to be correct before the Explorer view first renders,
  with rationale recorded in the PR.

## Acceptance criteria

- Confirms feasibility of AC-01 (view shows on linked-worktree SCM selection) and AC-02 (view hides
  when only the main repository is selected).
- Confirms feasibility of the Git-unavailable behavior described in PRD §9.11 (view hides, recovers
  automatically if Git becomes available later).

## Validation

Integration test opening a fixture repository with one linked worktree, toggling SCM selection, and
asserting the relevant context key flips; manual confirmation in the Extension Development Host.
