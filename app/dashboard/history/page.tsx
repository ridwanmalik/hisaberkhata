"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import TxnRow from "@/components/TxnRow";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatBDT, formatDate, formatMonth } from "@/lib/format";
import { useContainers, useMonthData } from "@/lib/hooks";
import { deleteTransaction } from "@/lib/repo";
import { ROUTES } from "@/lib/routes";
import { useUIStore } from "@/lib/store";
import { isContainerType } from "@/lib/types";

const HistoryPage = () => {
  const { monthOffset, setMonthOffset } = useUIStore();
  const containers = useContainers();
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    isParent: boolean;
  } | null>(null);

  const target = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + monthOffset, 1);
  }, [monthOffset]);
  const month = useMonthData(target.getFullYear(), target.getMonth());

  const containerById = useMemo(
    () => new Map((containers ?? []).map((c) => [c.txn.id, c])),
    [containers],
  );

  // Top-level rows for the month: parents and standalone entries. Children
  // render inside their parent's group instead.
  const rows = (month?.transactions ?? []).filter((t) => !t.parentId);

  const requestDelete = (id: string) => {
    const txn = month?.transactions.find((t) => t.id === id);
    setPendingDelete({ id, isParent: !!txn && isContainerType(txn.type) });
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setMonthOffset(monthOffset - 1)}
          aria-label="Previous month"
          className="rounded-full"
        >
          <Icon name="prev" />
        </Button>
        <div className="text-center">
          <h1 className="font-bold">
            {formatMonth(target.getFullYear(), target.getMonth())}
          </h1>
          {monthOffset !== 0 && (
            <Button
              variant="link"
              size="xs"
              onClick={() => setMonthOffset(0)}
              className="h-auto"
            >
              Back to this month
            </Button>
          )}
        </div>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setMonthOffset(monthOffset + 1)}
          disabled={monthOffset >= 0}
          aria-label="Next month"
          className="rounded-full"
        >
          <Icon name="next" />
        </Button>
      </header>

      <section className="grid grid-cols-3 gap-2 text-center text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Income</p>
          <p className="font-bold text-primary">
            {formatBDT(month?.income ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Spent</p>
          <p className="font-bold">{formatBDT(month?.spent ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Cash out</p>
          <p className="font-bold text-amber-600 dark:text-amber-400">
            {formatBDT(month?.withdrawn ?? 0)}
          </p>
        </div>
      </section>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nothing recorded in this month.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => {
            if (!isContainerType(t.type)) {
              return (
                <Card key={t.id} className="py-0">
                  <CardContent className="px-4">
                    <TxnRow txn={t} onDelete={requestDelete} />
                  </CardContent>
                </Card>
              );
            }
            const c = containerById.get(t.id);
            const isBorrow = t.type === "borrow";
            return (
              <Card key={t.id} className="gap-0 py-4">
                <CardContent className="px-4">
                  <Link
                    href={ROUTES.withdrawal(t.id)}
                    className="flex items-baseline justify-between gap-2"
                  >
                    <p className="flex min-w-0 items-center gap-1.5 truncate font-medium">
                      <Icon
                        name={isBorrow ? "handshake" : "cash"}
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <span className="truncate">{t.category}</span>
                    </p>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(t.date)}
                    </p>
                  </Link>
                  <p className="mt-1 text-sm">
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {isBorrow ? "+" : "−"}
                      {formatBDT(t.amount)}
                    </span>{" "}
                    <span className="text-primary">
                      · {formatBDT(c?.remainder ?? t.amount)} left
                    </span>
                    {isBorrow && (c?.owed ?? 0) > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        · owes {formatBDT(c?.owed ?? 0)}
                      </span>
                    )}
                  </p>
                  {c && c.children.length > 0 && (
                    <div className="mt-1 divide-y border-t pl-3">
                      {c.children.map((child) => (
                        <TxnRow
                          key={child.id}
                          txn={child}
                          onDelete={requestDelete}
                        />
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex justify-end gap-1">
                    <Button variant="link" size="xs" asChild>
                      <Link href={ROUTES.withdrawal(t.id)}>Open</Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => requestDelete(t.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={
          pendingDelete?.isParent ? "Delete this cash entry?" : "Delete entry?"
        }
        description={
          pendingDelete?.isParent
            ? "This deletes the entry and everything recorded under it, reversing its balance effects."
            : "This entry will be removed and its balance effect reversed."
        }
        onConfirm={async () => {
          if (pendingDelete) await deleteTransaction(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
};

export default HistoryPage;
