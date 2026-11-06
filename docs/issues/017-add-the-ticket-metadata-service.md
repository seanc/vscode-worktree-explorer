# #17 — Add the ticket metadata service

**Milestone:** 5 — Ticket workflow
**Depends on:** #2
**Labels:** `type: feature`, `type: security`, `priority: high`, `area: git-integration`

## Objective

Derive per-worktree ticket context without any network access: the ticket key from the branch name,
and the summary, ticket link, databases, and test command from an optional `CLAUDE.local.md` in the
worktree root.

## Deliverables

- A pure parser (`src/ticket/ticketMetadata.ts`) for branch names and `CLAUDE.local.md` content.
- A small reader that loads `CLAUDE.local.md` with a size cap and never throws on a missing or
  unreadable file.
- Settings: `worktreeExplorer.ticket.keyPattern` (default `[A-Z][A-Z0-9]+-\d+`) and
  `worktreeExplorer.ticket.urlTemplate` (default empty; `{key}` placeholder).

## Acceptance criteria

- The key is taken from the branch name using the configured pattern; an invalid pattern falls back
  to the default rather than throwing.
- `CLAUDE.local.md` is treated as untrusted: files over 64 KB are ignored, only specific line shapes
  are matched, and the ticket link is accepted only if it is `https:`, its path is
  `/browse/<KEY>` for the same key, and its host is `*.atlassian.net` or the `urlTemplate` host.
- With no `CLAUDE.local.md`, the link falls back to the `urlTemplate`, if set.
- No hostnames are hard-coded and no file content is logged.

## Validation

Unit tests: branch parsing, custom/invalid key patterns, valid/malformed/oversized notes, and
rejected links (`http:`, `javascript:`, wrong host, wrong key).
