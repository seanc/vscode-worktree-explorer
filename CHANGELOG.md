# Changelog

## Unreleased

- The Worktree Explorer view now stays visible whenever the project has any linked worktree,
  regardless of what's currently selected in Source Control. Selecting the main repository no
  longer hides the view — it keeps showing the most recently active worktree (SCM, manual pick, or
  restored session), defaulting to the first discovered worktree if none has been active yet.
- Ticket workflow (Milestone 5, #17–#22), all local with no tracker API:
  - Ticket key from the branch or folder name; summary, link, databases, and test command from an
    optional notes file (`CLAUDE.local.md` by default), parsed defensively with validated links.
  - Ahead count and changed files against the base branch, measured from the merge base.
  - Worktree Explorer header `KEY · ↑N vs base` with the ticket summary; Open Ticket in Browser,
    Open Ticket Notes, and Copy Test Command.
  - Filter: all files, changed against the base branch, or uncommitted only.
  - Compare with Base Branch, Compare with Main Checkout, and Open in Main Checkout.
  - A Tickets view listing every linked worktree, with Show in Worktree Explorer, Open in New
    Window, and Copy Cleanup Command (clipboard only).
  - New settings: `baseBranch`, `ticket.keyPattern`, `ticket.urlTemplate`, `ticket.notesFile`,
    `ticket.cleanupCommand`.
  - #23: stacked branches compare against the branch they were created from (read from Git's
    reflog), falling back to the base branch setting or develop/main/master.
  - #24: Ready to clean up: tickets whose key appears in a commit on their base branch since the
    split, with a copy-only cleanup command and a confirmed Remove Worktree action (never forced).
  - #25: the Tickets view is now the design-A card sidebar (a webview), plus a ticket overview
    tab. Strict CSP, text-only rendering, and validated messages; this replaces the #22 tree.
    Cards show the main checkout first, compact buttons, and dev/test databases when expanded.
  - #26: optional tunnel support: a "● Tunnel" badge on the served checkout (from a configured
    site link) and a confirmed **Serve via tunnel** button that runs your configured serve command
    in a visible terminal. Settings `tunnel.siteLink` and `tunnel.serveCommand` are user-level only.
- Source maps in nested folders are now excluded from the VSIX.

## 0.1.0

First feature-complete release of the MVP described in `docs/PRD.md`.

- Secondary Explorer view bound to one linked Git worktree, following Source Control selection
  automatically, with a manual Quick Pick override (Select Worktree).
- Browse, open, create, rename, and delete files and folders in the active worktree; automatic
  refresh on external filesystem changes, plus manual Refresh and Collapse All.
- Copy Relative Path / Copy Absolute Path / Reveal in File Explorer, Copy Worktree Path / Reveal
  Worktree Root, and an Extension Settings shortcut.
- Root-boundary safety: path traversal and symlink-escape protection, root/`.git` protection,
  stale-command rejection on worktree switch, Workspace Trust gating on all mutating commands.
- Per-workspace persistence of the last valid selection, restored on startup when nothing else
  claims it.
- `worktreeExplorer.*` settings: `followScmSelection`, `restoreLastSelection`, `showHiddenFiles`,
  `sortOrder`, `exclude`, `openFilesInPreview`, `confirmDelete`, `useTrash`.
- No telemetry, no network calls, zero runtime dependencies.
