import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { PrintOverlay } from "@/components/Issuances/PrintOverlay"
import type { PrintData } from "@/lib/print/buildPrintData"
import { getOffset } from "@/lib/print/calibration"
import { loadPrintData } from "@/lib/print/loadPrintData"

const IMAGE_WAIT_MS = 3000

/** Resolves once every overlay image has loaded (or after a short timeout), so a photo never prints blank. */
function waitForOverlayImages(): Promise<void> {
  const images = Array.from(
    document.querySelectorAll<HTMLImageElement>(".print-overlay-root img"),
  )
  const pending = images
    .filter((image) => !image.complete)
    .map(
      (image) =>
        new Promise<void>((resolve) => {
          image.onload = image.onerror = () => resolve()
        }),
    )
  if (!pending.length) return Promise.resolve()
  return Promise.race([
    Promise.all(pending).then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, IMAGE_WAIT_MS)),
  ])
}

/**
 * Prints a stored issuance on the pre-printed form.
 * `print(id)` resolves to a short message for the screen (never throws). Render `overlay` once anywhere in the page.
 */
export function usePrintIssuance(): {
  print: (issuanceId: string) => Promise<string>
  overlay: ReactNode
} {
  const [data, setData] = useState<PrintData | null>(null)
  const busy = useRef(false)
  const done = useRef<(() => void) | null>(null)

  // Once the overlay is mounted: wait for photos, open the print dialog, then unmount the overlay.
  useEffect(() => {
    if (!data) return
    let cancelled = false
    void (async () => {
      await waitForOverlayImages()
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
      if (!cancelled) window.print() // blocks until the print dialog closes in most browsers
      setData(null)
      done.current?.()
      done.current = null
    })()
    return () => {
      cancelled = true
    }
  }, [data])

  const print = useCallback(async (issuanceId: string) => {
    if (busy.current) return "A print is already in progress."
    busy.current = true
    try {
      const result = await loadPrintData(issuanceId)
      if (!result.ok) return result.message
      await new Promise<void>((resolve) => {
        done.current = resolve
        setData(result.data)
      })
      return "Opened the print dialog. Load the pre-printed form, print at 100% scale with no headers or footers, and use Print again for another copy."
    } catch (error) {
      return error instanceof Error
        ? error.message
        : "Unable to prepare this document for printing."
    } finally {
      busy.current = false
    }
  }, [])

  return {
    print,
    overlay: data ? (
      <PrintOverlay data={data} offset={getOffset(data.templateId)} />
    ) : null,
  }
}
