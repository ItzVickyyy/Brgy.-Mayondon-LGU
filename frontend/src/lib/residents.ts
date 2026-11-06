import { AxiosError } from "axios"

import type { LookupItem, ResidentPublic } from "@/client"

export const civilStatuses = [
  "Single",
  "Married",
  "Legally Separated",
  "Widow/Widower",
] as const

export const suffixes = ["Jr.", "Sr.", "II", "III", "IV", "V"] as const

// What "resident type" means is still an open question (D-48); the column is free text.
export const residentTypes = ["Existing resident", "New / renting resident"]

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
})

// "2026-12-06" is a business date, not a moment: format it without time zones.
export function formatBusinessDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return dateFormat.format(new Date(year, month - 1, day))
}

export function streetNameMap(streets: LookupItem[] | undefined) {
  return new Map((streets ?? []).map((street) => [street.id, street.name]))
}

/** "12 Rizal St, Purok 3", leaving out whatever is not on the record. */
export function residentAddress(
  resident: ResidentPublic,
  streets: Map<number, string>,
) {
  const street = resident.street_id ? streets.get(resident.street_id) : null
  const line = [resident.house_number, street].filter(Boolean).join(" ")
  return [line, resident.purok ? `Purok ${resident.purok}` : ""]
    .filter(Boolean)
    .join(", ")
}

export type ApiError = {
  /** `detail.code` for the structured 409/422 answers, such as "possible_duplicate". */
  code: string | null
  message: string
  /** The whole `detail` from the API (for example the `sections` list), when there is one. */
  detail?: unknown
}

/** Reads the FastAPI error body into a code and a sentence a clerk can read. */
export function readApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)
      ?.detail
    if (typeof detail === "string") return { code: null, message: detail }
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string; loc?: unknown[] }
      const field = Array.isArray(first.loc)
        ? first.loc[first.loc.length - 1]
        : null
      return {
        code: null,
        message: field ? `${String(field)}: ${first.msg}` : String(first.msg),
      }
    }
    if (detail && typeof detail === "object") {
      const code = (detail as { code?: unknown }).code
      return {
        detail,
        code: typeof code === "string" ? code : null,
        message:
          typeof code === "string"
            ? code.replace(/_/g, " ")
            : "Request failed.",
      }
    }
    if (error.response?.status === 403)
      return { code: null, message: "You do not have permission to do that." }
    return { code: null, message: error.message }
  }
  return { code: null, message: "Something went wrong." }
}
