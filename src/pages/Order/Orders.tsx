// src/pages/Orders.tsx

import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCurrentVenue } from '@/hooks/use-current-venue' // Hook actualizado
import { useSocketEvents } from '@/hooks/use-socket-events'
import * as orderService from '@/services/order.service'
import { Order as OrderType } from '@/types' // CAMBIO: Usar el tipo Order
import { Currency } from '@/utils/currency'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

export default function Orders() {
  const { venueId } = useCurrentVenue() // Hook actualizado
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
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

  const columns = useMemo<ColumnDef<OrderType, unknown>[]>(
    () => [
      {
        accessorKey: 'createdAt', // Sin cambios
        header: 'Fecha',
        cell: ({ cell }) => {
          // Lógica de formato de fecha sin cambios
          const value = cell.getValue() as string
          const date = new Date(value)
          const monthName = date.toLocaleString('es-ES', { month: 'short' }).toUpperCase()
          const year = date.getUTCFullYear()
          const last2Year = year.toString().slice(-2)
          const day = date.getDate()
          const hour = date.getHours()
          const minutes = date.getMinutes().toString().padStart(2, '0')
          const ampm = date.getHours() >= 12 ? 'pm' : 'am'
          return (
            <div className="flex flex-col space-y-2">
              <span className="font-[600] text-[14px]">{`${hour}:${minutes}${ampm}`}</span>
              <span className="font-[400] text-muted-foreground text-[12px]">{`${day}/${monthName}/${last2Year}`}</span>
            </div>
          )
        },
      },
      {
        // CAMBIO: `folio` ahora es `orderNumber`
        accessorKey: 'orderNumber',
        header: 'Folio',
        cell: info => <>{(info.getValue() as string) || '-'}</>,
      },
      {
        // CAMBIO: `billName` ahora es `customerName`
        accessorKey: 'customerName',
        header: 'Cliente',
        cell: info => <>{(info.getValue() as string) || 'Mostrador'}</>,
      },
      {
        // CAMBIO: `waiterName` ahora se obtiene del objeto anidado `createdBy`
        accessorFn: row => (row.createdBy ? `${row.createdBy.firstName}` : '-'),
        id: 'waiterName',
        header: 'Mesero',
      },
      {
        // CAMBIO: Los valores de `status` provienen del enum `OrderStatus`
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ cell }) => {
          const status = cell.getValue() as string

          // Lógica de clases adaptada a los nuevos estados
          let statusClasses = { bg: 'bg-secondary', text: 'text-secondary-foreground' }
          if (status === 'COMPLETED') {
            statusClasses = { bg: 'bg-green-100', text: 'text-green-800' }
          } else if (status === 'PENDING' || status === 'CONFIRMED' || status === 'PREPARING') {
            statusClasses = { bg: 'bg-yellow-100', text: 'text-yellow-800' }
          } else if (status === 'CANCELLED') {
            statusClasses = { bg: 'bg-red-100', text: 'text-red-800' }
          }

          // Mapa de traducción para los nuevos estados
          const statusMap: Record<string, string> = {
            PENDING: 'Pendiente',
            CONFIRMED: 'Confirmada',
            PREPARING: 'En Preparación',
            READY: 'Lista',
            COMPLETED: 'Completada',
            CANCELLED: 'Cancelada',
          }

          return (
            <div className="flex justify-center">
              <span className={`${statusClasses.bg} ${statusClasses.text} px-3 py-1 font-medium rounded-full`}>
                {statusMap[status] || status}
              </span>
            </div>
          )
        },
      },
      {
        // CAMBIO: El total es un campo numérico directo, no un string.
        accessorKey: 'total',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Total
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ cell }) => {
          const value = (cell.getValue() as number) || 0
          // `Currency` probablemente espera centavos, y total es un valor decimal.
          return Currency(value * 100)
        },
      },
    ],
    [],
  )

  const filteredOrders = useMemo(() => {
    const orders = data?.data || []
    if (!searchTerm) return orders

    const lowerSearchTerm = searchTerm.toLowerCase()

    return orders.filter(order => {
      // CAMBIO: Adaptar los campos de búsqueda
      const folioMatch = order.orderNumber?.toLowerCase().includes(lowerSearchTerm)
      const customerMatch = order.customerName?.toLowerCase().includes(lowerSearchTerm)
      const waiterName = order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : ''
      const waiterMatch = waiterName.toLowerCase().includes(lowerSearchTerm)
      const totalMatch = order.total.toString().includes(lowerSearchTerm)

      return folioMatch || customerMatch || waiterMatch || totalMatch
    })
  }, [searchTerm, data])

  return (
    <div className={`p-4 bg-background text-foreground`}>
      <div className="flex flex-row items-center justify-between">
        {/* CAMBIO: El título ahora es Órdenes */}
        <h1 className="text-xl font-semibold">Órdenes</h1>
      </div>

      <Input
        type="text"
        placeholder="Buscar por folio, cliente o mesero..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className={`p-2 mt-4 mb-4 border rounded bg-background border-border max-w-sm`}
      />

      {error && (
        <div className={`p-4 mb-4 rounded bg-red-100 text-red-800`}>
          Error al cargar órdenes: {(error as Error).message}
        </div>
      )}

      <DataTable
        data={filteredOrders}
        rowCount={totalOrders}
        columns={columns}
        isLoading={isLoading}
        clickableRow={row => ({
          to: row.id, // El ID de la orden
          state: { from: location.pathname },
        })}
        pagination={pagination}
        setPagination={setPagination}
      />
    </div>
  )
}
