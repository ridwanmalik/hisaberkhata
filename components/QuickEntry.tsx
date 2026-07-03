"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import {
  CURRENCY_SYMBOL,
  dateInputToTs,
  formatBDT,
  tsToDateInput,
} from "@/lib/format";
import { useAccounts, useContainers } from "@/lib/hooks";
import {
  addChildExpense,
  addExpense,
  addIncome,
  addWithdrawal,
} from "@/lib/repo";
import { useUIStore } from "@/lib/store";
import type { TransactionType } from "@/lib/types";
import Sheet from "./Sheet";

const TABS: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "withdrawal", label: "Cash out" },
];

const LAST_ACCOUNT_KEY = "hisaberkhata:lastAccountId";

// localStorage access can throw on phones with cookies/site data blocked —
// remembering the last account is a nicety, never worth crashing the sheet.
const readLastAccount = (): string | null => {
  try {
    return localStorage.getItem(LAST_ACCOUNT_KEY);
  } catch {
    return null;
  }
};

const storeLastAccount = (id: string): void => {
  try {
    localStorage.setItem(LAST_ACCOUNT_KEY, id);
  } catch {
    // ignore — the default account fallback covers it
  }
};

const entrySchema = z.object({
  amount: z
    .string()
    .refine(
      (v) => Number.isFinite(Number(v)) && Number(v) > 0,
      "Enter an amount first",
    ),
  purpose: z.string(),
  note: z.string(),
  date: z.string().min(1, "Pick a date"),
});

type EntryFormValues = z.infer<typeof entrySchema>;

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const Chip = ({ active, onClick, children }: ChipProps) => (
  <Button
    type="button"
    variant={active ? "default" : "outline"}
    size="sm"
    onClick={onClick}
    className="shrink-0 rounded-full"
  >
    {children}
  </Button>
);

interface FormProps {
  initialType: TransactionType;
  /** When set, the entry is locked to a child expense of this withdrawal. */
  lockedParentId: string | null;
  onDone: () => void;
}

