# ADR-0007 — Mobile task composition

## Status

Accepted. The current product keeps desktop and mobile compositions explicit
while sharing domain state, API contracts and stable UI primitives.

## Decision

- Mobile operational surfaces use task-oriented flows with one primary decision
  visible at a time.
- Temporary decisions such as guest/room selection, search, help and secondary
  actions use the existing local Radix-compatible primitives (`Sheet`,
  `Popover`, `DropdownMenu` and focused dialogs); no broad UI framework is
  introduced for responsive work.
- Mobile may compose a workflow differently from desktop, but it must preserve
  API v1, domain rules, authorization and desktop behavior.
- Expensive inactive stages are not mounted. Closing or going back from a
  temporary surface preserves parent state and returns focus to the triggering
  control where the surface supports it.
- Mobile acceptance is demonstrated with functional browser journeys at 375,
  390 and 430 pixels plus desktop regression coverage. Ergonomic claims require
  measured workflow evidence; responsive layout alone is not treated as proof.

## Consequences

This keeps the product's transaction and authorization logic shared while
allowing mobile reception work to prioritize the operator's next action. It
also adds composition and responsive-test maintenance, but avoids duplicating
business rules or introducing a second component ecosystem.

## Evidence

- [Engineering case study](../ENGINEERING_CASE_STUDY.md)
- [Mobile reception walkthrough](../screenshots/README.md)
- [Full-stack CI](../../.github/workflows/full-stack-ci.yml)
