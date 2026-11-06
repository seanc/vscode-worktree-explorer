# #26 — Serve a checkout through the tunnel

**Milestone:** 5 — Ticket workflow
**Depends on:** #25
**Labels:** `type: feature`, `type: security`, `priority: medium`, `area: ui`

## Objective

Show which checkout a local tunnel serves, and switch it from a ticket card, using the user's own
serve script.

## Deliverables

- `worktreeExplorer.tunnel.siteLink`: a symlink whose target is the served checkout (e.g. a Herd
  site link). Read with `readlink` only; re-read every few seconds while the Tickets view is visible.
- `worktreeExplorer.tunnel.serveCommand`: a command with `{target}` (ticket key, or `main`).
- A "● Tunnel" badge on the served checkout; **Serve via tunnel** on other ticket cards, the main
  checkout row, and the overview — shown only when a serve command is configured.

## Security

- Both settings are application-scoped: a repository's workspace settings cannot set them.
- The target must be plain characters (`[A-Za-z0-9._-]`), so a branch or notes file cannot inject
  shell syntax.
- A modal confirmation (everyone using the tunnel is affected) precedes running the command in
  a new, visible terminal; refused in an untrusted workspace.

## Validation

Unit tests for command building, target validation, link reading, served matching, and the
no-command path.
