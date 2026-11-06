# #23 — Detect each branch's real base

**Milestone:** 5 — Ticket workflow
**Depends on:** #18
**Labels:** `type: feature`, `priority: high`, `area: git-integration`

## Objective

Compare a stacked branch (one created from another feature branch) against that branch, not
`develop`.

## Deliverables

- Read the first line of the branch's reflog (`<repo>/.git/logs/refs/heads/<branch>`, size-capped,
  no process) and take the ref from `branch: Created from <ref>`.
- Prefer that ref when it still resolves; else `worktreeExplorer.baseBranch`; else
  develop/main/master. Record which one was used (`baseSource`).
- Labels: `origin/` dropped; another ticket's branch shown as "`<KEY>` branch".

## Acceptance criteria

- HEAD, commit ids, and revision expressions in the reflog are ignored; branch names are validated
  before forming a path.
- A deleted origin branch falls back to the setting or defaults.

## Validation

Unit tests for parsing and fallback order; live test with a fixture branch created from `feature/x`.
