// Shown labels for resident values the API stores in English (sex, civil
// status, resident type). The stored value never changes; only the label does.
// A value with no entry here is shown exactly as it is stored.
import type { ParseKeys, TFunction } from "i18next"

const sexKeys = {
  Male: "records.labels.sex.Male",
  Female: "records.labels.sex.Female",
} as const satisfies Record<string, ParseKeys>

const civilStatusKeys = {
  Single: "records.labels.civilStatus.Single",
  Married: "records.labels.civilStatus.Married",
  "Legally Separated": "records.labels.civilStatus.Legally Separated",
  "Widow/Widower": "records.labels.civilStatus.Widow/Widower",
} as const satisfies Record<string, ParseKeys>

const residentTypeKeys = {
  "Existing resident": "records.labels.residentType.Existing resident",
  "New / renting resident":
    "records.labels.residentType.New / renting resident",
} as const satisfies Record<string, ParseKeys>

function label(keys: Record<string, ParseKeys>, value: string, t: TFunction) {
  const key = keys[value]
  return key ? t(key) : value
}

export const sexLabel = (value: string, t: TFunction) =>
  label(sexKeys, value, t)
export const civilStatusLabel = (value: string, t: TFunction) =>
  label(civilStatusKeys, value, t)
export const residentTypeLabel = (value: string, t: TFunction) =>
  label(residentTypeKeys, value, t)
