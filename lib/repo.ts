import { db } from "./db";
import { newId } from "./id";
import {
  holdsCash,
  isContainerType,
  OPENING_BALANCE_LABEL,
  type Account,
  type AccountType,
  type RecurringItem,
  type RecurringType,
  type Transaction,
} from "./types";

// ---------------------------------------------------------------------------
// Balance semantics
//
// - income:                +amount on the account
// - expense (no parent):   -amount on the account
// - withdrawal (parent):   -(amount + fee) on the account; the cash lives in
//                          the container from then on, the fee is spending
// - borrow (parent):       no balance effect — the cash came from someone
//                          else's pocket straight into the container. The
//                          debt owed is tracked separately via repayments.
// - repayment:             -amount on the account it was paid from; reduces
//                          the borrow's outstanding debt, never its cash
// - transfer:              -(amount + fee) on the source account, +amount on
//                          the destination. Only the fee is real spending.
// - adjustment:            +amount (SIGNED — the one type where amount can be
//                          negative). Opening balances and manual balance
//                          edits; never income or spending.
//
// Invariant: account.balance always equals the sum of its entries' effects —
// opening balances and balance edits are entries too, never silent writes.
// - expense (child):       no balance effect — the money already left the
//                          account (or the lender's pocket) when the container
//                          was created. Children only reduce the remainder.
//
// Invariants: sum(children) <= parent.amount
//             sum(repayments) <= borrow.amount
// ---------------------------------------------------------------------------

export const childrenSum = async (parentId: string): Promise<number> => {
  const children = await db.transactions
    .where("parentId")
    .equals(parentId)
    .toArray();
  return children.reduce((sum, t) => sum + t.amount, 0);
};

export const remainderOf = async (parent: Transaction): Promise<number> =>
  parent.amount - (await childrenSum(parent.id));

export const repaidSum = async (borrowId: string): Promise<number> => {
  const repayments = await db.transactions
    .where("borrowId")
    .equals(borrowId)
    .toArray();
  return repayments.reduce((sum, t) => sum + t.amount, 0);
};

// -- Accounts ---------------------------------------------------------------

interface AdjustmentInput {
  accountId: string;
  /** Signed: positive raises the balance, negative lowers it. */
  amount: number;
  /** Display label, e.g. "Opening balance". */
  label: string;
  note?: string;
  date?: number;
}

/** Records a signed balance adjustment entry and applies it to the account. */
export const addAdjustment = async (input: AdjustmentInput): Promise<string> => {
  if (!Number.isFinite(input.amount) || input.amount === 0) {
    throw new Error("Adjustment cannot be zero");
  }
  const id = newId();
  await db.transaction("rw", [db.accounts, db.transactions], async () => {
    const account = await db.accounts.get(input.accountId);
    if (!account) throw new Error("Account not found");
    await db.transactions.add({
      id,
      accountId: input.accountId,
      parentId: null,
      amount: input.amount,
      type: "adjustment",
      category: input.label,
      note: input.note ?? "",
      date: input.date ?? Date.now(),
    });
    await db.accounts.update(account.id, {
      balance: account.balance + input.amount,
    });
  });
  return id;
};

export const addAccount = async (
  name: string,
  type: AccountType,
  balance: number,
  extras?: Pick<Account, "last4" | "creditLimit">,
): Promise<string> => {
  const id = newId();
  await db.transaction("rw", [db.accounts, db.transactions], async () => {
    const createdAt = Date.now();
    // Balance starts at 0 — the opening balance arrives as an entry, so the
    // account's history explains every taka from day one.
    await db.accounts.add({ id, name, type, balance: 0, createdAt, ...extras });
    if (balance !== 0) {
      await addAdjustment({
        accountId: id,
        amount: balance,
        label: OPENING_BALANCE_LABEL,
        date: createdAt,
      });
    }
  });
  return id;
};

