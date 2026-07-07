import { db } from "./db";
import type { Account, Budget, RecurringItem, Transaction } from "./types";

const APP_ID = "hisaberkhata";
/** Bump alongside db.ts version bumps that change a table's shape. */
const BACKUP_SCHEMA_VERSION = 4;

export interface BackupData {
  accounts: Account[];
  transactions: Transaction[];
  recurring_items: RecurringItem[];
  budgets: Budget[];
}

interface BackupFile {
  app: typeof APP_ID;
  schemaVersion: number;
  exportedAt: number;
  data: BackupData;
}

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const dateStamp = (ts: number): string => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Downloads a full-fidelity JSON backup of every table. */
export const exportBackup = async (): Promise<void> => {
  const accounts = await db.accounts.toArray();
  const transactions = await db.transactions.toArray();
  const recurring_items = await db.recurring_items.toArray();
  const budgets = await db.budgets.toArray();
  const file: BackupFile = {
    app: APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: Date.now(),
    data: { accounts, transactions, recurring_items, budgets },
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, `hisaberkhata-backup-${dateStamp(Date.now())}.json`);
};

/**
 * Replaces ALL local data with the contents of a backup file. Destructive —
 * callers must get explicit user confirmation first.
 */
export const importBackup = async (file: File): Promise<void> => {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { app?: unknown }).app !== APP_ID
  ) {
    throw new Error("That doesn't look like a Hisaber Khata backup");
  }
  const backup = parsed as BackupFile;
  if (backup.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error(
      "This backup was made with a newer version of the app — update the app first",
    );
  }
  const { accounts, transactions, recurring_items, budgets } =
    backup.data ?? ({} as Partial<BackupData>);
  if (
    !Array.isArray(accounts) ||
    !Array.isArray(transactions) ||
    !Array.isArray(recurring_items) ||
    !Array.isArray(budgets)
  ) {
    throw new Error("That backup file is missing data");
  }
  await db.transaction(
    "rw",
    [db.accounts, db.transactions, db.recurring_items, db.budgets],
    async () => {
      await db.accounts.clear();
      await db.transactions.clear();
      await db.recurring_items.clear();
      await db.budgets.clear();
      await db.accounts.bulkAdd(accounts);
      await db.transactions.bulkAdd(transactions);
      await db.recurring_items.bulkAdd(recurring_items);
      await db.budgets.bulkAdd(budgets);
    },
  );
};

const csvField = (value: string | number): string => {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Downloads a flat CSV of every transaction for opening in a spreadsheet.
 * One-way only — re-importing edited CSVs would corrupt the parent/child
 * and borrow/transfer relationships and the balance invariant. Use the JSON
 * backup for anything that needs to come back in.
 */
export const exportTransactionsCsv = async (): Promise<void> => {
  const transactions = await db.transactions.orderBy("date").toArray();
  const accounts = await db.accounts.toArray();
  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? "";
  const header = [
    "Date",
    "Type",
    "Account",
    "Category",
    "Amount",
    "Fee",
    "Person",
    "Note",
  ];
  const rows = transactions.map((t) => [
    new Date(t.date).toISOString(),
    t.type,
    accountName(t.accountId),
    t.category,
    t.amount,
    t.fee ?? "",
    t.person ?? "",
    t.note,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map(csvField).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  downloadBlob(blob, `hisaberkhata-transactions-${dateStamp(Date.now())}.csv`);
};
