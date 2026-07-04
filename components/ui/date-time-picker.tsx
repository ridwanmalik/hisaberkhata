"use client"

import { Icon } from "@/components/Icon"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useEffect, useMemo, useRef, useState } from "react"
import type { Matcher } from "react-day-picker"

/**
 * Ported from scouty-desktop-v2, minus moment.js (native Date instead) and
 * the constraint props this app doesn't use (disableBefore/After,
 * disabledDates, timezone, displayFormat).
 */

type Period = "AM" | "PM"
type Tab = "date" | "time"

interface DateTimePickerProps {
  /** Controlled value, always "YYYY-MM-DD HH:mm" (or "" when empty). */
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  /** Hide the Time tab and pick a date only. */
  dateOnly?: boolean
  /** Minutes granularity for the time column (default 5). */
  minuteStep?: number
  disabled?: boolean
  /** Show a clear (×) button when there is a value. */
  showClear?: boolean
  error?: boolean
  className?: string
  disablePastDates?: boolean
  disableFutureDates?: boolean
}

const pad = (n: number) => String(n).padStart(2, "0")

const parseValue = (v: string | undefined): Date | null => {
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(v)
  if (!m) return null
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  return Number.isNaN(d.getTime()) ? null : d
}

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const to24 = (hour12: number, period: Period) =>
  period === "AM" ? (hour12 === 12 ? 0 : hour12) : hour12 === 12 ? 12 : hour12 + 12

const from24 = (hour24: number): { hour12: number; period: Period } => ({
  hour12: hour24 % 12 === 0 ? 12 : hour24 % 12,
  period: hour24 >= 12 ? "PM" : "AM",
})

const buildDate = (dateStr: string, hour12: number, minute: number, period: Period) => {
  const [y, mo, d] = dateStr.split("-").map(Number)
  return new Date(y, mo - 1, d, to24(hour12, period), minute)
}

const formatDisplay = (d: Date, dateOnly: boolean) => {
  const date = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  if (dateOnly) return date
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
  return `${date} · ${time}`
}

