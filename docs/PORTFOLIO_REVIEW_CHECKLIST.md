# HMS Elite — Portfolio Review Checklist

Use this checklist before the next release and periodically for portfolio hygiene.

## Repository presentation

- [x] README explains the product in the first screen.
- [x] Primary stack is visible without scrolling through setup instructions.
- [x] Architecture and quality evidence are summarized.
- [x] Portfolio case study is linked.
- [x] Current limitations are stated explicitly.
- [ ] GitHub repository description is updated in repository settings.
- [ ] Relevant GitHub topics are added: `rust`, `axum`, `react`, `postgresql`, `hotel-management`, `saas`, `multi-tenant`, `observability`, `quality-assurance`.
- [ ] HMS Elite is pinned on the public GitHub profile.

## Visual evidence

- [x] Verified screenshots published in `docs/screenshots/` (login, dashboard, bookings, calendar, rooms, guests, housekeeping, network, users, reports).
- [ ] Add a role-specific screenshot set (saas_admin, reception, housekeeping, admin) to match the tagged version.
- [ ] Add a concise architecture image if Mermaid rendering is insufficient for external use.
- [ ] Record a 60–90 second walkthrough.

## Technical validation

- [x] Full CI workflow green (`CI Stability Guard`) on latest releases.
- [ ] Verify quick start from a clean clone.
- [ ] Confirm OpenAPI documentation renders correctly.
- [ ] Confirm no secrets, local environment files or generated archives are tracked.
- [ ] Confirm all README links resolve.
- [ ] Verify screenshots match the exact release version.

## Release readiness

- [x] Release `v0.1.0` tagged and published with notes (2026-08-03).
- [ ] Decide the next portfolio release name.
- [ ] Document known limitations in upcoming release notes.
- [ ] Attach or link the product walkthrough.
- [ ] Publish a constrained read-only demo or explicitly state that no public demo is available.
- [ ] Pin the release commit used by screenshots and demo.

## Recruiter review test

A reviewer should be able to answer these questions in less than two minutes:

- What business problem does HMS Elite solve?
- What parts were implemented in Rust and React?
- How does the system enforce roles and tenant isolation?
- What automated quality controls exist?
- What is already implemented and what remains pending?
- How can the project be run or reviewed?

If any answer requires searching through source code, improve the README or case study before release.