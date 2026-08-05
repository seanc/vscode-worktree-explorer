# #1 — Bootstrap the VS Code extension project

**Milestone:** 0 — Technical feasibility
**Depends on:** none
**Labels:** `type: infrastructure`, `priority: critical`, `area: extension`

## Objective

Produce a buildable, lintable, testable, packageable VS Code extension skeleton with the view
contribution wired but inert. No Git, tree, selection, or file-operation logic.

## Out of scope

Git API usage (#2), SCM selection/visibility logic (#3), `SelectionCoordinator`/Quick Pick (#4/#5),
real tree data (#6), file mutations (#8–#11), persistence (#12).

## Deliverables

- Repository structure per PRD §33: `src/{extension.ts, git/, selection/, tree/, filesystem/,
  commands/, ui/, persistence/, common/}` (each non-`extension.ts` folder holds a placeholder stub
  only), `test/{unit/, integration/, fixtures/}`, `resources/`, `.github/{ISSUE_TEMPLATE/,
  workflows/}`, `.vscode/`.
- `package.json` with `engines.vscode` pinned, `contributes.views.explorer` per PRD §14 (id
  `worktreeExplorer.files`, `"when": "worktreeExplorer.visible"`), build/lint/test/package scripts.
- esbuild bundle config (`vscode` marked external), `tsconfig.json` (`strict: true`), `eslint.config.js`
  (flat config), `@vscode/test-cli` config (`.vscode-test.mjs`).
- `.vscode/launch.json` + `tasks.json` for F5 debugging.
- `.github/workflows/ci.yml` running install/lint/build/test.
- `README.md` (minimal), `CHANGELOG.md` (`Unreleased` heading), `LICENSE`.

## Acceptance criteria

- Clean install, build, lint, and test all succeed.
- `F5` launches the Extension Development Host with no console errors; no worktree-specific commands
  are registered yet.
- `contributes.views.explorer` is declared per PRD §14; nothing in this issue ever sets
  `worktreeExplorer.visible` true, so the view stays hidden.
- `vsce package` produces a `.vsix` locally (packaging smoke test — full Marketplace readiness is
  #16; PRD §34 item 18).
- No import of Git-extension API types anywhere in `src/` (PRD §16.2 — `git/` stays a stub).
- `engines.vscode` is pinned to an explicit minimum version, documented in the PR description since
  it constrains #2.

## Validation

Run install/build/lint/test locally and in CI; manual F5 activation check confirming no runtime
module-resolution errors (verify esbuild's `external: ['vscode']` setting specifically).
