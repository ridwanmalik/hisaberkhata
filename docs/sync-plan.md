# Auth & Multi-Device Sync Plan (Phase 3)

Local-first stays non-negotiable: Dexie is the source of truth, every write
works offline, and login/sync is an add-on — never a requirement to use the
app.

## Architecture

- **Server: Supabase** (Postgres + Auth, free tier).
- **Auth**: Google sign-in + email OTP. The landing page's placeholder
  Log in / Sign up buttons wire to it.
- **Schema**: mirror the Dexie tables (`accounts`, `transactions`,
  `recurring_items`, `budgets`) plus three sync columns on each:
  - `user_id` — RLS: users only see their own rows
  - `updated_at` — conflict resolution (last write wins)
  - `deleted` — soft-delete tombstones (hard deletes can't sync)
- Later: swap `user_id` for `khata_id` + membership table → family sharing.

## Sync engine

1. Every local write also records the row id in a Dexie **outbox** table.
2. When online: **pull** rows with `updated_at` > last sync, merge, then
   **push** the outbox. Per-row last-write-wins by `updated_at`.
3. **Balances are never synced as truth — they are recomputed.** The
   invariant `balance = Σ(entry effects)` means the client re-derives every
   account balance from merged entries after each sync. Devices can only
   disagree about entries (which merge cleanly: append-mostly, UUID ids),
   never about balances.
4. Settings shows sync status ("Last synced X min ago").

## Steps, in order

1. ✅ **Settings page + JSON backup/restore** — `/dashboard/settings`
   (linked from a gear icon in the home header; the bottom nav is full).
   `lib/backup.ts`: `exportBackup`/`importBackup` round-trip every Dexie
   table as one JSON file (`{ app, schemaVersion, exportedAt, data }`);
   import clears and bulk-restores inside one transaction after a
   destructive-action confirm. `exportTransactionsCsv` is one-way only —
   flattened for spreadsheets, never re-imported (would corrupt parent/
   child, borrow/transfer links, and the balance invariant).
2. Supabase project: Auth + schema + RLS policies.
3. Sync engine (outbox, pull-then-push, balance recompute) + status UI.
4. Family sharing (`khata_id` + RLS membership).

## Explicitly rejected

- Server-only data (kills offline — the core UX).
- CSV import (mangles relationships and the balance invariant).
- Heavy sync frameworks (PowerSync/Replicache/ElectricSQL) — the balance
  recompute trick removes the hard conflicts they exist to solve; the data
  model is small.
