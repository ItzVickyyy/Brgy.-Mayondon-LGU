import { type RefObject, useEffect, useLayoutEffect, useState } from "react"

function scrollParent(element: HTMLElement | null): HTMLElement | null {
  let node = element?.parentElement ?? null
  while (node) {
    const overflowY = window.getComputedStyle(node).overflowY
    if (overflowY === "auto" || overflowY === "scroll") return node
    node = node.parentElement
  }
  return null
}

/**
 * Decides whether a dropdown panel should open upward, so it is never hidden
 * behind the bottom edge of the scrolling form. Measured once when it opens.
 */
export function useOpenUpward(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
) {
  const [upward, setUpward] = useState(false)
  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!anchor || !panel) return
    const parent = scrollParent(anchor)
    const bounds = parent?.getBoundingClientRect() ?? {
      top: 0,
      bottom: window.innerHeight,
    }
    const box = anchor.getBoundingClientRect()
    const needed = panel.offsetHeight + 8
    const below = bounds.bottom - box.bottom
    const above = box.top - bounds.top
    setUpward(below < needed && above > below)
  }, [open, anchorRef, panelRef])
  return upward
}

/** Closes a panel when the person clicks anywhere outside of it. */
export function useClickOutside(
  open: boolean,
  wrapperRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return
    function handle(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open, wrapperRef, onClose])
}

/**
 * True when an open dropdown or calendar should receive the Escape key first.
 * The dialog checks this so Esc closes the dropdown instead of the whole form.
 */
export function popoverIsOpen() {
  return document.querySelector("[data-popover-open]") !== null
}

export const panelClass =
  "absolute left-0 z-40 min-w-full rounded-lg border bg-popover text-popover-foreground shadow-lg"
