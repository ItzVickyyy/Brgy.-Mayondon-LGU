/**
 * How an issued document is printed.
 * "data": only the typed values, for the barangay's pre-printed forms (the default).
 * "form": the form itself (letterhead, labels, lines) together with the values, for blank paper.
 */
export type PrintMode = "data" | "form"

const STORAGE_KEY = "print-mode"

export function getPrintMode(): PrintMode {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "form" ? "form" : "data"
  } catch {
    return "data"
  }
}

export function setPrintMode(mode: PrintMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Storage can be blocked; the choice then only lasts for this click.
  }
}
