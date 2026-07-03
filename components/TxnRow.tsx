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
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
        {isWithdrawal ? "💵" : categoryEmoji(txn.category)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {isWithdrawal ? txn.category : categoryLabel(txn.category)}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {txn.note || (compact ? "" : formatDate(txn.date))}
        </p>
      </div>
      <span
        className={`text-sm font-semibold tabular-nums ${
          isIncome
            ? "text-primary"
            : isWithdrawal
              ? "text-amber-600 dark:text-amber-400"
              : ""
        }`}
      >
        {isIncome ? "+" : "−"}
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
