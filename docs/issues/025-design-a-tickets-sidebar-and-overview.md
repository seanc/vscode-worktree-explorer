# #25 — Design-A Tickets sidebar and ticket overview

**Milestone:** 5 — Ticket workflow
**Depends on:** #22, #24
**Labels:** `type: feature`, `type: security`, `priority: medium`, `area: ui`

## Objective

Replace the #22 Tickets tree with the card layout from design concept A, and add a ticket overview
editor tab.

PRD §5 lists "no webview" as an MVP non-goal; this issue deliberately changes that at the user's
request, with the security constraints below.

## Deliverables

- Tickets sidebar as a `WebviewView`: active cards (key, summary, branch, ahead/changed/base/
  uncommitted badges, actions on the selected card), a Ready to clean up section, and the main
  checkout.
- Ticket overview as a `WebviewPanel`: header, actions, environment, test command, changed files
  (click to compare with the base), cleanup state.
- Theme colours from VS Code variables; keyboard navigation between cards; visible focus.

## Security

- CSP `default-src 'none'`, styles from the extension's `media/` only, scripts by per-render nonce.
- No ticket data in HTML: the model arrives by `postMessage` and is rendered with `textContent`
  (lint forbids `innerHTML`/`insertAdjacentHTML`/`eval`/`fetch` in `media/`).
- Messages are validated: fixed action list, a discovered worktree root, file paths inside it. URLs
  and commands are never accepted from a webview.

## Validation

Unit tests for view models, message validation, and the page shell; browser render check of the
scripts with sample data; manual check in VS Code.
