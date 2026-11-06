# #24 — Detect tickets ready to clean up

**Milestone:** 5 — Ticket workflow
**Depends on:** #23
**Labels:** `type: feature`, `priority: medium`, `area: git-integration`

## Objective

Flag tickets whose work already landed on their base branch, without a tracker or GitHub API.

## Deliverables

- Collect commit messages in `mergeBase..base` (capped) with the comparison.
- A ticket "looks merged" when one mentions its key as a whole token (squash or merge commits).
- States: merged (clean) or merged with uncommitted work.
- Copy the configured `ticket.cleanupCommand` (never run).
- Remove Worktree: a modal confirmation naming the folder, then `deleteWorktree` through the
  built-in Git extension — linked worktrees only, never forced (Git refuses uncommitted, untracked,
  or locked worktrees), refused in an untrusted workspace. The branch is kept.

## Acceptance criteria

- `PROJ-3251` never matches `PROJ-32512`.
- The UI says the result is based on the local base branch.
- Nothing is removed without confirmation; the main checkout can never be removed.

## Validation

Unit tests for matching and states; live test with a squash commit on the fixture's `main`.
