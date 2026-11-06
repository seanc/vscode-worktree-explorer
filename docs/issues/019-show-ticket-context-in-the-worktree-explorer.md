# #19 — Show ticket context in the Worktree Explorer

**Milestone:** 5 — Ticket workflow
**Depends on:** #17, #18
**Labels:** `type: feature`, `priority: high`, `area: tree`, `area: commands`

## Objective

Make the Worktree Explorer header say which ticket is active and give one-click access to its link,
its notes, and its test command.

## Deliverables

- View description `<KEY> · ↑N vs <base>` (falls back to the existing `<ref> · <folder>` when no key
  is found) and a view message with the ticket summary.
- View-title commands: Open in Jira (`env.openExternal`, only for a validated link), Open Ticket Notes
  (Markdown preview of `CLAUDE.local.md`), Copy Test Command (clipboard only).
- Context keys so each command is hidden when its data is missing.

## Acceptance criteria

- The header updates when the active worktree changes and when its repository state changes.
- No command runs a shell or terminal; the only external call is `env.openExternal` for a validated
  `https:` link.

## Validation

Unit tests for header formatting and command no-op safety; manual check on a real ticket worktree.
