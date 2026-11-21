import { useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import { IssuancesService } from "@/client"
import {
  buildDocx,
  buildPdf,
  type ExportFormat,
  exportMime,
  safeFileName,
} from "@/lib/print/exportDocument"
import { loadPrintData } from "@/lib/print/loadPrintData"
import { renderSheets } from "@/lib/print/renderSheets"

/**
 * Saves an issued document as a PDF or Word file. `exportIssuance(id, format, fileName)` resolves to a short message
 * for the screen (never throws) and sets `ok` when the file was handed to the browser.
 * Like printing, a save is written to the Activity Log first; if that fails nothing is saved.
 */
export function useExportIssuance() {
  const { t } = useTranslation()
  const busy = useRef(false)

  const exportIssuance = useCallback(
    async (
      issuanceId: string,
      format: ExportFormat,
      fileName: string,
    ): Promise<{ ok: boolean; message: string }> => {
      if (busy.current)
        return { ok: false, message: t("issuances.exporting.notices.busy") }
      busy.current = true
      try {
        const result = await loadPrintData(issuanceId)
        if (!result.ok)
          return {
            ok: false,
            message: t("issuances.exporting.notices.unavailable"),
          }
        try {
          await IssuancesService.recordPrint({
            path: { issuance_id: issuanceId },
            body: { mode: format },
          })
        } catch {
          return {
            ok: false,
            message: t("issuances.exporting.notices.notRecorded"),
          }
        }
        const { sheets, widthPt, heightPt } = await renderSheets(result.data)
        const bytes =
          format === "pdf"
            ? buildPdf(sheets, widthPt, heightPt, fileName)
            : buildDocx(sheets, widthPt, heightPt, fileName)
        const blob = new Blob([bytes as BlobPart], { type: exportMime[format] })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = safeFileName(fileName, format)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
        return {
          ok: true,
          message: t(
            format === "pdf"
              ? "issuances.exporting.notices.savedPdf"
              : "issuances.exporting.notices.savedWord",
            { file: safeFileName(fileName, format) },
          ),
        }
      } catch (error) {
        return {
          ok: false,
          message:
            error instanceof Error
              ? error.message
              : t("issuances.exporting.notices.unable"),
        }
      } finally {
        busy.current = false
      }
    },
    [t],
  )

  return { exportIssuance }
}