export const updateAccount = async (
  id: string,
  patch: Partial<
    Pick<Account, "name" | "type" | "balance" | "last4" | "creditLimit">
  >,
): Promise<void> => {
  await db.transaction("rw", [db.accounts, db.transactions], async () => {
    const account = await db.accounts.get(id);
    if (!account) throw new Error("Account not found");
    const { balance, ...rest } = patch;
    await db.accounts.update(id, rest);
    // Balance edits leave a paper trail instead of silently overwriting.
    if (balance !== undefined && balance !== account.balance) {
      await addAdjustment({
        accountId: id,
        amount: balance - account.balance,
        label: "Balance adjusted",
      });
    }
  });
};

export const addLinkedCard = async (
  accountId: string,
  label: string,
  last4?: string,
): Promise<void> => {
  await db.transaction("rw", [db.accounts], async () => {
    const account = await db.accounts.get(accountId);
    if (!account) throw new Error("Account not found");
    const cards = [...(account.cards ?? []), { id: newId(), label, last4 }];
    await db.accounts.update(accountId, { cards });
  });
};

export const removeLinkedCard = async (
  accountId: string,
  cardId: string,
): Promise<void> => {
  await db.transaction("rw", [db.accounts], async () => {
    const account = await db.accounts.get(accountId);
    if (!account) return;
    await db.accounts.update(accountId, {
      cards: (account.cards ?? []).filter((c) => c.id !== cardId),
    });
  });
};

/** Deletes the account and every transaction recorded against it. */
export const deleteAccount = async (id: string): Promise<void> => {
  await db.transaction("rw", [db.accounts, db.transactions], async () => {
    await db.transactions.where("accountId").equals(id).delete();
    // Transfers into this account too — other balances stay as they are.
    await db.transactions.where("toAccountId").equals(id).delete();
    await db.accounts.delete(id);
  });
};

// -- Transactions -----------------------------------------------------------

interface EntryInput {
  accountId: string;
  amount: number;
  category: string;
  note?: string;
  date?: number;
}

const assertPositive = (amount: number) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be greater than zero");
  }
};

export const addIncome = async (input: EntryInput): Promise<string> => {
  assertPositive(input.amount);
  const id = newId();
  await db.transaction("rw", [db.accounts, db.transactions], async () => {
    const account = await db.accounts.get(input.accountId);
    if (!account) throw new Error("Account not found");
    await db.transactions.add({
      id,
      accountId: input.accountId,
      parentId: null,
      amount: input.amount,
      type: "income",
      category: input.category,
      note: input.note ?? "",
      date: input.date ?? Date.now(),
    });
    await db.accounts.update(account.id, {
      balance: account.balance + input.amount,
    });
  });
  return id;
};

export const addExpense = async (input: EntryInput): Promise<string> => {
  assertPositive(input.amount);
  const id = newId();
  await db.transaction("rw", [db.accounts, db.transactions], async () => {
    const account = await db.accounts.get(input.accountId);
    if (!account) throw new Error("Account not found");
    await db.transactions.add({
      id,
      accountId: input.accountId,
      parentId: null,
      amount: input.amount,
      type: "expense",
      category: input.category,
      note: input.note ?? "",
      date: input.date ?? Date.now(),
    });
    await db.accounts.update(account.id, {
      balance: account.balance - input.amount,
    });
  });
  return id;
};

/** Records a cash-out as a parent container. `category` is the purpose label. */
export const addWithdrawal = async (
  input: EntryInput & { fee?: number },
): Promise<string> => {
  assertPositive(input.amount);
  const fee = input.fee ?? 0;
  if (!Number.isFinite(fee) || fee < 0) {
    throw new Error("Fee cannot be negative");
  }
  const id = newId();
  await db.transaction("rw", [db.accounts, db.transactions], async () => {
    const account = await db.accounts.get(input.accountId);
    if (!account) throw new Error("Account not found");
    await db.transactions.add({
      id,
      accountId: input.accountId,
      parentId: null,
      amount: input.amount,
      type: "withdrawal",
      category: input.category,
      note: input.note ?? "",
      date: input.date ?? Date.now(),
      ...(fee > 0 ? { fee } : {}),
    });
    await db.accounts.update(account.id, {
      balance: account.balance - input.amount - fee,
    });
  });
  return id;
};

