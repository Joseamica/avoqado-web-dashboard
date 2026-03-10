import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, ClickableTableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
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
  ColumnSizingState,
} from '@tanstack/react-table'
import { Dispatch, ReactNode, SetStateAction, useCallback, useEffect, useState, useMemo } from 'react'
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
  /** Controlled search value (for server-side search). When provided, the internal search state is bypassed. */
  searchValue?: string
  /** Called when the search input changes. Use with searchValue for controlled/server-side search. */
  onSearchChange?: (value: string) => void
  // Row styling
  getRowClassName?: (row: TData) => string | undefined
  /** Enable sticky first column with shadow indicator on horizontal scroll (Stripe/Linear pattern) */
  stickyFirstColumn?: boolean
  /** Enable column resizing by dragging column borders */
  enableColumnResizing?: boolean
  /** Render expandable sub-content below a row. Return null/undefined to skip. */
  renderSubComponent?: (row: TData) => ReactNode | null | undefined
  /** Enable row selection with checkboxes */
  enableRowSelection?: boolean
  /** Callback with selected row data whenever selection changes */
  onRowSelectionChange?: (selectedRows: TData[]) => void
  /** Change this value to programmatically clear row selection (e.g., increment a counter) */
  clearSelectionTrigger?: number
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
  showColumnCustomizer = false,
  tableId,
  enableSearch = false,
  searchPlaceholder,
  onSearch,
  searchValue,
  onSearchChange,
  getRowClassName,
  stickyFirstColumn = false,
  enableColumnResizing = false,
  renderSubComponent,
  enableRowSelection: enableRowSelectionProp = false,
  onRowSelectionChange: onRowSelectionChangeProp,
  clearSelectionTrigger,
}: DataTableProps<TData>) {
  // MUST call ALL hooks at the very top, before ANY conditional logic or returns
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation('common')

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

  // Column sizing state with localStorage persistence
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    if (!tableId || !enableColumnResizing) return {}
    try {
      const raw = localStorage.getItem(`table:sizing:${tableId}`)
      return raw ? (JSON.parse(raw) as ColumnSizingState) : {}
    } catch {
      return {}
    }
  })

  // Search state (internal, used when not controlled via searchValue/onSearchChange)
  const [internalSearchTerm, setInternalSearchTerm] = useState('')
  const isControlledSearch = searchValue !== undefined
  const currentSearchTerm = isControlledSearch ? searchValue : internalSearchTerm
  const handleSearchChange = isControlledSearch
    ? (onSearchChange || (() => {}))
    : setInternalSearchTerm

  // Internal pagination state (used when pagination/setPagination not provided)
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // Filter data based on search (only for client-side/uncontrolled search)
  const filteredData = useMemo(() => {
    if (!enableSearch || isControlledSearch || !currentSearchTerm || !onSearch) {
      return data || []
    }
    return onSearch(currentSearchTerm, data || [])
  }, [enableSearch, isControlledSearch, currentSearchTerm, onSearch, data])

  // Prepend checkbox column when row selection is enabled
  const allColumns = useMemo<ColumnDef<TData, any>[]>(() => {
    if (!enableRowSelectionProp) return columns
    const selectColumn: ColumnDef<TData, any> = {
      id: 'select',
      header: ({ table: tbl }) => {
        const isAllSelected = tbl.getIsAllPageRowsSelected()
        const isSomeSelected = tbl.getIsSomePageRowsSelected()
        return (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
              onCheckedChange={value => tbl.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
              className="translate-y-[2px]"
            />
          </div>
        )
      },
      cell: ({ row }) => (
        <div
          className="flex items-center justify-center"
          onClick={e => { e.stopPropagation(); e.preventDefault() }}
        >
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={value => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        </div>
      ),
      size: 40,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
    }
    return [selectColumn, ...columns]
  }, [columns, enableRowSelectionProp])

  // Clear selection when data changes (e.g., page change, filter change)
  useEffect(() => {
    setRowSelection({})
  }, [filteredData])

  // Clear selection when parent triggers it
  useEffect(() => {
    if (clearSelectionTrigger !== undefined) setRowSelection({})
  }, [clearSelectionTrigger])

  // Notify parent of selection changes
  const handleRowSelectionChange = useCallback(
    (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
      setRowSelection(updater)
    },
    [],
  )

  // Use external pagination if provided, otherwise use internal state
  const currentPagination = pagination || internalPagination
  const currentSetPagination = setPagination || setInternalPagination

  const table = useReactTable({
    data: filteredData,
    columns: allColumns,
    state: {
      pagination: currentPagination,
      rowSelection,
      columnVisibility,
      columnSizing,
    },
    onPaginationChange: currentSetPagination,
    onRowSelectionChange: handleRowSelectionChange,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    manualPagination: !!setPagination, // Use manual pagination when pagination state is controlled externally
    rowCount: _rowCount, // Total number of rows for server-side pagination
    getCoreRowModel: getCoreRowModel(),
    defaultColumn: {
      size: 150, // Default column width
      minSize: 50, // Minimum column width when resizing
      maxSize: 500, // Maximum column width when resizing
    },
    // Column resizing configuration
    enableColumnResizing,
    columnResizeMode: 'onChange', // 'onChange' for live resize, 'onEnd' for resize on mouse up
    debugTable: false, // Disable debug mode to prevent console errors
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    sortDescFirst: true, //sort by all columns in descending order first (default is ascending for string columns and descending for number columns)
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: enableRowSelectionProp,
  })

  // Notify parent when selection changes
  useEffect(() => {
    if (!onRowSelectionChangeProp) return
    const selectedRows = table.getSelectedRowModel().rows.map(row => row.original)
    onRowSelectionChangeProp(selectedRows)
  }, [rowSelection, onRowSelectionChangeProp, table])

  // Persist visibility per tableId
  useEffect(() => {
    if (!tableId) return
    try {
      localStorage.setItem(`table:visibility:${tableId}`, JSON.stringify(columnVisibility))
    } catch {
      /* Intentionally ignore localStorage write errors (e.g., Safari private mode or quota exceeded) */
    }
  }, [tableId, columnVisibility])

  // Persist column sizing per tableId
  useEffect(() => {
    if (!tableId || !enableColumnResizing) return
    try {
      localStorage.setItem(`table:sizing:${tableId}`, JSON.stringify(columnSizing))
    } catch {
      /* Intentionally ignore localStorage write errors */
    }
  }, [tableId, enableColumnResizing, columnSizing])

  if (isLoading) {
    const skeletonRows = currentPagination.pageSize
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
      {/* Toolbar - Only render if has content */}
      {(enableSearch || showColumnCustomizer) && (
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Bar */}
          {enableSearch && <SearchBar value={currentSearchTerm} onChange={handleSearchChange} placeholder={searchPlaceholder || t('search')} />}

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
      )}
      <Table
        containerClassName="mb-4 rounded-xl border border-border bg-background overflow-hidden"
        className="table-sticky"
        stickyFirstColumn={stickyFirstColumn}
        style={enableColumnResizing ? { width: table.getCenterTotalSize(), tableLayout: 'fixed' } : undefined}
      >
        {/* <TableCaption>{t('dashboard.tableTexts.paymentsList')}</TableCaption> */}
        <TableHeader className="sticky top-0 z-10 bg-muted dark:bg-[#262626] text-muted-foreground">
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id} className="border-border">
              {headerGroup.headers.map(header => {
                const canResize = enableColumnResizing && header.column.getCanResize()
                return (
                  <TableHead
                    key={header.id}
                    className="px-4 py-3 font-medium first:rounded-tl-xl last:rounded-tr-xl relative group"
                    style={{
                      width: enableColumnResizing ? header.getSize() : undefined,
                    }}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}

                    {/* Column resize handle - visible line at column edge */}
                    {canResize && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => header.column.resetSize()}
                        className={`
                          absolute right-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full
                          cursor-col-resize select-none touch-none transition-all duration-150
                          ${
                            header.column.getIsResizing()
                              ? 'bg-primary h-full rounded-none'
                              : 'bg-border/60 hover:bg-primary/70 hover:h-6 group-hover:bg-border'
                          }
                        `}
                        title={tCommon('doubleClickToReset', 'Double-click to reset')}
                      />
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        {hasRows ? (
          table.getRowModel().rows.map(row => {
            const customRowClass = getRowClassName?.(row.original) || ''
            const subContent = renderSubComponent?.(row.original)
            if (clickableRow) {
              const { to, state } = clickableRow(row.original)
              return (
                <TableBody key={row.id}>
                  <ClickableTableRow
                    data-state={row.getIsSelected() && 'selected'}
                    to={to}
                    state={state}
                    className={`bg-background border-border ${row.getIsSelected() ? 'bg-primary/5 dark:bg-primary/10' : ''} ${customRowClass}`}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell
                        key={cell.id}
                        className="px-4 py-3"
                        style={{
                          width: enableColumnResizing ? cell.column.getSize() : undefined,
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </ClickableTableRow>
                </TableBody>
              )
            }

            return (
              <TableBody key={row.id} className={subContent ? 'group' : undefined}>
                <TableRow
                  data-state={row.getIsSelected() && 'selected'}
                  className={`bg-background border-border ${row.getIsSelected() ? 'bg-primary/5! dark:bg-primary/10!' : 'data-[state=selected]:bg-background'} ${
                    onRowClick ? 'cursor-pointer transition-colors hover:bg-muted/30' : 'hover:bg-background'
                  } ${subContent ? 'group-hover:bg-muted/30' : ''} ${customRowClass}`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell
                      key={cell.id}
                      className="px-4 py-3"
                      style={{
                        width: enableColumnResizing ? cell.column.getSize() : undefined,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
                {subContent && (
                  <TableRow className="bg-background border-border group-hover:bg-muted/30">
                    <TableCell colSpan={allColumns.length} className="p-0">
                      {subContent}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            )
          })
        ) : (
          <TableBody>
            <TableRow>
              <TableCell colSpan={allColumns.length} className={`h-10 text-center text-muted-foreground`}>
                {t('no_results')}
              </TableCell>
            </TableRow>
          </TableBody>
        )}
      </Table>
      <DataTablePagination table={table} />
    </>
  )
}
export default DataTable
