import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, ClickableTableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import SearchBar from '@/components/search-bar'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  PaginationState,
  RowSelectionState,
  VisibilityState,
} from '@tanstack/react-table'
import { Dispatch, SetStateAction, useEffect, useState, useMemo } from 'react'
import { DataTablePagination } from './pagination'
import TableSkeleton from './skeleton-table'

type DataTableProps<TData> = {
  data: TData[]
  rowCount: number
  columns: ColumnDef<TData, any>[]
  isLoading?: boolean
  clickableRow?: (row: TData) => { to: string; state?: Record<string, any> }
  onRowClick?: (row: TData) => void
  pagination?: PaginationState
  setPagination?: Dispatch<SetStateAction<PaginationState>>
  showColumnCustomizer?: boolean
  tableId?: string
  // Search functionality
  enableSearch?: boolean
  searchPlaceholder?: string
  onSearch?: (searchTerm: string, data: TData[]) => TData[]
}

function DataTable<TData>({
  data,
  rowCount: _rowCount,
  columns,
  isLoading = false,
  clickableRow,
  onRowClick,
  pagination,
  setPagination,
  showColumnCustomizer = true,
  tableId,
  enableSearch = false,
  searchPlaceholder,
  onSearch,
}: DataTableProps<TData>) {
  // MUST call ALL hooks at the very top, before ANY conditional logic or returns
  const { t } = useTranslation()

  // Row selection state to prevent React Table errors
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (!tableId) return {}
    try {
      const raw = localStorage.getItem(`table:visibility:${tableId}`)
      return raw ? (JSON.parse(raw) as VisibilityState) : {}
    } catch {
      return {}
    }
  })

  // Search state
  const [searchTerm, setSearchTerm] = useState('')

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!enableSearch || !searchTerm || !onSearch) {
      return data || []
    }
    return onSearch(searchTerm, data || [])
  }, [enableSearch, searchTerm, onSearch, data])

  // Default pagination state if not provided
  const defaultPagination = {
    pageIndex: 0,
    pageSize: 10,
  }

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      pagination: pagination || defaultPagination,
      rowSelection,
      columnVisibility,
    },
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    manualPagination: !!setPagination, // Use manual pagination when pagination state is controlled externally
    rowCount: _rowCount, // Total number of rows for server-side pagination
    getCoreRowModel: getCoreRowModel(),
    defaultColumn: {
      size: 10,
      minSize: 200, //enforced during column resizing
    },
    debugTable: false, // Disable debug mode to prevent console errors
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    sortDescFirst: true, //sort by all columns in descending order first (default is ascending for string columns and descending for number columns)
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: false, // Explicitly disable row selection to prevent errors
  })

  // Persist visibility per tableId
  useEffect(() => {
    if (!tableId) return
    try {
      localStorage.setItem(`table:visibility:${tableId}`, JSON.stringify(columnVisibility))
    } catch {
      /* Intentionally ignore localStorage write errors (e.g., Safari private mode or quota exceeded) */
    }
  }, [tableId, columnVisibility])

  if (isLoading) {
    const skeletonRows = pagination?.pageSize || defaultPagination.pageSize
    return (
      <>
        {/* Toolbar Skeleton */}
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Bar Skeleton */}
          {enableSearch && (
            <div className="flex-1">
              <Skeleton className="h-10 w-full max-w-md" />
            </div>
          )}

          {/* Column Customizer Skeleton */}
          {showColumnCustomizer && <Skeleton className="h-10 w-48" />}
        </div>

        {/* Table Skeleton */}
        <TableSkeleton columns={columns.length} rows={skeletonRows} />
      </>
    )
  }

  // Handle case where there's no data yet
  const hasRows = table.getRowModel() && table.getRowModel().rows && table.getRowModel().rows.length > 0

  return (
    <>
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Bar */}
        {enableSearch && (
          <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder={searchPlaceholder || t('common.search')} />
        )}

        {/* Column Customizer */}
        {showColumnCustomizer && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="default" className="gap-2">
                <Settings2 className="h-4 w-4" /> {t('customize_columns')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" sideOffset={5}>
              {table
                .getAllLeafColumns()
                .filter(col => col.getCanHide())
                .map(col => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    className="capitalize"
                    checked={col.getIsVisible()}
                    onCheckedChange={val => col.toggleVisibility(!!val)}
                  >
                    {(col.columnDef as any)?.meta?.label ??
                      (typeof col.columnDef.header === 'string' ? (col.columnDef.header as string) : col.id)}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <Table containerClassName="mb-4 rounded-xl border border-border bg-background overflow-hidden" className="table-sticky">
        {/* <TableCaption>{t('dashboard.tableTexts.paymentsList')}</TableCaption> */}
        <TableHeader className="sticky top-0 z-10 bg-muted dark:bg-[#262626] text-muted-foreground">
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id} className="border-border">
              {headerGroup.headers.map(header => {
                return (
                  <TableHead key={header.id} className="px-4 py-3 font-medium first:rounded-tl-xl last:rounded-tr-xl">
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
                    className="bg-background border-border hover:bg-background data-[state=selected]:bg-background"
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </ClickableTableRow>
                )
              }

              return (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={`bg-background border-border hover:bg-background data-[state=selected]:bg-background ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className={`h-10 text-center text-muted-foreground`}>
                {t('no_results')}
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
