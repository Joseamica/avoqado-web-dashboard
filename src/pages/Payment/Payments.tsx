// src/pages/Payments.tsx

import api from '@/api'
import { Button } from '@/components/ui/button'
import DataTable from '@/components/data-table'
import { Input } from '@/components/ui/input'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useSocketEvents } from '@/hooks/use-socket-events'
import { Payment as PaymentType } from '@/types' // Asumiendo que actualizas este tipo
import { Currency } from '@/utils/currency'
import getIcon from '@/utils/getIcon'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Computer, Smartphone } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

export default function Payments() {
  const { venueId } = useCurrentVenue()
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  // --- SIN CAMBIOS EN useQuery ---
  // La lógica de fetching sigue siendo válida porque el nuevo backend
  // devuelve la estructura { data, meta } que el frontend espera.
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['payments', venueId, pagination.pageIndex, pagination.pageSize],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payments`, {
        params: {
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
        },
      })
      // La respuesta ya tiene el formato { data: Payment[], meta: {...} }
      return response.data
    },
    // Habilitar refetchOnWindowFocus puede ser útil para datos en tiempo real
    refetchOnWindowFocus: true,
  })

  const totalPayments = data?.meta?.total || 0

  // --- SIN CAMBIOS EN useSocketEvents ---
  // La lógica de refetch al recibir un evento sigue siendo correcta.
  useSocketEvents(venueId, socketData => {
    console.log('Received payment update via socket:', socketData)
    refetch()
  })

  // ==================================================================
  // --- PRINCIPALES CAMBIOS EN LA DEFINICIÓN DE COLUMNAS ---
  // ==================================================================
  const columns = useMemo<ColumnDef<PaymentType, unknown>[]>(
    () => [
      {
        accessorKey: 'createdAt', // Sin cambios
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Fecha
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ cell }) => {
          // La lógica de formato de fecha no necesita cambios
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
        // CAMBIO: Accedemos al mesero a través de `processedBy`
        accessorFn: row => (row.processedBy ? `${row.processedBy.firstName} ${row.processedBy.lastName}` : '-'),
        id: 'waiterName', // Es buena práctica dar un ID único al usar accessorFn
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Mesero
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: info => <>{info.getValue() as string}</>,
      },
      {
        // CAMBIO: La propina ahora es un campo numérico directo `tipAmount`
        accessorFn: row => row.tipAmount || 0,
        id: 'totalTipAmount',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Propina
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ cell, row }) => {
          const totalTip = cell.getValue() as number
          // CAMBIO: El subtotal ahora es el campo `amount`
          const subtotal = row.original.amount || 0
          const tipPercentage = subtotal > 0 ? (totalTip / subtotal) * 100 : 0

          // La lógica de colores no necesita cambios
          let tipClasses = {
            bg: 'bg-green-100',
            text: 'text-green-800',
          }
          if (tipPercentage < 7) {
            tipClasses = { bg: 'bg-red-100', text: 'text-red-800' }
          } else if (tipPercentage >= 7 && tipPercentage < 10) {
            tipClasses = { bg: 'bg-yellow-100', text: 'text-yellow-800' }
          }

          return (
            <div className="flex flex-col space-y-1 items-center">
              <span className="text-[12px] font-semibold text-muted-foreground">{tipPercentage.toFixed(1)}%</span>
              {/* CAMBIO: `Currency` espera centavos, y `totalTip` es un valor decimal. */}
              <p className={`${tipClasses.bg} ${tipClasses.text} px-3 py-1 font-medium rounded-full`}>{Currency(totalTip * 100)}</p>
            </div>
          )
        },
        sortingFn: 'basic',
      },
      {
        // CAMBIO: `source` ahora viene del objeto `order` anidado.
        accessorFn: row => row.order?.source || 'DESCONOCIDO',
        id: 'source',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Origen
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ cell }) => {
          // Los valores del enum `OrderSource` son TPV, QR, WEB, APP, POS
          const source = cell.getValue() as string

          if (source === 'POS') {
            return (
              <div className="space-x-2 flex flex-row items-center">
                <Computer className="h-4 w-4 text-muted-foreground" />
                <span className="text-[12px] font-[600] text-muted-foreground">POS</span>
              </div>
            )
          } else if (source === 'TPV') {
            // ANTERIOR: 'AVOQADO_TPV'
            return (
              <div className="space-x-2 flex flex-row items-center">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <span className="text-[12px] font-[600] text-muted-foreground">TPV</span>
              </div>
            )
          }

          return <span className="text-[12px] font-[600] text-muted-foreground">{source}</span>
        },
      },
      {
        accessorKey: 'method',
        header: 'Método',
        cell: ({ row }) => {
          const payment = row.original
          // ANTERIOR: 'CARD', AHORA: 'CREDIT_CARD', 'DEBIT_CARD'
          const isCard = payment.method === 'CREDIT_CARD' || payment.method === 'DEBIT_CARD'
          const methodDisplay = payment.method === 'CASH' ? 'Efectivo' : 'Tarjeta'

          // CAMBIO: `last4` y `cardBrand` podrían estar en `processorData`.
          // Simplificamos si no están directamente disponibles.
          const cardBrand = payment.processorData?.cardBrand || 'generic'
          const last4 = payment.processorData?.last4 || ''

          return (
            <div className="space-x-2 flex flex-row items-center">
              {isCard ? (
                <>
                  <span>{getIcon(cardBrand)}</span>
                  <span className="text-[12px] font-[600] text-muted-foreground">{last4 ? `**** ${last4}` : 'Tarjeta'}</span>
                </>
              ) : (
                <span className="text-[12px] font-[600] text-muted-foreground">{methodDisplay}</span>
              )}
            </div>
          )
        },
      },
      {
        // CAMBIO: `amount` ahora es el subtotal del pago. Es numérico.
        accessorKey: 'amount',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Subtotal
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ cell }) => {
          const value = (cell.getValue() as number) || 0
          // `Currency` espera centavos.
          return Currency(value * 100)
        },
      },
      {
        // CAMBIO: El total es la suma de `amount` y `tipAmount`.
        accessorFn: row => (row.amount || 0) + (row.tipAmount || 0),
        id: 'totalAmount',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Total
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ cell }) => {
          const value = (cell.getValue() as number) || 0
          // `Currency` espera centavos.
          return Currency(value * 100)
        },
      },
    ],
    [], // Dependencias del useMemo, vacío está bien si no depende de props/state
  )

  // CAMBIO: Actualizar la lógica de filtrado/búsqueda
  const filteredPayments = useMemo(() => {
    const payments = data?.data || []
    if (!searchTerm) return payments

    const lowerSearchTerm = searchTerm.toLowerCase()

    return payments.filter(payment => {
      // Búsqueda por nombre de mesero
      const waiterName = payment.processedBy ? `${payment.processedBy.firstName} ${payment.processedBy.lastName}` : ''
      const waiterMatches = waiterName.toLowerCase().includes(lowerSearchTerm)

      // Búsqueda por total
      const total = (payment.amount || 0) + (payment.tipAmount || 0)
      const totalMatch = total.toString().includes(lowerSearchTerm)

      // Búsqueda por método de pago
      const methodMatch = payment.method.toLowerCase().includes(lowerSearchTerm)

      return waiterMatches || totalMatch || methodMatch
    })
  }, [searchTerm, data])

  return (
    <div className={`p-4 bg-background text-foreground`}>
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-semibold">Pagos</h1>
      </div>

      <Input
        type="text"
        placeholder="Buscar por mesero, total o método..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className={`p-2 mt-4 mb-4 border rounded bg-background border-border max-w-sm`}
      />

      {error && <div className={`p-4 mb-4 rounded bg-red-100 text-red-800`}>Error al cargar pagos: {(error as Error).message}</div>}

      <DataTable
        data={filteredPayments}
        rowCount={totalPayments}
        columns={columns}
        isLoading={isLoading}
        clickableRow={row => ({
          // CAMBIO: Asegurarse de que el ID de la fila sea el correcto
          to: row.id,
          state: { from: location.pathname },
        })}
        pagination={pagination}
        setPagination={setPagination}
      />
    </div>
  )
}