interface BorrowInput {
  /** Who lent the money. */
  person: string;
  amount: number;
  /** Purpose label, like a withdrawal's. */
  category: string;
  /** Account the money landed in; omit when it arrived as cash in hand. */
  accountId?: string;
  note?: string;
  date?: number;
}

/**
 * Records money borrowed from a person. Cash in hand (no accountId) becomes
 * a parent container with child spends; money that landed in an account
 * (e.g. bKash-to-bKash) credits that account instead — no container, the
 * account holds it. Either way the debt stays outstanding until repayments
 * add up to the amount.
 */
export const addBorrow = async (input: BorrowInput): Promise<string> => {
  assertPositive(input.amount);
  if (!input.person.trim()) throw new Error("Say who lent the money");
  const id = newId();
  await db.transaction("rw", [db.accounts, db.transactions], async () => {
    let accountId = "";
    if (input.accountId) {
      const account = await db.accounts.get(input.accountId);
      if (!account) throw new Error("Account not found");
      accountId = account.id;
      await db.accounts.update(account.id, {
        balance: account.balance + input.amount,
      });
    }
    await db.transactions.add({
      id,
      accountId,
      parentId: null,
      amount: input.amount,
      type: "borrow",
      category: input.category,
      note: input.note ?? "",
      date: input.date ?? Date.now(),
      person: input.person.trim(),
    });
  });
  return id;
};

interface RepaymentInput {
  borrowId: string;
  amount: number;
  /** Pay from an account… */
  accountId?: string;
  /** …or hand over cash from a container (no balance effect — the cash
   *  already left an account; it just reduces the container's remainder). */
  fromContainerId?: string;
  note?: string;
  date?: number;
}

/** Pays back part (or all) of a borrow from an account or from cash in hand. */
export const addRepayment = async (input: RepaymentInput): Promise<string> => {
  assertPositive(input.amount);
  const id = newId();
  await db.transaction("rw", [db.accounts, db.transactions], async () => {
    const borrow = await db.transactions.get(input.borrowId);
    if (!borrow || borrow.type !== "borrow") {
      throw new Error("Borrow entry not found");
    }
    const repaid = await repaidSum(borrow.id);
    if (repaid + input.amount > borrow.amount) {
      throw new Error("That's more than what is still owed");
    }
    const common = {
      id,
      amount: input.amount,
      type: "repayment" as const,
      category: "repayment",
      note: input.note ?? "",
      date: input.date ?? Date.now(),
      person: borrow.person,
      borrowId: borrow.id,
    };
    if (input.fromContainerId) {
      const parent = await db.transactions.get(input.fromContainerId);
      if (!parent || !isContainerType(parent.type) || !holdsCash(parent)) {
        throw new Error("Cash entry not found");
      }
      const spent = await childrenSum(parent.id);
      if (spent + input.amount > parent.amount) {
        throw new Error("Amount is more than what is left of this cash");
      }
      await db.transactions.add({
        ...common,
        accountId: parent.accountId,
        parentId: parent.id,
      });
    } else {
      if (!input.accountId) throw new Error("Pick where the money comes from");
      const account = await db.accounts.get(input.accountId);
      if (!account) throw new Error("Account not found");
      await db.transactions.add({
        ...common,
        accountId: input.accountId,
        parentId: null,
      });
      await db.accounts.update(account.id, {
        balance: account.balance - input.amount,
      });
    }
  });
  return id;
};

interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  /** Fee charged on top of the amount, paid by the source account. */
  fee?: number;
  note?: string;
  date?: number;
}

/**
 * Moves money between two accounts. Neither income nor expense — only the
 * optional fee counts as spending. Paying a credit card bill is a transfer
 * into the credit account (dues shrink).
 */
