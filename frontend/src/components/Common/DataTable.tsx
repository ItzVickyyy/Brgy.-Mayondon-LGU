import {
  type ColumnDef,
  createPaginatedRowModel,
  flexRender,
  type RowData,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { useTranslation } from "react-i18next"
import { EmptyState } from "@/components/Common/FeedbackState"
import {
  PageCheckbox,
  RowCheckbox,
  SelectionBar,
} from "@/components/Common/SelectionControls"
import { SortLabel } from "@/components/Common/SortLabel"
import { TablePagination } from "@/components/Common/TablePagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ReportCell } from "@/lib/reports/reportFiles"
import { useRowSelection } from "@/lib/useRowSelection"
import { type SortValue, useSort } from "@/lib/useSort"

const dataTableFeatures = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})

export type DataTableFeatures = typeof dataTableFeatures

interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<DataTableFeatures, TData>[]
  data: TData[]
  emptyTitle?: string
  emptyDescription?: string
  /** Click-to-sort (292): the value to compare, by column id; a column not listed is not sortable. */
  sortBy?: Record<string, (row: TData) => SortValue>
  /** Batch selection (278): a stable id and a name (for screen readers) per row. */
  selection?: {
    getRowId: (row: TData) => string
    getRowLabel: (row: TData) => string
    csvName: string
    csvRows: (rows: TData[]) => ReportCell[][]
  }
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  emptyTitle,
  emptyDescription,
  selection,
  sortBy = {},
}: DataTableProps<TData>) {
  const { t } = useTranslation()
  const sort = useSort(data, sortBy)
  const table = useTable({
    features: dataTableFeatures,
    data: sort.sorted,
    columns,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  })

  const pageRows = table.getRowModel().rows.map((row) => row.original)
  const pick = useRowSelection(
    pageRows,
    (row) => selection?.getRowId(row) ?? "",
    selection ? data.map(selection.getRowId) : [],
  )

  return (
    <div className="flex flex-col gap-4">
      {selection ? (
        <SelectionBar
          count={pick.count}
          onClear={pick.clear}
          csvName={selection.csvName}
          csvRows={() => selection.csvRows(pick.pick(data))}
        />
      ) : null}
      <Table containerClassName="overflow-x-auto rounded-none border-0">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {selection ? (
                <TableHead className="w-11 pl-5 pr-0">
                  <PageCheckbox
                    all={pick.allOnPage}
                    some={pick.someOnPage}
                    onChange={pick.togglePage}
                  />
                </TableHead>
              ) : null}
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={sort.ariaSort(header.column.id)}
                    className={
                      header.column.id === "actions"
                        ? "sticky right-0 bg-muted sticky-head-cell"
                        : undefined
                    }
                  >
                    {header.isPlaceholder ? null : typeof header.column
                        .columnDef.header === "string" &&
                      sort.isSortable(header.column.id) ? (
                      <SortLabel
                        sort={sort}
                        column={header.column.id}
                        label={header.column.columnDef.header}
                      />
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length
            ? table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  {selection ? (
                    <TableCell className="w-11 pl-5 pr-0">
                      <RowCheckbox
                        label={selection.getRowLabel(row.original)}
                        checked={pick.isSelected(
                          selection.getRowId(row.original),
                        )}
                        onChange={() =>
                          pick.toggle(selection.getRowId(row.original))
                        }
                      />
                    </TableCell>
                  ) : null}
                  {row.getAllCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={
                        cell.column.id === "actions"
                          ? "sticky right-0 bg-card row-hover-cell sticky-edge"
                          : undefined
                      }
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : null}
        </TableBody>
      </Table>
      {table.getRowModel().rows.length === 0 ? (
        <EmptyState
          title={emptyTitle ?? t("common.table.emptyTitle")}
          description={emptyDescription ?? t("common.table.emptyDescription")}
        />
      ) : null}

      {data.length > 0 ? (
        <TablePagination
          start={
            table.state.pagination.pageIndex * table.state.pagination.pageSize +
            1
          }
          end={Math.min(
            (table.state.pagination.pageIndex + 1) *
              table.state.pagination.pageSize,
            data.length,
          )}
          total={data.length}
          pageIndex={table.state.pagination.pageIndex}
          pageCount={table.getPageCount()}
          onPageChange={table.setPageIndex}
          pageSize={table.state.pagination.pageSize}
          onPageSizeChange={(size) => table.setPageSize(size)}
        />
      ) : null}
    </div>
  )
}
