import Dexie, { type Table } from "dexie";
import { newId } from "./id";
import {
  OPENING_BALANCE_LABEL,
  type Account,
  type Budget,
  type RecurringItem,
  type Transaction,
} from "./types";

class HisaberKhataDB extends Dexie {
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  recurring_items!: Table<RecurringItem, string>;
  budgets!: Table<Budget, string>;

  constructor() {
    super("hisaberkhata");
    this.version(1).stores({
      accounts: "id, name, type",
      transactions: "id, accountId, parentId, type, date, category",
      recurring_items: "id, type, dayOfMonth",
      budgets: "id, category",
    });
    // v2: borrow/repayment support — repayments look up their borrow by id.
    this.version(2).stores({
      transactions: "id, accountId, parentId, type, date, category, borrowId",
    });
    // v3: transfers — account deletion cleans up transfers into it by index.
    this.version(3).stores({
      transactions:
        "id, accountId, parentId, type, date, category, borrowId, toAccountId",
    });
    // v4: opening balances become adjustment entries. Backfill: whatever part
    // of each account's balance its transactions can't explain becomes an
    // "Opening balance" adjustment dated at account creation, restoring the
    // invariant balance = Σ(entry effects).
    this.version(4).upgrade(async (tx) => {
      const accounts = await tx.table<Account>("accounts").toArray();
      const txns = await tx.table<Transaction>("transactions").toArray();
      for (const a of accounts) {
        let net = 0;
        for (const t of txns) {
          if (!t.parentId && t.accountId === a.id) {
            if (t.type === "income") net += t.amount;
            else if (t.type === "expense" || t.type === "repayment")
              net -= t.amount;
            else if (t.type === "withdrawal" || t.type === "transfer")
              net -= t.amount + (t.fee ?? 0);
          }
          if (t.type === "transfer" && t.toAccountId === a.id) net += t.amount;
        }
        const opening = a.balance - net;
        if (opening !== 0) {
          await tx.table<Transaction>("transactions").add({
            id: newId(),
            accountId: a.id,
            parentId: null,
            amount: opening,
            type: "adjustment",
            category: OPENING_BALANCE_LABEL,
            note: "",
            date: a.createdAt,
          });
        }
      }
    });
  }
}

export const db = new HisaberKhataDB();
