# HMS Mobile Interaction Contract

Operational contract for the mobile reception, reservation and check-in surfaces.

| Need | Interaction pattern | Primitive | Why | Accessibility | Performance |
|---|---|---|---|---|---|
| Complete a multi-part task without a long page | `MobileTaskFlow` | Local state + visible step navigation | One decision per screen and preserved context | Step buttons expose current step; Back/Next are real buttons | Mount only the active step; keep existing data in state |
| Identify the current case quickly | `CompactTaskHeader` | Existing header elements + `DropdownMenu` | Keeps guest, room and status in the first viewport | Heading remains the dialog title; actions have labels | No new requests or heavy content |
| Keep the primary operation reachable | `CompactActionBar` | Existing `SheetFooter` + `Button` | One primary and one secondary action | 44px touch targets; disabled state is explicit | Fixed footer avoids repeated layout work |
| Choose from a long resource list | `MobilePicker` | Contained inline region + search input | Keeps one task surface and avoids nested modal focus traps | Named region, labelled search, 44px close, Escape closes | Render only the active picker and filtered results |
| Explain only when needed | `ContextHelp` | Existing `Popover` | Removes permanent instructional copy | Trigger has accessible label and content is dismissible | Content is mounted with the popover |
| Hide infrequent operations | `SecondaryActions` | Existing `DropdownMenu` | Reduces visual noise without removing capability | Menu items are keyboard/touch reachable | Menu content mounts on demand |

Rules: do not add a UI framework or dependency; preserve desktop markup through responsive variants; do not move business rules into presentation; use temporary surfaces only for decisions that need them, never nested task flows; inactive mobile stages and their expensive effects must not mount.
