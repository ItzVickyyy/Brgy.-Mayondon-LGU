import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { IssuancesService } from "@/client"
import { PrintForm } from "@/components/Issuances/PrintForm"
import { PrintOverlay } from "@/components/Issuances/PrintOverlay"
import { printMessage } from "@/lib/issuanceLabels"
import type { PrintData } from "@/lib/print/buildPrintData"
import { getOffset } from "@/lib/print/calibration"
import { loadPrintData } from "@/lib/print/loadPrintData"
import { getPrintMode, type PrintMode } from "@/lib/print/printMode"

const IMAGE_WAIT_MS = 3000

/** Resolves once every overlay image has loaded (or after a short timeout), so a photo never prints blank. */
function waitForOverlayImages(): Promise<void> {
  const images = Array.from(
    document.querySelectorAll<HTMLImageElement>(
      ".print-overlay-root img, .print-form-root img",
    ),
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
 * Prints a stored issuance: the values only (pre-printed paper) or the form with the values (blank paper).
 * Without `mode` the remembered choice is used. `print(id)` resolves to a short message for the screen (never throws). Render `overlay` once anywhere in the page.
 */
export function usePrintIssuance(): {
  print: (issuanceId: string, mode?: PrintMode) => Promise<string>
  overlay: ReactNode
} {
  const { t } = useTranslation()
  const [data, setData] = useState<PrintData | null>(null)
  const [mode, setMode] = useState<PrintMode>("data")
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

  const print = useCallback(
    async (issuanceId: string, chosen?: PrintMode) => {
      if (busy.current) return t("issuances.printing.notices.busy")
      busy.current = true
      try {
        const result = await loadPrintData(issuanceId)
        if (!result.ok) return printMessage(result.message, t)
        const printMode = chosen ?? getPrintMode()
        // The Activity Log must know about every print, so a print that cannot be recorded does not start.
        try {
          await IssuancesService.recordPrint({
            path: { issuance_id: issuanceId },
            body: { mode: printMode },
          })
        } catch {
          return t("issuances.printing.notices.notRecorded")
        }
        await new Promise<void>((resolve) => {
          done.current = resolve
          setMode(printMode)
          setData(result.data)
        })
        return t("issuances.printing.notices.opened")
      } catch (error) {
        return error instanceof Error
          ? error.message
          : t("issuances.printing.notices.unable")
      } finally {
        busy.current = false
      }
    },
    [t],
  )

  return {
    print,
    overlay: data ? (
      mode === "form" ? (
        <PrintForm data={data} />
      ) : (
        <PrintOverlay data={data} offset={getOffset(data.templateId)} />
      )
    ) : null,
  }
}
