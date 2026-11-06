# #18 — Compare worktrees against their base branch

**Milestone:** 5 — Ticket workflow
**Depends on:** #2
**Labels:** `type: feature`, `priority: high`, `area: git-integration`

## Objective

Expose, through `GitIntegrationService` only, how a linked worktree differs from its base branch:
commits ahead and changed files, measured from the merge base so new commits on the base branch are
never counted as the ticket's own.

## Deliverables

- Vendor only `getMergeBase`, `diffWith`, `log`, `getBranch`, and `toGitUri` into
  `src/git/gitExtensionApi.ts`.
- `GitIntegrationService.compareWithBase(rootUri)` returning `{ baseRef, mergeBase, ahead, changes }`,
  cached per worktree and invalidated on repository state changes.
- Setting `worktreeExplorer.baseBranch` (default empty: detect `develop`, then `main`, then `master`).

## Acceptance criteria

- Changed files include committed and uncommitted changes relative to the merge base.
- The ahead count is the number of commits in `mergeBase..HEAD`.
- No base branch found, or a Git failure, yields `undefined` rather than an error surfaced to the
  user; unexpected failures go to the output channel.
- No process is spawned; everything goes through the built-in Git extension API.

## Validation

Unit tests for base-branch selection; live test against the generated Git fixture (a branch with one
commit ahead of `main` plus an uncommitted change).
