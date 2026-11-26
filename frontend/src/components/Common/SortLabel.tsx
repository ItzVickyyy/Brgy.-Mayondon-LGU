import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { SortApi } from "@/lib/useSort"

/**
 * A column heading that sorts the table when clicked (patch 292). Put it
 * inside the `<th>` and set `aria-sort={sort.ariaSort(column)}` on the `<th>`.
 * A column without a sort accessor (Actions, Outcome) shows its plain label.
 * The button fills the heading's own padding, so the header row keeps its
 * height and the click target is 44 px tall. The arrow is drawn in the gap
 * after the text (absolutely placed), so it adds no width: a table that fits
 * its card still fits.
 */
export function SortLabel({
  sort,
  column,
  label,
}: {
  sort: SortApi
  column: string
  label: string
}) {
  const { t } = useTranslation()
  if (!sort.isSortable(column)) return <>{label}</>
  const dir = sort.dirOf(column)
  const Icon =
    dir === "asc" ? ChevronUp : dir === "desc" ? ChevronDown : ChevronsUpDown
  return (
    <button
      type="button"
      data-testid={`sort-${column}`}
      data-sort={dir ?? "none"}
      title={t("common.sort.hint", { column: label })}
      onClick={() => sort.toggle(column)}
      className={`group relative -my-1.5 -ml-2.5 -mr-7 inline-flex min-h-8 items-center rounded-full pl-2.5 pr-7 font-medium uppercase tracking-wide outline-none transition-colors after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[''] hover:bg-brand/10 hover:text-brand focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
        dir ? "bg-brand/10 text-brand" : ""
      }`}
    >
      {label}
      {/* The arrow chip sits inside the button's right padding, so the tint
          wraps label and chip together. The negative margins cancel that
          padding, so the heading takes no more width than its label. */}
      <span
        aria-hidden="true"
        className={`absolute top-1/2 right-1.5 grid size-4 -translate-y-1/2 place-items-center rounded-full transition-colors ${
          dir
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground group-hover:bg-brand/15 group-hover:text-brand"
        }`}
      >
        <Icon className="size-3" />
      </span>
    </button>
  )
}
