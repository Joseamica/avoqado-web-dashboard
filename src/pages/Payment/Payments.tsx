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
import { useTranslation } from 'react-i18next'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useLocation } from 'react-router-dom'

export default function Payments() {
  const { t, i18n } = useTranslation()
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
  const localeCode = getIntlLocale(i18n.language)

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
            {t('payments.columns.date')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ cell }) => {
          const value = cell.getValue() as string
          const date = new Date(value)

          // Usar toLocaleString con zona horaria local para consistencia
          const localDate = new Date(date.getTime())
          const monthName = localDate.toLocaleString(localeCode, { month: 'short' }).toUpperCase()
          const year = localDate.getFullYear()
          const last2Year = year.toString().slice(-2)
          const day = localDate.getDate()
          const hour = localDate.getHours()
          const minutes = localDate.getMinutes().toString().padStart(2, '0')
          const ampm = localDate.getHours() >= 12 ? 'pm' : 'am'

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
            {t('payments.columns.waiter')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: info => <>{info.getValue() as string}</>,
      },
      {
        // CAMBIO: La propina ahora es un campo numérico directo `tipAmount`
        // Usamos número para poder calcular porcentajes y ordenar correctamente
        accessorFn: row => Number(row.tipAmount) || 0,
        id: 'totalTipAmount',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('payments.columns.tip')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ cell, row }) => {
          const totalTip = (cell.getValue() as number) || 0
          // CAMBIO: El subtotal ahora es el campo `amount` (numérico)
          const subtotal = Number(row.original.amount) || 0
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
              {/* Formatear propina en unidades (Currency ya maneja decimales) */}
              <p className={`${tipClasses.bg} ${tipClasses.text} px-3 py-1 font-medium rounded-full`}>{Currency(totalTip)}</p>
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
            {t('payments.columns.source')}
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
        header: t('payments.columns.method'),
        cell: ({ row }) => {
          const payment = row.original
          // ANTERIOR: 'CARD', AHORA: 'CREDIT_CARD', 'DEBIT_CARD'
          const isCard = payment.method === 'CREDIT_CARD' || payment.method === 'DEBIT_CARD'
          const methodDisplay = payment.method === 'CASH' ? t('payments.methods.cash') : t('payments.methods.card')

          // CAMBIO: `last4` y `cardBrand` podrían estar en `processorData`.
          // Simplificamos si no están directamente disponibles.
          const cardBrand = payment.processorData?.cardBrand || 'generic'
          const last4 = payment.processorData?.last4 || ''

          return (
            <div className="space-x-2 flex flex-row items-center">
              {isCard ? (
                <>
                  <span>{getIcon(cardBrand)}</span>
                  <span className="text-[12px] font-[600] text-muted-foreground">{last4 ? `**** ${last4}` : t('payments.methods.card')}</span>
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
            {t('payments.columns.subtotal')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ cell }) => {
          const value = cell.getValue()
          // Convert to number, Currency function handles null/undefined
          return Currency(Number(value) || 0)
        },
      },
      {
        // CAMBIO: El total es la suma de `amount` y `tipAmount`.
        accessorFn: row => {
          const amount = Number(row.amount) || 0
          const tipAmount = Number(row.tipAmount) || 0
          return amount + tipAmount
        },
        id: 'totalAmount',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('payments.columns.total')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ cell }) => {
          const value = cell.getValue()
          // Convert to number, Currency function handles null/undefined
          return Currency(Number(value) || 0)
        },
      },
    ],
    [t, localeCode],
  )

  // CAMBIO: Actualizar la lógica de filtrado/búsqueda
  const filteredPayments = useMemo(() => {
    const payments = data?.data || []
    if (!searchTerm) return payments

    const lowerSearchTerm = searchTerm.toLowerCase()

    return payments.filter((payment: PaymentType) => {
      // Búsqueda por nombre de mesero
      const waiterName = payment.processedBy ? `${payment.processedBy.firstName} ${payment.processedBy.lastName}` : ''
      const waiterMatches = waiterName.toLowerCase().includes(lowerSearchTerm)

      // Búsqueda por total - usando Number para strings
      const amount = Number(payment.amount) || 0
      const tipAmount = Number(payment.tipAmount) || 0
      const total = amount + tipAmount
      const totalMatch = total.toString().includes(lowerSearchTerm)

      // Búsqueda por método de pago
      const methodMatch = payment.method.toLowerCase().includes(lowerSearchTerm)

      return waiterMatches || totalMatch || methodMatch
    })
  }, [searchTerm, data])

  return (
    <div className={`p-4 bg-background text-foreground`}>
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-semibold">{t('payments.title')}</h1>
      </div>

      <Input
        type="text"
        placeholder={t('payments.searchPlaceholder')}
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className={`p-2 mt-4 mb-4 border rounded bg-background border-border max-w-sm`}
      />

      {error && <div className={`p-4 mb-4 rounded bg-red-100 text-red-800`}>{t('payments.errorPrefix')}: {(error as Error).message}</div>}

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
