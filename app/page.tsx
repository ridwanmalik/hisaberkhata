"use client";

import Link from "next/link";
import { useMemo } from "react";
import TxnRow from "@/components/TxnRow";
import WithdrawalCard from "@/components/WithdrawalCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatBDT, formatMonth } from "@/lib/format";
import { useAccounts, useContainers, useMonthData } from "@/lib/hooks";
import { useUIStore } from "@/lib/store";

const HomePage = () => {
  const accounts = useAccounts();
  const containers = useContainers();
  const openQuickEntry = useUIStore((s) => s.openQuickEntry);

  const now = useMemo(() => new Date(), []);
  const month = useMonthData(now.getFullYear(), now.getMonth());

  const accountsTotal = useMemo(
    () => (accounts ?? []).reduce((sum, a) => sum + a.balance, 0),
    [accounts],
  );
  const cashInHand = useMemo(
    () => (containers ?? []).reduce((sum, c) => sum + c.remainder, 0),
    [containers],
  );
  const openContainers = (containers ?? []).filter((c) => c.remainder > 0);
  const recent = (month?.transactions ?? []).slice(0, 5);
  const loaded = accounts !== undefined;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">Hisaber Khata</h1>
        <p className="text-sm text-muted-foreground">
          {formatMonth(now.getFullYear(), now.getMonth())}
        </p>
      </header>

      <Card className="border-none bg-primary py-5 text-primary-foreground shadow-lg shadow-primary/20">
        <CardContent className="px-5">
          <p className="text-sm opacity-80">Total money</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">
            {formatBDT(accountsTotal + cashInHand)}
          </p>
          <p className="mt-2 text-xs opacity-80">
            {formatBDT(accountsTotal)} in accounts · {formatBDT(cashInHand)}{" "}
            unspent cash
          </p>
        </CardContent>
      </Card>

      {loaded && accounts.length === 0 && (
        <Card className="border-dashed border-primary/50 py-5 text-center">
          <CardContent className="px-5">
            <p className="mb-1 font-medium">Start your khata</p>
            <p className="mb-3 text-sm text-muted-foreground">
              Add your bank, bKash/Nagad, or cash-in-hand account first.
            </p>
            <Button asChild>
              <Link href="/accounts">Add an account</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <section className="grid grid-cols-3 gap-2 text-center">
        {[
          {
            label: "Income",
            value: month?.income ?? 0,
            tone: "text-primary",
          },
          { label: "Spent", value: month?.spent ?? 0, tone: "" },
          {
            label: "Cash out",
            value: month?.withdrawn ?? 0,
            tone: "text-amber-600 dark:text-amber-400",
          },
        ].map((s) => (
          <Card key={s.label} className="gap-0 px-2 py-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`mt-0.5 text-sm font-bold tabular-nums ${s.tone}`}>
              {formatBDT(s.value)}
            </p>
          </Card>
        ))}
      </section>

      {openContainers.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-semibold">Cash in hand</h2>
            <Button
              variant="link"
              size="sm"
              onClick={() => openQuickEntry("withdrawal")}
              className="px-0"
            >
              + Cash out
            </Button>
          </div>
          <div className="space-y-2">
            {openContainers.slice(0, 3).map((c) => (
              <WithdrawalCard key={c.txn.id} container={c} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="font-semibold">This month</h2>
          <Button variant="link" size="sm" asChild className="px-0">
            <Link href="/history">See all</Link>
          </Button>
        </div>
        {recent.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nothing recorded yet this month. Tap + to add your first entry.
          </p>
        ) : (
          <div className="divide-y">
            {recent.map((t) => (
              <TxnRow key={t.id} txn={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default HomePage;
