"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import TxnRow from "@/components/TxnRow";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatBDT, formatDate } from "@/lib/format";
import { useAccounts, useContainer } from "@/lib/hooks";
import { deleteTransaction } from "@/lib/repo";
import { useUIStore } from "@/lib/store";

type PendingDelete =
  | { kind: "child"; id: string }
  | { kind: "parent" }
  | null;

const WithdrawalDetail = () => {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const container = useContainer(id);
  const accounts = useAccounts();
  const openQuickEntry = useUIStore((s) => s.openQuickEntry);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  if (container === undefined) return null; // still loading
  if (container === null) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        <p>This withdrawal doesn&apos;t exist (it may have been deleted).</p>
        <Button variant="link" asChild>
          <Link href="/history">Back to history</Link>
        </Button>
      </div>
    );
  }

  const { txn, spent, remainder, children } = container;
  const account = accounts?.find((a) => a.id === txn.accountId);
  const pctLeft =
    txn.amount > 0
      ? Math.max(0, Math.min(100, (remainder / txn.amount) * 100))
      : 0;

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => router.back()}
          aria-label="Go back"
          className="rounded-full"
        >
          <Icon name="back" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate font-bold">💵 {txn.category}</h1>
          <p className="text-xs text-muted-foreground">
            {formatDate(txn.date)}
            {account ? ` · from ${account.name}` : ""}
          </p>
        </div>
      </header>

      <Card className="py-5 text-center">
        <CardContent className="px-5">
          <p className="text-sm text-muted-foreground">Left from this cash</p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-primary">
            {formatBDT(remainder)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            of {formatBDT(txn.amount)} · {formatBDT(spent)} accounted
          </p>
          <Progress value={pctLeft} className="mt-3 h-2" />
          <Button
            onClick={() => openQuickEntry("expense", txn.id)}
            disabled={remainder <= 0}
            className="mt-4 h-12 w-full text-base font-semibold"
          >
            {remainder > 0
              ? "Add a spend from this cash"
              : "Fully accounted 🎉"}
          </Button>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-1 font-semibold">Spends from this cash</h2>
        {children.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing recorded yet. Add spends whenever you remember — partial
            accounting is fine.
          </p>
        ) : (
          <div className="divide-y">
            {children.map((child) => (
              <TxnRow
                key={child.id}
                txn={child}
                onDelete={(childId) =>
                  setPendingDelete({ kind: "child", id: childId })
                }
              />
            ))}
          </div>
        )}
      </section>

      {txn.note && (
        <p className="text-sm text-muted-foreground">Note: {txn.note}</p>
      )}

      <Button
        variant="destructive"
        onClick={() => setPendingDelete({ kind: "parent" })}
        className="w-full"
      >
        Delete withdrawal
      </Button>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={
          pendingDelete?.kind === "parent"
            ? "Delete withdrawal?"
            : "Delete this spend?"
        }
        description={
          pendingDelete?.kind === "parent"
            ? "This deletes the withdrawal and everything recorded under it. The amount goes back to the account."
            : "The money goes back to this withdrawal's remainder."
        }
        onConfirm={async () => {
          if (pendingDelete?.kind === "child") {
            await deleteTransaction(pendingDelete.id);
          } else if (pendingDelete?.kind === "parent") {
            await deleteTransaction(txn.id);
            router.push("/history");
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
};

const WithdrawalPage = () => (
  <Suspense fallback={null}>
    <WithdrawalDetail />
  </Suspense>
);

export default WithdrawalPage;
