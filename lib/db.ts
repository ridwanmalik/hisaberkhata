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
  }
}

export const db = new HisaberKhataDB();
