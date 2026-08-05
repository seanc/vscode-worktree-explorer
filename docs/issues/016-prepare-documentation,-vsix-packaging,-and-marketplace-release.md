# #16 — Prepare documentation, VSIX packaging, and Marketplace release

**Milestone:** 4 — Release
**Depends on:** all of Milestones 0–3 (#1–#15)
**Labels:** `type: release`, `priority: high`, `area: documentation`

## Objective

Bring the extension to ship-readiness.

## Deliverables

- README documenting scope, non-goals, and workspace-isolation guarantees (DoD item 19).
- Extension icon.
- Marketplace metadata: publisher, categories, gallery banner.
- `CHANGELOG.md` entry for the first release.
- Release CI: tag-triggered VSIX build and publish.
- Final privacy confirmation: no telemetry, no external data transmission (PRD §21, DoD item 20).

## Acceptance criteria

- DoD item 18 (the extension packages as a VSIX).
- DoD item 19 (documentation explains limitations and isolation).
- DoD item 20 (no telemetry or external data transmission).

## Validation

Install the packaged VSIX in a clean VS Code profile and walk the full PRD §34 definition-of-done
checklist (all 20 items) end-to-end as a manual release smoke test.
