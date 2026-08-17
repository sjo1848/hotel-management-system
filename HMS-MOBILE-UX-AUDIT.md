# HMS Mobile UX/UI Audit

**Task:** HMS-MOBILE-UX-PERF-001
**Audit HEAD:** `5ff365b31a4d94056351c5de150c2799f6607f65`
**Mode:** read-only audit; no redesign implemented
**Viewports:** functional evidence at 375/390/430; broader layout checks also exist at 768/1024/1440.

## Executive diagnosis

**FACT:** PR #29 is canonically green in run `32079554969`: Backend, Frontend, Security, Performance Smoke, core E2E, reception lifecycle at 375/390/430, and Stability Guard all PASS.

**FACT:** Reservation and check-in have explicit mobile steps. Guest and room selection use bounded searchable surfaces.

**INFERENCE:** HMS is now partially mobile-first, but the global experience remains a desktop workspace adapted to mobile. The material gap is task hierarchy and cognitive load, not basic responsive CSS or horizontal overflow. The cognitive/scroll benefit of any new task flow remains unvalidated.

**RECOMMENDATION:** approve architecture review before implementation. Do not redesign screen-by-screen or import a UI framework.

## Evidence limits

Current tests prove functional completion, controls, permissions, overflow, selector behavior, and menu request count. They do not prove scroll burden, cognitive steps, focus/back consistency across every surface, physical-device fluency, INP, long tasks, render duration, or user comfort. Therefore:

- `PROVEN`: reception lifecycle and mobile selector/lifecycle coverage.
- `PARTIALLY_PROVEN`: surfaces covered by smoke/navigation/accessibility tests.
- `UNKNOWN`: reduction of cognitive load and operational scroll.
- `PROPOSED`: future architecture and slices; not product acceptance.

## Surface matrix

| Surface / workflow | Current evidence | Current gap | Classification |
|---|---|---|---|
| Login/auth | Role routing and auth tests; `frontend/src/features/auth/*` | No dedicated mobile friction evidence | UNKNOWN |
| Global shell/menu | `DashboardLayout.tsx:324-367,414-503`; menu test at `frontend/e2e/reception-role-smoke.spec.ts:79-111` | Sheet still exposes sidebar groups, branding, preview and descriptions | UX_RISK / PERFORMANCE_RISK |
| Global search | `DashboardLayout.tsx:478-503`; keyboard routing branches for numeric, `@`, and other queries | Search trigger/routing exists, but a complete mobile search journey, result surface, latency and back/context behavior are not evidenced | PARTIALLY_PROVEN / UNKNOWN |
| Notifications | `DashboardLayout.tsx:493-500` | Bell affordance is present, but notification loading, empty/error state, destination and mobile task value are not evidenced | UNKNOWN |
| Context help / secondary menus | `BookingsPage.tsx:398`, `WalkInBookingSheet.tsx:290`, `ReceptionWorkspaceTabs.tsx:112-145` | Help is available in temporary surfaces, but menu semantics and consistent focus return are not globally proven; tab/menu role mixing is a confirmed accessibility risk | PARTIALLY_PROVEN / ACCESSIBILITY_RISK |
| Dashboard | `DashboardHome.tsx`, dashboard tests | Overview/KPIs compete with “what now?”; no complete task evidence | PARTIALLY_PROVEN |
| Reception | `BookingsPage.tsx:391-611`, reception smoke tests | Header/help/export/guide/actions and operational views compete; “Más” hides some states | UX_RISK |
| New reservation | `WalkInBookingSheet.tsx:93-362`; lifecycle E2E | Best mobile flow; creation assertion has a fallback when CTA is absent; persistent chrome/internal scroll remain | PARTIALLY_PROVEN |
| Guest picker | `WalkInGuestSection.tsx:157-192` | Functional selector evidence; return focus and payload/filter volume not measured | PARTIALLY_PROVEN / ACCESSIBILITY_RISK |
| Room picker | `WalkInRoomSelectionSection.tsx:136-170` | Functional bounded surface; return focus and full availability payload not measured | PARTIALLY_PROVEN / ACCESSIBILITY_RISK |
| Booking workspace | `BookingCaseWorkspace.tsx:206-350`, `BookingCaseTabs.tsx:46-105` | Summary/operation/account/history remain a tab workspace; all panels may remain mounted | UX_RISK / PERFORMANCE_RISK |
| Check-in | `BookingCheckInSection.tsx:34-99`; lifecycle E2E | Steps and CTA exist; reduced scroll/cognitive load not measured | UX_RISK (not confirmed regression) |
| Charges/payment/checkout | `BookingCheckOutSection.tsx`, lifecycle E2E | Functional path passes; mobile action hierarchy and return context not proven | PARTIALLY_PROVEN / UX_RISK |
| Rooms | `RoomsPage.tsx`, `RoomsWorkspace.tsx`, room smoke tests | Inventory/availability/planner/holds remain workspace tabs; no complete mobile task journey | PRODUCT_GAP / UNKNOWN |
| Guests/users | `GuestsPage.tsx`, `UsersPage.tsx`, `data-table.tsx:162-240` | Cards retain many fields; long-list task contract absent | UX_RISK / PERFORMANCE_RISK |
| Housekeeping | `HousekeepingPage.tsx`, smoke coverage | Queue plus selected workspace stack; no independent complete mobile task evidence | PRODUCT_GAP / UNKNOWN |
| Calendar | `CalendarPage.tsx:56-120`, calendar tests | Filters/range/summary/agenda compete; no complete mobile operational journey | UX_RISK / PERFORMANCE_RISK |
| Reports/network | `ReportsPage.tsx`, network tests | Mostly navigation/overview evidence; not mobile operationally prioritized | PARTIALLY_PROVEN |
| Loading/error/empty | `App.tsx`, `async-state.tsx`, `data-table.tsx` | Some states are large or duplicated; action context inconsistent | UX_RISK |

