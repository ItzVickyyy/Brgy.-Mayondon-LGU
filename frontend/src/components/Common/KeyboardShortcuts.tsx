import { useNavigate } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"

import { ShortcutsDialog } from "@/components/Common/InfoDialogs"
import { GO_TO } from "@/lib/shortcuts"

const GO_TIMEOUT_MS = 1500

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

function isDialogOpen(): boolean {
  return Boolean(
    document.querySelector('[role="dialog"], [role="alertdialog"]'),
  )
}

/** Page shortcuts. Mount once inside the signed-in layout; it renders only the shortcut list popup. */
export function KeyboardShortcuts() {
  const navigate = useNavigate()
  const [listOpen, setListOpen] = useState(false)
  const waitingForGo = useRef(false)
  const goTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const stopWaiting = () => {
      waitingForGo.current = false
      window.clearTimeout(goTimer.current)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.defaultPrevented || isTypingTarget(event.target)) return
      if (isDialogOpen()) {
        stopWaiting()
        return
      }

      if (waitingForGo.current) {
        const destination = GO_TO[event.key.toLowerCase()]
        stopWaiting()
        if (destination) {
          event.preventDefault()
          void navigate({ to: destination })
        }
        return
      }

      if (event.key === "?") {
        event.preventDefault()
        setListOpen(true)
      } else if (event.key === "/") {
        const box = document.querySelector<HTMLInputElement>(
          '#main-content input[type="search"], #main-content input[placeholder^="Search"]',
        )
        if (box) {
          event.preventDefault()
          box.focus()
          box.select()
        }
      } else if (event.key.toLowerCase() === "g") {
        waitingForGo.current = true
        goTimer.current = window.setTimeout(stopWaiting, GO_TIMEOUT_MS)
      } else if (event.key.toLowerCase() === "n") {
        const button = document.querySelector<HTMLButtonElement>(
          '[data-shortcut="new-issuance"]',
        )
        if (button && !button.disabled) {
          event.preventDefault()
          button.click()
        }
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.clearTimeout(goTimer.current)
    }
  }, [navigate])

  return <ShortcutsDialog open={listOpen} onOpenChange={setListOpen} />
}
