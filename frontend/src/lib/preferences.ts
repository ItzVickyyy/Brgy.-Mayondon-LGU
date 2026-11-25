/**
 * Per-account display preferences: theme, accent colour and font size.
 *
 * Where they live: on the account (`GET/PUT /users/me/preferences`), so a
 * choice follows the person to any computer. The browser also keeps a copy in
 * localStorage (`app-preferences:<user id>`): it paints the right look before
 * the server answers and keeps the settings working when the server cannot be
 * reached. A change that could not be sent is flagged
 * (`app-preferences-unsynced:<user id>`) and sent at the next sign-in, so an
 * offline choice is never overwritten by an older server copy.
 *
 * The accent is a fixed set only (no free colour picker). Each accent keeps the
 * same lightness and chroma as the navy default and only changes the hue (slate
 * also lowers the chroma), and
 * every one was checked for WCAG AA contrast in both themes (see index.css).
 * The font size sets the root size, so every rem-based size scales with it.
 */

import { UsersService } from "@/client"

export const ACCENTS = [
  "navy",
  "teal",
  "green",
  "purple",
  "maroon",
  "rose",
  "bronze",
  "olive",
  "sky",
  "slate",
] as const
export type Accent = (typeof ACCENTS)[number]

/** Hue (oklch) of each accent; must match `--accent-hue` in index.css. */
export const ACCENT_HUES: Record<Accent, number> = {
  navy: 258,
  teal: 200,
  green: 152,
  purple: 305,
  maroon: 15,
  rose: 345,
  bronze: 55,
  olive: 115,
  sky: 232,
  slate: 250,
}

/** Slate is a muted grey-blue: the same hue family as navy with 30% of its chroma. */
export const ACCENT_CHROMA: Record<Accent, number> = {
  navy: 1,
  teal: 1,
  green: 1,
  purple: 1,
  maroon: 1,
  rose: 1,
  bronze: 1,
  olive: 1,
  sky: 1,
  slate: 0.3,
}

export const FONT_SIZES = ["small", "medium", "large"] as const
export type FontSize = (typeof FONT_SIZES)[number]

export type PreferenceTheme = "light" | "dark" | "system"

export type Preferences = {
  /** Only set once the person has chosen a theme themselves. */
  theme?: PreferenceTheme
  accent: Accent
  fontSize: FontSize
  /** Gold highlights on (default) or off. Independent of the accent colour. */
  goldAccent: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  accent: "navy",
  fontSize: "medium",
  goldAccent: true,
}

const KEY_PREFIX = "app-preferences:"
const UNSYNCED_PREFIX = "app-preferences-unsynced:"
const LAST_USER_KEY = "app-preferences-last-user"

function isAccent(value: unknown): value is Accent {
  return ACCENTS.includes(value as Accent)
}

function isFontSize(value: unknown): value is FontSize {
  return FONT_SIZES.includes(value as FontSize)
}

/** Reads one user's saved preferences. Anything missing or invalid falls back. */
export function readPreferences(userId: string): Preferences {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + userId)
    if (!raw) return { ...DEFAULT_PREFERENCES }
    const data = JSON.parse(raw) as Record<string, unknown>
    return {
      theme:
        data.theme === "light" ||
        data.theme === "dark" ||
        data.theme === "system"
          ? data.theme
          : undefined,
      accent: isAccent(data.accent) ? data.accent : DEFAULT_PREFERENCES.accent,
      fontSize: isFontSize(data.fontSize)
        ? data.fontSize
        : DEFAULT_PREFERENCES.fontSize,
      goldAccent:
        typeof data.goldAccent === "boolean"
          ? data.goldAccent
          : DEFAULT_PREFERENCES.goldAccent,
    }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

function setUnsynced(userId: string, unsynced: boolean) {
  try {
    if (unsynced) localStorage.setItem(UNSYNCED_PREFIX + userId, "1")
    else localStorage.removeItem(UNSYNCED_PREFIX + userId)
  } catch {
    // Ignored: the worst case is one extra comparison at the next sign-in.
  }
}

function isUnsynced(userId: string): boolean {
  try {
    return localStorage.getItem(UNSYNCED_PREFIX + userId) === "1"
  } catch {
    return false
  }
}

function hasLocalCopy(userId: string): boolean {
  try {
    return localStorage.getItem(KEY_PREFIX + userId) !== null
  } catch {
    return false
  }
}

function writePreferences(userId: string, preferences: Preferences) {
  try {
    localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(preferences))
  } catch {
    // Storage can be full or blocked; the choice then lasts for this visit only.
  }
}