export const DateTimePicker = ({
  value,
  onChange,
  placeholder = "Select date and time",
  dateOnly = false,
  minuteStep = 5,
  disabled = false,
  showClear = true,
  error = false,
  className,
  disablePastDates = false,
  disableFutureDates = false,
}: DateTimePickerProps) => {
  const [open, setOpen] = useState(false)
  // Snapshot of "now" for past/future checks — the React Compiler purity
  // rule forbids Date.now() during render. Refreshed on every open.
  const [now, setNow] = useState(() => Date.now())
  const [activeTab, setActiveTab] = useState<Tab>("date")
  const [selectedDate, setSelectedDate] = useState("")
  const [hour12, setHour12] = useState(12)
  const [minute, setMinute] = useState(0)
  const [period, setPeriod] = useState<Period>("AM")
  const [displayMonth, setDisplayMonth] = useState<Date>(() => new Date())

  const hourSelRef = useRef<HTMLButtonElement>(null)
  const minuteSelRef = useRef<HTMLButtonElement>(null)
  const periodSelRef = useRef<HTMLButtonElement>(null)

  const hours = useMemo(
    () => Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i)),
    [],
  )
  const minutes = useMemo(
    () => Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) => i * minuteStep),
    [minuteStep],
  )
  const periods: Period[] = ["AM", "PM"]

  // ── disabling logic ──────────────────────────────────────────────────
  const isTimeDisabled = (dateStr: string, h12: number, min: number, p: Period) => {
    if (!dateStr) return false
    const t = buildDate(dateStr, h12, min, p).getTime()
    if (disablePastDates && t < now) return true
    if (disableFutureDates && t > now) return true
    return false
  }

  const isHourDisabled = (dateStr: string, h12: number, p: Period) =>
    minutes.every((m) => isTimeDisabled(dateStr, h12, m, p))
  const isPeriodDisabled = (dateStr: string, p: Period) =>
    hours.every((h) => minutes.every((m) => isTimeDisabled(dateStr, h, m, p)))

  /** Move the time onto the first valid slot for a date if the current one is blocked. */
  const ensureValidTime = (dateStr: string, h12: number, min: number, p: Period) => {
    if (!isTimeDisabled(dateStr, h12, min, p)) return { hour12: h12, minute: min, period: p }
    for (const pp of periods) {
      for (const h of hours) {
        for (const m of minutes) {
          if (!isTimeDisabled(dateStr, h, m, pp)) return { hour12: h, minute: m, period: pp }
        }
      }
    }
    return { hour12: h12, minute: min, period: p }
  }

  const startOfToday = () => {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const isDayDisabled = (date: Date) => {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    if (disablePastDates && d < startOfToday()) return true
    if (disableFutureDates && d > startOfToday()) return true
    return false
  }

  const disabledMatchers = useMemo<Matcher[]>(() => {
    const m: Matcher[] = []
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    if (disablePastDates) m.push({ before: today })
    if (disableFutureDates) m.push({ after: today })
    return m
  }, [disablePastDates, disableFutureDates, now])

  // ── open: seed picker state from the current value ───────────────────
  const openPicker = () => {
    setNow(Date.now())
    const parsed = parseValue(value)
    const seed = parsed ?? new Date()
    const dateStr = toDateStr(seed)
    const { hour12: h, period: p } = from24(seed.getHours())
    const min = parsed
      ? seed.getMinutes()
      : Math.floor(seed.getMinutes() / minuteStep) * minuteStep
    const valid = ensureValidTime(dateStr, h, min, p)
    setSelectedDate(dateStr)
    setDisplayMonth(seed)
    setHour12(valid.hour12)
    setMinute(valid.minute)
    setPeriod(valid.period)
    setActiveTab("date")
    setOpen(true)
  }

  // ── center the selected time items when the Time tab is shown ────────
  useEffect(() => {
    if (!open || activeTab !== "time") return
    const id = setTimeout(() => {
      const opts: ScrollIntoViewOptions = { block: "center" }
      hourSelRef.current?.scrollIntoView(opts)
      minuteSelRef.current?.scrollIntoView(opts)
      periodSelRef.current?.scrollIntoView(opts)
    }, 30)
    return () => clearTimeout(id)
  }, [open, activeTab, hour12, minute, period])

  // ── handlers ─────────────────────────────────────────────────────────
  const selectDate = (date?: Date) => {
    if (!date) return
    const dateStr = toDateStr(date)
    setSelectedDate(dateStr)
    const valid = ensureValidTime(dateStr, hour12, minute, period)
    setHour12(valid.hour12)
    setMinute(valid.minute)
    setPeriod(valid.period)
  }

  const selectToday = () => {
    const today = new Date()
    if (isDayDisabled(today)) return
    const dateStr = toDateStr(today)
    setSelectedDate(dateStr)
    setDisplayMonth(today)
    const valid = ensureValidTime(dateStr, hour12, minute, period)
    setHour12(valid.hour12)
    setMinute(valid.minute)
    setPeriod(valid.period)
  }

  const headerLabel = selectedDate
    ? formatDisplay(buildDate(selectedDate, hour12, minute, period), dateOnly)
    : placeholder

  const parsedValue = parseValue(value)
  const triggerLabel = parsedValue ? formatDisplay(parsedValue, dateOnly) : ""

  const done = () => {
    if (selectedDate) {
      onChange?.(`${selectedDate} ${pad(to24(hour12, period))}:${pad(minute)}`)
    }
    setOpen(false)
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange?.("")
  }

  const todayDisabled = isDayDisabled(new Date(now))

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        className={cn(
          "flex h-10 w-full items-center rounded-md border bg-transparent px-3 text-left text-sm shadow-xs transition-colors",
          error ? "border-destructive" : "border-input hover:border-primary/60",
          disabled && "cursor-not-allowed opacity-60",
          className,
        )}
      >
        <span
          className={cn(
            "flex-1 truncate",
            triggerLabel ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {triggerLabel || placeholder}
        </span>
        {showClear && triggerLabel ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={clear}
            className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Icon name="close" size={16} />
          </span>
        ) : (
          <Icon
            name="calendar"
            size={16}
            className="ml-2 shrink-0 text-muted-foreground"
          />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-80">
          {/* Header */}
          <div className="px-5 pt-5 text-center">
            <DialogTitle className="text-base font-semibold">
              {headerLabel}
            </DialogTitle>
          </div>

          {/* Tabs */}
          {!dateOnly && (
            <div className="mt-4 flex">
              {(["date", "time"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 border-b-2 pb-2 text-sm font-medium capitalize transition-colors",
                    activeTab === tab
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* Body */}
          <div className="min-h-[360px] flex-1 overflow-y-auto">
            {dateOnly || activeTab === "date" ? (
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={
                    selectedDate
                      ? buildDate(selectedDate, hour12, minute, period)
                      : undefined
                  }
                  month={displayMonth}
                  onMonthChange={setDisplayMonth}
                  onSelect={selectDate}
                  captionLayout="label"
                  disabled={disabledMatchers}
                  // Always render 6 weeks so the last row never drops and
                  // the dialog height doesn't jump between months.
                  fixedWeeks
                  showOutsideDays
                  className="bg-transparent [--cell-size:--spacing(10)]"
                />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-px px-1 py-2">
                {/* Hours */}
                <TimeColumn>
                  {hours.map((h) => {
                    const off = isHourDisabled(selectedDate, h, period)
                    const active = hour12 === h
                    return (
                      <TimeItem
                        key={h}
                        ref={active ? hourSelRef : undefined}
                        active={active}
                        disabled={off}
                        onClick={() => !off && setHour12(h)}
                      >
                        {h}
                      </TimeItem>
                    )
                  })}
                </TimeColumn>

                {/* Minutes */}
                <TimeColumn className="rounded-lg bg-muted/40">
                  {minutes.map((m) => {
                    const off = isTimeDisabled(selectedDate, hour12, m, period)
                    const active = minute === m
                    return (
                      <TimeItem
                        key={m}
                        ref={active ? minuteSelRef : undefined}
                        active={active}
                        disabled={off}
                        onClick={() => !off && setMinute(m)}
                      >
                        {String(m).padStart(2, "0")}
                      </TimeItem>
                    )
                  })}
                </TimeColumn>

                {/* AM / PM */}
                <TimeColumn>
                  {periods.map((p) => {
                    const off = isPeriodDisabled(selectedDate, p)
                    const active = period === p
                    return (
                      <TimeItem
                        key={p}
                        ref={active ? periodSelRef : undefined}
                        active={active}
                        disabled={off}
                        onClick={() => !off && setPeriod(p)}
                      >
                        {p}
                      </TimeItem>
                    )
                  })}
                </TimeColumn>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="flex-row items-center justify-between border-t px-6 pt-4 pb-7 sm:justify-between">
            {dateOnly || activeTab === "date" ? (
              <Button
                variant="ghost"
                onClick={selectToday}
                disabled={todayDisabled}
                className="text-primary"
              >
                Today
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={done} disabled={!selectedDate} className="px-6">
                Done
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── time column primitives ─────────────────────────────────────────────
const TimeColumn = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => (
  <div
    className={cn(
      "flex h-[340px] flex-col gap-1 overflow-y-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      className,
    )}
  >
    {children}
  </div>
)

interface TimeItemProps {
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
  ref?: React.Ref<HTMLButtonElement>
}

const TimeItem = ({ ref, active, disabled, onClick, children }: TimeItemProps) => (
  <button
    ref={ref}
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "shrink-0 rounded-md py-2 text-center text-sm font-medium transition-colors",
      active
        ? "bg-primary text-primary-foreground"
        : "text-foreground hover:bg-muted",
      disabled && "opacity-30 hover:bg-transparent",
    )}
  >
    {children}
  </button>
)
