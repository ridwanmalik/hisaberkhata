"use client";

import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/button";
import { categoryEmoji, categoryLabel } from "@/lib/categories";
import { formatBDT, formatDate } from "@/lib/format";
import type { Transaction } from "@/lib/types";

interface TxnRowProps {
  txn: Transaction;
  onDelete?: (id: string) => void;
  /** Hide the date (e.g. inside a day group). */
  compact?: boolean;
}

const TxnRow = ({ txn, onDelete, compact }: TxnRowProps) => {
  const isIncome = txn.type === "income";
  const isWithdrawal = txn.type === "withdrawal";
  const isBorrow = txn.type === "borrow";
  const isRepayment = txn.type === "repayment";
  const emoji =
    isWithdrawal ? "💵" : isBorrow || isRepayment ? "🤝" : categoryEmoji(txn.category);
  const label =
    isWithdrawal || isBorrow
      ? txn.category
      : isRepayment
        ? `Repaid ${txn.person ?? ""}`.trim()
        : categoryLabel(txn.category);
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {txn.note || (compact ? "" : formatDate(txn.date))}
        </p>
      </div>
      <span
        className={`text-sm font-semibold tabular-nums ${
          isIncome
            ? "text-primary"
            : isWithdrawal || isBorrow
              ? "text-amber-600 dark:text-amber-400"
              : ""
        }`}
      >
        {isIncome || isBorrow ? "+" : "−"}
        {formatBDT(txn.amount)}
      </span>
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
