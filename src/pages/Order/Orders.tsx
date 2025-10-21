// src/pages/Orders.tsx

import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { useCurrentVenue } from '@/hooks/use-current-venue' // Hook actualizado
import { useSocketEvents } from '@/hooks/use-socket-events'
import * as orderService from '@/services/order.service'
import { Order as OrderType } from '@/types' // CAMBIO: Usar el tipo Order
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

export default function Orders() {
  const { t, i18n } = useTranslation()
  const { venueId } = useCurrentVenue()
  const { formatTime, formatDate, venueTimezoneShort } = useVenueDateTime()
  const location = useLocation()
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const { data, isLoading, error, refetch } = useQuery({
    // CAMBIO: La query key ahora es 'orders'
    queryKey: ['orders', venueId, pagination.pageIndex, pagination.pageSize],
    queryFn: () => orderService.getOrders(venueId, pagination),
    refetchOnWindowFocus: true,
  })

  const totalOrders = data?.meta?.total || 0 // CAMBIO: variable renombrada

  useSocketEvents(venueId, socketData => {
    console.log('Received dashboard update via socket:', socketData)
    // La lógica de refetch sigue siendo válida
    refetch()
  })

  const localeCode = getIntlLocale(i18n.language)

  const columns = useMemo<ColumnDef<OrderType, unknown>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        meta: { label: t('orders.columns.date') },
        header: () => (
          <div className="flex flex-col">
            <span>{t('orders.columns.date')}</span>
            <span className="text-xs font-normal text-muted-foreground">({venueTimezoneShort})</span>
          </div>
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
        meta: { label: t('orders.columns.orderNumber') },
        header: t('orders.columns.orderNumber'),
        cell: info => <>{(info.getValue() as string) || '-'}</>,
      },
      {
        // CAMBIO: `billName` ahora es `customerName`
        accessorKey: 'customerName',
        meta: { label: t('orders.columns.customer') },
        header: t('orders.columns.customer'),
        cell: info => <>{(info.getValue() as string) || t('orders.counter')}</>,
      },
      {
        // CAMBIO: `waiterName` ahora se obtiene del objeto anidado `createdBy`
        accessorFn: row => (row.createdBy ? `${row.createdBy.firstName}` : '-'),
        id: 'waiterName',
        meta: { label: t('orders.columns.waiter') },
        header: t('orders.columns.waiter'),
      },
      {
        // CAMBIO: Los valores de `status` provienen del enum `OrderStatus`
        accessorKey: 'status',
        meta: { label: t('orders.columns.status') },
        header: t('orders.columns.status'),
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
            PENDING: t('orders.statuses.PENDING'),
            CONFIRMED: t('orders.statuses.CONFIRMED'),
            PREPARING: t('orders.statuses.PREPARING'),
            READY: t('orders.statuses.READY'),
            COMPLETED: t('orders.statuses.COMPLETED'),
            CANCELLED: t('orders.statuses.CANCELLED'),
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
        // CAMBIO: El total es un campo numérico directo, no un string.
        accessorKey: 'total',
        meta: { label: t('orders.columns.total') },
        header: t('orders.columns.total'),
        cell: ({ cell }) => {
          const value = (cell.getValue() as number) || 0
          // `Currency` probablemente espera centavos, y total es un valor decimal.
          return Currency(value)
        },
      },
    ],
    [t, localeCode, formatTime, formatDate, venueTimezoneShort],
  )

  // Search callback for DataTable
  const handleSearch = useCallback((searchTerm: string, orders: any[]) => {
    if (!searchTerm) return orders

    const lowerSearchTerm = searchTerm.toLowerCase()

    return orders.filter(order => {
      const folioMatch = order.orderNumber?.toLowerCase().includes(lowerSearchTerm)
      const customerMatch = order.customerName?.toLowerCase().includes(lowerSearchTerm)
      const waiterName = order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : ''
      const waiterMatch = waiterName.toLowerCase().includes(lowerSearchTerm)
      const totalMatch = order.total.toString().includes(lowerSearchTerm)

      return folioMatch || customerMatch || waiterMatch || totalMatch
    })
  }, [])

  return (
    <div className={`p-4 bg-background text-foreground`}>
      <div className="flex flex-row items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">{t('orders.title')}</h1>
      </div>

      {error && (
        <div className={`p-4 mb-4 rounded bg-red-100 text-red-800`}>
          {t('orders.errorPrefix')}: {(error as Error).message}
        </div>
      )}

      <DataTable
        data={data?.data || []}
        rowCount={totalOrders}
        columns={columns}
        isLoading={isLoading}
        enableSearch={true}
        searchPlaceholder={t('orders.searchPlaceholder')}
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
