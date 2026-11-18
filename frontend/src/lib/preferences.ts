/**
 * Per-user display preferences: theme, accent colour and font size.
 *
 * Where they live: in this browser's localStorage, one entry per signed-in
 * user (`app-preferences:<user id>`), so two staff members sharing one
 * computer each keep their own choices. Nothing is sent to the server, so there
 * is no migration, and the settings work on the offline office network. A
 * choice follows the person on that computer, not to another computer.
 *
 * The accent is a fixed set only (no free colour picker). Each accent keeps the
 * same lightness and chroma as the navy default and only changes the hue (slate
 * also lowers the chroma), and
 * every one was checked for WCAG AA contrast in both themes (see index.css).
 * The font size sets the root size, so every rem-based size scales with it.
 */

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
}

export const DEFAULT_PREFERENCES: Preferences = {
  accent: "navy",
  fontSize: "medium",
}

const KEY_PREFIX = "app-preferences:"
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
    }
  } catch {
    return { ...DEFAULT_PREFERENCES }
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
  preferences: Pick<Preferences, "accent" | "fontSize">,
) {
  const root = document.documentElement
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
  if (current.userId) writePreferences(current.userId, preferences)
  applyAppearance(preferences)
  emit()
}
