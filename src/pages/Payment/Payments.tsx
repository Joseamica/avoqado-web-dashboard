// src/pages/Payments.tsx

import api from '@/api'
import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AddToAIButton } from '@/components/AddToAIButton'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useSocketEvents } from '@/hooks/use-socket-events'
import { useAuth } from '@/context/AuthContext'
import { Payment as PaymentType, StaffRole } from '@/types' // Asumiendo que actualizas este tipo
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { exportToCSV, exportToExcel, generateFilename, formatCurrencyForExport } from '@/utils/export'
import getIcon from '@/utils/getIcon'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import {
  AppWindow,
  ArrowUpDown,
  Banknote,
  Computer,
  Download,
  Globe,
  QrCode,
  Smartphone,
  TabletSmartphone,
  TestTube,
  X,
} from 'lucide-react'
import { useMemo, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'

export default function Payments() {
  const { t } = useTranslation('payment')
  const { toast } = useToast()
  const { venueId } = useCurrentVenue()
  const { user } = useAuth()
  const isSuperAdmin = user?.role === StaffRole.SUPERADMIN
  const { formatTime, formatDate, venueTimezoneShort } = useVenueDateTime()
  const location = useLocation()
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  // Filter states
  const [merchantAccountFilter, setMerchantAccountFilter] = useState<string>('all')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [waiterFilter, setWaiterFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Reset pagination when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [merchantAccountFilter, methodFilter, sourceFilter, waiterFilter, searchTerm])

  // --- SIN CAMBIOS EN useQuery ---
  // La lógica de fetching sigue siendo válida porque el nuevo backend
  // devuelve la estructura { data, meta } que el frontend espera.
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      'payments',
      venueId,
      pagination.pageIndex,
      pagination.pageSize,
      merchantAccountFilter,
      methodFilter,
      sourceFilter,
      waiterFilter,
      searchTerm,
    ],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payments`, {
        params: {
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          ...(merchantAccountFilter !== 'all' && { merchantAccountId: merchantAccountFilter }),
          ...(methodFilter !== 'all' && { method: methodFilter }),
          ...(sourceFilter !== 'all' && { source: sourceFilter }),
          ...(waiterFilter !== 'all' && { staffId: waiterFilter }),
          ...(searchTerm && { search: searchTerm }),
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

  // Get payments data directly from server (already filtered)
  const payments = useMemo(() => data?.data || [], [data?.data])

  // Extract unique options for filters
  const { merchantAccounts, methods, sources, waiters } = useMemo(() => {
    const payments = data?.data || []

    // Unique merchant accounts
    const merchantAccountsMap = new Map()
    payments.forEach((p: PaymentType) => {
      if (p.merchantAccount) {
        merchantAccountsMap.set(p.merchantAccount.id, p.merchantAccount)
      }
    })

    // Unique methods
    const methodsSet = new Set(payments.map((p: PaymentType) => p.method).filter(Boolean))

    // Unique sources
    const sourcesSet = new Set(payments.map((p: PaymentType) => p.source).filter(Boolean))

    // Unique waiters
    const waitersMap = new Map()
    payments.forEach((p: PaymentType) => {
      if (p.processedBy) {
        waitersMap.set(p.processedBy.id, p.processedBy)
      }
    })

    return {
      merchantAccounts: Array.from(merchantAccountsMap.values()),
      methods: Array.from(methodsSet),
      sources: Array.from(sourcesSet),
      waiters: Array.from(waitersMap.values()),
    }
  }, [data?.data])

  // Count active filters
  const activeFiltersCount = [
    merchantAccountFilter !== 'all',
    methodFilter !== 'all',
    sourceFilter !== 'all',
    waiterFilter !== 'all',
    searchTerm !== '',
  ].filter(Boolean).length

  // Reset all filters
  const resetFilters = useCallback(() => {
    setMerchantAccountFilter('all')
    setMethodFilter('all')
    setSourceFilter('all')
    setWaiterFilter('all')
    setSearchTerm('')
  }, [])

  // ==================================================================
  // --- PRINCIPALES CAMBIOS EN LA DEFINICIÓN DE COLUMNAS ---
  // ==================================================================
  const columns = useMemo<ColumnDef<PaymentType, unknown>[]>(
    () => [
      {
        id: 'ai',
        meta: { label: t('columns.ai', { defaultValue: 'AI' }) },
        header: () => <span className="sr-only">{t('columns.ai', { defaultValue: 'AI' })}</span>,
        cell: ({ row }) => (
          <div className="flex justify-center">
            <AddToAIButton payment={row.original} variant="icon" />
          </div>
        ),
        size: 50,
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'createdAt',
        meta: { label: t('columns.date') },
        header: () => (
          <div className="flex flex-col">
            <span>{t('columns.date')}</span>
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
        // CAMBIO: Accedemos al mesero a través de `processedBy`
        accessorFn: row => (row.processedBy ? `${row.processedBy.firstName} ${row.processedBy.lastName}` : '-'),
        id: 'waiterName', // Es buena práctica dar un ID único al usar accessorFn
        meta: { label: t('columns.waiter') },
        header: t('columns.waiter'),
        cell: info => <>{info.getValue() as string}</>,
      },

      {
        // Merchant account information
        accessorFn: row => row.merchantAccount?.displayName || row.merchantAccount?.externalMerchantId || 'N/A',
        id: 'merchantAccount',
        meta: { label: t('columns.merchantAccount') },
        header: t('columns.merchantAccount'),
        cell: ({ row }) => {
          const payment = row.original
          const merchant = payment.merchantAccount

          if (!merchant) {
            return <span className="text-xs text-muted-foreground">{t('columns.notAvailable')}</span>
          }

          return (
            <div className="flex flex-col space-y-1">
              <span className="text-sm font-medium">{merchant.displayName || merchant.externalMerchantId}</span>
              {merchant.bankName && <span className="text-xs text-muted-foreground">{merchant.bankName}</span>}
            </div>
          )
        },
      },

      {
        // Source viene directamente del campo `source` del Payment
        accessorKey: 'source',
        id: 'source',
        meta: { label: t('columns.source') },
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('columns.source')}
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
              label: t('sources.POS'),
            },
            TPV: {
              icon: iconBox(<TabletSmartphone className="h-4 w-4 text-green-600" />, 'bg-green-50 dark:bg-green-950/50'),
              label: t('sources.TPV'),
            },
            QR: {
              icon: iconBox(<QrCode className="h-4 w-4 text-purple-600" />, 'bg-purple-50 dark:bg-purple-950/50'),
              label: t('sources.QR'),
            },
            WEB: {
              icon: iconBox(<Globe className="h-4 w-4 text-orange-600" />, 'bg-orange-50 dark:bg-orange-950/50'),
              label: t('sources.WEB'),
            },
            APP: {
              icon: iconBox(<AppWindow className="h-4 w-4 text-indigo-600" />, 'bg-indigo-50 dark:bg-indigo-950/50'),
              label: t('sources.APP'),
            },
            DASHBOARD_TEST: {
              icon: iconBox(<TestTube className="h-4 w-4 text-indigo-600" />, 'bg-indigo-50 dark:bg-indigo-950/50'),
              label: t('sources.DASHBOARD_TEST'),
            },
            UNKNOWN: {
              icon: iconBox(<Smartphone className="h-4 w-4 text-muted-foreground" />, 'bg-muted'),
              label: t('sources.UNKNOWN'),
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
        meta: { label: t('columns.method') },
        header: t('columns.method'),
        cell: ({ row }) => {
          const payment = row.original
          // ANTERIOR: 'CARD', AHORA: 'CREDIT_CARD', 'DEBIT_CARD'
          const isCard = payment.method === 'CREDIT_CARD' || payment.method === 'DEBIT_CARD'
          const methodDisplay = payment.method === 'CASH' ? t('methods.cash') : t('methods.card')

          // CAMBIO: `last4` y `cardBrand` podrían estar en `processorData`.
          // Simplificamos si no están directamente disponibles.
          const cardBrand = payment.cardBrand || payment.processorData?.cardBrand || null
          const last4 = payment.last4 || payment.processorData?.last4 || payment.processorData?.maskedPan || ''

          return (
            <div className="flex items-center gap-3">
              {isCard ? (
                <>
                  <div className="shrink-0"> {getIcon(cardBrand)}</div>
                  <span className="text-sm font-medium text-foreground">{last4 ? `**** ${last4}` : t('methods.card')}</span>
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
        meta: { label: t('columns.subtotal') },
        header: t('columns.subtotal'),
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
        meta: { label: t('columns.tip') },
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('columns.tip')}
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
      // SUPERADMIN ONLY: Profit column showing Avoqado's earnings
      ...(isSuperAdmin
        ? [
            {
              accessorFn: (row: PaymentType) => {
                if (!row.transactionCost) return 0
                return Number(row.transactionCost.grossProfit) || 0
              },
              id: 'avoqadoProfit',
              meta: { label: t('columns.profit') },
              header: ({ column }: any) => (
                <div className="flex justify-center">
                  <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    {t('columns.profit')}
                    <ArrowUpDown className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ),
              cell: ({ row }: any) => {
                const payment = row.original
                if (!payment.transactionCost) {
                  return (
                    <div className="flex justify-center">
                      <span className="text-xs text-muted-foreground">-</span>
                    </div>
                  )
                }

                const profit = Number(payment.transactionCost.grossProfit) || 0
                const margin = Number(payment.transactionCost.profitMargin) || 0
                const providerCost = Number(payment.transactionCost.providerCostAmount) || 0
                const venueCharge = Number(payment.transactionCost.venueChargeAmount) || 0

                // Color based on profit margin
                let profitClasses = {
                  bg: 'bg-emerald-100 dark:bg-emerald-900/30',
                  text: 'text-emerald-800 dark:text-emerald-400',
                  border: 'border-emerald-200 dark:border-emerald-800',
                }
                if (margin < 0.01) {
                  // Less than 1% margin
                  profitClasses = {
                    bg: 'bg-red-100 dark:bg-red-900/30',
                    text: 'text-red-800 dark:text-red-400',
                    border: 'border-red-200 dark:border-red-800',
                  }
                } else if (margin >= 0.01 && margin < 0.02) {
                  // 1-2% margin
                  profitClasses = {
                    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
                    text: 'text-yellow-800 dark:text-yellow-400',
                    border: 'border-yellow-200 dark:border-yellow-800',
                  }
                }

                return (
                  <div
                    className="flex flex-col space-y-1 items-center"
                    title={`Provider: ${Currency(providerCost)} | Venue: ${Currency(venueCharge)}`}
                  >
                    <span className="text-xs font-semibold text-muted-foreground">{(margin * 100).toFixed(2)}%</span>
                    <Badge variant="outline" className={`${profitClasses.bg} ${profitClasses.text} ${profitClasses.border}`}>
                      {Currency(profit)}
                    </Badge>
                  </div>
                )
              },
              sortingFn: 'basic',
            } as ColumnDef<PaymentType, unknown>,
          ]
        : []),
      {
        // CAMBIO: El total es la suma de `amount` y `tipAmount`.
        accessorFn: row => {
          const amount = Number(row.amount) || 0
          const tipAmount = Number(row.tipAmount) || 0
          return amount + tipAmount
        },
        id: 'totalAmount',
        meta: { label: t('columns.total') },
        header: t('columns.total'),
        cell: ({ cell }) => {
          const value = cell.getValue()
          // Convert to number, Currency function handles null/undefined
          return Currency(Number(value) || 0)
        },
      },
    ],
    [t, formatTime, formatDate, venueTimezoneShort, isSuperAdmin],
  )

  // Export functionality
  const handleExport = useCallback(
    (format: 'csv' | 'excel') => {
      if (!payments || payments.length === 0) {
        toast({
          title: t('export.noData'),
          variant: 'destructive',
        })
        return
      }

      try {
        // Transform payments to flat structure for export
        const exportData = payments.map((payment: PaymentType) => {
          const processedBy = payment.processedBy ? `${payment.processedBy.firstName} ${payment.processedBy.lastName}` : '-'
          const merchantAccount = payment.merchantAccount?.displayName || payment.merchantAccount?.externalMerchantId || 'N/A'
          const cardInfo = payment.last4 ? `**** ${payment.last4}` : ''

          const sourceKey = `sources.${payment.source || 'UNKNOWN'}` as const
          const methodKey = payment.method === 'CASH' ? 'methods.cash' : 'methods.card'

          const row: Record<string, any> = {
            [t('columns.date')]: formatDate(payment.createdAt),
            [t('columns.waiter')]: processedBy,
            [t('columns.merchantAccount')]: merchantAccount,
            [t('columns.source')]: t(sourceKey as any),
            [t('columns.method')]: t(methodKey as any),
          }

          // Add card details if available
          if (cardInfo) {
            row['Card'] = cardInfo
          }

          row[t('columns.subtotal')] = formatCurrencyForExport(Number(payment.amount) || 0)
          row[t('columns.tip')] = formatCurrencyForExport(Number(payment.tipAmount) || 0)

          // Add profit column if superadmin
          if (isSuperAdmin && payment.transactionCost) {
            row[t('columns.profit')] = formatCurrencyForExport(Number(payment.transactionCost.grossProfit) || 0)
          }

          row[t('columns.total')] = formatCurrencyForExport((Number(payment.amount) || 0) + (Number(payment.tipAmount) || 0))

          return row
        })

        const filename = generateFilename('payments', venueId)

        if (format === 'csv') {
          exportToCSV(exportData, filename)
          toast({
            title: t('export.success', { count: payments.length }),
          })
        } else {
          exportToExcel(exportData, filename, 'Payments')
          toast({
            title: t('export.success', { count: payments.length }),
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
    [payments, formatDate, isSuperAdmin, venueId, t, toast],
  )

  return (
    <div className={`p-4 bg-background text-foreground`}>
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-row items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('filters.showing')} {payments.length} {t('filters.of')} {totalPayments} {t('filters.payments')}
            </p>
          </div>
          <div className="flex items-center gap-2">
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
            {/* Clear filters button */}
            {activeFiltersCount > 0 && (
              <Button variant="outline" size="sm" onClick={resetFilters} className="gap-2">
                <X className="h-4 w-4" />
                {t('filters.clearAll')} ({activeFiltersCount})
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex-1">
            <Input
              placeholder={t('filters.searchPlaceholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>

          <Select value={merchantAccountFilter} onValueChange={setMerchantAccountFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder={t('filters.merchantAccount')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allMerchantAccounts')}</SelectItem>
              {merchantAccounts.map(account => (
                <SelectItem key={account.id} value={account.id}>
                  {account.displayName || account.externalMerchantId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder={t('filters.method')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allMethods')}</SelectItem>
              {methods.map((method: string) => (
                <SelectItem key={method} value={method}>
                  {method === 'CASH' ? t('methods.cash') : method === 'CREDIT_CARD' ? t('methods.credit_card') : t('methods.card')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder={t('filters.source')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allSources')}</SelectItem>
              {sources.map((source: string) => (
                <SelectItem key={source} value={source}>
                  {t(`sources.${source}` as any)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={waiterFilter} onValueChange={setWaiterFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder={t('filters.waiter')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allWaiters')}</SelectItem>
              {waiters.map(waiter => (
                <SelectItem key={waiter.id} value={waiter.id}>
                  {waiter.firstName} {waiter.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className={`p-4 mb-4 rounded bg-red-100 text-red-800`}>
          {t('errorPrefix')}: {(error as Error).message}
        </div>
      )}

      <DataTable
        data={payments}
        rowCount={totalPayments}
        columns={columns}
        isLoading={isLoading}
        tableId="payments:main"
        enableSearch={false}
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