export const addTransfer = async (input: TransferInput): Promise<string> => {
  assertPositive(input.amount);
  const fee = input.fee ?? 0;
  if (!Number.isFinite(fee) || fee < 0) {
    throw new Error("Fee cannot be negative");
  }
  if (input.fromAccountId === input.toAccountId) {
    throw new Error("Pick two different accounts");
  }
  const id = newId();
  await db.transaction("rw", [db.accounts, db.transactions], async () => {
    const from = await db.accounts.get(input.fromAccountId);
    const to = await db.accounts.get(input.toAccountId);
    if (!from || !to) throw new Error("Account not found");
    await db.transactions.add({
      id,
      accountId: from.id,
      parentId: null,
      amount: input.amount,
      type: "transfer",
      // Denormalized label so rows render without account lookups.
      category: `${from.name} → ${to.name}`,
      note: input.note ?? "",
      date: input.date ?? Date.now(),
      toAccountId: to.id,
      ...(fee > 0 ? { fee } : {}),
    });
    await db.accounts.update(from.id, {
      balance: from.balance - input.amount - fee,
    });
    await db.accounts.update(to.id, { balance: to.balance + input.amount });
  });
  return id;
};

/** Attaches a spend to a cash container. Never touches account balances. */
export const addChildExpense = async (
  parentId: string,
  input: Omit<EntryInput, "accountId">,
): Promise<string> => {
  assertPositive(input.amount);
  const id = newId();
  await db.transaction("rw", [db.transactions], async () => {
    const parent = await db.transactions.get(parentId);
    if (!parent || !isContainerType(parent.type) || !holdsCash(parent)) {
      throw new Error("Cash entry not found");
    }
    const spent = await childrenSum(parentId);
    if (spent + input.amount > parent.amount) {
      throw new Error("Amount is more than what is left of this cash");
    }
    await db.transactions.add({
      id,
      accountId: parent.accountId,
      parentId,
      amount: input.amount,
      type: "expense",
      category: input.category,
      note: input.note ?? "",
      date: input.date ?? Date.now(),
    });
  });
  return id;
};

/**
 * Edits amount/category/note/date of any transaction, keeping account
 * balances and the container invariant consistent.
 */
export const updateTransaction = async (
  id: string,
  patch: Partial<
    Pick<Transaction, "amount" | "category" | "note" | "date" | "person" | "fee">
  >,
): Promise<void> => {
  await db.transaction("rw", [db.accounts, db.transactions], async () => {
    const txn = await db.transactions.get(id);
    if (!txn) throw new Error("Transaction not found");
    // Fee exists on transfers/withdrawals — a change moves the source balance.
    if (
      patch.fee !== undefined &&
      (txn.type === "transfer" || txn.type === "withdrawal")
    ) {
      const nextFee = patch.fee;
      if (!Number.isFinite(nextFee) || nextFee < 0) {
        throw new Error("Fee cannot be negative");
      }
      const feeDelta = nextFee - (txn.fee ?? 0);
      if (feeDelta !== 0) {
        const source = await db.accounts.get(txn.accountId);
        if (source) {
          await db.accounts.update(source.id, {
            balance: source.balance - feeDelta,
          });
        }
      }
    }
    // Renaming a borrow's lender updates the display copy on its repayments.
    if (patch.person !== undefined && txn.type === "borrow") {
      await db.transactions
        .where("borrowId")
        .equals(txn.id)
        .modify({ person: patch.person });
    }
    const nextAmount = patch.amount ?? txn.amount;
    if (patch.amount !== undefined) {
      if (txn.type === "adjustment") {
        if (!Number.isFinite(nextAmount) || nextAmount === 0) {
          throw new Error("Adjustment cannot be zero");
        }
      } else {
        assertPositive(nextAmount);
      }
      const delta = nextAmount - txn.amount;
      // Repayments (standalone or paid from a cash container) can never
      // exceed what is still owed on their borrow.
      if (txn.type === "repayment" && txn.borrowId) {
        const borrow = await db.transactions.get(txn.borrowId);
        if (borrow) {
          const repaid = await repaidSum(borrow.id);
          if (repaid + delta > borrow.amount) {
            throw new Error("That's more than what is still owed");
          }
        }
      }
      if (txn.parentId) {
        const parent = await db.transactions.get(txn.parentId);
        if (parent) {
          const spent = await childrenSum(parent.id);
          if (spent + delta > parent.amount) {
            throw new Error(
              "Amount is more than what is left in this withdrawal",
            );
          }
        }
      } else {
        if (isContainerType(txn.type)) {
          const spent = await childrenSum(txn.id);
          if (nextAmount < spent) {
            throw new Error(
              "Cannot be smaller than what was already spent from it",
            );
          }
        }
        if (txn.type === "borrow") {
          const repaid = await repaidSum(txn.id);
          if (nextAmount < repaid) {
            throw new Error(
              "Cannot be smaller than what was already repaid on it",
            );
          }
        }
        // Cash borrows have accountId "" — the lookup misses and no balance
        // moves. Borrows that landed in an account move it like income.
        const account = await db.accounts.get(txn.accountId);
        if (account) {
          const sign =
            txn.type === "income" ||
            txn.type === "adjustment" ||
            txn.type === "borrow"
              ? 1
              : -1;
          await db.accounts.update(account.id, {
            balance: account.balance + sign * delta,
          });
        }
        if (txn.type === "transfer" && txn.toAccountId) {
          const dest = await db.accounts.get(txn.toAccountId);
          if (dest) {
            await db.accounts.update(dest.id, {
              balance: dest.balance + delta,
            });
          }
        }
      }
    }
    await db.transactions.update(id, patch);
  });
};

