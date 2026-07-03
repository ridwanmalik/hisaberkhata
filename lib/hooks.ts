"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { monthRange } from "./format";
import type { Transaction } from "./types";

export interface Container {
  txn: Transaction;
  spent: number;
  remainder: number;
  children: Transaction[];
}

export const useAccounts = () =>
  useLiveQuery(
    async () => (await db.accounts.toArray()).sort((a, b) => a.createdAt - b.createdAt),
    [],
  );

const toContainer = async (txn: Transaction): Promise<Container> => {
  const children = await db.transactions
    .where("parentId")
    .equals(txn.id)
    .toArray();
  children.sort((a, b) => b.date - a.date);
  const spent = children.reduce((sum, t) => sum + t.amount, 0);
  return { txn, spent, remainder: txn.amount - spent, children };
};

/** All withdrawal containers, newest first. */
export const useContainers = () =>
  useLiveQuery(async () => {
    const withdrawals = await db.transactions
      .where("type")
      .equals("withdrawal")
      .toArray();
    withdrawals.sort((a, b) => b.date - a.date);
    return Promise.all(withdrawals.map(toContainer));
  }, []);

export const useContainer = (id: string | null) =>
  useLiveQuery(async () => {
    if (!id) return null;
    const txn = await db.transactions.get(id);
    if (!txn || txn.type !== "withdrawal") return null;
    return toContainer(txn);
  }, [id]);

export interface MonthData {
  transactions: Transaction[];
  income: number;
  /** All expense transactions — standalone and container children. */
  spent: number;
  withdrawn: number;
  spentByCategory: Record<string, number>;
}

export const useMonthData = (year: number, month: number) =>
  useLiveQuery(async (): Promise<MonthData> => {
    const [start, end] = monthRange(year, month);
    const transactions = await db.transactions
      .where("date")
      .between(start, end)
      .toArray();
    transactions.sort((a, b) => b.date - a.date);
    let income = 0;
    let spent = 0;
    let withdrawn = 0;
    const spentByCategory: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type === "income") income += t.amount;
      if (t.type === "withdrawal") withdrawn += t.amount;
      if (t.type === "expense") {
        spent += t.amount;
        spentByCategory[t.category] =
          (spentByCategory[t.category] ?? 0) + t.amount;
      }
    }
    return { transactions, income, spent, withdrawn, spentByCategory };
  }, [year, month]);

export const useRecurringItems = () =>
  useLiveQuery(
    async () =>
      (await db.recurring_items.toArray()).sort(
        (a, b) => a.dayOfMonth - b.dayOfMonth,
      ),
    [],
  );

export const useBudgets = () => useLiveQuery(() => db.budgets.toArray(), []);
