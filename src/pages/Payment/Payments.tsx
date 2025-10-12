// src/pages/Payments.tsx

import api from '@/api'
import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useSocketEvents } from '@/hooks/use-socket-events'
import { Payment as PaymentType } from '@/types' // Asumiendo que actualizas este tipo
import { Currency } from '@/utils/currency'
import getIcon from '@/utils/getIcon'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { AppWindow, ArrowUpDown, Banknote, Computer, Globe, QrCode, Smartphone, TabletSmartphone, TestTube } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

export default function Payments() {
  const { t, i18n } = useTranslation()
  const { venueId } = useCurrentVenue()
  const location = useLocation()
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
        meta: { label: t('payments.columns.date') },
        header: t('payments.columns.date'),
        cell: ({ cell }) => {
          const value = cell.getValue() as string
          const date = new Date(value)

          // Localized time and date without hardcoded strings
          const timeStr = date.toLocaleTimeString(localeCode, { hour: 'numeric', minute: '2-digit' })
          const dateStr = date.toLocaleDateString(localeCode, { day: '2-digit', month: 'short', year: '2-digit' })

          return (
            <div className="flex flex-col space-y-2">
              <span className="text-sm font-medium">{timeStr}</span>
              <span className="text-xs text-muted-foreground">{dateStr}</span>
            </div>
          )
        },
      },
      {
        // CAMBIO: Accedemos al mesero a través de `processedBy`
        accessorFn: row => (row.processedBy ? `${row.processedBy.firstName} ${row.processedBy.lastName}` : '-'),
        id: 'waiterName', // Es buena práctica dar un ID único al usar accessorFn
        meta: { label: t('payments.columns.waiter') },
        header: t('payments.columns.waiter'),
        cell: info => <>{info.getValue() as string}</>,
      },

      {
        // Source viene directamente del campo `source` del Payment
        accessorKey: 'source',
        id: 'source',
        meta: { label: t('payments.columns.source') },
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('payments.columns.source')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ cell }) => {
          // Valores posibles: TPV, QR, WEB, APP, POS, UNKNOWN
          const source = String(cell.getValue() || 'UNKNOWN')

          const iconBox = (icon: JSX.Element, bgColor: string = 'bg-muted') => (
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${bgColor} border border-border shadow-sm`}>{icon}</div>
          )

          const map = {
            POS: {
              icon: iconBox(<Computer className="h-4 w-4 text-blue-600" />, 'bg-blue-50 dark:bg-blue-950/50'),
              label: t('payments.sources.POS'),
            },
            TPV: {
              icon: iconBox(<TabletSmartphone className="h-4 w-4 text-green-600" />, 'bg-green-50 dark:bg-green-950/50'),
              label: t('payments.sources.TPV'),
            },
            QR: {
              icon: iconBox(<QrCode className="h-4 w-4 text-purple-600" />, 'bg-purple-50 dark:bg-purple-950/50'),
              label: t('payments.sources.QR'),
            },
            WEB: {
              icon: iconBox(<Globe className="h-4 w-4 text-orange-600" />, 'bg-orange-50 dark:bg-orange-950/50'),
              label: t('payments.sources.WEB'),
            },
            APP: {
              icon: iconBox(<AppWindow className="h-4 w-4 text-indigo-600" />, 'bg-indigo-50 dark:bg-indigo-950/50'),
              label: t('payments.sources.APP'),
            },
            DASHBOARD_TEST: {
              icon: iconBox(<TestTube className="h-4 w-4 text-indigo-600" />, 'bg-indigo-50 dark:bg-indigo-950/50'),
              label: t('payments.sources.DASHBOARD_TEST'),
            },
            UNKNOWN: {
              icon: iconBox(<Smartphone className="h-4 w-4 text-muted-foreground" />, 'bg-muted'),
              label: t('payments.sources.UNKNOWN'),
            },
          } as const

          const item = map[source as keyof typeof map] || map.UNKNOWN

          return (
            <div className="flex items-center gap-3">
              {item.icon}
              <span className="text-sm font-medium text-foreground">{item.label}</span>
            </div>
          )
        },
      },
      {
        accessorKey: 'method',
        meta: { label: t('payments.columns.method') },
        header: t('payments.columns.method'),
        cell: ({ row }) => {
          const payment = row.original
          // ANTERIOR: 'CARD', AHORA: 'CREDIT_CARD', 'DEBIT_CARD'
          const isCard = payment.method === 'CREDIT_CARD' || payment.method === 'DEBIT_CARD'
          const methodDisplay = payment.method === 'CASH' ? t('payments.methods.cash') : t('payments.methods.card')

          // CAMBIO: `last4` y `cardBrand` podrían estar en `processorData`.
          // Simplificamos si no están directamente disponibles.
          const cardBrand = payment.cardBrand || payment.processorData?.cardBrand || null
          const last4 = payment.last4 || payment.processorData?.last4 || payment.processorData?.maskedPan || ''

          return (
            <div className="flex items-center gap-3">
              {isCard ? (
                <>
                  <div className="shrink-0"> {getIcon(cardBrand)}</div>
                  <span className="text-sm font-medium text-foreground">{last4 ? `**** ${last4}` : t('payments.methods.card')}</span>
                </>
              ) : (
                <>
                  <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 shadow-sm">
                    <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{methodDisplay}</span>
                </>
              )}
            </div>
          )
        },
      },
      {
        // CAMBIO: `amount` ahora es el subtotal del pago. Es numérico.
        accessorKey: 'amount',
        meta: { label: t('payments.columns.subtotal') },
        header: t('payments.columns.subtotal'),
        cell: ({ cell }) => {
          const value = cell.getValue()
          // Convert to number, Currency function handles null/undefined
          return Currency(Number(value) || 0)
        },
      },
      {
        // CAMBIO: La propina ahora es un campo numérico directo `tipAmount`
        // Usamos número para poder calcular porcentajes y ordenar correctamente
        accessorFn: row => Number(row.tipAmount) || 0,
        id: 'totalTipAmount',
        meta: { label: t('payments.columns.tip') },
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
            bg: 'bg-green-100 dark:bg-green-900/30',
            text: 'text-green-800 dark:text-green-400',
          }
          if (tipPercentage < 7) {
            tipClasses = { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-400' }
          } else if (tipPercentage >= 7 && tipPercentage < 10) {
            tipClasses = { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-400' }
          }

          return (
            <div className="flex flex-col space-y-1 items-center">
              <span className="text-xs font-semibold text-muted-foreground">{tipPercentage.toFixed(1)}%</span>
              {/* Formatear propina en unidades (Currency ya maneja decimales) */}
              <Badge variant="soft" className={`${tipClasses.bg} ${tipClasses.text} border-transparent`}>
                {Currency(totalTip)}
              </Badge>
            </div>
          )
        },
        sortingFn: 'basic',
      },
      {
        // CAMBIO: El total es la suma de `amount` y `tipAmount`.
        accessorFn: row => {
          const amount = Number(row.amount) || 0
          const tipAmount = Number(row.tipAmount) || 0
          return amount + tipAmount
        },
        id: 'totalAmount',
        meta: { label: t('payments.columns.total') },
        header: t('payments.columns.total'),
        cell: ({ cell }) => {
          const value = cell.getValue()
          // Convert to number, Currency function handles null/undefined
          return Currency(Number(value) || 0)
        },
      },
    ],
    [t, localeCode],
  )

  // Search callback for DataTable with multi-language support
  const handleSearch = (searchTerm: string, payments: PaymentType[]) => {
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

      // Búsqueda por método de pago - buscar en ambos idiomas y valores originales
      const methodOriginal = payment.method?.toLowerCase() || ''
      const methodTranslated =
        payment.method === 'CASH' ? t('payments.methods.cash').toLowerCase() : t('payments.methods.card').toLowerCase()

      // También buscar en términos comunes en inglés
      const methodEnglish = payment.method === 'CASH' ? 'cash' : 'card'
      const methodMatches =
        methodOriginal.includes(lowerSearchTerm) || methodTranslated.includes(lowerSearchTerm) || methodEnglish.includes(lowerSearchTerm)

      // Búsqueda por fuente - buscar en valores originales y traducciones
      const source = payment.source || 'UNKNOWN'
      const sourceOriginal = source.toLowerCase()
      const sourceTranslated = t(`payments.sources.${source}`, { defaultValue: source }).toLowerCase()

      // Términos en inglés para fuentes
      const sourceEnglishTerms = {
        POS: ['pos', 'terminal'],
        TPV: ['tpv', 'tablet'],
        QR: ['qr', 'codigo'],
        WEB: ['web', 'website'],
        APP: ['app', 'mobile', 'movil'],
        UNKNOWN: ['unknown', 'desconocido'],
      }

      const sourceEnglishMatches =
        sourceEnglishTerms[source as keyof typeof sourceEnglishTerms]?.some(
          term => term.includes(lowerSearchTerm) || lowerSearchTerm.includes(term),
        ) || false

      const sourceMatches = sourceOriginal.includes(lowerSearchTerm) || sourceTranslated.includes(lowerSearchTerm) || sourceEnglishMatches

      return waiterMatches || totalMatch || methodMatches || sourceMatches
    })
  }

  return (
    <div className={`p-4 bg-background text-foreground`}>
      <div className="flex flex-row items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">{t('payments.title')}</h1>
      </div>

      {error && (
        <div className={`p-4 mb-4 rounded bg-red-100 text-red-800`}>
          {t('payments.errorPrefix')}: {(error as Error).message}
        </div>
      )}

      <DataTable
        data={data?.data || []}
        rowCount={totalPayments}
        columns={columns}
        isLoading={isLoading}
        tableId="payments:main"
        enableSearch={true}
        searchPlaceholder={t('payments.searchPlaceholder')}
        onSearch={handleSearch}
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
