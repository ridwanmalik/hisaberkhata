import { db } from "./db";
import type {
  Account,
  AccountType,
  RecurringItem,
  RecurringType,
  Transaction,
} from "./types";

/**
 * crypto.randomUUID() only exists in secure contexts (HTTPS/localhost), so
 * opening the dev server via LAN IP (http://192.168.x.x) on a phone would
 * break every save. Fall back to building a v4 UUID from getRandomValues,
 * which works everywhere.
 */
const newId = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// ---------------------------------------------------------------------------
// Balance semantics
//
// - income:                +amount on the account
// - expense (no parent):   -amount on the account
// - withdrawal (parent):   -amount on the account; the cash lives in the
//                          container from then on
// - expense (child):       no balance effect — the money already left the
//                          account when the withdrawal happened. Children only
//                          reduce the container's remainder.
//
// Invariant: sum(children) <= parent.amount.
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

// -- Accounts ---------------------------------------------------------------

export const addAccount = async (
  name: string,
  type: AccountType,
  balance: number,
  extras?: Pick<Account, "last4" | "creditLimit">,
): Promise<string> => {
  const id = newId();
  await db.accounts.add({
    id,
    name,
    type,
    balance,
    createdAt: Date.now(),
    ...extras,
  });
  return id;
};

export const updateAccount = async (
  id: string,
  patch: Partial<
    Pick<Account, "name" | "type" | "balance" | "last4" | "creditLimit">
  >,
): Promise<void> => {
  await db.accounts.update(id, patch);
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
export const addWithdrawal = async (input: EntryInput): Promise<string> => {
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
      type: "withdrawal",
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

/** Attaches a spend to a withdrawal container. Never touches account balances. */
export const addChildExpense = async (
  parentId: string,
  input: Omit<EntryInput, "accountId">,
): Promise<string> => {
  assertPositive(input.amount);
  const id = newId();
  await db.transaction("rw", [db.transactions], async () => {
    const parent = await db.transactions.get(parentId);
    if (!parent || parent.type !== "withdrawal") {
      throw new Error("Withdrawal not found");
    }
    const spent = await childrenSum(parentId);
    if (spent + input.amount > parent.amount) {
      throw new Error("Amount is more than what is left in this withdrawal");
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
  patch: Partial<Pick<Transaction, "amount" | "category" | "note" | "date">>,
): Promise<void> => {
  await db.transaction("rw", [db.accounts, db.transactions], async () => {
    const txn = await db.transactions.get(id);
    if (!txn) throw new Error("Transaction not found");
    const nextAmount = patch.amount ?? txn.amount;
    if (patch.amount !== undefined) {
      assertPositive(nextAmount);
      const delta = nextAmount - txn.amount;
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
        if (txn.type === "withdrawal") {
          const spent = await childrenSum(txn.id);
          if (nextAmount < spent) {
            throw new Error(
              "Withdrawal cannot be smaller than what was already spent from it",
            );
          }
        }
        const account = await db.accounts.get(txn.accountId);
        if (account) {
          const sign = txn.type === "income" ? 1 : -1;
          await db.accounts.update(account.id, {
            balance: account.balance + sign * delta,
          });
        }
      }
    }
    await db.transactions.update(id, patch);
  });
};

/**
 * Deletes a transaction, reversing its balance effect. Deleting a withdrawal
 * also deletes its children (they never affected any balance).
 */
export const deleteTransaction = async (id: string): Promise<void> => {
  await db.transaction("rw", [db.accounts, db.transactions], async () => {
    const txn = await db.transactions.get(id);
    if (!txn) return;
    if (txn.type === "withdrawal") {
      await db.transactions.where("parentId").equals(id).delete();
    }
    if (!txn.parentId) {
      const account = await db.accounts.get(txn.accountId);
      if (account) {
        const sign = txn.type === "income" ? -1 : 1;
        await db.accounts.update(account.id, {
          balance: account.balance + sign * txn.amount,
        });
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
