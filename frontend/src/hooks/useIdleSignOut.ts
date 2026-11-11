import { useCallback, useEffect, useRef, useState } from "react"

// Signs the person out after a period with no keyboard, mouse, touch or scroll
// activity, so a screen left open on a shared office computer does not keep
// resident data on view. The last-activity time lives in localStorage, so a
// second browser tab of the same person counts as activity and every tab
// signs out together. The check compares clock times each second instead of
// trusting one long timer, because browsers slow timers in background tabs
// and a computer that slept must still sign out on waking.
//
// This is a browser-side convenience. It does not cancel the sign-in token
// (that still ends by itself after ACCESS_TOKEN_EXPIRE_MINUTES, 8 hours).

const ACTIVITY_KEY = "last_activity"
// Change this one number to change the limit (the front end is built into the
// backend image, so rebuild it afterwards).
export const IDLE_MINUTES = 30
const WARNING_SECONDS = 60
// A burst of mouse moves writes the time at most this often.
const WRITE_EVERY_MS = 5000

const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
] as const

function readLastActivity(): number | null {
  try {
    const value = Number(localStorage.getItem(ACTIVITY_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function writeLastActivity(time: number) {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(time))
  } catch {
    // Storage can be blocked; the page then keeps its own copy below.
  }
}

export function useIdleSignOut(onTimeout: () => void) {
  const limitMs = IDLE_MINUTES * 60_000
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const lastActivity = useRef(Date.now())
  const lastWrite = useRef(0)
  const warningOpen = useRef(false)
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  const markActive = useCallback(() => {
    const now = Date.now()
    lastActivity.current = now
    lastWrite.current = now
    writeLastActivity(now)
    warningOpen.current = false
    setSecondsLeft(null)
  }, [])

  useEffect(() => {
    if (limitMs <= 0) return

    // Opening or reloading the page is activity.
    markActive()

    const onActivity = () => {
      // While the warning shows, only its button counts, so a bumped mouse
      // does not quietly hide it.
      if (warningOpen.current) return
      const now = Date.now()
      lastActivity.current = now
      if (now - lastWrite.current >= WRITE_EVERY_MS) {
        lastWrite.current = now
        writeLastActivity(now)
      }
    }
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, onActivity, {
        passive: true,
        capture: true,
      })
    }

    const timer = window.setInterval(() => {
      // Another tab may have been used more recently.
      const stored = readLastActivity()
      const last = Math.max(lastActivity.current, stored ?? 0)
      const idle = Math.max(0, Date.now() - last)
      const remaining = limitMs - idle
      if (remaining <= 0) {
        window.clearInterval(timer)
        onTimeoutRef.current()
      } else if (remaining <= WARNING_SECONDS * 1000) {
        warningOpen.current = true
        setSecondsLeft(Math.ceil(remaining / 1000))
      } else {
        warningOpen.current = false
        setSecondsLeft(null)
      }
    }, 1000)

    return () => {
      window.clearInterval(timer)
      for (const name of ACTIVITY_EVENTS) {
        window.removeEventListener(name, onActivity, { capture: true })
      }
    }
  }, [limitMs, markActive])

  return { secondsLeft, stayActive: markActive }
}
