# Changelog

## Unreleased

- The Worktree Explorer view now stays visible whenever the project has any linked worktree,
  regardless of what's currently selected in Source Control. Selecting the main repository no
  longer hides the view — it keeps showing the most recently active worktree (SCM, manual pick, or
  restored session), defaulting to the first discovered worktree if none has been active yet.

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
