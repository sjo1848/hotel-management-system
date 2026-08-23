# Guest Lifecycle — HMS Elite

This document describes the current operational lifecycle that connects reception, reservations, rooms, billing and housekeeping.

## Core entities

### Guest

The guest record provides identity and contact context for reservations and stays.

### Booking

The booking is the main commercial and operational record. Its lifecycle coordinates guest context, room assignment, dates, billing and front-desk evidence.

Core states:

```text
Confirmed → CheckedIn → CheckedOut
     ├──────────────→ Cancelled
     └──────────────→ NoShow
```

### Room

The room is operational inventory. The normal stay/housekeeping cycle is:

```text
Available → Occupied → Dirty → Cleaning → Available
                          ↘
                        Maintenance
                          ↓
                         Dirty
```

Maintenance resolution returns the room to `Dirty` so cleaning is still completed before the room becomes sellable again.

## Reception lifecycle

### Reservation or walk-in

Reception can open an existing reservation or create a walk-in by selecting/creating the guest, choosing dates and assigning an available room.

Availability is date-aware and respects active bookings and room holds.

### Pre check-in validation

Check-in is allowed only when the booking and room satisfy the required operational conditions. The backend, not only the UI, enforces the transition.

The accepted reception flow validates guest/contact context, stay dates and room assignment before the final transition.

If the room is changed during the check-in task, the room association changes while the already-completed identity/date/contact validations remain intact. A room reassignment is not a request to restart the complete check-in workflow.

### Check-in

Successful check-in performs the booking/room transition transactionally:

```text
Booking: Confirmed → CheckedIn
Room:    Available → Occupied
```

The operation records the relevant front-desk evidence and audit context.

### Stay operations

During an active stay the system supports operational work such as:

- room reassignment through the governed booking path;
- extra charges;
- invoice/balance inspection;
- payments;
- operational notes/evidence represented by typed booking data;
- room and maintenance context.

Room changes preserve continuity of the active reservation and apply the corresponding room-state transitions.

### Checkout

Checkout validates the booking state, room state and financial policy before closing the stay.

The normal transition is:

```text
Booking: CheckedIn → CheckedOut
Room:    Occupied → Dirty
```

A pending-balance exception uses the dedicated override capability and requires explicit operational evidence; it is not a generic status edit.

## Housekeeping handoff

Checkout hands a `Dirty` room to housekeeping.

The normal cleaning path is:

```text
Dirty → Cleaning → Available
```

If housekeeping identifies an operational problem, the room can enter `Maintenance` through the maintenance-case workflow. The case records reason, priority and responsibility. Resolution returns the room to `Dirty`, after which the normal cleaning path resumes.

## Arrival exceptions

The booking lifecycle distinguishes common front-desk outcomes rather than overloading cancellation:

- `Cancelled` records a cancellation reason and releases the booking from active inventory.
- `NoShow` is a separate terminal state with its own timing/evidence rules.
- Late-arrival information can be recorded while the booking remains `Confirmed`, allowing normal check-in later.

These transitions are implemented through the booking workflow and audited rather than represented as UI-only labels.

## Role boundaries

- **Receptionist:** reservations, guest context, check-in/out, charges/payments allowed by capability and daily front-desk work.
- **Housekeeping:** cleaning transitions and maintenance-case operations.
- **Ops:** broader operational inventory and exception handling.
- **Admin:** tenant administration and privileged operational actions, including governed overrides.
- **SaaS admin:** platform/network hotel administration rather than daily hotel operations.

The authoritative permission matrix is [`../validation/rbac-canon-v1.json`](../validation/rbac-canon-v1.json).

## Invariants

- A protected mutation must pass backend authorization even if the frontend hides the action.
- Tenant context is enforced below the UI boundary.
- A room cannot be sold through an overlapping active reservation.
- Check-in/check-out use explicit lifecycle transitions rather than arbitrary status mutation.
- Checkout releases the room to housekeeping, not directly to sellable inventory.
- Maintenance cannot be bypassed by a generic room-state update.
- Critical lifecycle operations are transactional and leave audit evidence.

## Evidence

- Domain/application logic: `backend/src/domain`, `backend/src/application`
- Transactional booking paths: `backend/src/infrastructure/repository`
- API contract: `backend/openapi.yaml`
- Backend lifecycle tests: `backend/tests`
- Browser journeys: `frontend/e2e`
- Manual QA procedure: `docs/validation/manual-qa-execution-runbook.md`
