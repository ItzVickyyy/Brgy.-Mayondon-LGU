import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"

export function usePagination<T>(items: T[], pageSize = 10, resetKey?: string | number) {
  const [pageIndex, setPageIndex] = useState(0)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))

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
}

export function TablePagination({ start, end, total, pageIndex, pageCount, onPageChange }: TablePaginationProps) {
  if (total === 0) return null

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-sm text-muted-foreground" aria-live="polite">Showing {start}–{end} of {total}</p>
      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-11 gap-1 px-3" onClick={() => onPageChange(Math.max(0, pageIndex - 1))} disabled={pageIndex === 0}>
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Previous</span>
            <span className="sr-only sm:hidden">Previous page</span>
          </Button>
          <span className="min-w-[100px] text-center text-sm text-muted-foreground" aria-current="page" aria-live="polite">Page {pageIndex + 1} of {pageCount}</span>
          <Button type="button" variant="outline" className="min-h-11 gap-1 px-3" onClick={() => onPageChange(Math.min(pageCount - 1, pageIndex + 1))} disabled={pageIndex >= pageCount - 1}>
            <span className="hidden sm:inline">Next</span>
            <span className="sr-only sm:hidden">Next page</span>
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </nav>
      ) : null}
    </div>
  )
}
