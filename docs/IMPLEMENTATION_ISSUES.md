# Worktree Explorer — Implementation Issues

This file contains GitHub-ready issue bodies grouped into implementation milestones.

## Suggested labels

- `type: spike`
- `type: feature`
- `type: security`
- `type: testing`
- `type: infrastructure`
- `type: hardening`
- `type: performance`
- `type: release`
- `priority: critical`
- `priority: high`
- `priority: medium`
- `area: extension`
- `area: git-integration`
- `area: selection`
- `area: tree`
- `area: filesystem`
- `area: commands`
- `area: ui`
- `area: persistence`
- `area: security`
- `area: performance`
- `area: testing`
- `area: ci`
- `area: documentation`

## Milestones

1. Milestone 0 — Technical feasibility
2. Milestone 1 — Read-only MVP
3. Milestone 2 — Safe file operations
4. Milestone 3 — Hardening
5. Milestone 4 — Release

## Milestone 0 — Technical feasibility

- [#1 — Bootstrap the VS Code extension project](issues/001-bootstrap-the-vs-code-extension-project.md)
- [#2 — Implement the built-in Git integration adapter](issues/002-implement-the-built-in-git-integration-adapter.md)
- [#3 — Validate SCM selection tracking and dynamic view visibility](issues/003-validate-scm-selection-tracking-and-dynamic-view-visibility.md)
## Milestone 1 — Read-only MVP

- [#4 — Build the production selection coordinator](issues/004-build-the-production-selection-coordinator.md)
- [#5 — Add the worktree Quick Pick and manual override](issues/005-add-the-worktree-quick-pick-and-manual-override.md)
- [#6 — Implement the read-only worktree Tree View](issues/006-implement-the-read-only-worktree-tree-view.md)
- [#7 — Add active-root filesystem watching and refresh coalescing](issues/007-add-active-root-filesystem-watching-and-refresh-coalescing.md)
## Milestone 2 — Safe file operations

- [#8 — Create the root-boundary and stale-operation safety layer](issues/008-create-the-root-boundary-and-stale-operation-safety-layer.md)
- [#9 — Implement New File and New Folder](issues/009-implement-new-file-and-new-folder.md)
- [#10 — Implement Rename and Delete](issues/010-implement-rename-and-delete.md)
- [#11 — Add path and operating-system utility commands](issues/011-add-path-and-operating-system-utility-commands.md)
## Milestone 3 — Hardening

- [#12 — Persist valid worktree selections per workspace](issues/012-persist-valid-worktree-selections-per-workspace.md)
- [#13 — Harden multi-repository, symlink, trust, and error behavior](issues/013-harden-multi-repository,-symlink,-trust,-and-error-behavior.md)
- [#14 — Create the cross-platform extension test suite](issues/014-create-the-cross-platform-extension-test-suite.md)
- [#15 — Profile and optimize large-worktree behavior](issues/015-profile-and-optimize-large-worktree-behavior.md)
## Milestone 4 — Release

- [#16 — Prepare documentation, VSIX packaging, and Marketplace release](issues/016-prepare-documentation,-vsix-packaging,-and-marketplace-release.md)
## Milestone 5 — Ticket workflow

Ticket-aware browsing for one-worktree-per-ticket workflows, with no network access beyond opening a
validated ticket link. Jira status, running commands, and cleanup actions are out of scope.

- [#17 — Add the ticket metadata service](issues/017-add-the-ticket-metadata-service.md)
- [#18 — Compare worktrees against their base branch](issues/018-compare-worktrees-against-their-base-branch.md)
- [#19 — Show ticket context in the Worktree Explorer](issues/019-show-ticket-context-in-the-worktree-explorer.md)
- [#20 — Add a changed-files filter](issues/020-add-a-changed-files-filter.md)
- [#21 — Add compare commands](issues/021-add-compare-commands.md)
- [#22 — Add the Tickets view](issues/022-add-the-tickets-view.md)
- [#23 — Detect each branch's real base](issues/023-detect-each-branchs-real-base.md)
- [#24 — Detect tickets ready to clean up](issues/024-detect-tickets-ready-to-clean-up.md)
- [#25 — Design-A Tickets sidebar and ticket overview](issues/025-design-a-tickets-sidebar-and-overview.md)
- [#26 — Serve a checkout through the tunnel](issues/026-serve-a-checkout-through-the-tunnel.md)
