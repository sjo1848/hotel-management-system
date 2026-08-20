# Runtime Transfer Entry — OpenCode + DeepSeek → Codex

previous_runtime: OpenCode + DeepSeek
current_runtime: Codex
transfer_point: 2026-08-20 (runtime handoff)
transfer_prompt_source: user runtime-transfer directive
phase: BOUNDED REWORK / E2E REPAIR

## Verified state (executable truth, not doc claims)

- Operational checkout: `/home/sjo1848/dev/hms-elite` (the requested
  `/home/sjo1848/dev/hotel-management-system` path is absent in this runtime).
- local HEAD: `d51aeac41e26f1400be4ce8c821bc385394975b8`.
- remote `origin/feature/mobile-ux-perf`: same SHA; no local-only commits.
- working tree: modified `frontend/e2e/guest-lifecycle.spec.ts`; untracked
  `.opencode/`, `opencode.json`, `.orchestration/RUNTIME-ADAPTER-DEFECT-RECORD.md`,
  and `frontend/e2e/probe.tmp.spec.ts`. These are preserved.
- PR #29: OPEN, DRAFT, not merged. Latest CI at this SHA has E2E Browser Core
  Journeys FAILURE; Secret Scanning, Backend CI, Frontend CI, and Performance
  Smoke Gate SUCCESS; Stability Guard SKIPPED.
- current unfinished work: validate/rework the OpenCode partial canonical E2E
  repair around invoice lookup and reopening the same booking/stay.
- Human Acceptance state: mobile architecture/direction PASS; Product
  Acceptance BOUNDED REWORK; R1-R6 remain the active contract.

## Runtime capability

- Codex can launch real subagents in this runtime. Product/test implementation
  is delegated to the implementer lane; critics are separate read-only
  subagent executions. No self-review is counted as independent criticism.

## Bounded rework execution

- Engineering repair: PASS for R1/R2 navigation; initial local Housekeeping
  failure was `ENVIRONMENT_DEFECT` caused by rate limiting/credentials, not
  invoice or `openBookingTab`.
- Domain critic: initial REWORK (`TEST_DEFECT` — weak booking identity and
  optional create CTA); rework applied; re-critique PASS.
- UX critic: initial REWORK (stale reservation copy and R5 ambiguity); copy
  corrected; global search evidence in `DashboardLayout.tsx` confirms R5; re-
  critique PASS.
- Integration critic: REWORK because local repairs were not yet published;
  canonical CI remains the remaining gate.
- Canonical CI at `c26bb2a`: 14/15 core E2E passed; the remaining failure was
  `TEST_DEFECT` caused by closing the nested action menu with `Escape`, which
  removed the case surface before Cuenta. A bounded repair removed that
  incidental menu assertion and preserves the lifecycle assertions.
- Latest local retry did not reach the repaired line because the persistent
  local synthetic database had no available room; classify as
  `ENVIRONMENT/fixture`, not product evidence. Canonical CI must be rerun with
  its clean synthetic seed.
- Repair loop count: 1. Repair changed only
  `frontend/e2e/guest-lifecycle.spec.ts` and
  `frontend/src/features/bookings/components/WalkInBookingSheet.tsx`.
- Local evidence after repair: frontend lint PASS, 54 test files / 344 tests
  PASS, frontend build PASS, `git diff --check` PASS, focused guest lifecycle
  PASS with `E2E_USERNAME=admin E2E_PASSWORD=demo2026pass`.
- Not included in product commit: `.opencode/`, `opencode.json`,
  `frontend/e2e/probe.tmp.spec.ts`, and the adapter defect record; all remain
  preserved as local OpenCode transfer artifacts.

- local HEAD == remote HEAD == PR #29 HEAD == 2a2a1a0f7e8c023d916184267d10ed038cc8108b (commit: feat(mobile): streamline rooms and calendar tasks)
- branch feature/mobile-ux-perf == origin/feature/mobile-ux-perf (0/0 ahead-behind)
- PR #29: OPEN, MERGEABLE, NOT merged. base main, head feature/mobile-ux-perf, title "Improve mobile reception UX and perceived performance"
- Canonical CI run 32149425903 PASS (backend, frontend, e2e core journeys, reception mobile 375/390/430, perf smoke, secret scan, stability guard) — verified for 2a2a1a0 per transfer prompt
- Human architecture gate: APPROVED 2026-08-18

## What is committed on HEAD (2a2a1a0)

- Slice 0 baseline + Slice 1 foundation + Slice 2 Rooms + Calendar (committed)
- Reception / check-in mobile work (committed in prior commits to 2a2a1a0)

## Open work found (uncommitted working tree, 22 files, +461/-189)

Already implemented in working tree, NOT yet committed, NOT yet gated:
- Slice 3 Housekeeping: HousekeepingPage.tsx, HousekeepingRoomWorkspace.tsx (+ new tests HousekeepingPage.test.tsx, HousekeepingRoomWorkspace.test.tsx)
- Slice 3 Dashboard: DashboardHome.tsx, DashboardControlCenter.tsx
- Slice 4 partial Guests/Users/Reports: GuestsPage.tsx, UsersPage.tsx, ReportsPage.tsx
- Shared UI: data-table.tsx, tab-strip.tsx, toast.tsx, index.css, DashboardLayout.tsx
- e2e touch-ups: housekeeping-role-smoke, calendar-role-smoke, guest-lifecycle
- Minor bookings touch-ups: BookingsPage, BookingCheckOutSection, BookingSupportSections

## Functional baseline order (from NEXT-PLAN)

completed/candidate: reservation+check-in, audit+architecture, Rooms+Calendar (committed on 2a2a1a0)
in flight (working tree): Slice 3 Housekeeping + Dashboard
next after Slice 3: Slice 4 Guests + Users + Reports (partially present in working tree)
then: Slice 5 cross-app consistency / acceptance

## Discrepancies

- NEXT-PLAN lists Housekeeping as "P1 / UX_RISK / UNKNOWN" and Dashboard "P2 / UX_RISK". Slice 3 is in flight.
- Slice 4 (Guests/Users/Reports) partial edits already present in working tree despite being scheduled after Slice 3; these need review/organizing, not blind discard.
- No contradiction found between docs and git at the transfer point.

## Acceptance contract per slice (unchanged, from NEXT-PLAN)

1 complete mobile task at 375/390/430; 2 single visible primary action; 3 preserved state on back/close; 4 secondary actions off critical path; 5 accessible focus+semantics; 6 no desktop regression; 7 before/after evidence same protocol; 8 no unnecessary requests/mounts.

## Guards

- No merge to main. No deploy. No real guest data. Do not discard working changes. Do not redo mobile audit.
- Component policy: REUSE/ADAPT existing Radix/Tailwind; only classified new components (Sheet REUSE/ADAPT, Dialog ADAPT, DropdownMenu REUSE, Popover REUSE, Tabs ADAPT, AlertDialog targeted, Drawer/Command/Combobox REJECT) unless new evidence.

## Next actions

Reconstruct + validate Slice 3 (Housekeeping + Dashboard) working-tree implementation, run evidence, critics, REWORK, then continue into Slice 4/5 per method. Continue autonomously; report only on legitimate Human Gate.
