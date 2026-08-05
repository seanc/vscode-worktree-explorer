# Worktree Explorer

A VS Code extension that adds a secondary Explorer view bound to one selected Git linked worktree —
browse, open, create, rename, and delete files in it — without adding that worktree to your
workspace.

**Status: early development.** This is issue #1 (project bootstrap) only. The extension currently
contributes an inert, hidden view and has no user-facing behavior yet.

See [`docs/PRD.md`](docs/PRD.md) for the full product requirements and
[`docs/IMPLEMENTATION_ISSUES.md`](docs/IMPLEMENTATION_ISSUES.md) for the implementation backlog.

## Scope and limitations

- Local filesystem repositories and linked worktrees only (MVP).
- Requires VS Code's built-in Git extension.
- Never adds the displayed worktree to `workspace.workspaceFolders` — it is a browsing/editing
  surface, not a second workspace. See `docs/PRD.md` §5 for the full list of non-goals.

## Development

```bash
npm install
npm run compile   # type-check, lint, bundle
npm test          # run the unit and integration suites
```

Press `F5` in VS Code to launch the Extension Development Host.
