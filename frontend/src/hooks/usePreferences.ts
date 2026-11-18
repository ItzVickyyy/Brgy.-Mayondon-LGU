import { useEffect, useRef, useSyncExternalStore } from "react"

import { useTheme } from "@/components/theme-provider"
import {
  getPreferences,
  loadUserPreferences,
  type Preferences,
  subscribePreferences,
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
    return () => {
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
  const { resolvedTheme, setTheme } = useTheme()

  return {
    preferences,
    theme: resolvedTheme,
    setTheme: (theme: "light" | "dark") => {
      setTheme(theme)
      updatePreferences({ theme })
    },
    setAccent: (accent: Preferences["accent"]) => updatePreferences({ accent }),
    setFontSize: (fontSize: Preferences["fontSize"]) =>
      updatePreferences({ fontSize }),
    reset: () => {
      setTheme("dark")
      updatePreferences({ theme: "dark", accent: "navy", fontSize: "medium" })
    },
  }
}
