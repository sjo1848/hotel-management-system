# Mobile Component Decisions

**Audit HEAD:** `5ff365b31a4d94056351c5de150c2799f6607f65`
**System decision:** keep React + Tailwind + local Radix-compatible components. No UI framework migration.

## Decision dimensions

Every row below is evaluated on the same dimensions: **dependency/bundle** (REUSE/ADAPT = no new package; IMPORT = new package/code to validate; REJECT = zero impact), **accessibility** (prefer existing Radix semantics; validate any new role contract), **performance** (avoid mounting or interaction work that is not needed), and **overlap** (do not duplicate an existing HMS primitive or accepted picker).

| Candidate | Decision | Rationale / use |
|---|---|---|
| Drawer | REJECT | No proven swipe/snap need; Sheet already covers temporary surfaces |
| Sheet | REUSE / ADAPT | Existing Radix Dialog-backed primitive; add task-surface variants only when needed |
| Dialog | ADAPT | Short focused confirmations/task surfaces; avoid nested use |
| AlertDialog | IMPORT — targeted/deferred | Candidate for replacing browser `confirm()` in Users; defer to a concrete implementation slice and validate dependency, a11y and bundle first |
| DropdownMenu | REUSE | Secondary actions and “Más”, not primary workflow navigation |
| Popover | REUSE | Contextual help and brief filters |
| Command | REJECT for now | Guest picker already searches and bounds results; no `cmdk` need proven |
| Combobox | REJECT for now | Do not duplicate accepted guest/room pickers |
| Tabs | ADAPT | Preserve desktop; mobile should expose intent/next action, not all workspace panels |
| Accordion | REJECT | Could hide operationally critical actions and add depth |
| Collapsible | ADAPT only if repeated | Secondary information; current conditional mobile steps may suffice |
| Tooltip | ADAPT | Hover is not a primary touch pattern; use explicit help/Popover mobile |
| Navigation/Menu | ADAPT | Reuse capability data, create a mobile-specific composition rather than sidebar tree |
| Form/Input | REUSE | Existing controls and touch sizing are sufficient base |
| Select | REUSE native where short | No second selection ecosystem without a concrete need |
| Checkbox | REUSE | Check-in and bulk operations |
| Radio | REJECT for now | No repeated current workflow requiring import |
| Switch | REJECT for now | No repeated current workflow requiring import |
| Skeleton | REUSE | Existing loading primitive |
| Toast | ADAPT | Validate `max-width: calc(100vw - 2rem)`, wrapping and safe-area at 375px |
| Progress | ADAPT conceptually | Existing reservation/check-in progress; avoid decorative use |
| ScrollArea | REJECT for now | Native overflow is sufficient until nested-scroll defect is measured |
| Table/DataTable | ADAPT per feature | Desktop table stays; mobile needs summary/state/primary-action contract, not every column |
| Card | REUSE / ADAPT spacing | Use compact entity summaries; avoid globally shrinking desktop cards |
| Badge | REUSE | Compact status and counts |

## Concrete evidence by relevant component

| Component | Dependency / bundle | Accessibility | Performance | Overlap |
|---|---|---|---|---|
| Sheet | No new package; local Radix primitive | Focus/Escape behavior is inherited, but return-to-trigger focus needs slice-level tests | Mount only when opened; avoid nested task sheets | Overlaps Drawer; keep Sheet |
| AlertDialog | Would add/retain a targeted Radix primitive; no broad import approved | Better confirmation semantics than browser `confirm()`; validate labels and focus | Targeted use only; measure bundle/chunk impact in implementation slice | Use only for destructive confirmation, not generic Dialog |
| DataTable | No new package | Preserve list semantics and explicit entity actions | Current rows/fields are all rendered; volume-dependent risk needs profiling | MobileList must be feature-specific, not a universal replacement |
| Toast | No new package | Preserve status semantics, wrapping and a touch-sized dismissal target | Fixed width currently risks narrow viewports; validate safe-area and layout work | Adapt existing Toast; do not add another notification system |
| Navigation / Menu | No new package | Separate real tabs from menu buttons/items and validate focus return | Menu test showed zero extra requests; tree render/animation cost remains unmeasured | Reuse capability data, not the desktop sidebar visual tree |

## Accessibility corrections required before implementation approval

- `tab-strip.tsx:96-123` and `ReceptionWorkspaceTabs.tsx:112-145` must not combine `role="tab"` with dropdown menu items. Keep real tabs in a `tablist`; make “Más” a menu trigger with `aria-haspopup`/`aria-expanded` and `menuitem` children.
- Guest/room pickers support opening and Escape, but return-to-trigger focus is not globally proven. Add explicit focus/back tests in the relevant implementation slice.
- Any future toast adaptation must preserve status semantics, wrapping, safe-area and 44px dismissal target.

## Existing foundation to preserve

- `frontend/src/components/ui/sheet.tsx`
- `dropdown-menu.tsx`, `popover.tsx`, `button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`
- `skeleton.tsx`, `toast.tsx`, `data-table.tsx`, `tab-strip.tsx`
- Radix dependencies already present in `frontend/package.json`

## Material findings for future implementation

1. `data-table.tsx:88-90`: critic reports duplicate ErrorState; repair in a bounded implementation ticket, not this audit.
2. `UsersPage.tsx:38`: replace `confirm()` with targeted Radix AlertDialog.
3. `toast.tsx:58`: make mobile width/safe-area explicit.
4. Mobile navigation (`DashboardLayout.tsx:414-474`) needs a distinct composition while reusing navigation data.
5. `DataTable` should not become a universal mobile workflow; entity-specific primary action contracts are required.

## Import policy

Import only when a concrete repeated problem, accessibility benefit, and bundle impact are evidenced. Current recommendation: no broad shadcn import; AlertDialog is the only targeted candidate. Drawer, Command, Combobox, Accordion, ScrollArea, Radio and Switch are rejected for now.

**FACT:** the current local Radix foundation covers the most frequent mobile needs without new packages.
**INFERENCE:** composition and information hierarchy are higher-value than adding primitives.
**UNVALIDATED:** exact bundle and interaction impact of any future imported AlertDialog must be measured in its implementation slice.

## Verdict

`REWORK_REQUIRED → DOCUMENTED`

The design-system architecture is adequate. Remaining findings are bounded future implementation work, not justification for a new framework.
