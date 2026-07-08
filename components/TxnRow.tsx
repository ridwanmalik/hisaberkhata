"use client";

import { Icon, type IconName } from "@/components/Icon";
import { Button } from "@/components/ui/button";
import { categoryIcon, categoryLabel } from "@/lib/categories";
import { formatBDT, formatDateTime } from "@/lib/format";
import { useAccounts } from "@/lib/hooks";
import { useUIStore } from "@/lib/store";
import type { Transaction } from "@/lib/types";

interface TxnRowProps {
  txn: Transaction;
  onDelete?: (id: string) => void;
  /** Hide the date (e.g. inside a day group). */
  compact?: boolean;
}

const TxnRow = ({ txn, onDelete, compact }: TxnRowProps) => {
  const openEditEntry = useUIStore((s) => s.openEditEntry);
  const accounts = useAccounts();
  const isIncome = txn.type === "income";
  const isWithdrawal = txn.type === "withdrawal";
  const isBorrow = txn.type === "borrow";
  const isRepayment = txn.type === "repayment";
  const isTransfer = txn.type === "transfer";
  const isAdjustment = txn.type === "adjustment";
  const icon: IconName = isWithdrawal
    ? "cash"
    : isBorrow || isRepayment
      ? "handshake"
      : isTransfer
        ? "transfer"
        : isAdjustment
          ? "adjust"
          : categoryIcon(txn.category);
  const label =
    isWithdrawal || isBorrow || isTransfer || isAdjustment
      ? txn.category
      : isRepayment
        ? `Repaid ${txn.person ?? ""}`.trim()
        : categoryLabel(txn.category);
  // Adjustments are meaningless without knowing which account they touched.
  const accountName = isAdjustment
    ? accounts?.find((a) => a.id === txn.accountId)?.name
    : undefined;
  const detail = [
    accountName,
    txn.note || (compact ? "" : formatDateTime(txn.date)),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex items-center gap-3 py-2.5">
      <button
        type="button"
        onClick={() => openEditEntry(txn.id)}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon name={icon} className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{label}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {(isTransfer || isWithdrawal) && txn.fee
              ? `${formatBDT(txn.fee)} fee${detail ? ` · ${detail}` : ""}`
              : detail}
          </span>
        </span>
        <span
          className={`text-sm font-semibold tabular-nums ${
            isIncome
              ? "text-primary"
              : isWithdrawal || isBorrow
                ? "text-amber-600 dark:text-amber-400"
                : isTransfer || isAdjustment
                  ? "text-muted-foreground"
                  : ""
          }`}
        >
          {isAdjustment
            ? txn.amount < 0
              ? "−"
              : "+"
            : isIncome || isBorrow
              ? "+"
              : isTransfer
                ? ""
                : "−"}
          {formatBDT(Math.abs(txn.amount))}
        </span>
      </button>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(txn.id)}
          aria-label="Delete transaction"
          className="text-muted-foreground hover:text-destructive"
        >
          <Icon name="delete" />
        </Button>
      )}
    </div>
  );
};

export default TxnRow;
