"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { Icon } from "@/components/Icon";
import Sheet from "@/components/Sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";
import { EXPENSE_CATEGORIES, categoryById } from "@/lib/categories";
import { CURRENCY_SYMBOL, formatBDT } from "@/lib/format";
import {
  useAccounts,
  useBudgets,
  useContainers,
  useMonthData,
  useRecurringItems,
} from "@/lib/hooks";
import { summarizeMoney } from "@/lib/money";
import {
  addRecurringItem,
  deleteRecurringItem,
  setBudget,
  updateRecurringItem,
} from "@/lib/repo";
import type { RecurringItem, RecurringType } from "@/lib/types";

const isPositiveNumber = (v: string) =>
  Number.isFinite(Number(v)) && Number(v) > 0;

const recurringSchema = z.object({
  type: z.enum(["bill", "income"]),
  name: z.string().trim().min(1, "Give it a name"),
  amount: z.string().refine(isPositiveNumber, "Enter a valid amount"),
  day: z
    .string()
    .refine(
      (v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 31,
      "Day must be between 1 and 31",
    ),
});

type RecurringFormValues = z.infer<typeof recurringSchema>;

const budgetSchema = z.object({
  category: z.string().min(1),
  // Blank or 0 removes the budget, so any non-negative number is fine.
  amount: z
    .string()
    .refine(
      (v) => v.trim() === "" || (Number.isFinite(Number(v)) && Number(v) >= 0),
      "Enter a valid amount",
    ),
});

type BudgetFormValues = z.infer<typeof budgetSchema>;

const BudgetPage = () => {
  const accounts = useAccounts();
  const containers = useContainers();
  const recurring = useRecurringItems();
  const budgets = useBudgets();

  const now = useMemo(() => new Date(), []);
  const month = useMonthData(now.getFullYear(), now.getMonth());

  // -- Projection -----------------------------------------------------------
  // Same "you have" logic as home: credit dues and borrowed debt don't
  // drag the projection down.
  const available = useMemo(
    () => summarizeMoney(accounts, containers).have,
    [accounts, containers],
  );
  const upcomingBills = useMemo(
    () =>
      (recurring ?? [])
        .filter((r) => r.type === "bill" && r.dayOfMonth >= now.getDate())
        .reduce((sum, r) => sum + r.amount, 0),
    [recurring, now],
  );
  const afterBills = available - upcomingBills;

  // -- Recurring item sheet ---------------------------------------------------
  const [recSheetOpen, setRecSheetOpen] = useState(false);
  const [editingRec, setEditingRec] = useState<RecurringItem | null>(null);
  const recForm = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringSchema),
    defaultValues: { type: "bill", name: "", amount: "", day: "1" },
  });

  const openRecSheet = (item: RecurringItem | null) => {
    setEditingRec(item);
    recForm.reset({
      type: item?.type ?? "bill",
      name: item?.name ?? "",
      amount: item ? String(item.amount) : "",
      day: item ? String(item.dayOfMonth) : "1",
    });
    setRecSheetOpen(true);
  };

  const onSubmitRecurring = async (values: RecurringFormValues) => {
    try {
      const name = values.name.trim();
      const amount = Number(values.amount);
      const day = Number(values.day);
      if (editingRec) {
        await updateRecurringItem(editingRec.id, {
          name,
          amount,
          type: values.type,
          dayOfMonth: day,
        });
      } else {
        await addRecurringItem(name, amount, values.type, day);
      }
      setRecSheetOpen(false);
    } catch (e) {
      recForm.setError("root", {
        message: e instanceof Error ? e.message : "Could not save",
      });
    }
  };

  // -- Category budget sheet --------------------------------------------------
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);
  const budgetForm = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { category: EXPENSE_CATEGORIES[0].id, amount: "" },
  });

  const budgetByCategory = useMemo(
    () => new Map((budgets ?? []).map((b) => [b.category, b.amount])),
    [budgets],
  );

  const openBudgetSheet = (category: string, currentAmount: number) => {
    budgetForm.reset({
      category,
      amount: currentAmount > 0 ? String(currentAmount) : "",
    });
    setBudgetSheetOpen(true);
  };

  const onSubmitBudget = async (values: BudgetFormValues) => {
    try {
      await setBudget(values.category, Number(values.amount) || 0);
      setBudgetSheetOpen(false);
    } catch (e) {
      budgetForm.setError("root", {
        message: e instanceof Error ? e.message : "Could not save",
      });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Budget</h1>

      <Card className="border-none bg-primary py-5 text-primary-foreground shadow-lg shadow-primary/20">
        <CardContent className="px-5">
          <p className="text-sm opacity-80">After all bills</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">
            {formatBDT(afterBills)}
          </p>
          <p className="mt-2 text-xs opacity-80">
            {formatBDT(available)} available − {formatBDT(upcomingBills)} bills
            still due this month
          </p>
        </CardContent>
      </Card>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">Bills &amp; salary</h2>
          <Button
            variant="link"
            size="sm"
            onClick={() => openRecSheet(null)}
            className="px-0"
          >
            + Add
          </Button>
        </div>
        {(recurring ?? []).length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Add recurring bills (rent, internet…) and salary to see what&apos;s
            really left each month.
          </p>
        ) : (
          <div className="space-y-2">
            {(recurring ?? []).map((r) => (
              <Card
                key={r.id}
                onClick={() => openRecSheet(r)}
                className="cursor-pointer py-3.5 transition-colors active:bg-muted/50"
              >
                <CardContent className="flex items-center gap-3 px-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon
                      name={r.type === "bill" ? "receipt" : "salary"}
                      className="size-4"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Day {r.dayOfMonth} of every month
                      {r.type === "bill" && r.dayOfMonth >= now.getDate()
                        ? " · due"
                        : ""}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-semibold tabular-nums ${
                      r.type === "income" ? "text-primary" : ""
                    }`}
                  >
                    {r.type === "income" ? "+" : "−"}
                    {formatBDT(r.amount)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">Category budgets</h2>
          <Button
            variant="link"
            size="sm"
            onClick={() => openBudgetSheet(EXPENSE_CATEGORIES[0].id, 0)}
            className="px-0"
          >
            + Set
          </Button>
        </div>
        {(budgets ?? []).length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No budgets set. Set a monthly limit for categories you want to
            watch — no guilt, just visibility.
          </p>
        ) : (
          <div className="space-y-2">
            {(budgets ?? []).map((b) => {
              const cat = categoryById(b.category);
              const spent = month?.spentByCategory[b.category] ?? 0;
              const pct = Math.min(100, (spent / b.amount) * 100);
              const over = spent > b.amount;
              return (
                <Card
                  key={b.id}
                  onClick={() => openBudgetSheet(b.category, b.amount)}
                  className="cursor-pointer gap-0 py-3.5 transition-colors active:bg-muted/50"
                >
                  <CardContent className="px-4">
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <p className="flex items-center gap-1.5 font-medium">
                        <Icon
                          name={cat.icon}
                          className="size-4 text-muted-foreground"
                        />
                        {cat.label}
                      </p>
                      <p className="tabular-nums text-muted-foreground">
                        <span
                          className={
                            over
                              ? "font-semibold text-destructive"
                              : "font-semibold"
                          }
                        >
                          {formatBDT(spent)}
                        </span>{" "}
                        / {formatBDT(b.amount)}
                      </p>
                    </div>
                    <Progress
                      value={pct}
                      className={`h-1.5 ${
                        over
                          ? "**:data-[slot=progress-indicator]:bg-destructive"
                          : ""
                      }`}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Sheet
        open={recSheetOpen}
        onClose={() => setRecSheetOpen(false)}
        title={editingRec ? "Edit recurring item" : "New recurring item"}
      >
        <form onSubmit={recForm.handleSubmit(onSubmitRecurring)}>
          <FieldGroup className="gap-4">
            <Controller
              name="type"
              control={recForm.control}
              render={({ field }) => (
                <Field>
                  <div className="grid grid-cols-2 gap-2">
                    {(["bill", "income"] as RecurringType[]).map((t) => (
                      <Button
                        key={t}
                        type="button"
                        variant={field.value === t ? "default" : "outline"}
                        onClick={() => field.onChange(t)}
                        className="py-2.5"
                      >
                        <Icon name={t === "bill" ? "receipt" : "salary"} />
                        {t === "bill" ? "Bill" : "Income"}
                      </Button>
                    ))}
                  </div>
                </Field>
              )}
            />
            <Controller
              name="name"
              control={recForm.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="rec-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="rec-name"
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. Rent, Internet, Salary"
                    autoComplete="off"
                    className="h-10"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <div className="grid grid-cols-[1fr_7rem] gap-2">
              <Controller
                name="amount"
                control={recForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="rec-amount">Amount</FieldLabel>
                    <InputGroup className="h-10">
                      <InputGroupAddon>{CURRENCY_SYMBOL}</InputGroupAddon>
                      <InputGroupInput
                        {...field}
                        id="rec-amount"
                        aria-invalid={fieldState.invalid}
                        onChange={(e) =>
                          field.onChange(e.target.value.replace(/[^\d.]/g, ""))
                        }
                        inputMode="decimal"
                        placeholder="0"
                      />
                    </InputGroup>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="day"
                control={recForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="rec-day">Day of month</FieldLabel>
                    <Input
                      {...field}
                      id="rec-day"
                      aria-invalid={fieldState.invalid}
                      onChange={(e) =>
                        field.onChange(e.target.value.replace(/\D/g, ""))
                      }
                      inputMode="numeric"
                      placeholder="1"
                      className="h-10"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>
            {recForm.formState.errors.root && (
              <FieldError errors={[recForm.formState.errors.root]} />
            )}
            <Button
              type="submit"
              className="h-12 w-full text-base font-semibold"
            >
              {editingRec ? "Save changes" : "Add"}
            </Button>
            {editingRec && (
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  await deleteRecurringItem(editingRec.id);
                  setRecSheetOpen(false);
                }}
                className="w-full"
              >
                Delete
              </Button>
            )}
          </FieldGroup>
        </form>
      </Sheet>

      <Sheet
        open={budgetSheetOpen}
        onClose={() => setBudgetSheetOpen(false)}
        title="Category budget"
      >
        <form onSubmit={budgetForm.handleSubmit(onSubmitBudget)}>
          <FieldGroup className="gap-4">
            <Controller
              name="category"
              control={budgetForm.control}
              render={({ field }) => (
                <Field>
                  <div className="grid grid-cols-4 gap-2">
                    {EXPENSE_CATEGORIES.map((c) => (
                      <Button
                        key={c.id}
                        type="button"
                        variant={field.value === c.id ? "default" : "outline"}
                        onClick={() => {
                          field.onChange(c.id);
                          const existing = budgetByCategory.get(c.id);
                          budgetForm.setValue(
                            "amount",
                            existing ? String(existing) : "",
                          );
                        }}
                        className="h-auto flex-col gap-1 py-2 text-xs font-normal"
                      >
                        <Icon name={c.icon} className="size-4" />
                        {c.label}
                      </Button>
                    ))}
                  </div>
                </Field>
              )}
            />
            <Controller
              name="amount"
              control={budgetForm.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="budget-amount">
                    Monthly limit (0 to remove)
                  </FieldLabel>
                  <InputGroup className="h-10">
                    <InputGroupAddon>{CURRENCY_SYMBOL}</InputGroupAddon>
                    <InputGroupInput
                      {...field}
                      id="budget-amount"
                      aria-invalid={fieldState.invalid}
                      onChange={(e) =>
                        field.onChange(e.target.value.replace(/[^\d.]/g, ""))
                      }
                      inputMode="decimal"
                      placeholder="0"
                    />
                  </InputGroup>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            {budgetForm.formState.errors.root && (
              <FieldError errors={[budgetForm.formState.errors.root]} />
            )}
            <Button
              type="submit"
              className="h-12 w-full text-base font-semibold"
            >
              Save budget
            </Button>
          </FieldGroup>
        </form>
      </Sheet>
    </div>
  );
};

export default BudgetPage;
