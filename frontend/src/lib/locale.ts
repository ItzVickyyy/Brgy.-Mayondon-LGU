import i18n from "@/i18n"

/** Resolve the currently selected interface language to a regional format locale. */
export function getLocale(): string {
  return i18n.language === "fil" ? "fil-PH" : "en-PH"
}

/** Like getLocale(), but keeps `englishLocale` for English so English output never changes. */
export function getLocaleOr(englishLocale: string): string {
  return i18n.language === "fil" ? "fil-PH" : englishLocale
}

export function formatLocaleDate(
  value: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(getLocale(), options).format(value)
}

export function formatLocaleNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(getLocale(), options).format(value)
}
