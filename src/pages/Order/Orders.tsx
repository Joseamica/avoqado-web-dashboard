// src/pages/Orders.tsx

import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue' // Hook actualizado
import { useSocketEvents } from '@/hooks/use-socket-events'
import * as orderService from '@/services/order.service'
import { Order as OrderType } from '@/types' // CAMBIO: Usar el tipo Order
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { exportToCSV, exportToExcel, generateFilename, formatCurrencyForExport } from '@/utils/export'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

export default function Orders() {
  const { t } = useTranslation('orders')
  const { toast } = useToast()
  const { venueId } = useCurrentVenue()
  const { formatTime, formatDate, venueTimezoneShort } = useVenueDateTime()
  const location = useLocation()
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const { data, isLoading, error, refetch } = useQuery({
    // CAMBIO: La query key ahora es 'orders'
    queryKey: ['orders', venueId, pagination.pageIndex, pagination.pageSize],
    queryFn: async () => {
      const response = await orderService.getOrders(venueId, pagination)
      // Backend now filters out PENDING orders automatically
      return response
    },
    refetchOnWindowFocus: true,
  })

  const totalOrders = data?.meta?.total || 0 // CAMBIO: variable renombrada

  useSocketEvents(venueId, socketData => {
    console.log('Received dashboard update via socket:', socketData)
    // La lógica de refetch sigue siendo válida
    refetch()
  })

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  // Render sortable header
  const renderSortableHeader = (label: string | JSX.Element, field: string) => {
    const isSorted = sortField === field
    return (
      <div
        className="flex items-center gap-2 cursor-pointer select-none hover:text-foreground"
        onClick={() => handleSort(field)}
      >
        {label}
        <span className="flex items-center">
          {isSorted && sortOrder === 'asc' && <ArrowUp className="h-4 w-4" />}
          {isSorted && sortOrder === 'desc' && <ArrowDown className="h-4 w-4" />}
          {!isSorted && <ArrowUpDown className="h-4 w-4 opacity-50" />}
        </span>
      </div>
    )
  }

  const columns = useMemo<ColumnDef<OrderType, unknown>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        meta: { label: t('columns.date') },
        header: () =>
          renderSortableHeader(
            <div className="flex flex-col">
              <span>{t('columns.date')}</span>
              <span className="text-xs font-normal text-muted-foreground">({venueTimezoneShort})</span>
            </div>,
            'createdAt',
          ),
        cell: ({ cell }) => {
          const value = cell.getValue() as string
          // ✅ Uses venue timezone instead of browser timezone
          const time = formatTime(value)
          const date = formatDate(value)
          return (
            <div className="flex flex-col space-y-2">
              <span className="text-sm font-medium">{time}</span>
              <span className="text-xs text-muted-foreground">{date}</span>
            </div>
          )
        },
      },
      {
        // CAMBIO: `folio` ahora es `orderNumber`
        accessorKey: 'orderNumber',
        meta: { label: t('columns.orderNumber') },
        header: t('columns.orderNumber'),
        cell: info => <>{(info.getValue() as string) || '-'}</>,
      },
      // {
      //   // CAMBIO: `billName` ahora es `customerName`
      //   accessorKey: 'customerName',
      //   meta: { label: t('columns.customer') },
      //   header: t('columns.customer'),
      //   cell: info => <>{(info.getValue() as string) || t('counter')}</>,
      // },
      {
        accessorKey: 'type',
        meta: { label: t('columns.type') },
        header: () => (
          <div className="flex justify-center">
            {t('columns.type')}
          </div>
        ),
        cell: ({ cell }) => {
          const type = cell.getValue() as string

          // Badge styling for order types
          let typeClasses = { bg: 'bg-muted', text: 'text-muted-foreground' }
          if (type === 'DINE_IN') {
            typeClasses = { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-400' }
          } else if (type === 'TAKEOUT') {
            typeClasses = { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-400' }
          } else if (type === 'DELIVERY') {
            typeClasses = { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-400' }
          } else if (type === 'PICKUP') {
            typeClasses = { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-800 dark:text-cyan-400' }
          }

          // Translation map for order types
          const typeMap: Record<string, string> = {
            DINE_IN: t('types.DINE_IN'),
            TAKEOUT: t('types.TAKEOUT'),
            DELIVERY: t('types.DELIVERY'),
            PICKUP: t('types.PICKUP'),
          }

          return (
            <div className="flex justify-center">
              <Badge variant="soft" className={`${typeClasses.bg} ${typeClasses.text} border-transparent`}>
                {typeMap[type] || type}
              </Badge>
            </div>
          )
        },
      },
      {
        // Mesa (Table)
        accessorFn: row => row.table?.number || '-',
        id: 'tableName',
        meta: { label: t('columns.table') },
        header: t('columns.table'),
        cell: info => <>{info.getValue() as string}</>,
      },
      {
        // CAMBIO: `waiterName` ahora se obtiene del objeto anidado `createdBy`
        accessorFn: row => (row.createdBy ? `${row.createdBy.firstName}` : '-'),
        id: 'waiterName',
        meta: { label: t('columns.waiter') },
        header: () => renderSortableHeader(t('columns.waiter'), 'waiterName'),
      },
      {
        // CAMBIO: Los valores de `status` provienen del enum `OrderStatus`
        accessorKey: 'status',
        meta: { label: t('columns.status') },
        header: () => renderSortableHeader(t('columns.status'), 'status'),
        cell: ({ cell }) => {
          const status = cell.getValue() as string

          // Lógica de clases adaptada a los nuevos estados
          let statusClasses = { bg: 'bg-secondary dark:bg-secondary', text: 'text-secondary-foreground' }
          if (status === 'COMPLETED') {
            statusClasses = { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-400' }
          } else if (status === 'PENDING' || status === 'CONFIRMED' || status === 'PREPARING') {
            statusClasses = { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-400' }
          } else if (status === 'CANCELLED') {
            statusClasses = { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-400' }
          }

          // Mapa de traducción para los nuevos estados
          const statusMap: Record<string, string> = {
            PENDING: t('statuses.PENDING'),
            CONFIRMED: t('statuses.CONFIRMED'),
            PREPARING: t('statuses.PREPARING'),
            READY: t('statuses.READY'),
            COMPLETED: t('statuses.COMPLETED'),
            CANCELLED: t('statuses.CANCELLED'),
          }

          return (
            <div className="flex justify-center">
              <Badge variant="soft" className={`${statusClasses.bg} ${statusClasses.text} border-transparent`}>
                {statusMap[status] || status}
              </Badge>
            </div>
          )
        },
      },
      {
        accessorKey: 'tipAmount',
        meta: { label: t('columns.tip') },
        header: () => renderSortableHeader(t('columns.tip'), 'tipAmount'),
        cell: ({ cell }) => {
          const value = (cell.getValue() as number) || 0
          return Currency(value)
        },
      },
      {
        // CAMBIO: El total es un campo numérico directo, no un string.
        accessorKey: 'total',
        meta: { label: t('columns.total') },
        header: () => renderSortableHeader(t('columns.total'), 'total'),
        cell: ({ cell }) => {
          const value = (cell.getValue() as number) || 0
          // `Currency` probablemente espera centavos, y total es un valor decimal.
          return Currency(value)
        },
      },
    ],
    [t, formatTime, formatDate, venueTimezoneShort, sortField, sortOrder],
  )

  // Search callback for DataTable
  const handleSearch = useCallback((searchTerm: string, orders: any[]) => {
    if (!searchTerm) return orders

    const lowerSearchTerm = searchTerm.toLowerCase()

    return orders.filter(order => {
      const folioMatch = order.orderNumber?.toLowerCase().includes(lowerSearchTerm)
      // const customerMatch = order.customerName?.toLowerCase().includes(lowerSearchTerm)
      const waiterName = order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : ''
      const waiterMatch = waiterName.toLowerCase().includes(lowerSearchTerm)
      const tableName = order.table?.number || ''
      const tableMatch = tableName.toLowerCase().includes(lowerSearchTerm)
      const totalMatch = order.total.toString().includes(lowerSearchTerm)

      return folioMatch || waiterMatch || tableMatch || totalMatch
    })
  }, [])

  // Sort data before displaying
  const sortedData = useMemo(() => {
    const orders = data?.data || []
    if (!sortField) return orders

    return [...orders].sort((a: any, b: any) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        case 'waiterName':
          aValue = a.createdBy ? a.createdBy.firstName.toLowerCase() : ''
          bValue = b.createdBy ? b.createdBy.firstName.toLowerCase() : ''
          break
        case 'status':
          aValue = a.status || ''
          bValue = b.status || ''
          break
        case 'tipAmount':
          aValue = a.tipAmount || 0
          bValue = b.tipAmount || 0
          break
        case 'total':
          aValue = a.total || 0
          bValue = b.total || 0
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [data?.data, sortField, sortOrder])

  // Export functionality
  const handleExport = useCallback(
    (format: 'csv' | 'excel') => {
      const orders = data?.data || []

      if (!orders || orders.length === 0) {
        toast({
          title: t('export.noData'),
          variant: 'destructive',
        })
        return
      }

      try {
        // Transform orders to flat structure for export
        const exportData = orders.map(order => {
          const waiterName = order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '-'
          const tableName = order.table?.number || '-'

          return {
            [t('columns.date')]: formatDate(order.createdAt),
            [t('columns.orderNumber')]: order.orderNumber || '-',
            // [t('columns.customer')]: order.customerName || t('counter'),
            [t('columns.type')]: t(`types.${order.type}` as any),
            [t('columns.table')]: tableName,
            [t('columns.waiter')]: waiterName,
            [t('columns.status')]: t(`statuses.${order.status}` as any),
            [t('columns.tip')]: formatCurrencyForExport(Number(order.tipAmount) || 0),
            [t('columns.total')]: formatCurrencyForExport(Number(order.total) || 0),
          }
        })

        const filename = generateFilename('orders', venueId)

        if (format === 'csv') {
          exportToCSV(exportData, filename)
          toast({
            title: t('export.success', { count: orders.length }),
          })
        } else {
          exportToExcel(exportData, filename, 'Orders')
          toast({
            title: t('export.success', { count: orders.length }),
          })
        }
      } catch (error) {
        console.error('Export error:', error)
        toast({
          title: t('export.error'),
          variant: 'destructive',
        })
      }
    },
    [data?.data, formatDate, venueId, t, toast],
  )

  return (
    <div className={`p-4 bg-background text-foreground`}>
      <div className="flex flex-row items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        {/* Export button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              {t('export.button')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('csv')}>{t('export.asCSV')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('excel')}>{t('export.asExcel')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {error && (
        <div className={`p-4 mb-4 rounded bg-red-100 text-red-800`}>
          {t('errorPrefix')}: {(error as Error).message}
        </div>
      )}

      <DataTable
        data={sortedData}
        rowCount={totalOrders}
        columns={columns}
        isLoading={isLoading}
        enableSearch={true}
        searchPlaceholder={t('searchPlaceholder')}
        onSearch={handleSearch}
        tableId="orders:main"
        clickableRow={row => ({
          to: row.id,
          state: { from: location.pathname },
        })}
        pagination={pagination}
        setPagination={setPagination}
      />
    </div>
  )
}
