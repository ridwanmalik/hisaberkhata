"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { monthRange } from "./format";
import { CONTAINER_TYPES, isContainerType, type Transaction } from "./types";

export interface Container {
  txn: Transaction;
  spent: number;
  remainder: number;
  children: Transaction[];
  /** Borrows only — empty for withdrawals. */
  repayments: Transaction[];
  repaid: number;
  /** Borrows only: what is still owed to the person. */
  owed: number;
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
  const repayments =
    txn.type === "borrow"
      ? await db.transactions.where("borrowId").equals(txn.id).toArray()
      : [];
  repayments.sort((a, b) => b.date - a.date);
  const repaid = repayments.reduce((sum, t) => sum + t.amount, 0);
  return {
    txn,
    spent,
    remainder: txn.amount - spent,
    children,
    repayments,
    repaid,
    owed: txn.type === "borrow" ? txn.amount - repaid : 0,
  };
};

/** All cash containers (withdrawals and borrows), newest first. */
export const useContainers = () =>
  useLiveQuery(async () => {
    const parents = await db.transactions
      .where("type")
      .anyOf(...CONTAINER_TYPES)
      .toArray();
    parents.sort((a, b) => b.date - a.date);
    return Promise.all(parents.map(toContainer));
  }, []);

export const useTransaction = (id: string | null) =>
  useLiveQuery(async () => {
    if (!id) return null;
    return (await db.transactions.get(id)) ?? null;
  }, [id]);

export const useContainer = (id: string | null) =>
  useLiveQuery(async () => {
    if (!id) return null;
    const txn = await db.transactions.get(id);
    if (!txn || !isContainerType(txn.type)) return null;
    return toContainer(txn);
  }, [id]);

export interface MonthData {
  transactions: Transaction[];
  income: number;
  /** All expense transactions — standalone and container children. */
  spent: number;
  withdrawn: number;
  /** Neither income nor spending — shown as their own quiet line. */
  borrowed: number;
  repaid: number;
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
    let borrowed = 0;
    let repaid = 0;
    const spentByCategory: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type === "income") income += t.amount;
      if (t.type === "withdrawal") withdrawn += t.amount;
      if (t.type === "borrow") borrowed += t.amount;
      if (t.type === "repayment") repaid += t.amount;
      if (t.type === "expense") {
        spent += t.amount;
        spentByCategory[t.category] =
          (spentByCategory[t.category] ?? 0) + t.amount;
      }
      // Transfers/withdrawals move money, not spend it — only fees are
      // spending.
      if ((t.type === "transfer" || t.type === "withdrawal") && t.fee) {
        spent += t.fee;
        spentByCategory.fees = (spentByCategory.fees ?? 0) + t.fee;
      }
    }
    return {
      transactions,
      income,
      spent,
      withdrawn,
      borrowed,
      repaid,
      spentByCategory,
    };
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
