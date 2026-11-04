import {
  type ColumnDef,
  createPaginatedRowModel,
  flexRender,
  type RowData,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { EmptyState } from "@/components/Common/FeedbackState"
import { TablePagination } from "@/components/Common/TablePagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  emptyTitle = "No results found",
  emptyDescription = "There are no records to display.",
}: DataTableProps<TData>) {
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  })

  return (
    <div className="flex flex-col gap-4">
      <Table containerClassName="overflow-x-auto rounded-none border-0">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : null}
        </TableBody>
      </Table>
      {table.getRowModel().rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : null}

      {data.length > 0 ? (
        <TablePagination
          start={table.state.pagination.pageIndex * table.state.pagination.pageSize + 1}
          end={Math.min((table.state.pagination.pageIndex + 1) * table.state.pagination.pageSize, data.length)}
          total={data.length}
          pageIndex={table.state.pagination.pageIndex}
          pageCount={table.getPageCount()}
          onPageChange={table.setPageIndex}
        />
      ) : null}
    </div>
  )
}
