@AGENTS.md

# Cash-First Money Manager (hisaberkhata)

A local-first, offline-first PWA for cash-heavy money management (Bangladesh, BDT ৳).
Core model: a withdrawal is a _parent transaction_; purchases from that cash are
_child transactions_ attached lazily. Invariant: Σ(children) ≤ parent; remainder =
parent − Σ(children). Dexie (IndexedDB) is the source of truth; Zustand is UI state
only. Full concept, data model, phases, and UX principles: `docs/project-plan.md`.

## Docs — keep in sync

- `docs/business-logic.md` is the rulebook: balance semantics, invariants,
  derived numbers. **Any change to business rules (transaction types, balance
  effects, fees, invariants, dashboard/budget math) MUST update this doc in
  the same change.** Keep it very concise — rules, not prose.

## Code Style

- **Always use shadcn/ui** for any UI primitive (dialog, dropdown, tooltip, popover,
  sheet, drawer, etc.). Do NOT hand-roll modals/overlays or pull in another UI library.
  - Configured via `components.json` (style `radix-nova`, components in `components/ui/`).
  - Add new components with the CLI: `npx shadcn@latest add <component>` (yarn 1.x has
    no `dlx`, so use `npx`).
  - ⚠️ The CLI may overwrite existing components it considers dependencies. Review
    `git diff` after running and revert unintended changes.
- **Always use arrow functions** — components and regular functions alike:
  `const MyComponent = () => { ... }`, exported separately
  (`export default MyComponent`).
- **No magic strings** — use constants or object properties instead of hardcoded
  strings (categories, account types, route paths, Dexie table names).
- **Smallest client island, largest server shell**: `page.tsx` stays a server
  component; extract only the parts that need the client (hooks, `useLiveQuery`,
  event handlers) into `_component/` files with `"use client"`. Don't wrap a whole
  page in one client component when a static shell (headings, layout) can stay on
  the server. Exception: genuinely end-to-end interactive pages.
- **Semantic Tailwind colors only**: use theme classes (`bg-background`, `bg-muted`,
  `bg-accent`, `text-foreground`, `text-muted-foreground`, `border-border`) — never
  hardcoded shades like `text-white` or `border-gray-800`.
- **Gradients (Tailwind v4)**: use `bg-linear-to-*`, NOT the legacy
  `bg-gradient-to-*` (all directions: `-t`, `-b`, `-l`, `-r`, `-tr`, `-tl`, `-br`, `-bl`).
- **Icons inside buttons**: don't add `mr-2` — the shadcn Button already has `gap-2`.
- **Route verb consistency**: route segments for new-resource pages always use
  `create` (✅ `/accounts/create` ❌ `/accounts/add`). UI labels may say "Add" or
  "Create", URLs never mix them.

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

## Package Management

- **Always use yarn** (`yarn add`, `yarn dev`, `yarn lint`), never npm. If a
  `package-lock.json` ever appears, delete it.
- Verify changes with `yarn lint` and `yarn build` (TypeScript + React Compiler
  lint are strict here).
