import { useEffect, useState } from "react"

const DEFER_MS = 1000
const startedAt = typeof performance !== "undefined" ? performance.now() : 0

/**
 * False for the first second of the page session, then true (patch 237). The notification bell and
 * the setup reminders use it so their requests start after the first screen has drawn, instead of
 * competing with it. Later pages in the same session get true at once.
 */
export function useDeferredStart(): boolean {
  const [ready, setReady] = useState(
    () => performance.now() - startedAt >= DEFER_MS,
  )
  useEffect(() => {
    if (ready) return
    const wait = Math.max(0, DEFER_MS - (performance.now() - startedAt))
    const timer = window.setTimeout(() => setReady(true), wait)
    return () => window.clearTimeout(timer)
  }, [ready])
  return ready
}
