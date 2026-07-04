"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  CURRENCY_SYMBOL,
  dateTimeInputToTs,
  formatBDT,
  tsToDateTimeInput,
} from "@/lib/format";
import { useAccounts, useContainers } from "@/lib/hooks";
import {
  addBorrow,
  addChildExpense,
  addExpense,
  addIncome,
  addTransfer,
  addWithdrawal,
} from "@/lib/repo";
import { useUIStore } from "@/lib/store";
import type { TransactionType } from "@/lib/types";
import Sheet from "./Sheet";

const TABS: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "withdrawal", label: "Cash out" },
  { value: "borrow", label: "Borrow" },
  { value: "transfer", label: "Transfer" },
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
  /** Borrow only: who lent the money. Required there, checked on save. */
  person: z.string(),
  /** Expense/income only: required there, checked on save. */
  category: z.string(),
  /** Transfer/cash-out only: optional fee, paid by the source account. */
  fee: z
    .string()
    .refine(
      (v) => v.trim() === "" || (Number.isFinite(Number(v)) && Number(v) >= 0),
      "Fee must be a number",
    ),
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
  /** Transfer only: the receiving account. */
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  /** "" = straight from the account; otherwise a withdrawal container id. */
  const [sourceParentId, setSourceParentId] = useState(lockedParentId ?? "");
  const [storedAccountId] = useState(readLastAccount);
  const [now] = useState(() => tsToDateTimeInput(Date.now()));

  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      amount: "",
      purpose: "",
      person: "",
      category: "",
      fee: "",
      note: "",
      date: now,
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
        date: dateTimeInputToTs(values.date),
      };
      if (type === "borrow") {
        await addBorrow({ ...common, person: values.person });
      } else if (type === "transfer") {
        if (!accountId) throw new Error("Add an account first");
        storeLastAccount(accountId);
        const fee = Number(values.fee || "0");
        await addTransfer({
          fromAccountId: accountId,
          toAccountId: toAccountId as string,
          amount: common.amount,
          fee: fee > 0 ? fee : undefined,
          note: common.note,
          date: common.date,
        });
      } else if (type === "expense" && sourceParentId) {
        await addChildExpense(sourceParentId, common);
      } else {
        if (!accountId) throw new Error("Add an account first");
        storeLastAccount(accountId);
        const input = { ...common, accountId };
        if (type === "expense") await addExpense(input);
        else if (type === "income") await addIncome(input);
        else {
          const fee = Number(values.fee || "0");
          await addWithdrawal({ ...input, fee: fee > 0 ? fee : undefined });
        }
      }
      onDone();
    } catch (e) {
      form.setError("root", {
        message: e instanceof Error ? e.message : "Could not save",
      });
    }
  };

  const onSubmit = (values: EntryFormValues) => {
    if (type === "withdrawal") {
      return save(values, values.purpose.trim() || "Cash out");
    }
    if (type === "borrow") {
      if (!values.person.trim()) {
        form.setError("person", { message: "Who lent you the money?" });
        return;
      }
      return save(
        values,
        values.purpose.trim() || `From ${values.person.trim()}`,
      );
    }
    if (type === "transfer") {
      if (!toAccountId || toAccountId === accountId) {
        form.setError("root", {
          message: "Pick the account the money goes to",
        });
        return;
      }
      // The label is built in the repo from the two account names.
      return save(values, "");
    }
    if (!values.category) {
      form.setError("category", { message: "Pick a category" });
      return;
    }
    return save(values, values.category);
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
            form.resetField("category");
            form.clearErrors();
          }}
          className="mb-4"
        >
          <TabsList className="grid w-full grid-cols-5">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="px-1 text-xs">
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

      <div className="mb-4 space-y-2">
        <Controller
          name="note"
          control={form.control}
          render={({ field }) => (
            <Field>
              <Input
                {...field}
                placeholder="Note (optional)"
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
            <Field data-invalid={fieldState.invalid}>
              <DateTimePicker
                value={field.value}
                onChange={field.onChange}
                error={fieldState.invalid}
                showClear={false}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>

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
                <Icon
                  name={c.txn.type === "borrow" ? "handshake" : "cash"}
                  className="size-3.5"
                />
                {c.txn.category} · {formatBDT(c.remainder)} left
              </Chip>
            ))}
          </div>
        </div>
      )}

      {lockedParentId && selectedContainer && (
        <p className="mb-4 flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">
          <Icon
            name={
              selectedContainer.txn.type === "borrow" ? "handshake" : "cash"
            }
            className="size-4"
          />
          {selectedContainer.txn.category} —{" "}
          {formatBDT(selectedContainer.remainder)} left
        </p>
      )}

      {type !== "borrow" && (type !== "expense" || !sourceParentId) && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {type === "withdrawal"
              ? "Cash out from"
              : type === "transfer"
                ? "From"
                : "Account"}
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

      {type === "transfer" && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            To
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(accounts ?? [])
              .filter((a) => a.id !== accountId)
              .map((a) => (
                <Chip
                  key={a.id}
                  active={toAccountId === a.id}
                  onClick={() => setToAccountId(a.id)}
                >
                  {a.name}
                </Chip>
              ))}
            {(accounts ?? []).length < 2 && (
              <p className="text-sm text-muted-foreground">
                You need a second account to transfer to.
              </p>
            )}
          </div>
        </div>
      )}

      {type === "withdrawal" || type === "borrow" ? (
        <div className="space-y-3">
          {type === "borrow" && (
            <Controller
              name="person"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <Input
                    {...field}
                    aria-invalid={fieldState.invalid}
                    placeholder="From whom? (e.g. Rahim bhai)"
                    autoComplete="off"
                    className="h-10"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          )}
          <Controller
            name="purpose"
            control={form.control}
            render={({ field }) => (
              <Field>
                <Input
                  {...field}
                  placeholder={
                    type === "borrow"
                      ? "Purpose (optional)"
                      : "Purpose (e.g. Bazar, Eid shopping)"
                  }
                  autoComplete="off"
                  className="h-10"
                />
              </Field>
            )}
          />
          {type === "withdrawal" && (
            <Controller
              name="fee"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <InputGroup className="h-10">
                    <InputGroupAddon>{CURRENCY_SYMBOL}</InputGroupAddon>
                    <InputGroupInput
                      {...field}
                      aria-invalid={fieldState.invalid}
                      onChange={(e) =>
                        field.onChange(e.target.value.replace(/[^\d.]/g, ""))
                      }
                      inputMode="decimal"
                      placeholder="Fee (optional, e.g. ATM/cash-out charge)"
                      aria-label="Cash-out fee"
                    />
                  </InputGroup>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          )}
          <Button
            type="submit"
            className="h-12 w-full text-base font-semibold"
          >
            {type === "borrow" ? "Record borrowed cash" : "Record cash out"}
          </Button>
        </div>
      ) : type === "transfer" ? (
        <div className="space-y-3">
          <Controller
            name="fee"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <InputGroup className="h-10">
                  <InputGroupAddon>{CURRENCY_SYMBOL}</InputGroupAddon>
                  <InputGroupInput
                    {...field}
                    aria-invalid={fieldState.invalid}
                    onChange={(e) =>
                      field.onChange(e.target.value.replace(/[^\d.]/g, ""))
                    }
                    inputMode="decimal"
                    placeholder="Fee (optional, e.g. cash-out charge)"
                    aria-label="Transfer fee"
                  />
                </InputGroup>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Button
            type="submit"
            className="h-12 w-full text-base font-semibold"
          >
            Transfer money
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Controller
            name="category"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Category
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {categories.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant={field.value === c.id ? "default" : "outline"}
                      onClick={() => field.onChange(c.id)}
                      className={`h-auto flex-col gap-1 py-2.5 text-xs font-normal ${
                        field.value === c.id ? "" : "text-muted-foreground"
                      }`}
                    >
                      <Icon name={c.icon} className="size-5" />
                      {c.label}
                    </Button>
                  ))}
                </div>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="h-12 w-full text-base font-semibold"
          >
            {type === "income" ? "Add income" : "Add expense"}
          </Button>
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
 * The speed-first entry sheet: amount, tap a category, hit Add. The form
 * remounts on every open so it always starts fresh.
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
      fullscreen
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
