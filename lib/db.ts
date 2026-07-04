import Dexie, { type Table } from "dexie";
import type { Account, Budget, RecurringItem, Transaction } from "./types";

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
  }
}

export const db = new HisaberKhataDB();