/** Puts the accent and font size on the page (the CSS reads these attributes). */
export function applyAppearance(
  preferences: Pick<Preferences, "accent" | "fontSize" | "goldAccent">,
) {
  const root = document.documentElement
  // Gold is on unless the attribute says off (the CSS reads `data-gold`).
  if (preferences.goldAccent) delete root.dataset.gold
  else root.dataset.gold = "off"
  if (preferences.accent === "navy") delete root.dataset.accent
  else root.dataset.accent = preferences.accent
  if (preferences.fontSize === "medium") delete root.dataset.fontSize
  else root.dataset.fontSize = preferences.fontSize
}

/**
 * Applies the last signed-in user's accent and font size before the first
 * paint, so the page does not flash the defaults while the user loads.
 */
export function applyRememberedAppearance() {
  try {
    const userId = localStorage.getItem(LAST_USER_KEY)
    if (userId) applyAppearance(readPreferences(userId))
  } catch {
    // Nothing to apply.
  }
}

// A tiny store, so the pop-up and the layout see the same values.
let current: { userId: string | null; preferences: Preferences } = {
  userId: null,
  preferences: { ...DEFAULT_PREFERENCES },
}
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribePreferences(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getPreferences(): Preferences {
  return current.preferences
}

/** Loads (and applies) a user's preferences when they sign in. */
export function loadUserPreferences(userId: string): Preferences {
  const preferences = readPreferences(userId)
  current = { userId, preferences }
  try {
    localStorage.setItem(LAST_USER_KEY, userId)
  } catch {
    // Ignored: only the no-flash start-up is lost.
  }
  applyAppearance(preferences)
  emit()
  return preferences
}

/** Back to the defaults when the user signs out (the login page is not themed). */
export function unloadUserPreferences() {
  // A change made just before signing out is sent now, not lost with the timer.
  if (saveTimer !== undefined && current.userId) {
    window.clearTimeout(saveTimer)
    saveTimer = undefined
    void sendToServer(current.userId, current.preferences)
  }
  current = { userId: null, preferences: { ...DEFAULT_PREFERENCES } }
  try {
    localStorage.removeItem(LAST_USER_KEY)
  } catch {
    // Ignored.
  }
  applyAppearance(DEFAULT_PREFERENCES)
  emit()
}

/** Changes one or more preferences, applies them and saves them for this user. */
export function updatePreferences(patch: Partial<Preferences>) {
  const preferences: Preferences = { ...current.preferences, ...patch }
  current = { ...current, preferences }
  if (current.userId) {
    writePreferences(current.userId, preferences)
    scheduleSave(current.userId)
  }
  applyAppearance(preferences)
  emit()
}

let saveTimer: number | undefined

async function sendToServer(userId: string, preferences: Preferences) {
  try {
    await UsersService.saveMyPreferences({
      body: {
        theme: preferences.theme ?? null,
        accent: preferences.accent,
        font_size: preferences.fontSize,
        gold_accent: preferences.goldAccent,
      },
    })
    setUnsynced(userId, false)
  } catch {
    setUnsynced(userId, true) // offline or server down: sent at the next sign-in
  }
}

/** Sends the current choices to the account shortly after the last change. */
function scheduleSave(userId: string) {
  setUnsynced(userId, true)
  if (saveTimer !== undefined) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    saveTimer = undefined
    if (current.userId === userId)
      void sendToServer(userId, current.preferences)
  }, 400)
}

/**
 * Brings this browser and the account in line once, after sign-in.
 * - The account has preferences and nothing is waiting to be sent: use them
 *   (another computer's choice arrives here) and refresh the local copy.
 * - Otherwise (a first run after this feature, or an unsent offline change):
 *   the local choice goes up to the account.
 * Returns the preferences to show, or null when nothing changed.
 */
export async function syncPreferencesWithServer(
  userId: string,
): Promise<Preferences | null> {
  try {
    const { data: server } = await UsersService.readMyPreferences()
    if (current.userId !== userId) return null // signed out meanwhile
    if (server && !isUnsynced(userId)) {
      const preferences: Preferences = {
        theme: server.theme ?? undefined,
        accent: isAccent(server.accent) ? server.accent : "navy",
        fontSize: isFontSize(server.font_size) ? server.font_size : "medium",
        goldAccent: server.gold_accent !== false,
      }
      writePreferences(userId, preferences)
      current = { userId, preferences }
      applyAppearance(preferences)
      emit()
      return preferences
    }
    if (hasLocalCopy(userId) || isUnsynced(userId))
      await sendToServer(userId, current.preferences)
  } catch {
    // Offline: keep the local copy.
  }
  return null
}
