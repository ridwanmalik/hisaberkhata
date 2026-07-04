"use client"

import ConfirmDialog from "@/components/ConfirmDialog"
import { Icon, type IconName } from "@/components/Icon"
import Sheet from "@/components/Sheet"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { CURRENCY_SYMBOL, formatBDT } from "@/lib/format"
import { useAccounts, useContainers } from "@/lib/hooks"
import { addAccount, addLinkedCard, deleteAccount, removeLinkedCard, updateAccount } from "@/lib/repo"
import { ROUTES } from "@/lib/routes"
import type { Account, AccountType } from "@/lib/types"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import * as z from "zod"

const TYPE_META: Record<AccountType, { label: string; icon: IconName }> = {
  bank: { label: "Bank", icon: "bank" },
  mfs: { label: "Mobile wallet", icon: "mfs" },
  cash: { label: "Cash in hand", icon: "cash" },
  credit: { label: "Credit card", icon: "card" },
}

/** Debit cards attach to accounts that actually hold money at a bank. */
const canLinkCards = (type: AccountType) => type === "bank" || type === "mfs"

const isBlankOrNumber = (v: string) => v.trim() === "" || Number.isFinite(Number(v))

const accountSchema = z.object({
  name: z.string().trim().min(1, "Give the account a name"),
  type: z.enum(["bank", "mfs", "cash", "credit"]),
  balance: z.string().refine(isBlankOrNumber, "Balance must be a number"),
  last4: z.string().refine(v => v === "" || /^\d{4}$/.test(v), "Use the card's 4 digits"),
  creditLimit: z.string().refine(isBlankOrNumber, "Credit limit must be a number"),
})

type AccountFormValues = z.infer<typeof accountSchema>

const cardSchema = z.object({
  label: z.string().trim().min(1, "Give the card a name (e.g. VISA Debit)"),
  last4: z.string().refine(v => v === "" || /^\d{4}$/.test(v), "Use the card's 4 digits"),
})

type CardFormValues = z.infer<typeof cardSchema>

const emptyAccount: AccountFormValues = {
  name: "",
  type: "bank",
  balance: "",
  last4: "",
  creditLimit: "",
}

