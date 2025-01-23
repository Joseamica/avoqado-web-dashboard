import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { DataTablePagination } from './pagination'
import TableSkeleton from './skeleton-table'

type DataTableProps<TData> = {
  data: TData[]
  rowCount: number
  columns: ColumnDef<TData, any>[]
  isLoading?: boolean // Added isLoading prop
}

function DataTable<TData>({ data, rowCount, columns, isLoading = false }: DataTableProps<TData>) {
  const table = useReactTable({
    data: data || [],
    columns,
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
    // initialState: {
    //   sorting: [{ id: 'createdAt', desc: true }],
    // },
  })

  if (isLoading) {
    return <TableSkeleton columns={columns.length} rows={5} />
  }

  return (
    <>
      <Table className="mb-4 bg-white rounded-xl">
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
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map(row => (
              <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id} className="p-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-10 text-center">
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
