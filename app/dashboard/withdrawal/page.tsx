"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import TxnRow from "@/components/TxnRow";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";
import { CURRENCY_SYMBOL, formatBDT, formatDateTime } from "@/lib/format";
import {
  useAccounts,
  useContainer,
  useContainers,
  type Container,
} from "@/lib/hooks";
import { addRepayment, deleteTransaction } from "@/lib/repo";
import { ROUTES } from "@/lib/routes";
import { useUIStore } from "@/lib/store";
import type { Account } from "@/lib/types";

type PendingDelete =
  | { kind: "child"; id: string }
  | { kind: "repayment"; id: string }
  | { kind: "parent" }
  | null;

const repaySchema = z.object({
  amount: z
    .string()
    .refine(
      (v) => Number.isFinite(Number(v)) && Number(v) > 0,
      "Enter an amount first",
    ),
});

type RepayFormValues = z.infer<typeof repaySchema>;

interface RepayFormProps {
  borrowId: string;
  accounts: Account[];
  /** Cash containers with something left — handing over physical cash. */
  cashSources: Container[];
}

const RepayForm = ({ borrowId, accounts, cashSources }: RepayFormProps) => {
  const [sourceId, setSourceId] = useState(
    accounts[0]?.id ?? cashSources[0]?.txn.id ?? "",
  );
  const form = useForm<RepayFormValues>({
    resolver: zodResolver(repaySchema),
    defaultValues: { amount: "" },
  });

  const onSubmit = async (values: RepayFormValues) => {
    try {
      if (!sourceId) throw new Error("Add an account first");
      const isAccount = accounts.some((a) => a.id === sourceId);
      await addRepayment({
        borrowId,
        amount: Number(values.amount),
        ...(isAccount
          ? { accountId: sourceId }
          : { fromContainerId: sourceId }),
      });
      form.reset();
    } catch (e) {
      form.setError("root", {
        message: e instanceof Error ? e.message : "Could not save",
      });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {accounts.map((a) => (
          <Button
            key={a.id}
            type="button"
            variant={sourceId === a.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSourceId(a.id)}
            className="shrink-0 rounded-full"
          >
            {a.name}
          </Button>
        ))}
        {cashSources.map((c) => (
          <Button
            key={c.txn.id}
            type="button"
            variant={sourceId === c.txn.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSourceId(c.txn.id)}
            className="shrink-0 rounded-full"
          >
            <Icon name="cash" className="size-3.5" /> {c.txn.category} ·{" "}
            {formatBDT(c.remainder)} left
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Controller
          name="amount"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="flex-1 gap-1">
              <InputGroup className="h-10">
                <InputGroupAddon>{CURRENCY_SYMBOL}</InputGroupAddon>
                <InputGroupInput
                  {...field}
                  aria-invalid={fieldState.invalid}
                  onChange={(e) =>
                    field.onChange(e.target.value.replace(/[^\d.]/g, ""))
                  }
                  inputMode="decimal"
                  placeholder="Amount repaid"
                  aria-label="Repayment amount"
                />
              </InputGroup>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Button type="submit" className="h-10">
          Repay
        </Button>
      </div>
      {form.formState.errors.root && (
        <FieldError errors={[form.formState.errors.root]} />
      )}
    </form>
  );
};

const WithdrawalDetail = () => {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const container = useContainer(id);
  const containers = useContainers();
  const accounts = useAccounts();
  const openQuickEntry = useUIStore((s) => s.openQuickEntry);
  const openEditEntry = useUIStore((s) => s.openEditEntry);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  if (container === undefined) return null; // still loading
  if (container === null) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        <p>This entry doesn&apos;t exist (it may have been deleted).</p>
        <Button variant="link" asChild>
          <Link href={ROUTES.history}>Back to history</Link>
        </Button>
      </div>
    );
  }

  const { txn, spent, remainder, children, repayments, repaid, owed } =
    container;
  const isBorrow = txn.type === "borrow";
  // A borrow that landed in an account holds no cash — only its debt is live.
  const isAccountBorrow = isBorrow && txn.accountId !== "";
  const account = accounts?.find((a) => a.id === txn.accountId);
  const cashSources = (containers ?? []).filter((c) => c.remainder > 0);
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
        <div className="min-w-0 flex-1">
          <h1 className="flex min-w-0 items-center gap-1.5 truncate font-bold">
            <Icon
              name={isBorrow ? "handshake" : "cash"}
              className="size-4 shrink-0 text-muted-foreground"
            />
            <span className="truncate">{txn.category}</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(txn.date)}
            {isBorrow
              ? ` · lent by ${txn.person}${
                  isAccountBorrow && account ? ` · into ${account.name}` : ""
                }`
              : account
                ? ` · from ${account.name}`
                : ""}
          </p>
        </div>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => openEditEntry(txn.id)}
          aria-label="Edit this entry"
          className="rounded-full"
        >
          <Icon name="edit" />
        </Button>
      </header>

      {!isAccountBorrow && (
      <Card className="py-5 text-center">
        <CardContent className="px-5">
          <p className="text-sm text-muted-foreground">Left from this cash</p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-primary">
            {formatBDT(remainder)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            of {formatBDT(txn.amount)} · {formatBDT(spent)} accounted
            {txn.fee ? ` · ${formatBDT(txn.fee)} fee` : ""}
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
      )}

      {isBorrow && (
        <Card className="gap-0 py-4">
          <CardContent className="space-y-3 px-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold">Owed to {txn.person}</h2>
              <p className="text-sm font-bold tabular-nums">
                {owed > 0 ? formatBDT(owed) : "Settled 🎉"}
              </p>
            </div>
            {repaid > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatBDT(repaid)} repaid of {formatBDT(txn.amount)}
              </p>
            )}
            {isAccountBorrow && account && (
              <p className="text-xs text-muted-foreground">
                The money went into {account.name} — spend it from there like
                any balance.
              </p>
            )}
            {owed > 0 && (
              <RepayForm
                borrowId={txn.id}
                accounts={accounts ?? []}
                cashSources={cashSources}
              />
            )}
            {repayments.length > 0 && (
              <div className="divide-y border-t">
                {repayments.map((r) => (
                  <TxnRow
                    key={r.id}
                    txn={r}
                    onDelete={(rid) =>
                      setPendingDelete({ kind: "repayment", id: rid })
                    }
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isAccountBorrow && (
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
      )}

      {txn.note && (
        <p className="text-sm text-muted-foreground">Note: {txn.note}</p>
      )}

      <Button
        variant="destructive"
        onClick={() => setPendingDelete({ kind: "parent" })}
        className="w-full"
      >
        {isBorrow ? "Delete borrow" : "Delete withdrawal"}
      </Button>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={
          pendingDelete?.kind === "parent"
            ? isBorrow
              ? "Delete borrow?"
              : "Delete withdrawal?"
            : pendingDelete?.kind === "repayment"
              ? "Delete this repayment?"
              : "Delete this spend?"
        }
        description={
          pendingDelete?.kind === "parent"
            ? isBorrow
              ? "This deletes the borrow, its spends, and its repayments. Repaid amounts go back to the accounts they were paid from."
              : "This deletes the withdrawal and everything recorded under it. The amount goes back to the account."
            : pendingDelete?.kind === "repayment"
              ? "The money goes back to the account it was paid from, and the debt grows back."
              : "The money goes back to this cash's remainder."
        }
        onConfirm={async () => {
          if (
            pendingDelete?.kind === "child" ||
            pendingDelete?.kind === "repayment"
          ) {
            await deleteTransaction(pendingDelete.id);
          } else if (pendingDelete?.kind === "parent") {
            await deleteTransaction(txn.id);
            router.push(ROUTES.history);
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