const QuickEntryForm = ({ initialType, lockedParentId, onDone }: FormProps) => {
  const accounts = useAccounts();
  const containers = useContainers();

  const [type, setType] = useState(initialType);
  const [pickedAccountId, setPickedAccountId] = useState<string | null>(null);
  /** "" = straight from the account; otherwise a withdrawal container id. */
  const [sourceParentId, setSourceParentId] = useState(lockedParentId ?? "");
  const [moreOpen, setMoreOpen] = useState(false);
  const [storedAccountId] = useState(readLastAccount);
  const [today] = useState(() => tsToDateInput(Date.now()));

  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      amount: "",
      purpose: "",
      note: "",
      date: today,
    },
  });

  const accountId =
    pickedAccountId ??
    (accounts?.some((a) => a.id === storedAccountId)
      ? (storedAccountId as string)
      : (accounts?.[0]?.id ?? ""));

  const openContainers = useMemo(
    () => (containers ?? []).filter((c) => c.remainder > 0),
    [containers],
  );

  const save = async (values: EntryFormValues, category: string) => {
    try {
      const common = {
        amount: Number(values.amount),
        category,
        note: values.note,
        date: dateInputToTs(values.date),
      };
      if (type === "expense" && sourceParentId) {
        await addChildExpense(sourceParentId, common);
      } else {
        if (!accountId) throw new Error("Add an account first");
        storeLastAccount(accountId);
        const input = { ...common, accountId };
        if (type === "expense") await addExpense(input);
        else if (type === "income") await addIncome(input);
        else await addWithdrawal(input);
      }
      onDone();
    } catch (e) {
      form.setError("root", {
        message: e instanceof Error ? e.message : "Could not save",
      });
    }
  };

  /** Category tap = validate + save in one go. Speed is the whole point. */
  const saveWithCategory = (category: string) =>
    form.handleSubmit((values) => save(values, category))();

  const onSubmit = (values: EntryFormValues) => {
    if (type !== "withdrawal") return; // expense/income save via category tap
    return save(values, values.purpose.trim() || "Cash out");
  };

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const selectedContainer = openContainers.find(
    (c) => c.txn.id === sourceParentId,
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {!lockedParentId && (
        <Tabs
          value={type}
          onValueChange={(v) => {
            setType(v as TransactionType);
            form.clearErrors();
          }}
          className="mb-4"
        >
          <TabsList className="grid w-full grid-cols-3">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <Controller
        name="amount"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="mb-4 gap-1.5">
            <div className="flex items-center gap-2 rounded-2xl border px-4 py-3 has-aria-invalid:border-destructive">
              <span className="text-2xl font-semibold text-muted-foreground">
                {CURRENCY_SYMBOL}
              </span>
              <input
                {...field}
                autoFocus
                aria-invalid={fieldState.invalid}
                onChange={(e) =>
                  field.onChange(e.target.value.replace(/[^\d.]/g, ""))
                }
                inputMode="decimal"
                placeholder="0"
                aria-label="Amount"
                className="w-full bg-transparent text-3xl font-bold outline-none placeholder:text-muted-foreground/40"
              />
            </div>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      {type === "expense" && !lockedParentId && openContainers.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Paying from
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Chip
              active={!sourceParentId}
              onClick={() => setSourceParentId("")}
            >
              Account
            </Chip>
            {openContainers.map((c) => (
              <Chip
                key={c.txn.id}
                active={sourceParentId === c.txn.id}
                onClick={() => setSourceParentId(c.txn.id)}
              >
                💵 {c.txn.category} · {formatBDT(c.remainder)} left
              </Chip>
            ))}
          </div>
        </div>
      )}

      {lockedParentId && selectedContainer && (
        <p className="mb-4 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">
          💵 {selectedContainer.txn.category} —{" "}
          {formatBDT(selectedContainer.remainder)} left
        </p>
      )}

      {(type !== "expense" || !sourceParentId) && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {type === "withdrawal" ? "Cash out from" : "Account"}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(accounts ?? []).map((a) => (
              <Chip
                key={a.id}
                active={accountId === a.id}
                onClick={() => setPickedAccountId(a.id)}
              >
                {a.name}
              </Chip>
            ))}
            {accounts && accounts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No accounts yet — add one from the Accounts tab.
              </p>
            )}
          </div>
        </div>
      )}

      {type === "withdrawal" ? (
        <div className="space-y-3">
          <Controller
            name="purpose"
            control={form.control}
            render={({ field }) => (
              <Field>
                <Input
                  {...field}
                  placeholder="Purpose (e.g. Bazar, Eid shopping)"
                  autoComplete="off"
                  className="h-10"
                />
              </Field>
            )}
          />
          <Button
            type="submit"
            className="h-12 w-full text-base font-semibold"
          >
            Record cash out
          </Button>
        </div>
      ) : (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tap a category to save
          </p>
          <div className="grid grid-cols-4 gap-2">
            {categories.map((c) => (
              <Button
                key={c.id}
                type="button"
                variant="outline"
                disabled={form.formState.isSubmitting}
                onClick={() => saveWithCategory(c.id)}
                className="h-auto flex-col gap-1 py-2.5 text-xs font-normal text-muted-foreground"
              >
                <span className="text-xl">{c.emoji}</span>
                {c.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={() => setMoreOpen(!moreOpen)}
        className="mt-3 px-0 text-muted-foreground"
      >
        {moreOpen ? "Hide details" : "Add note / change date"}
      </Button>
      {moreOpen && (
        <div className="mt-1 flex gap-2">
          <Controller
            name="note"
            control={form.control}
            render={({ field }) => (
              <Field className="flex-1">
                <Input
                  {...field}
                  placeholder="Note"
                  autoComplete="off"
                  className="h-10"
                />
              </Field>
            )}
          />
          <Controller
            name="date"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="w-auto">
                <Input
                  {...field}
                  type="date"
                  aria-invalid={fieldState.invalid}
                  aria-label="Date"
                  className="h-10 w-auto"
                />
              </Field>
            )}
          />
        </div>
      )}

      {form.formState.errors.root && (
        <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2">
          <FieldError errors={[form.formState.errors.root]} />
        </div>
      )}
    </form>
  );
};

/**
 * The speed-first entry sheet. For expenses and income, tapping a category
 * chip saves immediately — amount + one tap. The form remounts on every open
 * so it always starts fresh.
 */
const QuickEntry = () => {
  const {
    quickEntryOpen,
    quickEntryType,
    quickEntryParentId,
    closeQuickEntry,
  } = useUIStore();

  return (
    <Sheet
      open={quickEntryOpen}
      onClose={closeQuickEntry}
      title={quickEntryParentId ? "Spend from this cash" : "Add entry"}
    >
      {quickEntryOpen && (
        <QuickEntryForm
          initialType={quickEntryType}
          lockedParentId={quickEntryParentId}
          onDone={closeQuickEntry}
        />
      )}
    </Sheet>
  );
};

export default QuickEntry;
