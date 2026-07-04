"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import Sheet from "@/components/Sheet";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import {
  CURRENCY_SYMBOL,
  dateTimeInputToTs,
  tsToDateTimeInput,
} from "@/lib/format";
import { useAccounts, useTransaction } from "@/lib/hooks";
import { deleteTransaction, updateTransaction } from "@/lib/repo";
import { useUIStore } from "@/lib/store";
import type { Transaction } from "@/lib/types";

const TITLES: Record<Transaction["type"], string> = {
  income: "Edit income",
  expense: "Edit expense",
  withdrawal: "Edit cash out",
  borrow: "Edit borrow",
  repayment: "Edit repayment",
  transfer: "Edit transfer",
  adjustment: "Edit adjustment",
};

const DELETE_WARNINGS: Record<Transaction["type"], string> = {
  income: "This entry will be removed and its balance effect reversed.",
  expense: "This entry will be removed and its balance effect reversed.",
  withdrawal:
    "This deletes the withdrawal and everything recorded under it. The amount goes back to the account.",
  borrow:
    "This deletes the borrow, its spends, and its repayments. Repaid amounts go back to the accounts they were paid from.",
  repayment:
    "The money goes back to the account it was paid from, and the debt grows back.",
  transfer:
    "Both sides are reversed — the amount and any fee go back to the source account.",
  adjustment:
    "The adjustment is removed and the account balance moves back by the same amount.",
};

const editSchema = z.object({
  // Nonzero only — positivity is enforced per type by the repo (adjustments
  // are the one signed type).
  amount: z
    .string()
    .refine(
      (v) => Number.isFinite(Number(v)) && Number(v) !== 0,
      "Enter a valid amount",
    ),
  category: z.string(),
  purpose: z.string(),
  person: z.string(),
  fee: z
    .string()
    .refine(
      (v) => v.trim() === "" || (Number.isFinite(Number(v)) && Number(v) >= 0),
      "Fee must be a number",
    ),
  note: z.string(),
  date: z.string().min(1, "Pick a date"),
});

type EditFormValues = z.infer<typeof editSchema>;

interface EditFormProps {
  txn: Transaction;
  onDone: () => void;
}

const EditEntryForm = ({ txn, onDone }: EditFormProps) => {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const accounts = useAccounts();
  const accountName = accounts?.find((a) => a.id === txn.accountId)?.name;

  const isCategoryType = txn.type === "expense" || txn.type === "income";
  const isPurposeType = txn.type === "withdrawal" || txn.type === "borrow";
  const categories =
    txn.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      amount: String(txn.amount),
      category: isCategoryType ? txn.category : "",
      purpose: isPurposeType ? txn.category : "",
      person: txn.person ?? "",
      fee: txn.fee ? String(txn.fee) : "",
      note: txn.note,
      date: tsToDateTimeInput(txn.date),
    },
  });

  const onSubmit = async (values: EditFormValues) => {
    try {
      const patch: Parameters<typeof updateTransaction>[1] = {
        amount: Number(values.amount),
        note: values.note,
        date: dateTimeInputToTs(values.date),
      };
      if (isCategoryType) {
        if (!values.category) {
          form.setError("category", { message: "Pick a category" });
          return;
        }
        patch.category = values.category;
      }
      if (isPurposeType && values.purpose.trim()) {
        patch.category = values.purpose.trim();
      }
      if (txn.type === "borrow") {
        if (!values.person.trim()) {
          form.setError("person", { message: "Who lent you the money?" });
          return;
        }
        patch.person = values.person.trim();
      }
      if (txn.type === "transfer" || txn.type === "withdrawal") {
        patch.fee = Number(values.fee || "0");
      }
      await updateTransaction(txn.id, patch);
      onDone();
    } catch (e) {
      form.setError("root", {
        message: e instanceof Error ? e.message : "Could not save",
      });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup className="gap-4">
        {txn.type === "adjustment" && accountName && (
          <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
            {txn.category} · <span className="text-foreground">{accountName}</span>
          </p>
        )}
        <Controller
          name="amount"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="edit-amount">Amount</FieldLabel>
              <InputGroup className="h-10">
                <InputGroupAddon>{CURRENCY_SYMBOL}</InputGroupAddon>
                <InputGroupInput
                  {...field}
                  id="edit-amount"
                  aria-invalid={fieldState.invalid}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value.replace(
                        // Adjustments are signed — allow a leading minus.
                        txn.type === "adjustment" ? /[^\d.-]/g : /[^\d.]/g,
                        "",
                      ),
                    )
                  }
                  inputMode="decimal"
                />
              </InputGroup>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {isCategoryType && (
          <Controller
            name="category"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Category</FieldLabel>
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
        )}

        {txn.type === "borrow" && (
          <Controller
            name="person"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="edit-person">Lent by</FieldLabel>
                <Input
                  {...field}
                  id="edit-person"
                  aria-invalid={fieldState.invalid}
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

        {isPurposeType && (
          <Controller
            name="purpose"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="edit-purpose">Purpose</FieldLabel>
                <Input
                  {...field}
                  id="edit-purpose"
                  autoComplete="off"
                  className="h-10"
                />
              </Field>
            )}
          />
        )}

        {(txn.type === "transfer" || txn.type === "withdrawal") && (
          <Controller
            name="fee"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="edit-fee">Fee</FieldLabel>
                <InputGroup className="h-10">
                  <InputGroupAddon>{CURRENCY_SYMBOL}</InputGroupAddon>
                  <InputGroupInput
                    {...field}
                    id="edit-fee"
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
        )}

        <Controller
          name="note"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="edit-note">Note</FieldLabel>
              <Input
                {...field}
                id="edit-note"
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
              <FieldLabel>Date &amp; time</FieldLabel>
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

        {form.formState.errors.root && (
          <FieldError errors={[form.formState.errors.root]} />
        )}
        <Button type="submit" className="h-12 w-full text-base font-semibold">
          Save changes
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setConfirmingDelete(true)}
          className="w-full"
        >
          Delete entry
        </Button>
      </FieldGroup>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this entry?"
        description={DELETE_WARNINGS[txn.type]}
        onConfirm={async () => {
          await deleteTransaction(txn.id);
          setConfirmingDelete(false);
          onDone();
        }}
      />
    </form>
  );
};

/** Global edit sheet — open it from anywhere via useUIStore().openEditEntry(id). */
const EditEntry = () => {
  const editEntryId = useUIStore((s) => s.editEntryId);
  const closeEditEntry = useUIStore((s) => s.closeEditEntry);
  const txn = useTransaction(editEntryId);

  return (
    <Sheet
      open={editEntryId !== null}
      onClose={closeEditEntry}
      title={txn ? TITLES[txn.type] : "Edit entry"}
    >
      {txn && <EditEntryForm key={txn.id} txn={txn} onDone={closeEditEntry} />}
    </Sheet>
  );
};

export default EditEntry;
