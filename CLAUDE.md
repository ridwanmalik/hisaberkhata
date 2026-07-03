@AGENTS.md

# Cash-First Money Manager — Project Plan

## Concept

A local-first PWA for managing day-to-day money in a cash-heavy economy (Bangladesh, BDT).
Instead of tracking every transaction independently, it mirrors how cash actually flows:
withdraw money → spend it gradually → account for it lazily.

## Core Differentiator

**Withdrawal-as-container model.** An ATM/bKash cash-out becomes a _parent transaction_.
Purchases made from that cash are attached as _child transactions_ — added lazily, over days.
The unallocated remainder is always visible (e.g., "৳1,500 left from Jul 2 withdrawal").
No forced categorization, no separate cash account drifting out of sync.

## Tech Stack

- **Next.js (App Router) + TypeScript** — client-heavy; server stays thin until Phase 3
- **PWA via Serwist** — installable, fully offline (critical for in-store entry)
- **Dexie.js (IndexedDB)** — local-first storage; `useLiveQuery` for reactive UI
- **Zustand** — minimal UI state only (filters, modals); Dexie is the source of truth
- **Tailwind CSS** — styling
- **Phase 3 only:** Supabase + Next.js server actions for sync/family sharing

## Data Model (3 tables)

- **accounts** — id, name, type (bank | mfs | cash | credit), balance, `cards[]` (debit cards linked to bank/mfs accounts; for credit accounts, negative balance = dues)
- **transactions** — id, accountId, `parentId` (nullable → enables grouping), amount, type (income | expense | withdrawal), category, note, date
- **recurring_items** — id, name, amount, type (bill | income), dayOfMonth

Invariant: sum of children ≤ parent amount; remainder = parent − Σ(children).

## Phases

### Phase 1 — MVP (build this first)

- Accounts CRUD (bank, bKash/Nagad, cash-in-hand)
- Record withdrawal → parent entry with purpose label
- Tap parent → add child transactions anytime; remainder auto-calculated
- Quick entry: amount + one-tap category, under 5 seconds
- Transaction list grouped by parent, monthly overview

### Phase 2 — Budgeting

- Recurring bills & salary (recurring_items)
- "After all bills, ৳X left this month" projection
- Simple monthly category budgets

### Phase 3 — Sync & friction reduction

- Supabase sync via server actions (multi-device, family sharing)
- Reports/charts
- Optional companion Android app to forward bank SMS to the API

## UX Principles

- Entry speed is everything — no receipts exist, so logging must beat forgetting
- Lazy allocation is a feature, not a bug — partial accounting is fine
- Remainder always visible, never guilt-tripping
- Offline-first: every Phase 1/2 feature must work with zero connectivity
- Default currency: BDT (৳)

## Forms

- Every form follows the shadcn React Hook Form pattern
  (https://ui.shadcn.com/docs/forms/react-hook-form): `useForm` +
  `zodResolver`, `<Controller>` per field, shadcn `<Field>` /
  `<FieldLabel>` / `<FieldError>` with `data-invalid` on Field and
  `aria-invalid` on the control.
- Form values stay as strings in the schema (inputs are text); convert to
  numbers in `onSubmit`. Cross-field/repo errors go to
  `form.setError("root", …)` and render via `<FieldError>`.
- ৳-prefixed amount inputs use `<InputGroup>` + `<InputGroupAddon>`.
- Chip pickers (account type, category, paying-from) are wired through
  `<Controller>` when they're part of the form's submitted values.
- Use `useWatch` instead of `form.watch()` — the React Compiler lint rejects
  `watch`.

## Icon Component Usage

- Never import from `lucide-react` directly in app code. Use the semantic
  `Icon` component (`components/Icon.tsx`): `<Icon name="delete" />`.
- Icons are registered by semantic name (what they mean, e.g. `add`, `back`,
  `delete`), not by their Lucide name, so the concrete glyph can be swapped
  app-wide from that one file. Add new icons to the `ICONS` registry there.
- Brand/social icons (Facebook, X, WhatsApp, …) must come from the
  `simple-icons` package — Lucide removed brand icons. Wrap them in a small
  SVG component inside `components/Icon.tsx` and register them under a
  semantic name like any other icon.
