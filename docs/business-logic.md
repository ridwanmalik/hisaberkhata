# Business Logic

The rules of the system, concisely. Source of truth: `lib/repo.ts` (balance
effects), `lib/hooks.ts` (derived numbers), `lib/types.ts` (shapes).

## Accounts

- Types: `bank`, `mfs` (mobile wallet), `cash`, `credit`.
- Credit: **negative balance = dues**; `creditLimit` optional.
- Debit cards (`cards[]`) attach to bank/mfs accounts only — display-only,
  never a money source.
- Deleting an account deletes every transaction recorded on it.

## Transactions & balance effects

| Type                  | Account balance effect                       |
| --------------------- | -------------------------------------------- |
| `income`              | +amount                                      |
| `expense` (no parent) | −amount                                      |
| `withdrawal` (parent) | −amount — the cash now lives in the container |
| `borrow` (parent)     | none — cash came from the lender's pocket (`accountId: ""`) |
| `repayment`           | −amount on the account it was paid from      |
| `expense` (child)     | none — only reduces the container remainder  |

- Amounts are always positive; direction comes from `type`.
- Editing an amount applies the delta to the account; deleting reverses the
  full effect. Deleting a container deletes its children; deleting a borrow
  also deletes its repayments, refunding each to its account.

## Containers (the core model)

- `withdrawal` and `borrow` are **parent containers** of spendable cash.
- Child expenses attach via `parentId`, lazily, over days.
- `remainder = parent.amount − Σ(children)` — always visible.
- **Invariant: Σ(children) ≤ parent.amount.** A parent can't shrink below
  what was already spent from it.

## Borrows & debt

- A borrow tracks two independent lifecycles:
  1. **Cash**: spend it via children, like a withdrawal.
  2. **Debt**: `owed = amount − Σ(repayments)`; settled at 0.
- **Invariant: Σ(repayments) ≤ borrow.amount.** A borrow can't shrink below
  what was already repaid.
- Repayments reference the borrow via `borrowId` and copy `person` for display.

## Dashboard numbers

- **You have** = Σ non-credit balances + Σ max(0, credit balances)
  + Σ container remainders. Only money that exists.
- **You owe** = Σ credit dues + Σ outstanding borrows. Shown as a quiet
  corner line, never subtracted from the big number.
- Monthly Income/Spent/Cash-out exclude borrows and repayments — those get
  their own "Borrowed X · Repaid Y" line. Debt movement is never income or
  spending.

## Recurring & budgets (Phase 2)

- `recurring_items`: bills/income templates by `dayOfMonth` — projections
  only, they never create transactions themselves.
- Budgets: one monthly limit per category; setting a budget ≤ 0 deletes it.
