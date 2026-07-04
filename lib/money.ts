import type { Container } from "./hooks";
import type { Account, Transaction } from "./types";

/**
 * Signed effect of a transaction on one account's balance. Children are 0
 * (they never touch balances); incoming transfers count via `toAccountId`.
 */
export const accountEffect = (t: Transaction, accountId: string): number => {
  let effect = 0;
  if (!t.parentId && t.accountId === accountId) {
    if (t.type === "income") effect += t.amount;
    else if (t.type === "adjustment") effect += t.amount; // signed
    else if (t.type === "expense" || t.type === "repayment")
      effect -= t.amount;
    else if (t.type === "withdrawal" || t.type === "transfer")
      effect -= t.amount + (t.fee ?? 0);
  }
  if (t.type === "transfer" && t.toAccountId === accountId) effect += t.amount;
  return effect;
};

export interface MoneySummary {
  /** Money in accounts, counting credit only when positive. */
  accountsTotal: number;
  /** Unspent cash sitting in containers. */
  cashInHand: number;
  /** Money that actually exists: accountsTotal + cashInHand. */
  have: number;
  creditDues: number;
  borrowedOwed: number;
  /** creditDues + borrowedOwed — shown quietly, never subtracted from have. */
  owe: number;
}

/**
 * The one place the "you have / you owe" split is computed. Credit dues and
 * borrowed debt never drag `have` down — they only show up in `owe`.
 */
export const summarizeMoney = (
  accounts: Account[] | undefined,
  containers: Container[] | undefined,
): MoneySummary => {
  let accountsTotal = 0;
  let creditDues = 0;
  for (const a of accounts ?? []) {
    if (a.type === "credit") {
      accountsTotal += Math.max(0, a.balance);
      creditDues += Math.max(0, -a.balance);
    } else {
      accountsTotal += a.balance;
    }
  }
  let cashInHand = 0;
  let borrowedOwed = 0;
  for (const c of containers ?? []) {
    cashInHand += c.remainder;
    borrowedOwed += c.owed;
  }
  return {
    accountsTotal,
    cashInHand,
    have: accountsTotal + cashInHand,
    creditDues,
    borrowedOwed,
    owe: creditDues + borrowedOwed,
  };
};
