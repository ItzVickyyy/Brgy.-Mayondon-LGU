import { useEffect, useRef, useState } from "react"

import { formatLocaleNumber } from "@/lib/locale"

const DURATION_MS = 600

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

// Counts up (or down) to `value` the first time it shows and whenever it
// changes. With "reduce motion" on it shows the final number straight away.
// Screen readers get only the final number, never the counting.
export function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0))
  const shownRef = useRef(shown)
  shownRef.current = shown

  useEffect(() => {
    const from = shownRef.current
    if (from === value || prefersReducedMotion()) {
      setShown(value)
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS)
      const eased = 1 - (1 - progress) ** 3
      setShown(Math.round(from + (value - from) * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return (
    <>
      <span aria-hidden="true">{formatLocaleNumber(shown)}</span>
      <span className="sr-only">{formatLocaleNumber(value)}</span>
    </>
  )
}
