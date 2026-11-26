import { useEffect, useRef, useSyncExternalStore } from "react"

import { useTheme } from "@/components/theme-provider"
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  loadUserPreferences,
  type Preferences,
  type PreferenceTheme,
  subscribePreferences,
  syncPreferencesWithServer,
  unloadUserPreferences,
  updatePreferences,
} from "@/lib/preferences"

/**
 * Loads the signed-in user's saved preferences while the app layout is shown.
 * Call once, in the layout. A saved theme is applied after the first paint
 * (the theme switch animates and must not run inside an effect).
 */
export function useLoadPreferences(userId: string | undefined) {
  const { setTheme } = useTheme()
  const setThemeRef = useRef(setTheme)
  setThemeRef.current = setTheme

  useEffect(() => {
    if (!userId) return
    const saved = loadUserPreferences(userId)
    let timer: number | undefined
    if (saved.theme) {
      const theme = saved.theme
      timer = window.setTimeout(() => setThemeRef.current(theme), 0)
    }
    // Then ask the account: a choice made on another computer replaces this one.
    let cancelled = false
    void syncPreferencesWithServer(userId).then((fromServer) => {
      if (!cancelled && fromServer?.theme) setThemeRef.current(fromServer.theme)
    })
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
      unloadUserPreferences()
    }
  }, [userId])
}

/** The current preferences plus setters that also save them for this user. */
export function usePreferences() {
  const preferences = useSyncExternalStore<Preferences>(
    subscribePreferences,
    getPreferences,
  )
  const { theme: themeSetting, resolvedTheme, setTheme } = useTheme()

  return {
    preferences,
    /** What the page looks like now: "light" or "dark". */
    theme: resolvedTheme,
    /** What the person chose: "system", "light" or "dark". */
    themeSetting,
    setTheme: (theme: PreferenceTheme) => {
      setTheme(theme)
      updatePreferences({ theme })
    },
    setAccent: (accent: Preferences["accent"]) => updatePreferences({ accent }),
    setFontSize: (fontSize: Preferences["fontSize"]) =>
      updatePreferences({ fontSize }),
    setGoldAccent: (goldAccent: boolean) => updatePreferences({ goldAccent }),
    reset: () => {
      setTheme("system")
      updatePreferences({
        theme: "system",
        accent: DEFAULT_PREFERENCES.accent,
        fontSize: "medium",
        goldAccent: true,
      })
    },
  }
}
