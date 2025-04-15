import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, ClickableTableRow } from '@/components/ui/table'
import { themeClasses } from '@/lib/theme-utils'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  PaginationState,
} from '@tanstack/react-table'
import { Dispatch, SetStateAction } from 'react'
import { DataTablePagination } from './pagination'
import TableSkeleton from './skeleton-table'

type DataTableProps<TData> = {
  data: TData[]
  rowCount: number
  columns: ColumnDef<TData, any>[]
  isLoading?: boolean
  clickableRow?: (row: TData) => { to: string; state?: Record<string, any> }
  pagination?: PaginationState
  setPagination?: Dispatch<SetStateAction<PaginationState>>
}

function DataTable<TData>({ data, rowCount, columns, isLoading = false, clickableRow, pagination, setPagination }: DataTableProps<TData>) {
  // Default pagination state if not provided
  const defaultPagination = {
    pageIndex: 0,
    pageSize: 10,
  }

  const table = useReactTable({
    data: data || [],
    columns,
    pageCount: pagination ? Math.ceil(rowCount / pagination.pageSize) : Math.ceil(rowCount / defaultPagination.pageSize),
    state: {
      pagination: pagination || defaultPagination,
    },
    onPaginationChange: setPagination,
    manualPagination: !!pagination, // Enable server-side pagination when pagination prop is provided
    rowCount: rowCount || 0,
    getCoreRowModel: getCoreRowModel(),
    defaultColumn: {
      size: 10,
      minSize: 200, //enforced during column resizing
    },
    debugTable: true,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    sortDescFirst: true, //sort by all columns in descending order first (default is ascending for string columns and descending for number columns)
    getPaginationRowModel: getPaginationRowModel(),
  })

  if (isLoading) {
    return <TableSkeleton columns={columns.length} rows={5} />
  }

  // Handle case where there's no data yet
  const hasRows = table.getRowModel() && table.getRowModel().rows && table.getRowModel().rows.length > 0

  return (
    <>
      <Table className={`mb-4 rounded-xl ${themeClasses.table.bg}`}>
        {/* <TableCaption>Lista de los pagos realizados.</TableCaption> */}
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => {
                return (
                  <TableHead key={header.id} className="p-4">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    {/* {header.column.getCanFilter() ? (
                  <div>
                    <Filter column={header.column} table={table} />
                  </div>
                ) : null} */}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {hasRows ? (
            table.getRowModel().rows.map(row => {
              if (clickableRow) {
                const { to, state } = clickableRow(row.original)
                return (
                  <ClickableTableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    to={to}
                    state={state}
                    className={themeClasses.table.border}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id} className="p-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </ClickableTableRow>
                )
              }

              return (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'} className={themeClasses.table.border}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className="p-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className={`h-10 text-center ${themeClasses.textMuted}`}>
                Sin resultados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <DataTablePagination table={table} />
    </>
  )
}
export default DataTable
