import i18n from "@/i18n"

/** Resolve the currently selected interface language to a regional format locale. */
export function getLocale(): string {
  return i18n.language === "fil" ? "fil-PH" : "en-PH"
}

/** Like getLocale(), but keeps `englishLocale` for English so English output never changes. */
export function getLocaleOr(englishLocale: string): string {
  return i18n.language === "fil" ? "fil-PH" : englishLocale
}

/** The format locale used for files that must not change with the interface language (CSV exports). */
export const FIXED_LOCALE = "en-PH"

export function formatLocaleDate(
  value: Date,
  options: Intl.DateTimeFormatOptions,
  locale: string = getLocale(),
): string {
  return new Intl.DateTimeFormat(locale, options).format(value)
}

export function formatLocaleNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale: string = getLocale(),
): string {
  return new Intl.NumberFormat(locale, options).format(value)
}
