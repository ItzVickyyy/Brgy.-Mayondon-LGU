import type { TFunction } from "i18next"

import type { ResidentDeathPublic } from "@/client"
import { formatLocaleDate } from "@/lib/locale"
import { formatBusinessDate } from "@/lib/residents"

export type DeathPrecision = ResidentDeathPublic["date_precision"]
export type DeathEvidence = ResidentDeathPublic["evidence"]

export const deathPrecisions: DeathPrecision[] = [
  "day",
  "month",
  "year",
  "unknown",
]
export const deathEvidences: DeathEvidence[] = ["reported", "verified"]

/** The date of death as far as it is known: a day, a month, a year or "not known". */
export function deathDateText(
  death: Pick<ResidentDeathPublic, "date_of_death" | "date_precision">,
  t: TFunction,
) {
  if (death.date_precision === "unknown" || !death.date_of_death) {
    return t("records.death.dateUnknown")
  }
  const [year, month] = death.date_of_death.split("-").map(Number)
  if (death.date_precision === "year") return String(year)
  if (death.date_precision === "month") {
    return formatLocaleDate(new Date(year, month - 1, 1), {
      month: "long",
      year: "numeric",
    })
  }
  return formatBusinessDate(death.date_of_death)
}

/** Today in Manila as YYYY-MM-DD. */
export function todayManila() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
}

/** What the date box holds for a stored date: the day, `YYYY-MM`, `YYYY` or empty. */
export function dateBoxValue(
  precision: DeathPrecision,
  stored: string | null | undefined,
) {
  if (!stored || precision === "unknown") return ""
  if (precision === "month") return stored.slice(0, 7)
  if (precision === "year") return stored.slice(0, 4)
  return stored
}

/** The date sent to the server for what the date box holds (the first day of a month or year). */
export function dateToSend(precision: DeathPrecision, value: string) {
  if (precision === "unknown") return null
  if (precision === "month") return `${value}-01`
  if (precision === "year") return `${value}-01-01`
  return value
}

export type DeathDateError =
  | "dateRequired"
  | "dateFormat"
  | "dateFuture"
  | "dateTooOld"
  | "beforeBirth"

/**
 * The same date rules the server applies (patch 327), so a mistake shows before
 * saving. The server still decides; its message is shown if it disagrees.
 */
export function deathDateError(
  precision: DeathPrecision,
  value: string,
  birthdate: string | null | undefined,
): DeathDateError | null {
  if (precision === "unknown") return null
  if (!value) return "dateRequired"
  const shape =
    precision === "day"
      ? /^\d{4}-\d{2}-\d{2}$/
      : precision === "month"
        ? /^\d{4}-\d{2}$/
        : /^\d{4}$/
  if (!shape.test(value)) return "dateFormat"
  const today = todayManila()
  const cut = precision === "day" ? 10 : precision === "month" ? 7 : 4
  if (value > today.slice(0, cut)) return "dateFuture"
  if (Number(value.slice(0, 4)) < 1900) return "dateTooOld"
  if (birthdate && value < birthdate.slice(0, cut)) return "beforeBirth"
  return null
}
