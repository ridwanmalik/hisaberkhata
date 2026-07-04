"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatBDT, formatDate } from "@/lib/format";
import type { Container } from "@/lib/hooks";
import { ROUTES } from "@/lib/routes";

/** Summary card for a cash container (withdrawal or borrow). */
const WithdrawalCard = ({ container }: { container: Container }) => {
  const { txn, spent, remainder, owed } = container;
  const isBorrow = txn.type === "borrow";
  const pctLeft =
    txn.amount > 0
      ? Math.max(0, Math.min(100, (remainder / txn.amount) * 100))
      : 0;
  return (
    <Link href={ROUTES.withdrawal(txn.id)} className="block">
      <Card className="gap-0 py-4 transition-colors active:bg-muted/50">
        <CardContent className="px-4">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium">
              <Icon
                name={isBorrow ? "handshake" : "cash"}
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span className="truncate">{txn.category}</span>
            </p>
            <p className="shrink-0 text-xs text-muted-foreground">
              {formatDate(txn.date)}
            </p>
          </div>
          <p className="mb-2 text-lg font-bold text-primary">
            {formatBDT(remainder)}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              left of {formatBDT(txn.amount)}
            </span>
          </p>
          <Progress value={pctLeft} className="h-1.5" />
          {spent > 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {formatBDT(spent)} accounted · {container.children.length}{" "}
              {container.children.length === 1 ? "entry" : "entries"}
            </p>
          )}
          {isBorrow && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {owed > 0
                ? `${formatBDT(owed)} still owed to ${txn.person}`
                : `Repaid to ${txn.person} in full 🎉`}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};

export default WithdrawalCard;
