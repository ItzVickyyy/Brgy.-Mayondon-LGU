import { Download, X } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

/**
 * Bar above a table while rows are selected: count, Clear, Export selected
 * (CSV, formula-safe) and any table-specific `children` buttons.
 */
export function SelectionBar({
  count,
  onClear,
  csvName,
  csvRows,
  children,
}: {
  count: number
  onClear: () => void
  csvName?: string
  csvRows?: () => ReportCell[][]
  children?: ReactNode
}) {
  const { t } = useTranslation()
  if (count === 0) return null
  return (
    <section
      data-testid="selection-bar"
      aria-label={t("common.selection.bar")}
      className="selection-bar flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-brand/5 px-4 py-2 text-sm sm:px-5"
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
        {children}
      </div>
    </section>
  )
}
