import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Select } from "@/components/Common/Select"
import { Button } from "@/components/ui/button"

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export function usePagination<T>(
  items: T[],
  initialPageSize = 10,
  resetKey?: string | number,
) {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSizeState] = useState(initialPageSize)
  const setPageSize = (size: number) => {
    setPageSizeState(size)
    setPageIndex(0)
  }
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey is a trigger; the page goes back to 1 whenever it changes
  useEffect(() => {
    setPageIndex(0)
  }, [resetKey])

  useEffect(() => {
    setPageIndex((current) => Math.min(current, pageCount - 1))
  }, [pageCount])

  const effectivePageIndex = Math.min(pageIndex, pageCount - 1)
  const startIndex = effectivePageIndex * pageSize
  const paginatedItems = items.slice(startIndex, startIndex + pageSize)

  return {
    paginatedItems,
    pageIndex: effectivePageIndex,
    pageCount,
    setPageIndex,
    pageSize,
    setPageSize,
    start: items.length ? startIndex + 1 : 0,
    end: Math.min(startIndex + pageSize, items.length),
    total: items.length,
  }
}

type TablePaginationProps = {
  start: number
  end: number
  total: number
  pageIndex: number
  pageCount: number
  onPageChange: (pageIndex: number) => void
  pageSize?: number
  pageSizeOptions?: number[]
  pageSizeLabel?: string
  onPageSizeChange?: (pageSize: number) => void
}

export function TablePagination({
  start,
  end,
  total,
  pageIndex,
  pageCount,
  onPageChange,
  pageSize,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  pageSizeLabel,
  onPageSizeChange,
}: TablePaginationProps) {
  const { t } = useTranslation()
  const pageSizeId = useId()
  if (total === 0) return null

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("common.pagination.showing", { start, end, total })}
        </p>
        {pageSize !== undefined &&
        pageSizeOptions.length &&
        onPageSizeChange ? (
          <label
            htmlFor={pageSizeId}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <span>{pageSizeLabel ?? t("common.pagination.rowsPerPage")}</span>
            <Select
              id={pageSizeId}
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              wrapperClassName="w-24"
              className="text-foreground"
              openUp
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
      </div>
      {pageCount > 1 ? (
        <nav
          aria-label={t("common.pagination.label")}
          className="flex items-center justify-end gap-2"
        >
          <Button
            type="button"
            variant="outline"
            className="min-h-11 gap-1 px-3"
            onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
            disabled={pageIndex === 0}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">
              {t("common.pagination.previous")}
            </span>
            <span className="sr-only sm:hidden">
              {t("common.pagination.previousPage")}
            </span>
          </Button>
          <span
            className="min-w-[100px] text-center text-sm text-muted-foreground"
            aria-current="page"
            aria-live="polite"
          >
            {t("common.pagination.page", {
              current: pageIndex + 1,
              total: pageCount,
            })}
          </span>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 gap-1 px-3"
            onClick={() => onPageChange(Math.min(pageCount - 1, pageIndex + 1))}
            disabled={pageIndex >= pageCount - 1}
          >
            <span className="hidden sm:inline">
              {t("common.pagination.next")}
            </span>
            <span className="sr-only sm:hidden">
              {t("common.pagination.nextPage")}
            </span>
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </nav>
      ) : null}
    </div>
  )
}
