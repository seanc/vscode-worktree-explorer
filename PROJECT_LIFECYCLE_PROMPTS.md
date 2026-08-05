# Basic Claude Project Lifecycle Prompts

Replace bracketed text before use. Here, **work item** means a task or issue.

## 1. Create or refresh the implementation backlog

**Use:** when the repository has a PRD but no usable task/issue backlog, or after a substantial PRD
revision.

```text
Read CLAUDE.md, the PRD, and any existing milestones or implementation backlog. Inspect the
repository at a high level. Do not implement anything. Preserve useful existing issues and propose
only missing or necessary changes. Produce a concise ordered set of milestones and issues. For each
issue include its objective, PRD traceability, testable acceptance criteria, dependencies, and
validation. Keep each issue independently reviewable and flag contradictions or missing
requirements separately.
```

## 2. Select the next work item

**Use:** when no task or issue is currently active.

```text
Follow CLAUDE.md. Inspect the issue/task backlog, milestone order, dependencies, repository state,
and relevant PRD sections. Do not edit files. Identify the earliest incomplete milestone and select
the smallest unblocked issue that creates useful progress. State why it is next, its objective,
acceptance criteria, dependencies, and the relevant PRD constraints. If the backlog is incomplete,
propose the missing issue rather than absorbing extra scope into another one.
```

## 3. Start or resume a work item

**Use:** at the beginning of a work session, after context compaction, or when switching issues.

```text
Follow CLAUDE.md. Start or resume [task/issue name or ID]. Read its existing record, milestone, only
the relevant PRD/design sections, and the related code and tests. State the objective, open
acceptance criteria, dependencies, current repository state, and the next smallest useful step. Do
not edit yet.
```

## 4. Explore an implementation approach

**Use:** when the solution is uncertain or has meaningful trade-offs.

```text
Explore how to implement [work item or capability] under CLAUDE.md and the relevant issue,
milestone, PRD, and design constraints. Do not edit files. Describe the current implementation,
viable options, trade-offs, risks, and your recommended smallest approach. Distinguish documented
requirements from assumptions.
```

## 5. Plan a work item

**Use:** before a medium or large change. Skip this for a trivial, low-risk edit.

```text
Create a concise implementation plan for [task/issue]. Follow CLAUDE.md. Map every step to an
acceptance criterion and include the tests or checks that prove it. Keep the plan inline unless the
work truly needs multiple phases or components. Exclude unrelated refactoring, adjacent issues, and
speculative enhancements. Do not implement yet.
```

## 6. Implement a work item or phase

**Use:** after the acceptance criteria and approach are sufficiently clear.

```text
Implement [task/issue, acceptance criterion, or plan phase] according to CLAUDE.md. Keep the diff
minimal, follow existing patterns, and add or update tests with the behaviour. Run the relevant
focused checks. Stop after this item or phase, then summarise changed files, results, and any
blocker. Do not commit.
```

## 7. Review the change

**Use:** after implementation and before final validation or commit.

```text
Review the current working-tree diff against CLAUDE.md, the active task/issue acceptance criteria,
and the relevant milestone, PRD, and design constraints. Do not modify files yet. Look for
correctness defects, regressions, security issues, contract changes, unnecessary complexity, scope
creep, and missing tests. Rank findings by severity and cite the affected files and lines. Say
explicitly if there are no material findings.
```

## 8. Fix findings and validate

**Use:** after reviewing the implementation.

```text
Fix the confirmed review findings for [task/issue]. Do not broaden the scope. Run focused tests
first and then the broader checks appropriate to the change, including a smoke or integration path
when externally observable behaviour changed. Report the exact commands, outcomes, and any checks
you could not run. Do not commit.
```

## 9. Close the work item

**Use:** when implementation and validation are complete.

```text
Close [task/issue name or ID] according to CLAUDE.md. Verify each acceptance criterion from
evidence, update its existing tracker record, and update milestone status only if appropriate.
Update README, architecture documentation, or CHANGELOG only where the change requires it. Do not
commit. Provide a concise completion report with changes, validation results, assumptions, risks,
and follow-up issues.
```

## 10. Check milestone readiness

**Use:** after completing the last expected issue in a milestone.

```text
Assess whether milestone [name or ID] is complete. Do not implement or edit files. Review all issues,
the milestone objective, relevant PRD acceptance criteria, integration behaviour, and validation
evidence. List completed, incomplete, or weakly evidenced exit criteria and identify any missing
issue. Do not declare the milestone complete unless every required item is satisfied.
```

## 11. Prepare a commit

**Use:** only after the work item is reviewed, validated, and ready to record.

```text
Inspect the completed change for [task/issue name or ID]. Confirm that the working tree contains no
unrelated files and that completion evidence is present. Propose a concise commit message and list
exactly what will be included. Do not commit until I explicitly tell you to do so.
```