/**
 * Deletes a transaction, reversing its balance effect. Deleting a container
 * also deletes its children (they never affected any balance). Deleting a
 * borrow also deletes its repayments, returning each to the account it was
 * paid from.
 */
export const deleteTransaction = async (id: string): Promise<void> => {
  await db.transaction("rw", [db.accounts, db.transactions], async () => {
    const txn = await db.transactions.get(id);
    if (!txn) return;
    if (isContainerType(txn.type)) {
      await db.transactions.where("parentId").equals(id).delete();
    }
    if (txn.type === "borrow") {
      const repayments = await db.transactions
        .where("borrowId")
        .equals(id)
        .toArray();
      for (const r of repayments) {
        // Cash-container repayments never touched a balance — deleting them
        // just returns the cash to their container's remainder.
        if (r.parentId) continue;
        const account = await db.accounts.get(r.accountId);
        if (account) {
          await db.accounts.update(account.id, {
            balance: account.balance + r.amount,
          });
        }
      }
      await db.transactions.where("borrowId").equals(id).delete();
    }
    if (!txn.parentId) {
      const account = await db.accounts.get(txn.accountId);
      if (account) {
        const sign =
          txn.type === "income" ||
          txn.type === "adjustment" ||
          txn.type === "borrow"
            ? -1
            : 1;
        const reversal =
          txn.type === "transfer" || txn.type === "withdrawal"
            ? txn.amount + (txn.fee ?? 0)
            : sign * txn.amount;
        await db.accounts.update(account.id, {
          balance: account.balance + reversal,
        });
      }
      if (txn.type === "transfer" && txn.toAccountId) {
        const dest = await db.accounts.get(txn.toAccountId);
        if (dest) {
          await db.accounts.update(dest.id, {
            balance: dest.balance - txn.amount,
          });
        }
      }
    }
    await db.transactions.delete(id);
  });
};

// -- Recurring items (Phase 2) ----------------------------------------------

export const addRecurringItem = async (
  name: string,
  amount: number,
  type: RecurringType,
  dayOfMonth: number,
): Promise<string> => {
  assertPositive(amount);
  const id = newId();
  await db.recurring_items.add({ id, name, amount, type, dayOfMonth });
  return id;
};

export const updateRecurringItem = async (
  id: string,
  patch: Partial<Omit<RecurringItem, "id">>,
): Promise<void> => {
  await db.recurring_items.update(id, patch);
};

export const deleteRecurringItem = async (id: string): Promise<void> => {
  await db.recurring_items.delete(id);
};

// -- Category budgets (Phase 2) ---------------------------------------------

export const setBudget = async (
  category: string,
  amount: number,
): Promise<void> => {
  const existing = await db.budgets.where("category").equals(category).first();
  if (amount <= 0) {
    if (existing) await db.budgets.delete(existing.id);
    return;
  }
  if (existing) {
    await db.budgets.update(existing.id, { amount });
  } else {
    await db.budgets.add({ id: newId(), category, amount });
  }
};
