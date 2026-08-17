# Mobile Interaction Architecture

**Status:** proposal for review; no implementation in this phase.
**Principle:** ask “what must the operator do now?” before presenting all module information.

## Three levels

### Level 1 — Mobile App Shell

`[Menu] [current context / explicit search] [Notifications]`

- Compact persistent chrome.
- Frequent operational destinations first: Reception, current task, Rooms/Housekeeping as role permits.
- Administration, reports, network and logout behind secondary grouping.
- Navigation uses existing route data/capabilities but a mobile-specific visual tree.
- Do not mount desktop sidebar descriptions/preview as the primary mobile menu content.

Evidence: `DashboardLayout.tsx:230-367,414-503`. Menu has zero additional requests in `reception-role-smoke.spec.ts:79-111`; perceived latency remains unmeasured.

### Level 2 — Task flows

| Workflow | Current | Target | Evidence status |
|---|---|---|---|
| Reservation | Mobile steps and selection surfaces exist; the lifecycle test tolerates an absent direct create CTA | Stay → guest → room → review/create, one primary decision per step | PARTIALLY_PROVEN; friction reduction UNKNOWN |
| Check-in | Four mobile stages exist | Verify → stay/data → room → confirm, with only current stage dominant | Functional PROVEN; ergonomic reduction UNKNOWN |
| Account/payment/checkout | Tabs inside booking workspace | Next-action sequence driven by booking state; history/secondary actions out of path | PARTIALLY_PROVEN; target PROPOSED |
| Housekeeping | Queue and selected workspace | Queue → room → action → return | Current complete mobile journey UNKNOWN |
| Rooms | Multi-tab workspace | Inventory task first; planner/holds secondary | Current complete mobile journey UNKNOWN |
| Calendar/admin | Filtered workspaces/overview | Day/task first; filters and reports secondary | Current complete mobile journey UNKNOWN |

## Current vs target step matrix

The target benefit is `PROPOSED / UNVALIDATED`; current measurements for steps, time, backtracks and scroll do not exist.

| Workflow | Current observable path | Target path | Required acceptance evidence |
|---|---|---|---|
| Reservation | Open sheet → dates → guest picker/quick guest → room picker → review/create; mobile E2E covers the lifecycle but tolerates an absent create CTA | Open task → Stay → Guest → Room → Review/Create; one decision per step, no lost state | Direct create action must be observed without fallback; step count, backtracks, time-to-create, scroll and focus return at 375/390/430 |
| Check-in | Open booking workspace → Operation tab → checklist → reference → stage navigation → confirm | Open case → Verification → Stay/data → Room → Confirm; next step always visible | Complete task; step count, time-to-confirm, backtracks, scroll, focus/back and desktop regression |
| Checkout | Open workspace → Account/Operation tabs → charges/payment state → checkout blockers/reference → confirm | Open case → Account/payment status → Checkout decision → Confirm release/handoff | Complete checkout/release; primary CTA visibility, time, backtracks, state preservation and no hidden blocker |

### Level 3 — Temporary surfaces

Use Sheet/Popover/Dropdown/Dialog only for temporary decisions:

- guest/room selection;
- search/filter;
- contextual help;
- secondary actions;
- entity detail;
- short confirmations.

Back/Escape must close the temporary surface first, return focus to its trigger, and preserve parent state. Current picker implementations do not provide sufficient global evidence for return-to-trigger focus, so this is an acceptance criterion, not a proven capability. Do not chain nested modal surfaces or route every micro-decision.

## Reusable patterns (conceptual)

| Pattern | Need | Primitive | Decision |
|---|---|---|---|
| MobileAppHeader | compact shell context | local Button/Input/Sheet | adopt after shell slice |
| CompactTaskHeader | too much persistent header chrome | local layout + Popover help | adopt when repeated |
| MobileTaskFlow | one decision/step and clear next action | local state + progress | preserve existing flow, extract only after repetition |
| MobilePicker | long entity selection | existing bounded Sheet/inline picker | preserve guest/room pattern |
| CompactActionBar | too many footer actions | local Button + DropdownMenu | adopt for check-in/checkout |
| ContextHelp | permanent explanatory text | Popover | adapt existing help |
| SecondaryActions | actions that should not compete | DropdownMenu | reuse |
| MobileList | table-to-task conversion | feature-specific composition over DataTable | define per entity |
| MobileEntitySummary | select entity and return with context | Card/Badge/Sheet | adopt for rooms/housekeeping |

No abstraction is approved merely because it has a name; repetition and a complete workflow must justify it.

## Slice Definition of Done

For each future slice:

1. One named mobile task completes at 375/390/430.
2. Primary action is visible at the current step.
3. Back/Escape/close preserves state and focus.
4. Secondary actions do not obscure the task.
5. Functional API/domain behavior is unchanged unless directly evidenced.
6. Desktop behavior remains green.
7. Evidence includes functional journey plus measured interaction boundary where performance is in scope.
8. ARIA roles remain coherent: real tabs stay in a tablist; “Más” is a menu button with menu items, not tab roles inside a dropdown.
9. UX improvement claims include steps, time-to-action, completion time, backtracks, scroll and focus/context evidence.

## Desktop strategy

Preserve desktop composition, domain state, API v1, services and stable primitives. Mobile may use a distinct composition and task flow. Keep responsive branches explicit to avoid repeating the `WalkInBookingSheet` desktop regression.

## Review gate

`READY_FOR_MOBILE_ARCHITECTURE_REVIEW` — human review is required before mass implementation.
