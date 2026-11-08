import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import { flushSync } from "react-dom"

export type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  resolvedTheme: "dark" | "light"
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

/**
 * Runs `apply` (which must switch the theme synchronously) as one coordinated
 * change.
 *
 * Without this, every element eased to the new colours on its own schedule
 * (some instantly, some over 140-150ms), so for a moment the page was half
 * dark and half light, with light text on a light background. Here all CSS
 * transitions are paused while the switch happens, and the browser cross-fades
 * the whole page once through the View Transitions API. Browsers without that
 * API (and people who ask for reduced motion) get a clean instant switch.
 */
function runThemeSwitch(apply: () => void) {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches

  const freeze = window.document.createElement("style")
  freeze.textContent =
    "*,*::before,*::after{transition:none!important}" +
    "::view-transition-group(root){animation-duration:200ms}" +
    "::view-transition-old(root),::view-transition-new(root){animation-duration:200ms;animation-timing-function:ease-out}"
  window.document.head.appendChild(freeze)

  const unfreeze = () => {
    // Make sure the new colours are committed while transitions are off.
    void window.getComputedStyle(window.document.body).backgroundColor
    window.setTimeout(() => freeze.remove(), 0)
  }

  const startViewTransition = (
    window.document as Document & {
      startViewTransition?: (update: () => void) => { finished: Promise<void> }
    }
  ).startViewTransition

  if (!prefersReducedMotion && typeof startViewTransition === "function") {
    const transition = startViewTransition.call(window.document, apply)
    transition.finished.then(unfreeze, unfreeze)
    return
  }

  apply()
  unfreeze()
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
  )

  const getResolvedTheme = useCallback((theme: Theme): "dark" | "light" => {
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
    }
    return theme
  }, [])

  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(() =>
    getResolvedTheme(theme),
  )

  const updateTheme = useCallback((newTheme: Theme) => {
    const root = window.document.documentElement

    root.classList.remove("light", "dark")

    if (newTheme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      root.classList.add(systemTheme)
      return
    }

    root.classList.add(newTheme)
  }, [])

  useEffect(() => {
    updateTheme(theme)
    setResolvedTheme(getResolvedTheme(theme))

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const handleChange = () => {
      if (theme === "system") {
        runThemeSwitch(() => {
          updateTheme("system")
          flushSync(() => setResolvedTheme(getResolvedTheme("system")))
        })
      }
    }

    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [theme, updateTheme, getResolvedTheme])

  const value = {
    theme,
    resolvedTheme,
    setTheme: (nextTheme: Theme) => {
      localStorage.setItem(storageKey, nextTheme)
      if (nextTheme === theme) return
      runThemeSwitch(() => {
        // The class and React state change in the same step, so the page
        // and the sun/moon button flip together.
        updateTheme(nextTheme)
        flushSync(() => {
          setTheme(nextTheme)
          setResolvedTheme(getResolvedTheme(nextTheme))
        })
      })
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
