# Manual QA Runbook — HMS Elite

This runbook provides a reproducible manual pass for the application. It complements automated CI; it does not replace backend, frontend or browser tests.

## Exit criteria

A manual run is `PASS` when:

- core reception, housekeeping and role-boundary scenarios complete without critical/high defects;
- protected routes/actions remain denied for unauthorized roles;
- persisted state remains correct after refresh;
- mobile task flows remain usable at the supported widths;
- no real personal or production data is used.

## Environment

Default local stack:

| Item | Value |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:3001` |
| Tenant | synthetic demo hotel |
| Viewports | `375`, `390`, `430`, `768`, `1024`, `1440` |
| Browser | Chromium/Chrome, zoom 100% |

Use the synthetic users created by the repository demo seed. Credentials are local/demo-only and must never be reused as production secrets.

## Preflight

From the repository root:

```bash
./scripts/gate.sh
```

For a focused browser smoke:

```bash
./scripts/playwright-smoke.sh
./scripts/playwright-reception-smoke.sh
```

If the automated preflight is red, separate that failure from the manual product result.

## QA-01 — Session and navigation

For each synthetic role:

1. Sign in.
2. Confirm the expected landing/navigation surfaces.
3. Open a permitted route directly by URL.
4. Attempt at least one route that the role must not access.
5. Sign out and revisit a protected URL.

PASS when protected routes do not become accessible merely because their URL is known and logout invalidates the browser session as expected.

## QA-02 — Reception: reservation / walk-in

At desktop and at least one mobile width:

1. Open Reception.
2. Start a new reservation/walk-in.
3. Select or create a synthetic guest.
4. Select dates and an available room.
5. Review the booking context.
6. Save and return to Reception.
7. Re-open the created booking and confirm the persisted values.

PASS when completing reservation creation returns to the reception task context rather than automatically starting check-in.

## QA-03 — Reception: check-in

1. Open a valid `Confirmed` booking.
2. Complete the required guest/contact/stay checks.
3. Change the selected room once before final confirmation when an alternative is available.
4. Confirm that changing room does not reset unrelated validations.
5. Complete check-in.
6. Return to Reception and confirm the booking/room state after refresh.

Expected transition:

```text
Booking: Confirmed → CheckedIn
Room:    Available → Occupied
```

PASS when the check-in task ends cleanly and later stay/checkout work remains a separate task.

## QA-04 — Charges, payment and checkout

1. Open an active checked-in stay.
2. Add a synthetic extra charge.
3. Review invoice/balance information.
4. Register payment through the supported flow.
5. Complete checkout when financial conditions allow it.
6. Refresh and verify the persisted result.

Expected normal transition:

```text
Booking: CheckedIn → CheckedOut
Room:    Occupied → Dirty
```

If testing a pending-balance override, use only a role with the dedicated override capability and verify unauthorized roles receive a backend denial.

## QA-05 — Housekeeping

1. Open Housekeeping with a room in `Dirty`.
2. Move it to `Cleaning`.
3. Complete cleaning and confirm `Available`.
4. Repeat with a maintenance case:
   - create the case;
   - verify the room becomes non-sellable;
   - resolve the case;
   - verify it returns to `Dirty` before normal cleaning.

PASS when housekeeping cannot skip the required lifecycle through a generic state action.

## QA-06 — Role and capability boundaries

Use at least `receptionist`, `housekeeping`, `ops`, `admin` and `saas_admin` synthetic roles.

Validate both UI visibility and backend denial for representative restricted actions. The permission source of truth is [`rbac-canon-v1.json`](rbac-canon-v1.json).

PASS requires the backend to reject an unauthorized mutation even when the UI also hides the control.

## QA-07 — Mobile behavior

Run the reception journey at `375`, `390` and `430` pixels.

Check:

- one clear primary action per task step;
- sheets/dialogs remain closable and scroll internally;
- primary CTA is reachable without layout breakage;
- touch targets are usable;
- focus returns to a sensible trigger/target after closing a temporary surface;
- back/close does not accidentally cancel business data;
- completed task state is preserved when returning to Reception.

Desktop behavior must remain unaffected by the mobile composition.

## QA-08 — Error and recovery states

Exercise at least one validation or authorization failure:

- invalid/missing booking input;
- unavailable room;
- forbidden action;
- failed/refused lifecycle transition.

PASS when the user receives an actionable error, valid input is not silently discarded and no partial critical mutation remains persisted.

## Evidence record

For each defect record:

- commit/ref;
- role;
- viewport;
- route/task;
- expected result;
- actual result;
- severity;
- screenshot/video when useful.

Do not retain one-off execution evidence in the public repository after the finding is resolved. Durable behavior belongs in tests, runbooks, ADRs or product documentation; historical execution records belong in issue/PR/Git history.