## Systemic findings

1. **Mobile navigation is still a desktop sidebar inside a Sheet.** Confirmed structure; impact is high for hierarchy, not proven as a measured latency regression.
2. **Reception presents too many simultaneous decisions.** Primary action should be the next operational task; help, export and guide are secondary.
3. **Tables becoming cards does not make them task-oriented.** `DataTable` still renders all received records and fields; risk depends on tenant volume.
4. **Booking workspace hides a sequence inside tabs.** Check-in, account/payment and checkout need an explicit next-action model while preserving domain rules.
5. **Rooms, housekeeping and calendar remain panel/workspace-oriented.** They need complete mobile task evidence before implementation claims success.
6. **Global motion/remounts are a performance hypothesis.** `index.css:252-283` and `DashboardLayout.tsx:505-508` justify measurement, not a confirmed regression.
7. **Tabs/menu semantics need correction in a future implementation.** `tab-strip.tsx:96-123` and `ReceptionWorkspaceTabs.tsx:112-145` mix tab roles with dropdown menu items; classify as confirmed accessibility risk.
8. **Focus/context return is not proven globally.** Some surfaces support Escape/autoFocus, but picker return-to-trigger focus needs explicit validation.

## Concrete technical findings for future slices

These are recorded, not repaired in this audit:

- `frontend/src/components/ui/data-table.tsx:88-90`: critic reports duplicated `ErrorState` rendering.
- `frontend/src/features/users/UsersPage.tsx:38`: browser `confirm()` is not an adequate mobile confirmation surface; targeted Radix AlertDialog candidate.
- `frontend/src/components/ui/toast.tsx:58`: fixed 320px toast requires 375px/safe-area validation.
- `BookingCaseTabs.tsx:46-105`: panel mounting is a performance risk requiring measurement.
- `tab-strip.tsx:96-123`: tab/menu ARIA semantics require a bounded accessibility repair.

## Acceptance gaps

Before any slice is considered successful, it must show: one complete mobile task, visible primary action, preserved state on back/close, secondary actions out of the critical path, accessibility/focus evidence, 375/390/430 validation, and desktop regression coverage. Screenshots or overflow checks alone are insufficient.

Required measurements for claims of UX improvement: task steps, time to primary action, total completion time, backtracks, scroll burden, focus return, and context preservation. Until measured, benefits remain `PROPOSED / UNVALIDATED`.

## Prioritized implementation proposal

1. **Slice A — Mobile shell:** compact app header; frequent destinations first; secondary administration grouped; preserve desktop sidebar.
2. **Slice B — Reception/reservation:** compact reception task header; preserve accepted guest/room pickers; operational “next action” navigation.
3. **Slice C — Booking operations:** explicit check-in → account/payment → checkout sequence; one primary action by state; preserve API/domain.
4. **Slice D — Rooms/Guests:** entity summary + search/filter + temporary detail surface; define per-entity mobile list contract.
5. **Slice E — Housekeeping:** queue → select room → action → return, with independent E2E journey.
6. **Slice F — Calendar/admin/reports:** only after prior patterns and measurements validate.

## Desktop preservation

Share domain, state, API, services and proven Radix primitives. Use explicit mobile composition branches. Do not globally shrink `PageHeader`, `Card`, `DataTable` or alter desktop sidebar behavior. Every slice must include desktop regression validation.

## Project Method findings

- **TRANSFER_CONFIRMED:** Human Acceptance exposed a systemic interaction defect that technical green checks did not catch.
- **TRANSFER_CONFIRMED:** bounded audit before broad implementation reduced scope risk.
- **METHOD_IMPROVEMENT_CANDIDATE:** every UX architecture claim needs a current-vs-target workflow step matrix and an evidence label (`PROVEN`, `PARTIALLY_PROVEN`, `UNKNOWN`, `PROPOSED`).
- **METHOD_IMPROVEMENT_CANDIDATE:** distinguish functional mobile PASS from ergonomic/product acceptance.
- **RUNTIME_CAPABILITY_GAP:** independent worker orchestration was available for lanes and critics in this execution; one notification reported a main-runtime fallback, so critic independence must be recorded per agent rather than assumed globally.

## Verdict

`READY_FOR_MOBILE_ARCHITECTURE_REVIEW`

Implementation remains stopped pending human architecture/UX review. PR #29 remains unmerged.
