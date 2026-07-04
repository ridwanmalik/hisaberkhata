const bdtFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

/**
 * The one place the currency symbol is defined. Change it here (e.g. to
 * "BDT ") and every amount and input prefix in the app follows.
 */
export const CURRENCY_SYMBOL = "৳"

/** Formats an amount as BDT with lakh/crore digit grouping, e.g. ৳ 1,50,000. */
export const formatBDT = (amount: number): string => {
  const sign = amount < 0 ? "−" : ""
  //   = non-breaking space, so symbol and number never wrap apart.
  return `${CURRENCY_SYMBOL} ${sign}${bdtFormatter.format(Math.abs(amount))}`
}

export const formatDate = (ts: number): string => {
  const d = new Date(ts)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  })
}

export const formatMonth = (year: number, month: number): string =>
  new Date(year, month, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  })

/** [start, end) epoch ms range for a calendar month. month is 0-based. */
export const monthRange = (year: number, month: number): [number, number] => [
  new Date(year, month, 1).getTime(),
  new Date(year, month + 1, 1).getTime(),
]

/** Converts a date input value (yyyy-mm-dd) to epoch ms at local noon. */
export const dateInputToTs = (value: string): number => {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d, 12).getTime()
}

export const tsToDateInput = (ts: number): string => {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
