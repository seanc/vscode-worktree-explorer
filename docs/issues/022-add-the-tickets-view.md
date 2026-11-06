# #22 — Add the Tickets view

**Milestone:** 5 — Ticket workflow
**Depends on:** #17, #18, #19
**Labels:** `type: feature`, `priority: medium`, `area: ui`

## Objective

Give every linked worktree a ticket-shaped row in its own activity-bar view, so switching between
tickets and finding a ticket's link, databases, and commands takes one click.

## Deliverables

- A Tickets view container and tree view (no webview, per PRD §5).
- One row per linked worktree: key and summary as the label, branch as the description, a tooltip
  with ahead count, change count, and dev database. Expanding a row shows its details.
- Inline and context actions: Open in New Window, Show in Worktree Explorer, Open in Jira, Copy Test
  Command, Copy Drop Command.
- A main-checkout row.

## Acceptance criteria

- The view refreshes on worktree and repository changes.
- Copy Drop Command only copies text; nothing is deleted or executed by the extension.

## Validation

Unit tests for row building and actions with fakes; manual check in VS Code.
