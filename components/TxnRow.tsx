"use client";

import { Icon, type IconName } from "@/components/Icon";
import { Button } from "@/components/ui/button";
import { categoryIcon, categoryLabel } from "@/lib/categories";
import { formatBDT, formatDate } from "@/lib/format";
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
  const isIncome = txn.type === "income";
  const isWithdrawal = txn.type === "withdrawal";
  const isBorrow = txn.type === "borrow";
  const isRepayment = txn.type === "repayment";
  const isTransfer = txn.type === "transfer";
  const icon: IconName = isWithdrawal
    ? "cash"
    : isBorrow || isRepayment
      ? "handshake"
      : isTransfer
        ? "transfer"
        : categoryIcon(txn.category);
  const label =
    isWithdrawal || isBorrow || isTransfer
      ? txn.category
      : isRepayment
        ? `Repaid ${txn.person ?? ""}`.trim()
        : categoryLabel(txn.category);
  const detail = txn.note || (compact ? "" : formatDate(txn.date));
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
                : isTransfer
                  ? "text-muted-foreground"
                  : ""
          }`}
        >
          {isIncome || isBorrow ? "+" : isTransfer ? "" : "−"}
          {formatBDT(txn.amount)}
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
