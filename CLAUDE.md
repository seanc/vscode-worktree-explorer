# CLAUDE.md

## Purpose

Develop this repository **one work item at a time**. A work item may be a task, issue, or explicitly
selected PRD slice. Complete the smallest coherent change that satisfies it.

The PRD defines the release, milestones group and sequence work, and the active task or issue defines
implementation scope.

## Sources of truth

Use this order:

1. The user's current instruction.
2. The active task or issue and its acceptance criteria.
3. Approved architecture decisions, specifications, and designs.
4. The relevant milestone objective and dependencies.
5. The PRD for release scope, constraints, and definition of done.
6. Existing code, tests, and general documentation.

Identify material conflicts instead of silently choosing one source.

## Selecting work

- Prefer an explicitly selected task or issue. Treat an issue as a task.
- If no item is selected but a backlog exists, use milestone order and dependencies to select the
  next unblocked issue. State it before editing.
- If only a PRD or milestones exist, first derive a concise ordered issue backlog with objectives,
  acceptance criteria, dependencies, and validation. Never implement the entire PRD as one task.
- A direct, bounded user request may itself be the active work item.
- Do not create duplicate task documents when issues or another tracker already serve that purpose.
- A milestone provides context and sequencing; it does not expand the active issue.

## Context discipline

- Read this file at session start and identify the active work item and milestone before editing.
- Read only the relevant PRD sections, documents, code, and tests.
- Search before opening large files and avoid re-reading unchanged content without reason.
- Reuse existing conventions and trackers; do not create parallel process documents.
- Keep plans, explanations, and status updates concise.

## Work procedure

### 1. Orient

Inspect the work item, milestone and PRD context, relevant documentation, implementation, tests, and
working tree. State the objective and open acceptance criteria. If no work item exists, derive or
select one before implementation.

### 2. Plan

Use an inline checklist for a small item. Use a plan file only for work spanning multiple phases,
components, or architectural decisions. Map steps to acceptance criteria and validation; avoid
speculative work.

### 3. Implement

- Work on one item, or one agreed phase, at a time.
- Make the smallest complete diff and follow existing architecture, naming, and style.
- Avoid unrelated refactoring, dependency upgrades, and adjacent backlog items.
- Add or update tests with the behaviour they cover.
- Change public contracts, persistence, security boundaries, or build tooling only when required.

### 4. Review

Review the diff against the active item and relevant design, milestone, and PRD constraints. Check
correctness, regressions, security, error handling, unnecessary complexity, scope creep, and missing
tests. Resolve confirmed findings before closure.

### 5. Validate

Run focused checks first, then the broader checks appropriate to the change. Include a smoke or
integration path when externally observable behaviour changes. Never claim a command passed without
running it; report commands and outcomes concisely.

### 6. Close

Before declaring the work item complete:

- verify every acceptance criterion;
- update its existing issue, task, or progress record;
- update milestone status only when appropriate;
- update documentation or `CHANGELOG.md` only when the repository and change require it;
- record unresolved risks or follow-up work separately;
- leave unrelated files untouched.

Do not close a milestone until its required items and exit criteria are complete. Do not commit,
push, merge, tag, or publish unless explicitly asked.

## Engineering rules

- Prefer simple, explicit solutions over clever abstractions.
- Preserve compatibility unless the work item explicitly changes it.
- Validate inputs, fail clearly, and never hide errors.
- Never introduce secrets, credentials, or production data.
- Comments explain decisions or non-obvious constraints, not code line by line.
- Follow established language, formatting, linting, and testing conventions.

## Completion report

Report briefly: what changed, acceptance criteria satisfied, checks and results, and remaining risks,
assumptions, or follow-ups.

## Commit policy
The repository should remain vendor-neutral. Do not introduce AI-specific attribution into source code, 
documentation, or commit messages unless explicitly requested.