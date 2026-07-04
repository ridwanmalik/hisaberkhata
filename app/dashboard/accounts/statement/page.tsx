"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import TxnRow from "@/components/TxnRow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBDT, formatMonth } from "@/lib/format";
import { useAccountStatement } from "@/lib/hooks";
import { ROUTES } from "@/lib/routes";

const StatementDetail = () => {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const [monthOffset, setMonthOffset] = useState(0);

  const target = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + monthOffset, 1);
  }, [monthOffset]);
  const statement = useAccountStatement(
    id,
    target.getFullYear(),
    target.getMonth(),
  );

  if (statement === undefined) return null; // still loading
  if (statement === null) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        <p>This account doesn&apos;t exist (it may have been deleted).</p>
        <Button variant="link" asChild>
          <Link href={ROUTES.accounts}>Back to accounts</Link>
        </Button>
      </div>
    );
  }

  const { account, opening, closing, transactions } = statement;

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
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-bold">{account.name}</h1>
          <p className="text-xs text-muted-foreground">Account statement</p>
        </div>
      </header>

      <div className="flex items-center justify-between">
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
          <p className="font-semibold">
            {formatMonth(target.getFullYear(), target.getMonth())}
          </p>
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
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="gap-0 px-4 py-3">
          <p className="text-xs text-muted-foreground">Start balance</p>
          <p
            className={`mt-0.5 font-bold tabular-nums ${opening < 0 ? "text-destructive" : ""}`}
          >
            {formatBDT(opening)}
          </p>
        </Card>
        <Card className="gap-0 px-4 py-3">
          <p className="text-xs text-muted-foreground">End balance</p>
          <p
            className={`mt-0.5 font-bold tabular-nums ${closing < 0 ? "text-destructive" : ""}`}
          >
            {formatBDT(closing)}
          </p>
        </Card>
      </div>

      <section>
        <h2 className="mb-1 font-semibold">Transactions</h2>
        {transactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing moved this account in{" "}
            {formatMonth(target.getFullYear(), target.getMonth())}.
          </p>
        ) : (
          <div className="divide-y">
            {transactions.map((t) => (
              <TxnRow key={t.id} txn={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const StatementPage = () => (
  <Suspense fallback={null}>
    <StatementDetail />
  </Suspense>
);

export default StatementPage;
