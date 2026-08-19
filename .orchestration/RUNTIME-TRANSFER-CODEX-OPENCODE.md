# Runtime Transfer Entry — Codex → OpenCode + DeepSeek

previous_runtime: Codex
current_runtime: OpenCode + DeepSeek
transfer_point: 2026-08-18 (session start)
transfer_prompt_source: opencode-hms-project-method/BOOTSTRAP-TRANSFER-PROMPT.txt
phase: POST_HUMAN_GATE / IMPLEMENTATION_AUTHORIZED (mobile architecture)

## Verified state (executable truth, not doc claims)

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