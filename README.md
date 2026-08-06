# Worktree Explorer

A VS Code extension that adds a secondary Explorer view bound to one selected Git linked
worktree — browse, open, create, rename, and delete files in it — **without** adding that
worktree to your workspace.

Git worktrees let you check out several branches of one repository at once. VS Code can already
discover them in Source Control, but the built-in File Explorer stays tied to your workspace
folders. Worktree Explorer gives you a native, familiar file tree for another worktree — the one
selected in Source Control, or one you pick manually — while your current workspace, tasks,
search, and language tooling stay exactly as they are.

## How it works

- **Follows Source Control automatically.** Select a linked worktree's repository in the Source
  Control view and Worktree Explorer appears, rooted at it. Select the main repository (or nothing
  linked) and it hides again.
- **Manual override.** Use the **Select Worktree** action (view title, or Command Palette) to open
  any discovered linked worktree directly. A manual choice stays active until Source Control
  selection changes.
- **Browse, open, create, rename, delete.** Standard Explorer-like interactions, scoped strictly to
  the active worktree.
- **Never touches your workspace.** The active worktree is never added to
  `workspace.workspaceFolders` or any `.code-workspace` file — this is a browsing/editing surface,
  not a second workspace, and multi-root side effects (search, tasks, extension activation) never
  apply to it.

## Scope and limitations

This is intentionally smaller than a second full VS Code workspace:

- Local filesystem repositories and linked worktrees only.
- Requires VS Code's built-in Git extension (bundled with VS Code by default).
- Does not create, move, prune, lock, or delete Git worktrees themselves — only files/folders
  *inside* the active one.
- No staging, committing, merging, rebasing, or branch management.
- No drag-and-drop, copy/cut/paste, or multi-selection operations.
- No Git status decorations, no webview, **no telemetry** — nothing ever leaves your machine.

See [`docs/PRD.md`](docs/PRD.md) §5 for the complete list of non-goals and §32 for ideas
deliberately kept out of this first release.

## Safety

Every file operation is validated by a single shared boundary guard before it touches disk:

- Mutations can never escape the active worktree root (path traversal and symlink-escape targets
  are rejected).
- The worktree root itself and Git administrative paths (`.git`) can never be renamed or deleted.
- Commands re-validate the active worktree immediately before mutating, so a worktree switch that
  happens mid-operation aborts it instead of writing to the wrong place.
- Mutating commands are disabled by default in untrusted workspaces (browsing and opening remain
  available).

## Commands

| Command | Where |
|---|---|
| Select Worktree | View title, Command Palette |
| Refresh | View title |
| Collapse All | View title (built-in tree button) |
| Open File | Click a file |
| New File / New Folder | Folder context menu, view title |
| Rename / Delete | Item context menu |
| Copy Relative Path / Copy Absolute Path / Reveal in File Explorer | Item context menu |
| Copy Worktree Path / Reveal Worktree Root / Extension Settings | View title (overflow) |

## Settings

All settings live under `worktreeExplorer.*` — see the Extension Settings action above, or search
`worktreeExplorer` in VS Code Settings. They cover following/restoring selection, sort order,
hidden files, exclusions, delete confirmation, and trash behavior.

## Development

```bash
npm install
npm run compile   # type-check, lint, bundle
npm test          # unit and integration suites
npm run profile   # performance profile against a large synthetic tree (not part of npm test)
```

Press `F5` in VS Code to launch the Extension Development Host.

See [`docs/PRD.md`](docs/PRD.md) for the full product requirements and
[`docs/IMPLEMENTATION_ISSUES.md`](docs/IMPLEMENTATION_ISSUES.md) / [`docs/issues/`](docs/issues/)
for the implementation backlog this was built against.

## Privacy

No telemetry, no analytics, no network calls of any kind — this extension has zero runtime
dependencies and only ever reads/writes the local filesystem through VS Code's own APIs.
