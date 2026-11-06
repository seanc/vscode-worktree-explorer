# #21 — Add compare commands

**Milestone:** 5 — Ticket workflow
**Depends on:** #18
**Labels:** `type: feature`, `priority: medium`, `area: commands`

## Objective

Compare a worktree file with the base branch or the main checkout, from the file context menu.

## Deliverables

- Compare with Base: `vscode.diff` between the file at the merge base and the working copy.
- Compare with Main Checkout and Open in Main Checkout, using the owning repository root plus the
  file's relative path.

## Acceptance criteria

- Commands are read-only and appear only on files.
- A file missing from the main checkout shows a clear message instead of an empty diff.

## Validation

Unit tests for path mapping and no-op safety; manual check of the diff editors.
