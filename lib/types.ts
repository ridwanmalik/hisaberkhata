export type AccountType = "bank" | "mfs" | "cash" | "credit";

export type TransactionType = "income" | "expense" | "withdrawal";

/** A debit card linked to a bank/MFS account. Not a money source itself. */
export interface LinkedCard {
  id: string;
  /** e.g. "VISA Debit", "DBBL Mastercard" */
  label: string;
  /** Last 4 digits, for telling cards apart. */
  last4?: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** For credit cards, negative balance = current dues. */
  balance: number;
  createdAt: number;
  /** Debit cards linked to this account (bank/mfs only). */
  cards?: LinkedCard[];
  /** Last 4 digits of the card (credit accounts only). */
  last4?: string;
  /** Credit limit in BDT (credit accounts only). */
  creditLimit?: number;
}

export interface Transaction {
  id: string;
  accountId: string;
  /** Set on child transactions attached to a withdrawal container. */
  parentId: string | null;
  amount: number;
  type: TransactionType;
  /** For withdrawals this is the purpose label (e.g. "Bazar week 1"). */
  category: string;
  note: string;
  /** Epoch milliseconds. */
  date: number;
}

export type RecurringType = "bill" | "income";

export interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  type: RecurringType;
  dayOfMonth: number;
}

export interface Budget {
  id: string;
  category: string;
  /** Monthly limit in BDT. */
  amount: number;
}
