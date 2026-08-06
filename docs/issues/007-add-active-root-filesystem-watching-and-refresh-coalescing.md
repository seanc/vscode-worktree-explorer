# #7 — Add active-root filesystem watching and refresh coalescing

**Milestone:** 1 — Read-only MVP
**Depends on:** #6
**Labels:** `type: feature`, `priority: high`, `area: filesystem`

## Objective

Implement `WorktreeWatcher`: exactly one active-root filesystem watcher, debounced, disposed and
replaced on every root change.

## Deliverables

- URI-based relative-pattern watcher scoped to the active root only.
- Debounce rapid events over roughly 100–250ms (PRD §18).
- Full-tree refresh for MVP (affected-parent-only refresh is a deferred optimization — see #15).
- Watcher disposal on root change, replaced by a new watcher for the new root (PRD §9.5).
- Clear watcher-failure user message: "Automatic refresh is unavailable. Use Refresh to update the
  view." (PRD §25) with manual Refresh retained as fallback.

## Acceptance criteria

- FR-024 (refresh after filesystem events).
- AC-12 (root switch disposes the old watcher, creates the new one, invalidates stale commands).
- AC-13 (files created/deleted by external processes appear without restarting VS Code).
- Performance target: external change refresh under 1 second in normal conditions (PRD §23).

## Validation

Integration test creating/deleting files externally during an active session, asserting the tree
refreshes; root-switch test asserting the old watcher is disposed before the new one is created.
