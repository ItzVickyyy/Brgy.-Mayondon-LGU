/**
 * An unsaved NEW resident form is kept in this browser (per signed-in account) so a closed
 * window or a page reload does not lose the typing. Names and addresses only (the form has no
 * health data) and never the photo. Removed on save, on "Discard draft" and on sign-out.
 */
export const DRAFT_PREFIX = "resident-draft:"

const key = (userId: string) => `${DRAFT_PREFIX}${userId}`

export function readResidentDraft<T extends object>(
  userId: string,
  template: T,
): { form: T; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(key(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      form?: Record<string, unknown>
      at?: number
    }
    if (!parsed.form || typeof parsed.form !== "object") return null
    const form = { ...template } as Record<string, unknown>
    // Only known boxes, and only values of the same type, come back.
    for (const [name, fallback] of Object.entries(template)) {
      const value = parsed.form[name]
      if (typeof value === typeof fallback && !Array.isArray(fallback)) {
        form[name] = value
      } else if (Array.isArray(fallback) && Array.isArray(value)) {
        form[name] = value
      }
    }
    return { form: form as T, savedAt: Number(parsed.at) || Date.now() }
  } catch {
    return null
  }
}

export function writeResidentDraft(userId: string, form: object): void {
  try {
    localStorage.setItem(key(userId), JSON.stringify({ form, at: Date.now() }))
  } catch {
    // Storage blocked or full: the draft is a convenience only.
  }
}

export function clearResidentDraft(userId: string): void {
  try {
    localStorage.removeItem(key(userId))
  } catch {
    // Nothing to clear.
  }
}

/** Sign-out: no draft stays behind for the next person at this browser. */
export function clearAllResidentDrafts(): void {
  try {
    for (const name of Object.keys(localStorage)) {
      if (name.startsWith(DRAFT_PREFIX)) localStorage.removeItem(name)
    }
  } catch {
    // Nothing to clear.
  }
}
