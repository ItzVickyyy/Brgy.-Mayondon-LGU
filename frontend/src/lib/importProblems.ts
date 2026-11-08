import type { TFunction } from "i18next"

/**
 * Row problems come from the server in English (`masterlist_import.py` and the
 * resident field rules). The known ones are shown in the chosen language; any
 * other text is shown as the server sent it. The downloaded problem report
 * stays English.
 */
export function importProblemText(message: string, t: TFunction): string {
  const fixed: Record<string, string> = {
    "Street is not in the streets list": t(
      "records.import.problems.streetUnknown",
    ),
    "Date not recognised": t("records.import.problems.dateUnknown"),
    "ID number appears twice in the file": t("records.import.problems.idTwice"),
    "ID number is already assigned to a resident": t(
      "records.import.problems.idTaken",
    ),
    "birthdate cannot be in the future": t(
      "records.import.problems.futureBirthdate",
    ),
    "resident_since_year and resident_since_birth cannot both be set": t(
      "records.import.problems.sinceBoth",
    ),
    "Field required": t("records.import.problems.required"),
    "String should have at least 1 character": t(
      "records.import.problems.required",
    ),
  }
  const known = fixed[message]
  if (known) return known

  const tooLong = message.match(
    /^String should have at most (\d+) characters?$/,
  )
  if (tooLong) return t("records.import.problems.tooLong", { max: tooLong[1] })

  const allowed = message.match(/^Input should be (.+)$/)
  if (allowed && /^'[^']+'( or '[^']+'|, '[^']+')*$/.test(allowed[1])) {
    const options = allowed[1].replace(/'/g, "").replace(/ or /g, ", ")
    return t("records.import.problems.notAllowed", { options })
  }

  const atLeast = message.match(
    /^Input should be greater than or equal to (\d+)$/,
  )
  if (atLeast) return t("records.import.problems.atLeast", { min: atLeast[1] })
  const above = message.match(/^Input should be greater than (\d+)$/)
  if (above) return t("records.import.problems.above", { min: above[1] })
  const atMost = message.match(/^Input should be less than or equal to (\d+)$/)
  if (atMost) return t("records.import.problems.atMost", { max: atMost[1] })
  if (/^Input should be a valid integer/.test(message)) {
    return t("records.import.problems.notWholeNumber")
  }
  return message
}
