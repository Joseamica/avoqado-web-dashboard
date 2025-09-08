import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select'
import { type Table as TableType } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from './ui/button'
import { useTranslation } from 'react-i18next'

interface DataTablePaginationProps<TData> {
  table: TableType<TData>
}

export function DataTablePagination<TData>({ table }: DataTablePaginationProps<TData>) {
  const { t } = useTranslation()
  // Safety checks - only render pagination if the table is properly initialized
  if (!table || !table.getState || !table.getFilteredRowModel || !table.getFilteredRowModel().rows) {
    return null
  }

  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex-1 text-sm text-muted-foreground">
        {t(['pagination.selectedRows', 'tpv.pagination.selectedRows'], {
          selected: table.getFilteredSelectedRowModel()?.rows?.length || 0,
          total: table.getFilteredRowModel().rows.length,
          defaultValue: `${table.getFilteredSelectedRowModel()?.rows?.length || 0} of ${table.getFilteredRowModel().rows.length} row(s) selected.`,
        })}
      </div>
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">{t(['pagination.rowsPerPage', 'tpv.pagination.rowsPerPage'], { defaultValue: 'Rows per page' })}</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={value => {
              table.setPageSize(Number(value))
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map(pageSize => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          {t(['pagination.pageOf', 'tpv.pagination.pageOf'], {
            current: table.getState().pagination.pageIndex + 1,
            total: table.getPageCount() || 1,
            defaultValue: `Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount() || 1}`,
          })}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden w-8 h-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">{t(['pagination.firstPage', 'tpv.pagination.firstPage'], { defaultValue: 'Go to first page' })}</span>
            <ChevronsLeft />
          </Button>
          <Button variant="outline" className="w-8 h-8 p-0" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <span className="sr-only">{t(['pagination.previousPage', 'tpv.pagination.previousPage'], { defaultValue: 'Go to previous page' })}</span>
            <ChevronLeft />
          </Button>
          <Button variant="outline" className="w-8 h-8 p-0" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <span className="sr-only">{t(['pagination.nextPage', 'tpv.pagination.nextPage'], { defaultValue: 'Go to next page' })}</span>
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            className="hidden w-8 h-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">{t(['pagination.lastPage', 'tpv.pagination.lastPage'], { defaultValue: 'Go to last page' })}</span>
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
