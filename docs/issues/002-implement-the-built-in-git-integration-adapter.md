# #2 — Implement the built-in Git integration adapter

**Milestone:** 0 — Technical feasibility
**Depends on:** #1
**Labels:** `type: feature`, `priority: critical`, `area: git-integration`

## Objective

Build `GitIntegrationService`, the only component permitted to depend on the built-in VS Code Git
extension's API (PRD §16.2 isolation requirement).

## Deliverables

- Activates the built-in `vscode.git` extension and exposes Git enabled/disabled state.
- Discovers repositories and their linked worktrees; normalizes results into `WorktreeDescriptor`
  (PRD §15.1: `repositoryRoot`, `rootUri`, `displayName`, `ref`, `isMain`, `isDetached`).
- Exposes repository open/close events and per-repository UI-selected-state change events.
- No tree, filesystem, command, or persistence component may import Git API types directly — all
  access goes through this service.

## Acceptance criteria

- FR-001: detects linked worktrees for known repositories.
- FR-002: distinguishes main repositories from linked worktrees.
- FR-003: reacts to repositories/worktrees appearing and disappearing.
- FR-004: supports multiple unrelated repositories.
- Git-unavailable state is exposed in a form later consumers can use for AC-16.

## Validation

Unit tests with mocked Git API responses covering each FR above (no VS Code host required — this is
pure adapter logic behind an interface, per PRD §28.1).
