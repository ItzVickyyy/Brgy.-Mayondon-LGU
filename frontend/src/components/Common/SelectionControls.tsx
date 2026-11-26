import { Clipboard, Download, Printer, X } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import useCustomToast from "@/hooks/useCustomToast"
import { type ReportCell, reportCsv } from "@/lib/reports/reportFiles"

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

function saveCsv(name: string, rows: ReportCell[][]) {
  const blob = new Blob([`\uFEFF${reportCsv(rows)}`], {
    type: "text/csv;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
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

/** Tab-separated text, so it pastes into Excel or Word as a table. */
function tabText(rows: ReportCell[][]) {
  return rows
    .map((row) =>
      row.map((cell) => String(cell).replace(/[\t\r\n]+/g, " ")).join("\t"),
    )
    .join("\n")
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
  csvName?: string
  csvRows?: () => ReportCell[][]
  children?: ReactNode
  /**
   * `inline` (290): the tools sit at the right of the table's filter row
   * (or card header) instead of in a bar above the table. Place it as a child
   * of that row; it takes the free space on the right and wraps onto its own
   * right-aligned line when the filters leave no room. Nothing is drawn at
   * count 0 either way.
   */
  inline?: boolean
}) {
  const { t } = useTranslation()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  if (count === 0) return null
  async function copy() {
    if (!csvRows) return
    try {
      await navigator.clipboard.writeText(tabText(csvRows()))
      showSuccessToast(t("common.selection.copied", { count }))
    } catch {
      showErrorToast(t("common.selection.copyFailed"))
    }
  }
  return (
    <section
      data-testid="selection-bar"
      aria-label={t("common.selection.bar")}
      className={
        inline
          ? "selection-bar flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-brand/5 px-3 py-1 text-sm sm:ml-auto sm:w-auto"
          : "selection-bar flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-brand/5 px-4 py-2 text-sm sm:px-5"
      }
    >
      <span
        className="order-1 min-w-0 flex-1 font-medium sm:mr-auto sm:flex-none"
        aria-live="polite"
      >
        {t("common.selection.count", { count })}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="order-2 min-h-11 sm:order-3"
        onClick={onClear}
      >
        <X aria-hidden="true" />
        {t("common.selection.clear")}
      </Button>
      <div className="order-3 flex w-full flex-wrap items-center gap-2 sm:order-2 sm:w-auto">
        {csvName && csvRows ? (
          <Button
            type="button"
            variant="tintViolet"
            size="sm"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => saveCsv(csvName, csvRows())}
          >
            <Download aria-hidden="true" />
            {t("common.selection.export")}
          </Button>
        ) : null}
        {csvRows ? (
          <>
            <Button
              type="button"
              variant="tintViolet"
              size="sm"
              data-testid="selection-print"
              className="min-h-11 flex-1 sm:flex-none"
              onClick={() => printRows(document.title, csvRows())}
            >
              <Printer aria-hidden="true" />
              {t("common.selection.print")}
            </Button>
            <Button
              type="button"
              variant="tintTeal"
              size="sm"
              data-testid="selection-copy"
              className="min-h-11 flex-1 sm:flex-none"
              onClick={copy}
            >
              <Clipboard aria-hidden="true" />
              {t("common.selection.copy")}
            </Button>
          </>
        ) : null}
        {children}
      </div>
    </section>
  )
}
