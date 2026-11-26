import { Download, Printer, X } from "lucide-react"
import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"

import { ExportFormatDialog } from "@/components/Reports/ExportFormatDialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  buildReportFile,
  type ReportCell,
  type ReportFormat,
  reportMime,
} from "@/lib/reports/reportFiles"

/**
 * The checkbox column, same on every table: 20 px from the card edge (the
 * same inset as the text above it), box 20 px, 44 px wide in all.
 * Header and row cells both use it.
 */
export const selectCol = "w-11 py-3 pl-5 pr-0 align-middle"

/** The checkbox in a row (`label` = the row's name, for screen readers). */
export function RowCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  const { t } = useTranslation()
  return (
    <Checkbox
      data-testid="row-select"
      checked={checked}
      onCheckedChange={onChange}
      aria-label={t("common.selection.selectRow", { name: label })}
      className="size-5"
    />
  )
}

/** The checkbox in the header: selects or clears every row on this page. */
export function PageCheckbox({
  all,
  some,
  onChange,
}: {
  all: boolean
  some: boolean
  onChange: () => void
}) {
  const { t } = useTranslation()
  return (
    <Checkbox
      data-testid="page-select"
      checked={all ? true : some ? "indeterminate" : false}
      onCheckedChange={onChange}
      aria-label={t("common.selection.selectPage")}
      className="size-5"
    />
  )
}

/** Builds the chosen file from the selected rows (first row = headings) and downloads it. */
function saveFile(name: string, format: ReportFormat, rows: ReportCell[][]) {
  const blob = new Blob(
    [
      buildReportFile(format, {
        title: document.title.split(" | ")[0] || "Selected rows",
        subtitle: `${Math.max(rows.length - 1, 0)} selected · ${new Date().toLocaleDateString(
          "en-US",
          {
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "Asia/Manila",
          },
        )}`,
        rows,
      }) as BlobPart,
    ],
    {
      type: reportMime[format],
    },
  )
  const url = URL.createObjectURL(
    format === "csv"
      ? new Blob([`\uFEFF`, blob], { type: reportMime.csv })
      : blob,
  )
  const link = document.createElement("a")
  link.href = url
  link.download = `${name.replace(/\.[a-z]+$/i, "")}.${format}`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const escapeHtml = (value: ReportCell) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

/**
 * Prints the selected rows as a plain table. It is drawn in a hidden frame,
 * so it never touches the page's own print rules; the frame is removed after
 * printing (Chrome draws its preview after `print()` returns).
 */
function printRows(title: string, rows: ReportCell[][]) {
  const [head = [], ...body] = rows
  const frame = document.createElement("iframe")
  frame.setAttribute("aria-hidden", "true")
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  const win = frame.contentWindow
  if (!doc || !win) {
    frame.remove()
    return
  }
  doc.open()
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
@page{size:auto;margin:0.6in}
body{font:11pt Arial,sans-serif;color:#111}
h1{font-size:14pt;margin:0 0 8pt}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #999;padding:4pt 6pt;text-align:left;vertical-align:top;font-size:9.5pt}
th{background:#eee}
tr{break-inside:avoid}
</style></head><body><h1>${escapeHtml(title)}</h1><table><thead><tr>${head
    .map((cell) => `<th>${escapeHtml(cell)}</th>`)
    .join("")}</tr></thead><tbody>${body
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
    )
    .join("")}</tbody></table></body></html>`)
  doc.close()
  const cleanup = () => window.setTimeout(() => frame.remove(), 500)
  win.addEventListener("afterprint", cleanup, { once: true })
  window.setTimeout(() => {
    win.focus()
    win.print()
  }, 50)
}

/**
 * Bar above a table while rows are selected: count, Clear, Export selected
 * (CSV, formula-safe), Print selected, Copy and any table-specific
 * `children` buttons.
 */
export function SelectionBar({
  count,
  onClear,
  csvName,
  csvRows,
  children,
  inline = false,
}: {
  count: number
  onClear: () => void
  /** File name for Export; the extension is replaced by the chosen type. */
  csvName?: string
  csvRows?: () => ReportCell[][]
  children?: ReactNode
  /**
   * `inline` (290): the tools sit in the table's filter row, after the last
   * filter (or in the card header), instead of in a bar above the table. They
   * slide in from the right and never add a line at wide widths, so the rows
   * below do not move. Nothing is drawn at count 0 either way.
   */
  inline?: boolean
}) {
  const { t } = useTranslation()
  const [exportOpen, setExportOpen] = useState(false)
  if (count === 0) return null
  return (
    <section
      data-testid="selection-bar"
      aria-label={t("common.selection.bar")}
      className={
        inline
          ? "selection-bar animate-selection-in flex w-full flex-wrap items-center gap-2 rounded-lg bg-brand/5 px-2 py-0.5 text-sm sm:ml-auto sm:w-auto sm:shrink-0 sm:flex-nowrap sm:gap-1 sm:whitespace-nowrap"
          : "selection-bar flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-brand/5 px-4 py-2 text-sm sm:px-5"
      }
    >
      <span className="mr-1 font-medium" aria-live="polite">
        {t("common.selection.count", { count })}
      </span>
      {csvName && csvRows ? (
        <>
          <Button
            type="button"
            variant="tintViolet"
            size="sm"
            data-testid="selection-export"
            className="min-h-11"
            onClick={() => setExportOpen(true)}
          >
            <Download aria-hidden="true" />
            {t("common.selection.export")}
          </Button>
          <ExportFormatDialog
            open={exportOpen}
            onOpenChange={setExportOpen}
            namespace="common.selection.exportDialog"
            onChoose={(format) => {
              saveFile(csvName, format, csvRows())
              setExportOpen(false)
            }}
          />
        </>
      ) : null}
      {csvRows ? (
        <Button
          type="button"
          variant="tintViolet"
          size="sm"
          data-testid="selection-print"
          className="min-h-11"
          onClick={() => printRows(document.title, csvRows())}
        >
          <Printer aria-hidden="true" />
          {t("common.selection.print")}
        </Button>
      ) : null}
      {children}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-11"
        onClick={onClear}
      >
        <X aria-hidden="true" />
        {t("common.selection.clear")}
      </Button>
    </section>
  )
}