const AccountsPage = () => {
  const accounts = useAccounts()
  const containers = useContainers()
  const cashInHand = (containers ?? []).reduce((sum, c) => sum + c.remainder, 0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: emptyAccount,
  })
  const cardForm = useForm<CardFormValues>({
    resolver: zodResolver(cardSchema),
    defaultValues: { label: "", last4: "" },
  })

  const type = useWatch({ control: form.control, name: "type" })

  // The editing snapshot goes stale after card changes — always render the
  // live row from the query.
  const current = accounts?.find(a => a.id === editing?.id) ?? editing

  const openAdd = () => {
    setEditing(null)
    form.reset(emptyAccount)
    cardForm.reset()
    setSheetOpen(true)
  }

  const openEdit = (account: Account) => {
    setEditing(account)
    form.reset({
      name: account.name,
      type: account.type,
      balance: String(account.balance),
      last4: account.last4 ?? "",
      creditLimit: account.creditLimit ? String(account.creditLimit) : "",
    })
    cardForm.reset()
    setSheetOpen(true)
  }

  const onSubmit = async (values: AccountFormValues) => {
    const isCredit = values.type === "credit"
    const parsedLimit = Number(values.creditLimit)
    const payload = {
      name: values.name.trim(),
      type: values.type,
      balance: Number(values.balance || "0"),
      last4: isCredit && values.last4 ? values.last4 : undefined,
      creditLimit: isCredit && parsedLimit > 0 ? parsedLimit : undefined,
    }
    try {
      if (editing) {
        await updateAccount(editing.id, payload)
      } else {
        const { name, type: accountType, balance, ...extras } = payload
        await addAccount(name, accountType, balance, extras)
      }
      setSheetOpen(false)
    } catch (e) {
      form.setError("root", {
        message: e instanceof Error ? e.message : "Could not save",
      })
    }
  }

  const onLinkCard = async (values: CardFormValues) => {
    if (!editing) return
    try {
      await addLinkedCard(editing.id, values.label.trim(), values.last4 || undefined)
      cardForm.reset()
    } catch (e) {
      cardForm.setError("root", {
        message: e instanceof Error ? e.message : "Could not link the card",
      })
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Accounts</h1>
        <Button onClick={openAdd}>+ Add</Button>
      </header>

      {accounts?.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No accounts yet. Add your bank, mobile wallet, credit card, or a cash-in-hand account to get started.
        </p>
      )}

      <div className="space-y-2">
        {cashInHand > 0 && (
          <Card className="border-dashed py-4">
            <CardContent className="flex items-center gap-3 px-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon name="cash" className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">Cash in hand</p>
                <p className="text-xs text-muted-foreground">Unspent cash from cash-outs &amp; borrows</p>
              </div>
              <p className="font-bold tabular-nums">{formatBDT(cashInHand)}</p>
            </CardContent>
          </Card>
        )}
        {(accounts ?? []).map(a => {
          const hasCardFace = a.type === "credit" || (a.cards ?? []).length > 0
          return (
            <Card
              key={a.id}
              onClick={() => openEdit(a)}
              className={`cursor-pointer py-4 transition-colors active:bg-muted/50 ${hasCardFace ? "aspect-[1.71/1]" : ""}`}>
              <CardContent className="flex flex-1 flex-col px-6 py-4">
                {hasCardFace && (
                  <div className="flex flex-1 items-end">
                    <p className="mb-8 truncate text-xl font-medium">
                      <span className="text-muted-foreground">⬤⬤⬤⬤ ⬤⬤⬤⬤ ⬤⬤⬤⬤ </span>
                      {a.type === "credit" ? a.last4 : a.cards?.[0]?.last4}
                    </p>
                  </div>
                )}
                <div className="flex gap-10">
                  <div className="min-w-0">
                    <p className="text-muted-foreground">{TYPE_META[a.type].label}</p>
                    <p className="truncate font-medium">{a.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Balance</p>
                    <p
                      className={`font-bold tabular-nums ${a.type === "credit" && a.balance < 0 ? "text-destructive" : ""}`}>
                      {formatBDT(a.balance)}
                      {a.type === "credit" && a.balance < 0 && <span className="ml-1 text-xs font-normal">due</span>}
                    </p>
                  </div>
                  <div className="ml-auto">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon name={TYPE_META[a.type].icon} className="size-5" />
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={editing ? "Edit account" : "New account"}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup className="gap-4">
            {editing && (
              <Button type="button" variant="outline" asChild className="w-full">
                <Link href={ROUTES.accountStatement(editing.id)}>
                  <Icon name="history" /> View statement
                </Link>
              </Button>
            )}
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. DBBL, bKash, City Amex"
                    autoComplete="off"
                    className="h-10"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="type"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Type</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(TYPE_META) as AccountType[]).map(t => (
                      <Button
                        key={t}
                        type="button"
                        variant={field.value === t ? "default" : "outline"}
                        onClick={() => field.onChange(t)}
                        className="h-auto flex-col gap-1.5 whitespace-normal py-4 text-sm">
                        <Icon name={TYPE_META[t].icon} className="size-6" />
                        {TYPE_META[t].label}
                      </Button>
                    ))}
                  </div>
                </Field>
              )}
            />

            <Controller
              name="balance"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    {type === "credit" ? "Balance (dues as negative, e.g. -2000)" : "Balance"}
                  </FieldLabel>
                  <InputGroup className="h-10">
                    <InputGroupAddon>{CURRENCY_SYMBOL}</InputGroupAddon>
                    <InputGroupInput
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      onChange={e => field.onChange(e.target.value.replace(/[^\d.-]/g, ""))}
                      inputMode="decimal"
                      placeholder={editing ? "0" : "Opening balance (0 is fine)"}
                    />
                  </InputGroup>
                  <p className="text-xs text-muted-foreground">
                    {editing
                      ? "Changing this is saved as a dated adjustment entry."
                      : "Saved as an “Opening balance” entry you can edit later."}
                  </p>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            {type === "credit" && (
              <div className="grid grid-cols-2 gap-2">
                <Controller
                  name="last4"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>Last 4 digits</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                        onChange={e => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        inputMode="numeric"
                        placeholder="e.g. 7710"
                        className="h-10"
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="creditLimit"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>Credit limit</FieldLabel>
                      <InputGroup className="h-10">
                        <InputGroupAddon>{CURRENCY_SYMBOL}</InputGroupAddon>
                        <InputGroupInput
                          {...field}
                          id={field.name}
                          aria-invalid={fieldState.invalid}
                          onChange={e => field.onChange(e.target.value.replace(/[^\d.]/g, ""))}
                          inputMode="decimal"
                          placeholder="e.g. 50000"
                        />
                      </InputGroup>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </div>
            )}

            {editing && canLinkCards(type) && (
              <div className="space-y-2 rounded-xl border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Linked debit cards</p>
                {(current?.cards ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No cards linked yet. A debit card spends from this account — it&apos;s not a separate balance.
                  </p>
                )}
                {(current?.cards ?? []).map(c => (
                  <div key={c.id} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-sm">
                    <Icon name="card" className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {c.label}
                      {c.last4 && <span className="text-muted-foreground"> ••{c.last4}</span>}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove ${c.label}`}
                      onClick={() => removeLinkedCard(editing.id, c.id)}
                      className="text-muted-foreground hover:text-destructive">
                      <Icon name="close" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Controller
                    name="label"
                    control={cardForm.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid} className="flex-1 gap-1">
                        <Input
                          {...field}
                          aria-invalid={fieldState.invalid}
                          placeholder="Card name (e.g. VISA Debit)"
                          autoComplete="off"
                          className="h-9"
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                  <Controller
                    name="last4"
                    control={cardForm.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid} className="w-20 gap-1">
                        <Input
                          {...field}
                          aria-invalid={fieldState.invalid}
                          onChange={e => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          inputMode="numeric"
                          placeholder="Last 4"
                          aria-label="Last 4 digits"
                          className="h-9"
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                </div>
                {cardForm.formState.errors.root && <FieldError errors={[cardForm.formState.errors.root]} />}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={cardForm.handleSubmit(onLinkCard)}
                  className="w-full">
                  <Icon name="card" /> Link this card
                </Button>
              </div>
            )}

            {form.formState.errors.root && <FieldError errors={[form.formState.errors.root]} />}
            <Button type="submit" className="h-12 w-full text-base font-semibold">
              {editing ? "Save changes" : "Add account"}
            </Button>
            {editing && (
              <Button type="button" variant="destructive" onClick={() => setConfirmingDelete(true)} className="w-full">
                Delete account
              </Button>
            )}
          </FieldGroup>
        </form>
      </Sheet>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete "${editing?.name}"?`}
        description="Every transaction recorded on this account will be deleted too. This cannot be undone."
        onConfirm={async () => {
          if (editing) await deleteAccount(editing.id)
          setConfirmingDelete(false)
          setSheetOpen(false)
        }}
      />
    </div>
  )
}

export default AccountsPage
