# Hisaber Khata — হিসাবের খাতা

A local-first PWA for managing day-to-day money in a cash-heavy economy (Bangladesh, BDT).
Instead of tracking every transaction independently, it mirrors how cash actually flows:
**withdraw money → spend it gradually → account for it lazily.**

## The withdrawal-as-container model

An ATM/bKash cash-out becomes a _parent transaction_. Purchases made from that cash are
attached as _child transactions_ — added lazily, over days. The unallocated remainder is
always visible ("৳1,500 left from Jul 2 withdrawal"). No forced categorization, no separate
cash account drifting out of sync.

Balance semantics:

- **income** adds to the account, **expense** subtracts from it
- **withdrawal** subtracts from the account — the cash lives in the container from then on
- **child expenses** never touch account balances; they only reduce the container's remainder
- invariant: `sum(children) ≤ parent.amount`

## Features

- Accounts CRUD (bank, bKash/Nagad, cash-in-hand)
- Quick entry: amount + one-tap category — tapping a category chip saves immediately
- Withdrawal containers with always-visible remainders and progress
- Transaction history grouped by parent, with monthly navigation
- Recurring bills & salary with an "after all bills, ৳X left" projection
- Simple monthly category budgets
- Installable PWA, fully offline — the app shell is precached on first visit

## Tech stack

- **Next.js 16 (App Router) + TypeScript** — client-heavy, no server data layer
- **Dexie.js (IndexedDB)** — local-first storage, `useLiveQuery` for reactive UI
- **Zustand** — UI-only state (quick-entry sheet, month filter)
- **Serwist** (`@serwist/turbopack`) — service worker, works with Turbopack builds
- **Tailwind CSS 4 + shadcn/ui** — Radix-based components (Drawer, Tabs, AlertDialog, …) in `components/ui/`, themed emerald via CSS variables in `app/globals.css`

## Development

```bash
yarn dev     # dev server (service worker precaching is dev-disabled)
yarn build   # production build (bundles the service worker)
yarn start   # serve the production build
yarn lint    # eslint
```

The PWA icons in `public/icons/` are generated procedurally — regenerate with:

```bash
node scripts/generate-icons.mjs
```

## Data model

Four Dexie tables: `accounts`, `transactions` (with nullable `parentId` for container
children), `recurring_items`, and `budgets` (monthly category limits). Everything lives
in IndexedDB on the device; there is no backend. Sync (Supabase) is planned for Phase 3 —
see `CLAUDE.md` for the full project plan.
