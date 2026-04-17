// src/pages/Payments.tsx

import api from '@/api'
import { AddToAIButton } from '@/components/AddToAIButton'
import DataTable from '@/components/data-table'
import { AmountFilterContent, CheckboxFilterContent, ColumnCustomizer, FilterPill, type AmountFilter } from '@/components/filters'
import { DateRangePicker } from '@/components/date-range-picker'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { SelectionSummaryBar } from '@/components/selection-summary-bar'
import { StatusFilterTabs, type StatusTab } from '@/components/StatusFilterTabs'
import { SummaryCards, type SummaryCardItem } from '@/components/SummaryCards'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useSocketEvents } from '@/hooks/use-socket-events'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { commissionService } from '@/services/commission.service'
import { PaymentMethod, PaymentRecordType, PaymentStatus, Payment as PaymentType, StaffRole } from '@/types'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { DateTime } from 'luxon'
import { exportToCSV, exportToExcel, formatCurrencyForExport, generateFilename } from '@/utils/export'
import getIcon from '@/utils/getIcon'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Banknote, Bitcoin, Download, Pencil, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { PaymentDrawerContent } from './PaymentDrawerContent'

export default function Payments() {
  const { t } = useTranslation('payment')
  const { t: tCommon } = useTranslation('common')
  const { toast } = useToast()
  const { venueId } = useCurrentVenue()
  const { user, checkFeatureAccess, activeVenue } = useAuth()
  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'
  const isSuperAdmin = user?.role === StaffRole.SUPERADMIN
  const hasChatbot = checkFeatureAccess('CHATBOT')
  const { formatDate } = useVenueDateTime()
  const location = useLocation()
  const navigate = useNavigate()
  const { paymentId: drawerPaymentId } = useParams<{ paymentId: string }>()
  const queryClient = useQueryClient()
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentType | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [paymentToEdit, setPaymentToEdit] = useState<PaymentType | null>(null)
  const [editValues, setEditValues] = useState<{
    amount: number
    tipAmount: number
    method: PaymentMethod
    status: PaymentStatus
  }>({ amount: 0, tipAmount: 0, method: PaymentMethod.CASH, status: PaymentStatus.PAID })

  // Status tab filter
  const [activeStatusTab, setActiveStatusTab] = useState('all')

  // Filter states (arrays for multi-select Stripe-style filters)
  const [merchantAccountFilter, setMerchantAccountFilter] = useState<string[]>([])
  const [methodFilter, setMethodFilter] = useState<string[]>([])
  const [sourceFilter, setSourceFilter] = useState<string[]>([])
  const [waiterFilter, setWaiterFilter] = useState<string[]>([])
  // Date range state — defaults to last 30 days (Stripe-style)
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const now = DateTime.now().setZone(venueTimezone)
    return {
      from: now.minus({ days: 30 }).startOf('day').toJSDate(),
      to: now.endOf('day').toJSDate(),
    }
  })
  const [subtotalFilter, setSubtotalFilter] = useState<AmountFilter | null>(null)
  const [tipFilter, setTipFilter] = useState<AmountFilter | null>(null)
  const [totalFilter, setTotalFilter] = useState<AmountFilter | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [selectedPayments, setSelectedPayments] = useState<PaymentType[]>([])
  const [clearSelectionTrigger, setClearSelectionTrigger] = useState(0)

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'createdAt',
    'waiterName',
    'merchantAccount',
    'source',
    'method',
    'amount',
    'totalTipAmount',
    'totalAmount',
  ])

  // Reset pagination when filters change (using debounced search to avoid flicker)
  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [
    merchantAccountFilter,
    methodFilter,
    sourceFilter,
    waiterFilter,
    dateRange,
    subtotalFilter,
    tipFilter,
    totalFilter,
    debouncedSearchTerm,
  ])

  // Convert dateRange to startDate/endDate ISO strings for the API
  const dateParams = useMemo(() => {
    return {
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
    }
  }, [dateRange])

  // Fetch payments — multi-select filters, search and date range are sent to backend.
  // Amount filters (subtotal/tip/total) and status tab remain client-side because the
  // backend does not support them yet.
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      'payments',
      venueId,
      pagination.pageIndex,
      pagination.pageSize,
      dateParams,
      merchantAccountFilter,
      methodFilter,
      sourceFilter,
      waiterFilter,
      debouncedSearchTerm,
    ],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payments`, {
        params: {
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          ...dateParams,
          ...(merchantAccountFilter.length > 0 && { merchantAccountIds: merchantAccountFilter.join(',') }),
          ...(methodFilter.length > 0 && { methods: methodFilter.join(',') }),
          ...(sourceFilter.length > 0 && { sources: sourceFilter.join(',') }),
          ...(waiterFilter.length > 0 && { staffIds: waiterFilter.join(',') }),
          ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        },
      })
      return response.data
    },
    refetchOnWindowFocus: true,
  })

  const totalPayments = data?.meta?.total || 0

  // --- SIN CAMBIOS EN useSocketEvents ---
  // La lógica de refetch al recibir un evento sigue siendo correcta.
  useSocketEvents(venueId, socketData => {
    console.log('Received payment update via socket:', socketData)
    refetch()
  })

  // Delete mutation (SUPERADMIN only)
  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: string) => api.delete(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}`),
    onSuccess: () => {
      toast({
        title: tCommon('superadmin.delete.success'),
      })
      queryClient.invalidateQueries({ queryKey: ['payments', venueId] })
      setDeleteDialogOpen(false)
      setPaymentToDelete(null)
    },
    onError: (error: Error) => {
      toast({
        title: tCommon('superadmin.delete.error'),
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Update mutation (SUPERADMIN only)
  const updatePaymentMutation = useMutation({
    mutationFn: (data: { paymentId: string; amount: number; tipAmount: number; method: PaymentMethod; status: PaymentStatus }) =>
      api.put(`/api/v1/dashboard/venues/${venueId}/payments/${data.paymentId}`, {
        amount: data.amount,
        tipAmount: data.tipAmount,
        method: data.method,
        status: data.status,
      }),
    onSuccess: () => {
      toast({
        title: tCommon('superadmin.edit.success'),
      })
      queryClient.invalidateQueries({ queryKey: ['payments', venueId] })
      setEditDialogOpen(false)
      setPaymentToEdit(null)
    },
    onError: (error: Error) => {
      toast({
        title: tCommon('superadmin.edit.error'),
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleDeleteClick = (e: React.MouseEvent, payment: PaymentType) => {
    e.stopPropagation()
    setPaymentToDelete(payment)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (paymentToDelete) {
      deletePaymentMutation.mutate(paymentToDelete.id)
    }
  }

  const handleEditClick = (e: React.MouseEvent, payment: PaymentType) => {
    e.stopPropagation()
    setPaymentToEdit(payment)
    setEditValues({
      amount: Number(payment.amount) || 0,
      tipAmount: Number(payment.tipAmount) || 0,
      method: payment.method || PaymentMethod.CASH,
      status: payment.status || PaymentStatus.PAID,
    })
    setEditDialogOpen(true)
  }

  const confirmEdit = () => {
    if (paymentToEdit) {
      updatePaymentMutation.mutate({
        paymentId: paymentToEdit.id,
        amount: editValues.amount,
        tipAmount: editValues.tipAmount,
        method: editValues.method,
        status: editValues.status,
      })
    }
  }

  // Separate query to get all filter options (without filters applied)
  const { data: filterOptionsData } = useQuery({
    queryKey: ['payments-filter-options', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payments`, {
        params: {
          page: 1,
          pageSize: 500, // Get enough data to extract all unique options
        },
      })
      return response.data
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Extract unique options for filters from unfiltered data
  const { merchantAccounts, methods, sources, waiters } = useMemo(() => {
    const allPayments = filterOptionsData?.data || []

    // Unique merchant accounts
    const merchantAccountsMap = new Map()
    allPayments.forEach((p: PaymentType) => {
      if (p.merchantAccount) {
        merchantAccountsMap.set(p.merchantAccount.id, p.merchantAccount)
      }
    })

    // Unique methods
    const methodsSet = new Set(allPayments.map((p: PaymentType) => p.method).filter(Boolean))

    // Unique sources
    const sourcesSet = new Set(allPayments.map((p: PaymentType) => p.source).filter(Boolean))

    // Unique waiters
    const waitersMap = new Map()
    allPayments.forEach((p: PaymentType) => {
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
  }, [filterOptionsData?.data])

  // Count active filters (arrays with values count as active)
  const activeFiltersCount = [
    merchantAccountFilter.length > 0,
    methodFilter.length > 0,
    sourceFilter.length > 0,
    waiterFilter.length > 0,
    subtotalFilter !== null,
    tipFilter !== null,
    totalFilter !== null,
    searchTerm !== '',
  ].filter(Boolean).length

  // Reset all filters
  const resetFilters = useCallback(() => {
    setMerchantAccountFilter([])
    setMethodFilter([])
    setSourceFilter([])
    setWaiterFilter([])
    setSubtotalFilter(null)
    setTipFilter(null)
    setTotalFilter(null)
    setSearchTerm('')
  }, [])

  // Helper to get display label for active filters
  const getFilterDisplayLabel = (values: string[], options: { value: string; label: string }[]) => {
    if (values.length === 0) return null
    if (values.length === 1) {
      const option = options.find(o => o.value === values[0])
      return option?.label || values[0]
    }
    return `${values.length} seleccionados`
  }

  // Helper to get display label for amount filters
  const getAmountFilterLabel = (filter: AmountFilter | null): string | null => {
    if (!filter) return null
    switch (filter.operator) {
      case 'gt':
        return `> ${Currency(filter.value || 0)}`
      case 'lt':
        return `< ${Currency(filter.value || 0)}`
      case 'eq':
        return `= ${Currency(filter.value || 0)}`
      case 'between':
        return `${Currency(filter.value || 0)} - ${Currency(filter.value2 || 0)}`
      default:
        return null
    }
  }

  // Apply client-side multi-select filtering
  const filteredPayments = useMemo(() => {
    let payments = data?.data || []

    // Status tab filter
    if (activeStatusTab !== 'all') {
      const statusMap: Record<string, string[]> = {
        completed: [PaymentStatus.PAID],
        pending: [PaymentStatus.PENDING, PaymentStatus.PARTIAL],
        refunded: [PaymentStatus.REFUNDED],
      }
      const allowedStatuses = statusMap[activeStatusTab] || []
      if (allowedStatuses.length > 0) {
        payments = payments.filter((p: PaymentType) => allowedStatuses.includes(p.status))
      }
    }

    // NOTE: merchant/method/source/waiter/search filters are applied server-side (query params).
    // We no longer filter them client-side, otherwise we'd only be filtering within the
    // current paginated page, which misses records on other pages.
    // Amount filters (subtotal/tip/total) remain client-side because the backend does not
    // yet support them.
    // Subtotal amount filter
    if (subtotalFilter) {
      payments = payments.filter((p: PaymentType) => {
        const subtotal = Number(p.amount) || 0
        switch (subtotalFilter.operator) {
          case 'gt':
            return subtotal > (subtotalFilter.value || 0)
          case 'lt':
            return subtotal < (subtotalFilter.value || 0)
          case 'eq':
            return subtotal === (subtotalFilter.value || 0)
          case 'between':
            return subtotal >= (subtotalFilter.value || 0) && subtotal <= (subtotalFilter.value2 || 0)
          default:
            return true
        }
      })
    }
    // Tip amount filter
    if (tipFilter) {
      payments = payments.filter((p: PaymentType) => {
        const tip = Number(p.tipAmount) || 0
        switch (tipFilter.operator) {
          case 'gt':
            return tip > (tipFilter.value || 0)
          case 'lt':
            return tip < (tipFilter.value || 0)
          case 'eq':
            return tip === (tipFilter.value || 0)
          case 'between':
            return tip >= (tipFilter.value || 0) && tip <= (tipFilter.value2 || 0)
          default:
            return true
        }
      })
    }
    // Total amount filter
    if (totalFilter) {
      payments = payments.filter((p: PaymentType) => {
        const total = (Number(p.amount) || 0) + (Number(p.tipAmount) || 0)
        switch (totalFilter.operator) {
          case 'gt':
            return total > (totalFilter.value || 0)
          case 'lt':
            return total < (totalFilter.value || 0)
          case 'eq':
            return total === (totalFilter.value || 0)
          case 'between':
            return total >= (totalFilter.value || 0) && total <= (totalFilter.value2 || 0)
          default:
            return true
        }
      })
    }

    return payments
    // NOTE: multi-select filters and search are applied server-side, so they no longer
    // belong in the dep array. Only amount filters (subtotal/tip/total) and status tab
    // still affect this memo's output.
  }, [data?.data, activeStatusTab, subtotalFilter, tipFilter, totalFilter])

  // Status tab counts (computed from unfiltered-by-tab data)
  const statusTabCounts = useMemo(() => {
    const allPayments = data?.data || []
    return {
      all: allPayments.length,
      completed: allPayments.filter((p: PaymentType) => p.status === PaymentStatus.PAID).length,
      pending: allPayments.filter((p: PaymentType) => p.status === PaymentStatus.PENDING || p.status === PaymentStatus.PARTIAL).length,
      refunded: allPayments.filter((p: PaymentType) => p.status === PaymentStatus.REFUNDED).length,
    }
  }, [data?.data])

  const statusTabs = useMemo<StatusTab[]>(
    () => [
      { value: 'all', label: t('statusTabs.all'), count: statusTabCounts.all },
      { value: 'completed', label: t('statusTabs.completed'), count: statusTabCounts.completed },
      { value: 'pending', label: t('statusTabs.pending'), count: statusTabCounts.pending },
      { value: 'refunded', label: t('statusTabs.refunded'), count: statusTabCounts.refunded },
    ],
    [t, statusTabCounts],
  )

  // Summary cards (computed from filtered data)
  const summaryCards = useMemo<SummaryCardItem[]>(() => {
    const count = filteredPayments.length
    const totalCollected = filteredPayments.reduce((sum: number, p: PaymentType) => {
      return sum + Math.abs(Number(p.amount) || 0) + (Number(p.tipAmount) || 0)
    }, 0)
    const netSales = filteredPayments.reduce((sum: number, p: PaymentType) => {
      return sum + Math.abs(Number(p.amount) || 0)
    }, 0)
    return [
      { label: t('summaryCards.transactions'), value: count, format: 'number' as const },
      { label: t('summaryCards.totalCollected'), value: totalCollected, format: 'currency' as const },
      { label: t('summaryCards.netSales'), value: netSales, format: 'currency' as const },
    ]
  }, [filteredPayments, t])

  // Get unique payment IDs from filtered payments to fetch their commissions
  const paymentIds = useMemo(() => {
    return filteredPayments.map((p: PaymentType) => p.id)
  }, [filteredPayments])

  // Fetch commissions for all payments in a single batch request
  const { data: commissionsData } = useQuery({
    queryKey: ['commissions-batch', venueId, paymentIds],
    queryFn: () => commissionService.getCommissionsByPaymentIds(venueId!, paymentIds),
    enabled: !!venueId && paymentIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  // Create lookup map from paymentId to commission amount
  const commissionByPaymentId = useMemo(() => {
    const map = new Map<string, number>()
    if (commissionsData) {
      for (const [paymentId, commission] of Object.entries(commissionsData)) {
        if (commission?.netCommission) {
          map.set(paymentId, commission.netCommission)
        }
      }
    }
    return map
  }, [commissionsData])

  // ==================================================================
  // --- PRINCIPALES CAMBIOS EN LA DEFINICIÓN DE COLUMNAS ---
  // ==================================================================
  const columns = useMemo<ColumnDef<PaymentType, unknown>[]>(
    () => [
      // AI column - only show if venue has chatbot feature
      ...(hasChatbot
        ? [
            {
              id: 'ai',
              meta: { label: t('columns.ai', { defaultValue: 'AI' }) },
              header: () => <span className="sr-only">{t('columns.ai', { defaultValue: 'AI' })}</span>,
              cell: ({ row }: { row: { original: PaymentType } }) => (
                <div className="flex justify-center">
                  <AddToAIButton type="payment" data={row.original} variant="icon" />
                </div>
              ),
              size: 50,
              enableSorting: false,
              enableHiding: false,
            } as ColumnDef<PaymentType, unknown>,
          ]
        : []),
      {
        accessorKey: 'createdAt',
        meta: { label: t('columns.date') },
        header: t('columns.date'),
        cell: ({ cell, row }) => {
          const value = cell.getValue() as string
          // Format as "13 ene 14:30" - day, month abbrev, 24-hour time (no year, no AM/PM)
          const dateObj = new Date(value)
          const day = dateObj.getDate()
          const month = dateObj.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
          const hours = dateObj.getHours().toString().padStart(2, '0')
          const minutes = dateObj.getMinutes().toString().padStart(2, '0')
          // Legacy QR payments are merged from the old avo-pwa system.
          // Backend sets `isLegacyQR: true` on every mapped row. Show a pill
          // so operators can distinguish legacy QR from regular payments.
          const isLegacyQR = (row.original as any)?.isLegacyQR === true
          return (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-sm text-muted-foreground dark:text-foreground">
                {day} {month} {hours}:{minutes}
              </span>
              {isLegacyQR && (
                <span
                  title="Pago realizado con QR desde el sistema anterior de Avoqado"
                  className="inline-flex items-center rounded-md border border-purple-300 bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:border-purple-700/60 dark:bg-purple-900/30 dark:text-purple-300"
                >
                  QR
                </span>
              )}
            </div>
          )
        },
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
            return <span className="text-sm text-muted-foreground dark:text-foreground">-</span>
          }

          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium">{merchant.displayName || merchant.externalMerchantId}</span>
              {merchant.bankName && <span className="text-xs text-muted-foreground dark:text-foreground">{merchant.bankName}</span>}
            </div>
          )
        },
      },
      //Habilitar cuando haya mas metodos de origen, por ejemplo QR
      // {
      //   // Source viene directamente del campo `source` del Payment
      //   accessorKey: 'source',
      //   id: 'source',
      //   meta: { label: t('columns.source') },
      //   header: ({ column }) => (
      //     <Button
      //       variant="ghost"
      //       size="sm"
      //       className="text-xs h-7 px-2"
      //       onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      //     >
      //       {t('columns.source')}
      //       <ArrowUpDown className="w-3 h-3 ml-1" />
      //     </Button>
      //   ),
      //   cell: ({ cell }) => {
      //     // Valores posibles: TPV, QR, WEB, APP, POS, UNKNOWN
      //     const source = String(cell.getValue() || 'UNKNOWN')

      //     const iconBox = (icon: JSX.Element, bgColor: string = 'bg-muted') => (
      //       <div className={`flex items-center justify-center w-6 h-6 rounded-md ${bgColor} border border-border shadow-sm`}>{icon}</div>
      //     )

      //     const map = {
      //       POS: {
      //         icon: iconBox(<Computer className="h-3 w-3 text-blue-600" />, 'bg-blue-50 dark:bg-blue-950/50'),
      //         label: t('sources.POS'),
      //       },
      //       TPV: {
      //         icon: iconBox(<TabletSmartphone className="h-3 w-3 text-green-600" />, 'bg-green-50 dark:bg-green-950/50'),
      //         label: t('sources.TPV'),
      //       },
      //       QR: {
      //         icon: iconBox(<QrCode className="h-3 w-3 text-purple-600" />, 'bg-purple-50 dark:bg-purple-950/50'),
      //         label: t('sources.QR'),
      //       },
      //       WEB: {
      //         icon: iconBox(<Globe className="h-3 w-3 text-orange-600" />, 'bg-orange-50 dark:bg-orange-950/50'),
      //         label: t('sources.WEB'),
      //       },
      //       APP: {
      //         icon: iconBox(<AppWindow className="h-3 w-3 text-indigo-600" />, 'bg-indigo-50 dark:bg-indigo-950/50'),
      //         label: t('sources.APP'),
      //       },
      //       DASHBOARD_TEST: {
      //         icon: iconBox(<TestTube className="h-3 w-3 text-indigo-600" />, 'bg-indigo-50 dark:bg-indigo-950/50'),
      //         label: t('sources.DASHBOARD_TEST'),
      //       },
      //       UNKNOWN: {
      //         icon: iconBox(<Smartphone className="h-3 w-3 text-muted-foreground" />, 'bg-muted'),
      //         label: t('sources.UNKNOWN'),
      //       },
      //     } as const

      //     const item = map[source as keyof typeof map] || map.UNKNOWN

      //     return (
      //       <div className="flex items-center gap-2">
      //         {item.icon}
      //         <span className="text-xs text-muted-foreground dark:text-foreground">{item.label}</span>
      //       </div>
      //     )
      //   },
      // },
      {
        accessorKey: 'method',
        meta: { label: t('columns.method') },
        header: t('columns.method'),
        cell: ({ row }) => {
          const payment = row.original
          // ANTERIOR: 'CARD', AHORA: 'CREDIT_CARD', 'DEBIT_CARD'
          const isCard = payment.method === 'CREDIT_CARD' || payment.method === 'DEBIT_CARD'
          const isCrypto = (payment.method as string) === 'CRYPTOCURRENCY'
          const methodDisplay =
            payment.method === 'CASH'
              ? t('methods.cash')
              : payment.method === 'CREDIT_CARD'
                ? t('methods.creditCard')
                : payment.method === 'DEBIT_CARD'
                  ? t('methods.debitCard')
                  : payment.method === 'DIGITAL_WALLET'
                    ? t('methods.digitalWallet')
                    : payment.method === 'BANK_TRANSFER'
                      ? t('methods.bankTransfer')
                      : (payment.method as string) === 'CRYPTOCURRENCY'
                        ? t('methods.cryptocurrency')
                        : payment.method === 'OTHER'
                          ? t('methods.other')
                          : t('methods.card')

          // CAMBIO: `last4` y `cardBrand` podrían estar en `processorData`.
          // Simplificamos si no están directamente disponibles.
          const cardBrand = payment.cardBrand || payment.processorData?.cardBrand || null
          const last4Raw =
            payment.last4 || (payment as any).maskedPan || payment.processorData?.last4 || payment.processorData?.maskedPan || ''
          const last4Digits = last4Raw ? String(last4Raw).replace(/\D/g, '').slice(-4) : ''
          const maskedLast4 = last4Digits || ''

          // Crypto payment details from processorData
          const cryptoCurrency = payment.processorData?.cryptoCurrency || payment.processorData?.currency || ''

          return (
            <div className="flex items-center gap-2">
              {isCard ? (
                <>
                  <div className="shrink-0"> {getIcon(cardBrand)}</div>
                  <span className="text-sm text-muted-foreground dark:text-foreground">{maskedLast4}</span>
                </>
              ) : isCrypto ? (
                <>
                  <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 shadow-sm">
                    <Bitcoin className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="text-sm text-muted-foreground dark:text-foreground">
                    {cryptoCurrency ? cryptoCurrency.toUpperCase() : methodDisplay}
                  </span>
                </>
              ) : (
                <>
                  <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 shadow-sm">
                    <Banknote className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-sm text-muted-foreground dark:text-foreground">{methodDisplay}</span>
                </>
              )}
            </div>
          )
        },
      },
      {
        // CAMBIO: Accedemos al mesero a través de `processedBy`
        // Mostramos nombre + inicial del apellido (ej: "Jose Antonio A.")
        accessorFn: row => {
          if (!row.processedBy) return '-'
          const firstName = row.processedBy.firstName || ''
          const lastInitial = row.processedBy.lastName ? `${row.processedBy.lastName.charAt(0)}.` : ''
          return `${firstName} ${lastInitial}`.trim()
        },
        id: 'waiterName',
        meta: { label: t('columns.waiter') },
        header: t('columns.waiter'),
        cell: ({ getValue, row }) => {
          const waiterName = getValue() as string
          const commissionAmount = commissionByPaymentId.get(row.original.id) || 0

          return (
            <div className="flex flex-col items-start">
              <span className="text-sm text-muted-foreground dark:text-foreground">{waiterName}</span>
              {commissionAmount > 0 && (
                <Badge
                  variant="soft"
                  className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 border-transparent text-xs px-2 py-0.5 mt-0.5"
                >
                  {Currency(commissionAmount)}
                </Badge>
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
          return <span className="text-sm text-muted-foreground dark:text-foreground">{Currency(Math.abs(Number(value) || 0))}</span>
        },
      },
      {
        // CAMBIO: La propina ahora es un campo numérico directo `tipAmount`
        // Usamos número para poder calcular porcentajes y ordenar correctamente
        accessorFn: row => Number(row.tipAmount) || 0,
        id: 'totalTipAmount',
        meta: { label: t('columns.tip') },
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="text-sm h-8 px-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {t('columns.tip')}
            <ArrowUpDown className="w-3 h-3 ml-1" />
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
            <div className="flex flex-col items-start">
              <span className="text-sm text-muted-foreground dark:text-foreground">{tipPercentage.toFixed(1)}%</span>
              <Badge variant="soft" className={`${tipClasses.bg} ${tipClasses.text} border-transparent text-xs px-2 py-0.5`}>
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-sm h-7 px-2"
                  onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                >
                  {t('columns.profit')}
                  <ArrowUpDown className="w-3 h-3 ml-1" />
                </Button>
              ),
              cell: ({ row }: any) => {
                const payment = row.original
                const isRefund = payment.type === PaymentRecordType.REFUND

                if (!payment.transactionCost) {
                  return (
                    <div className="flex">
                      <span className="text-sm text-muted-foreground dark:text-foreground">-</span>
                    </div>
                  )
                }

                const profit = Number(payment.transactionCost.grossProfit) || 0
                const txAmount = Number(payment.transactionCost.amount) || 0
                const realMargin = txAmount > 0 ? profit / Math.abs(txAmount) : 0
                const providerCost = Number(payment.transactionCost.providerCostAmount) || 0
                const providerFixed = Number(payment.transactionCost.providerFixedFee) || 0
                const venueCharge = Number(payment.transactionCost.venueChargeAmount) || 0
                const venueFixed = Number(payment.transactionCost.venueFixedFee) || 0

                // For refunds, always use red styling (negative profit)
                if (isRefund) {
                  return (
                    <div
                      className="flex flex-col items-start"
                      title={`${t('types.refund')} | Provider: ${Currency(Math.abs(providerCost + providerFixed))} | Venue: ${Currency(
                        Math.abs(venueCharge + venueFixed),
                      )}`}
                    >
                      <span className="text-xs text-red-500 dark:text-red-400">−{(Math.abs(realMargin) * 100).toFixed(2)}%</span>
                      <Badge
                        variant="outline"
                        className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800 text-xs px-2 py-0.5"
                      >
                        −{Currency(Math.abs(profit))}
                      </Badge>
                    </div>
                  )
                }

                // Color based on real profit margin (% of transaction)
                let profitClasses = {
                  bg: 'bg-emerald-100 dark:bg-emerald-900/30',
                  text: 'text-emerald-800 dark:text-emerald-400',
                  border: 'border-emerald-200 dark:border-emerald-800',
                }
                if (realMargin < 0.002) {
                  // Less than 0.2% of transaction
                  profitClasses = {
                    bg: 'bg-red-100 dark:bg-red-900/30',
                    text: 'text-red-800 dark:text-red-400',
                    border: 'border-red-200 dark:border-red-800',
                  }
                } else if (realMargin < 0.005) {
                  // 0.2-0.5% of transaction
                  profitClasses = {
                    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
                    text: 'text-yellow-800 dark:text-yellow-400',
                    border: 'border-yellow-200 dark:border-yellow-800',
                  }
                }

                return (
                  <div
                    className="flex flex-col items-start"
                    title={`Provider: ${Currency(providerCost + providerFixed)} | Venue: ${Currency(venueCharge + venueFixed)}`}
                  >
                    <span className="text-xs text-muted-foreground dark:text-foreground">{(realMargin * 100).toFixed(2)}%</span>
                    <Badge
                      variant="outline"
                      className={`${profitClasses.bg} ${profitClasses.text} ${profitClasses.border} text-xs px-2 py-0.5`}
                    >
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
        cell: ({ cell, row }) => {
          const value = cell.getValue()
          const isRefund = row.original.type === PaymentRecordType.REFUND
          return (
            <div className="flex flex-col">
              <span className={cn('text-sm font-medium', isRefund && 'text-red-600 dark:text-red-400')}>
                {isRefund && '−'}
                {Currency(Math.abs(Number(value) || 0))}
              </span>
              {isRefund && (
                <span className="text-xs text-red-500 dark:text-red-400 flex items-center gap-0.5">
                  <RotateCcw className="h-2.5 w-2.5" />
                  {t('types.refund')}
                </span>
              )}
            </div>
          )
        },
      },
      // Superadmin actions column
      ...(isSuperAdmin
        ? [
            {
              id: 'actions',
              header: () => (
                <span className="text-sm font-medium bg-linear-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent">
                  Superadmin
                </span>
              ),
              cell: ({ row }: { row: { original: PaymentType } }) => (
                <div className="flex items-center justify-end">
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-linear-to-r from-amber-400 to-pink-500">
                    <Button
                      size="icon"
                      className="h-7 w-7 bg-background hover:bg-muted text-foreground border-0"
                      onClick={e => handleEditClick(e, row.original)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-7 w-7 bg-background hover:bg-destructive/10 text-destructive border-0"
                      onClick={e => handleDeleteClick(e, row.original)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ),
              size: 120,
            },
          ]
        : []),
    ],
    [t, isSuperAdmin, hasChatbot, commissionByPaymentId],
  )

  // Filter columns based on visibility settings
  const filteredColumns = useMemo(() => {
    // Columns that should always be visible (not customizable)
    const alwaysVisibleColumns = ['ai', 'actions', 'avoqadoProfit']
    return columns.filter(col => {
      // Get column id (either from 'id' or 'accessorKey')
      const colId = col.id || (col as any).accessorKey
      // Always show columns without id or special columns (AI, superadmin)
      if (!colId) return true
      if (alwaysVisibleColumns.includes(colId)) return true
      return visibleColumns.includes(colId)
    })
  }, [columns, visibleColumns])

  // Export functionality
  const handleExport = useCallback(
    async (format: 'csv' | 'excel') => {
      if (!filteredPayments || filteredPayments.length === 0) {
        toast({
          title: t('export.noData'),
          variant: 'destructive',
        })
        return
      }

      try {
        // Transform payments to flat structure for export
        const exportData = filteredPayments.map((payment: PaymentType) => {
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

          const isRefund = payment.type === PaymentRecordType.REFUND
          row[t('columns.subtotal')] = formatCurrencyForExport(Number(payment.amount) || 0)
          row[t('columns.tip')] = formatCurrencyForExport(Number(payment.tipAmount) || 0)

          // Add profit column if superadmin - show negative for refunds
          if (isSuperAdmin && payment.transactionCost) {
            const profit = Number(payment.transactionCost.grossProfit) || 0
            row[t('columns.profit')] = isRefund ? `-${formatCurrencyForExport(Math.abs(profit))}` : formatCurrencyForExport(profit)
          }

          row[t('columns.total')] = formatCurrencyForExport((Number(payment.amount) || 0) + (Number(payment.tipAmount) || 0))

          // Add refund indicator
          if (isRefund) {
            row[t('columns.type')] = t('types.refund')
          }

          return row
        })

        const filename = generateFilename('payments', venueId)

        if (format === 'csv') {
          exportToCSV(exportData, filename)
          toast({
            title: t('export.success', { count: filteredPayments.length }),
          })
        } else {
          await exportToExcel(exportData, filename, 'Payments')
          toast({
            title: t('export.success', { count: filteredPayments.length }),
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
    [filteredPayments, formatDate, isSuperAdmin, venueId, t, toast],
  )

  return (
    <div className={`p-4 bg-background text-foreground`}>
      {/* Header */}
      <div className="mb-4">
        <PageTitleWithInfo
          title={t('title')}
          className="text-xl font-semibold"
          tooltip={t('info.list', {
            defaultValue: 'Historial de pagos del venue con filtros, estado y acceso al detalle.',
          })}
        />
        <p className="text-sm text-muted-foreground">
          {t('filters.showing')} {filteredPayments.length} {t('filters.of')} {totalPayments} {t('filters.payments')}
        </p>
      </div>

      {/* Status Filter Tabs */}
      <StatusFilterTabs tabs={statusTabs} activeTab={activeStatusTab} onTabChange={setActiveStatusTab} className="mb-4" />

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} isLoading={isLoading} className="mb-4" />

      {/* Stripe-style Filter Bar */}
      <div className="mb-4">
        {/* Single row: Filters left, Actions right (wrap when needed) */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {/* Expandable Search Icon */}
          <div className="relative flex items-center">
            {isSearchOpen ? (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('filters.searchPlaceholder')}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') {
                        if (!searchTerm) setIsSearchOpen(false)
                      }
                    }}
                    className="h-8 w-[200px] pl-8 pr-8 text-sm rounded-full"
                    autoFocus
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => {
                    setSearchTerm('')
                    setIsSearchOpen(false)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant={searchTerm ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setIsSearchOpen(true)}
              >
                <Search className="h-4 w-4" />
                {searchTerm && <span className="sr-only">{t('filters.searchActive', { defaultValue: 'Búsqueda activa' })}</span>}
              </Button>
            )}
            {/* Active search indicator dot */}
            {searchTerm && !isSearchOpen && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />}
          </div>

          {/* Date Range Picker */}
          <DateRangePicker
            initialDateFrom={dateRange.from}
            initialDateTo={dateRange.to}
            showCompare={false}
            align="start"
            onUpdate={({ range }) => {
              setDateRange({
                from: range.from,
                to: range.to ?? range.from,
              })
            }}
          />

          {/* Merchant Account Filter Pill */}
          <FilterPill
            label={t('columns.merchantAccount')}
            activeValue={getFilterDisplayLabel(
              merchantAccountFilter,
              merchantAccounts.map(account => ({
                value: account.id,
                label: account.displayName || account.externalMerchantId,
              })),
            )}
            isActive={merchantAccountFilter.length > 0}
            onClear={() => setMerchantAccountFilter([])}
          >
            <CheckboxFilterContent
              title={`Filtrar por: ${t('columns.merchantAccount').toLowerCase()}`}
              options={merchantAccounts.map(account => ({
                value: account.id,
                label: account.displayName || account.externalMerchantId,
              }))}
              selectedValues={merchantAccountFilter}
              onApply={setMerchantAccountFilter}
              searchable={merchantAccounts.length > 5}
              searchPlaceholder={t('filters.searchMerchant', { defaultValue: 'Buscar cuenta...' })}
            />
          </FilterPill>

          {/* Method Filter Pill */}
          <FilterPill
            label={t('columns.method')}
            activeValue={getFilterDisplayLabel(
              methodFilter,
              methods.map((method: string) => ({
                value: method,
                label:
                  method === 'CASH'
                    ? t('methods.cash')
                    : method === 'CREDIT_CARD'
                      ? t('methods.creditCard')
                      : method === 'DEBIT_CARD'
                        ? t('methods.debitCard')
                        : t('methods.card'),
              })),
            )}
            isActive={methodFilter.length > 0}
            onClear={() => setMethodFilter([])}
          >
            <CheckboxFilterContent
              title={`Filtrar por: ${t('columns.method').toLowerCase()}`}
              options={methods.map((method: string) => ({
                value: method,
                label:
                  method === 'CASH'
                    ? t('methods.cash')
                    : method === 'CREDIT_CARD'
                      ? t('methods.creditCard')
                      : method === 'DEBIT_CARD'
                        ? t('methods.debitCard')
                        : t('methods.card'),
              }))}
              selectedValues={methodFilter}
              onApply={setMethodFilter}
            />
          </FilterPill>

          {/* Source Filter Pill */}
          <FilterPill
            label={t('columns.source')}
            activeValue={getFilterDisplayLabel(
              sourceFilter,
              sources.map((source: string) => ({
                value: source,
                label: t(`sources.${source}` as any),
              })),
            )}
            isActive={sourceFilter.length > 0}
            onClear={() => setSourceFilter([])}
          >
            <CheckboxFilterContent
              title={`Filtrar por: ${t('columns.source').toLowerCase()}`}
              options={sources.map((source: string) => ({
                value: source,
                label: t(`sources.${source}` as any),
              }))}
              selectedValues={sourceFilter}
              onApply={setSourceFilter}
            />
          </FilterPill>

          {/* Waiter Filter Pill */}
          <FilterPill
            label={t('columns.waiter')}
            activeValue={getFilterDisplayLabel(
              waiterFilter,
              waiters.map((waiter: any) => ({
                value: waiter.id,
                label: `${waiter.firstName} ${waiter.lastName}`.trim(),
              })),
            )}
            isActive={waiterFilter.length > 0}
            onClear={() => setWaiterFilter([])}
          >
            <CheckboxFilterContent
              title={`Filtrar por: ${t('columns.waiter').toLowerCase()}`}
              options={waiters.map((waiter: any) => ({
                value: waiter.id,
                label: `${waiter.firstName} ${waiter.lastName}`.trim(),
              }))}
              selectedValues={waiterFilter}
              onApply={setWaiterFilter}
              searchable={waiters.length > 5}
              searchPlaceholder={t('filters.searchWaiter', { defaultValue: 'Buscar personal...' })}
            />
          </FilterPill>

          {/* Subtotal Filter Pill */}
          <FilterPill
            label={t('columns.subtotal')}
            activeValue={getAmountFilterLabel(subtotalFilter)}
            isActive={subtotalFilter !== null}
            onClear={() => setSubtotalFilter(null)}
          >
            <AmountFilterContent
              title={`Filtrar por: ${t('columns.subtotal').toLowerCase()}`}
              currentFilter={subtotalFilter}
              onApply={setSubtotalFilter}
            />
          </FilterPill>

          {/* Tip Filter Pill */}
          <FilterPill
            label={t('columns.tip')}
            activeValue={getAmountFilterLabel(tipFilter)}
            isActive={tipFilter !== null}
            onClear={() => setTipFilter(null)}
          >
            <AmountFilterContent
              title={`Filtrar por: ${t('columns.tip').toLowerCase()}`}
              currentFilter={tipFilter}
              onApply={setTipFilter}
            />
          </FilterPill>

          {/* Total Filter Pill */}
          <FilterPill
            label={t('columns.total')}
            activeValue={getAmountFilterLabel(totalFilter)}
            isActive={totalFilter !== null}
            onClear={() => setTotalFilter(null)}
          >
            <AmountFilterContent
              title={`Filtrar por: ${t('columns.total').toLowerCase()}`}
              currentFilter={totalFilter}
              onApply={setTotalFilter}
            />
          </FilterPill>

          {/* Reset filters - white background button with X icon */}
          {activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" onClick={resetFilters} className="h-8 gap-1.5 rounded-full">
              <X className="h-3.5 w-3.5" />
              {t('filters.reset', { defaultValue: 'Borrar filtros' })}
            </Button>
          )}

          {/* Action buttons - pushed right with ml-auto, wrap left when needed */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Export button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  {t('export.button')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>{t('export.asCSV')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('excel')}>{t('export.asExcel')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Column Customizer */}
            <ColumnCustomizer
              columns={[
                { id: 'createdAt', label: t('columns.date'), visible: visibleColumns.includes('createdAt') },
                { id: 'waiterName', label: t('columns.waiter'), visible: visibleColumns.includes('waiterName') },
                { id: 'merchantAccount', label: t('columns.merchantAccount'), visible: visibleColumns.includes('merchantAccount') },
                { id: 'source', label: t('columns.source'), visible: visibleColumns.includes('source') },
                { id: 'method', label: t('columns.method'), visible: visibleColumns.includes('method') },
                { id: 'amount', label: t('columns.subtotal'), visible: visibleColumns.includes('amount') },
                { id: 'totalTipAmount', label: t('columns.tip'), visible: visibleColumns.includes('totalTipAmount') },
                { id: 'totalAmount', label: t('columns.total'), visible: visibleColumns.includes('totalAmount'), disabled: true },
              ]}
              onApply={setVisibleColumns}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className={`p-4 mb-4 rounded bg-red-100 text-red-800`}>
          {t('errorPrefix')}: {(error as Error).message}
        </div>
      )}

      <DataTable
        data={filteredPayments}
        rowCount={totalPayments}
        columns={filteredColumns}
        isLoading={isLoading}
        tableId="payments:main"
        enableSearch={false}
        showColumnCustomizer={false}
        clickableRow={row => ({
          to: row.id,
          state: { from: location.pathname },
        })}
        pagination={pagination}
        setPagination={setPagination}
        getRowClassName={row =>
          row.type === PaymentRecordType.REFUND
            ? '!bg-red-50/50 dark:!bg-red-950/20 hover:!bg-red-100/50 dark:hover:!bg-red-950/30'
            : undefined
        }
        enableRowSelection
        onRowSelectionChange={setSelectedPayments}
        clearSelectionTrigger={clearSelectionTrigger}
      />

      <SelectionSummaryBar
        selectedRows={selectedPayments}
        fields={[
          { label: t('columns.subtotal'), getValue: row => Math.abs(Number(row.amount) || 0) },
          { label: t('columns.tip'), getValue: row => Number(row.tipAmount) || 0 },
          { label: t('columns.total'), getValue: row => Math.abs(Number(row.amount) || 0) + (Number(row.tipAmount) || 0) },
          {
            label: t('detail.summary.toBank'),
            getValue: row => {
              const total = Math.abs(Number(row.amount) || 0) + (Number(row.tipAmount) || 0)
              const fee = (Number(row.transactionCost?.venueChargeAmount) || 0) + (Number(row.transactionCost?.venueFixedFee) || 0)
              return total - fee
            },
          },
        ]}
        onClear={() => {
          setSelectedPayments([])
          setClearSelectionTrigger(v => v + 1)
        }}
      />

      {/* Delete confirmation dialog (SUPERADMIN only) */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon('superadmin.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tCommon('superadmin.delete.description', { item: paymentToDelete?.id?.slice(-8) || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePaymentMutation.isPending}
            >
              {deletePaymentMutation.isPending ? tCommon('deleting') : tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog (SUPERADMIN only) */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge className="bg-linear-to-r from-amber-400 to-pink-500 text-primary-foreground border-0">
                {tCommon('superadmin.edit.editMode')}
              </Badge>
              {tCommon('superadmin.edit.title')}
            </DialogTitle>
            <DialogDescription>{t('editDialog.description', { id: paymentToEdit?.id?.slice(-8) || '' })}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Amount and Tip in a row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-amount">{t('columns.subtotal')}</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  value={editValues.amount}
                  onChange={e => setEditValues(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  className="border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-tip">{t('columns.tip')}</Label>
                <Input
                  id="edit-tip"
                  type="number"
                  step="0.01"
                  value={editValues.tipAmount}
                  onChange={e => setEditValues(prev => ({ ...prev, tipAmount: parseFloat(e.target.value) || 0 }))}
                  className="border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20"
                />
              </div>
            </div>

            {/* Method and Status in a row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-method">{t('columns.method')}</Label>
                <Select
                  value={editValues.method}
                  onValueChange={(value: PaymentMethod) => setEditValues(prev => ({ ...prev, method: value }))}
                >
                  <SelectTrigger className="border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PaymentMethod.CASH}>{t('methods.cash')}</SelectItem>
                    <SelectItem value={PaymentMethod.CREDIT_CARD}>{t('methods.creditCard')}</SelectItem>
                    <SelectItem value={PaymentMethod.DEBIT_CARD}>{t('methods.debitCard')}</SelectItem>
                    <SelectItem value={PaymentMethod.DIGITAL_WALLET}>{t('methods.digitalWallet')}</SelectItem>
                    <SelectItem value={PaymentMethod.BANK_TRANSFER}>{t('methods.bankTransfer')}</SelectItem>
                    <SelectItem value={PaymentMethod.OTHER}>{t('methods.other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-status">{t('columns.status')}</Label>
                <Select
                  value={editValues.status}
                  onValueChange={(value: PaymentStatus) => setEditValues(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger className="border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PaymentStatus.PENDING}>{t('statuses.pending')}</SelectItem>
                    <SelectItem value={PaymentStatus.PARTIAL}>{t('statuses.partial')}</SelectItem>
                    <SelectItem value={PaymentStatus.PAID}>{t('statuses.paid')}</SelectItem>
                    <SelectItem value={PaymentStatus.REFUNDED}>{t('statuses.refunded')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Total preview */}
            <div className="flex items-center justify-between p-3 bg-linear-to-r from-amber-500/10 to-pink-500/10 rounded-lg border border-amber-400/30">
              <span className="text-sm font-medium bg-linear-to-r from-amber-500 to-pink-500 bg-clip-text text-transparent">
                {t('columns.total')}
              </span>
              <span className="text-lg font-semibold">{Currency(editValues.amount + editValues.tipAmount)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={confirmEdit}
              disabled={updatePaymentMutation.isPending}
              className="bg-linear-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground border-0"
            >
              {updatePaymentMutation.isPending ? tCommon('saving') : tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Square-style drawer: URL /payments/:paymentId opens this Sheet over the list. */}
      <Sheet
        open={!!drawerPaymentId}
        onOpenChange={open => {
          if (!open) navigate('..', { relative: 'path' })
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 [&>button]:hidden">
          {drawerPaymentId && (
            <PaymentDrawerContent
              paymentId={drawerPaymentId}
              venueTimezone={venueTimezone}
              onClose={() => navigate('..', { relative: 'path' })}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
