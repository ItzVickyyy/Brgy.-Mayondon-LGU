/**
 * Helpers for the monthly Certificate of Utilization (the LSPU extension program asks the barangay for
 * one every month). Pure functions only, so the wording and the month list are easy to test.
 */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

/** Today's year and month in Philippine time (the office clock, whatever the computer's zone is). */
export function manilaYearMonth(now: Date = new Date()): {
  year: number
  month: number
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now)
  const pick = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value)
  return { year: pick("year"), month: pick("month") }
}

/** "2026-11" */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`
}

/** "November" (month is 1 to 12). */
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? ""
}

/** "2026-11" -> { year: 2026, month: 11 } */
export function parseMonthKey(key: string): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number)
  return { year: year ?? 0, month: month ?? 0 }
}

/** "2026-11" -> "November 2026" */
export function monthLabel(key: string): string {
  const { year, month } = parseMonthKey(key)
  return `${monthName(month)} ${year}`
}

/** This month first, then the 11 before it, newest to oldest. */
export function recentMonths(now: Date = new Date(), count = 12): string[] {
  const { year, month } = manilaYearMonth(now)
  const keys: string[] = []
  for (let back = 0; back < count; back += 1) {
    const index = year * 12 + (month - 1) - back
    keys.push(monthKey(Math.floor(index / 12), (index % 12) + 1))
  }
  return keys
}

/** "HON. DANILO V. APOLINARIO": the name as the certificate prints it. Blank when nobody is set. */
export function signatoryLine(name: string | null | undefined): string {
  const clean = (name ?? "").trim().replace(/\s+/g, " ")
  if (!clean) return ""
  const upper = clean.toUpperCase()
  return /^HON\.?\s/.test(upper) ? upper : `HON. ${upper}`
}
