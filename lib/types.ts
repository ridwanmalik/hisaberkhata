export type AccountType = "bank" | "mfs" | "cash" | "credit";

export type TransactionType =
  | "income"
  | "expense"
  | "withdrawal"
  | "borrow"
  | "repayment"
  | "transfer";

/** Parent types that hold spendable cash and take child expenses. */
export const CONTAINER_TYPES = ["withdrawal", "borrow"] as const;

export const isContainerType = (
  type: TransactionType,
): type is "withdrawal" | "borrow" =>
  (CONTAINER_TYPES as readonly TransactionType[]).includes(type);

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
  /** Empty string on borrows — the cash never touched one of our accounts. */
  accountId: string;
  /** Set on child transactions attached to a cash container. */
  parentId: string | null;
  amount: number;
  type: TransactionType;
  /** For containers this is the purpose label (e.g. "Bazar week 1"). */
  category: string;
  note: string;
  /** Epoch milliseconds. */
  date: number;
  /** Borrows and their repayments: who the money is owed to. */
  person?: string;
  /** Repayments: the borrow transaction this settles. */
  borrowId?: string;
  /** Transfers: the receiving account. */
  toAccountId?: string;
  /** Transfers/withdrawals: fee charged on top of the amount, paid by the source. */
  fee?: number;
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
