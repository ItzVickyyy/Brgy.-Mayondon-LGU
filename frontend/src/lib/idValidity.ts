// The default "Valid until" date of a Barangay ID (patch 61).
//
// A regular resident gets 12 months. A new or renting resident gets 6 months
// until proof of voter registration is verified (the server works this out and
// sends `idValidityMonths`). A replacement keeps the validity of the card it
// replaces, unless that card has already run out. This only fills in the date
// box; staff can change it, and an ID that is already issued never changes.

export type IdValidityResident = {
  idValidityMonths?: 6 | 12
  idValidUntil?: string
}

export type IdValidityRule = "months" | "replacement"

/** Same rule as the server: whole months, the day clamped to the month end. */
export function addMonthsIso(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  const index = month - 1 + months
  const targetYear = year + Math.floor(index / 12)
  const targetMonth = ((index % 12) + 12) % 12
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(Math.min(day, lastDay))}`
}

export function defaultIdValidUntil(
  issueDate: string,
  transactionType: string,
  resident?: IdValidityResident | null,
): { date: string; rule: IdValidityRule; months: 6 | 12 } {
  const months = resident?.idValidityMonths ?? 12
  if (
    transactionType === "replacement" &&
    resident?.idValidUntil &&
    resident.idValidUntil > issueDate
  ) {
    return { date: resident.idValidUntil, rule: "replacement", months }
  }
  return { date: addMonthsIso(issueDate, months), rule: "months", months }
}

/** Which short note, if any, goes under the "Valid until" box. */
export function idValidityNoteKey(
  issueDate: string,
  transactionType: string,
  resident?: IdValidityResident | null,
):
  | "issuances.new.validityNote.sixMonths"
  | "issuances.new.validityNote.replacement"
  | null {
  if (!resident) return null
  const result = defaultIdValidUntil(issueDate, transactionType, resident)
  if (result.rule === "replacement")
    return "issuances.new.validityNote.replacement"
  return result.months === 6 ? "issuances.new.validityNote.sixMonths" : null
}
