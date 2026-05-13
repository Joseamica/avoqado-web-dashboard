// src/pages/Orders.tsx

import api from '@/api'
import { AddToAIButton } from '@/components/AddToAIButton'
import DataTable from '@/components/data-table'
import { DateRangePicker } from '@/components/date-range-picker'
import { AmountFilterContent, CheckboxFilterContent, ColumnCustomizer, FilterPill, type AmountFilter } from '@/components/filters'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { SelectionSummaryBar } from '@/components/selection-summary-bar'
import { StatusFilterTabs, type StatusTab } from '@/components/StatusFilterTabs'
import { SummaryCards, type SummaryCardItem } from '@/components/SummaryCards'
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
import { ManualPaymentDialog } from '@/components/ManualPaymentDialog/ManualPaymentDialog'
import { useAuth } from '@/context/AuthContext'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useSocketEvents } from '@/hooks/use-socket-events'
import { useTerminology } from '@/hooks/use-terminology'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import * as orderService from '@/services/order.service'
import { teamService, type TeamMember } from '@/services/team.service'
import { Order, OrderStatus, OrderType as OrderTypeEnum, StaffRole } from '@/types'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { exportToCSV, exportToExcel, formatCurrencyForExport, generateFilename } from '@/utils/export'
import { formatOrderNumber } from '@/utils/orderStatus'
import { ItemsSection } from './components/sections/ItemsSection'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, Clock, Download, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { DateTime } from 'luxon'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { OrderDrawerContent } from './OrderDrawerContent'

// Table interface for dropdowns
interface Table {
  id: string
  number: string
  status: string
  areaId?: string
  area?: {
    id: string
    name: string
  }
}

export default function Orders() {
  const { t } = useTranslation('orders')
  const { t: tCommon } = useTranslation('common')
  const { toast } = useToast()
  const { venueId, fullBasePath } = useCurrentVenue()
  const { formatTime: _formatTime, formatDate, venueTimezoneShort: _venueTimezoneShort } = useVenueDateTime()
  const location = useLocation()
  const navigate = useNavigate()
  const { orderId: drawerOrderId } = useParams<{ orderId: string }>()
  const queryClient = useQueryClient()
  const { user, checkFeatureAccess, activeVenue } = useAuth()
  const { category, term } = useTerminology()
  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'
  const isSuperAdmin = user?.role === StaffRole.SUPERADMIN
  const hasChatbot = checkFeatureAccess('CHATBOT')
  const isNonFoodService = category !== 'FOOD_SERVICE'

  const getCustomerDisplayName = (customer?: { firstName?: string | null; lastName?: string | null } | null) => {
    if (!customer) return ''
    return [customer.firstName, customer.lastName]
      .filter(part => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim()
  }

  const getOrderTypeDisplayLabel = (type?: string | null, orderNumber?: string | null) => {
    const normalizedType = (type || '').toUpperCase()
    const isFastSale = (orderNumber || '').startsWith('FAST-')

    if (isFastSale) {
      return t('types.FAST', { defaultValue: 'Venta sin productos' })
    }

    // Non-restaurant sectors: DINE_IN/TAKEOUT lose meaning → use sector-aware term
    // (RETAIL → "Venta", SERVICES → "Cita/Orden", HOSPITALITY → "Reservacion", ENTERTAINMENT → "Entrada")
    if (isNonFoodService && (normalizedType === 'DINE_IN' || normalizedType === 'TAKEOUT')) {
      return term('order')
    }

    if (!normalizedType) return '-'
    return t(`types.${normalizedType}` as any, { defaultValue: normalizedType })
  }

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 100,
  })

  // Status tab filter
  const [activeStatusTab, setActiveStatusTab] = useState('all')

  // Filter states (arrays for multi-select Stripe-style filters)
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [tableFilter, setTableFilter] = useState<string[]>([])
  const [waiterFilter, setWaiterFilter] = useState<string[]>([])
  const [totalFilter, setTotalFilter] = useState<AmountFilter | null>(null)
  const [tipFilter, setTipFilter] = useState<AmountFilter | null>(null)
  // Date range state — defaults to last 12 months.
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const now = DateTime.now().setZone(venueTimezone)
    return {
      from: now.minus({ days: 365 }).startOf('day').toJSDate(),
      to: now.endOf('day').toJSDate(),
    }
  })
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<Order[]>([])
  const [clearSelectionTrigger, setClearSelectionTrigger] = useState(0)

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'createdAt',
    'orderNumber',
    'customerName',
    'productsCount',
    'tableName',
    'waiterName',
    'status',
    'tipAmount',
    'total',
  ])

  // Products dialog — clicking the "N productos" cell opens this without triggering row navigation
  const [productsDialogOrder, setProductsDialogOrder] = useState<Order | null>(null)
  const { data: productsDialogFullOrder, isLoading: productsDialogLoading } = useQuery({
    queryKey: ['order', venueId, productsDialogOrder?.id],
    queryFn: () => orderService.getOrder(venueId, productsDialogOrder!.id),
    enabled: !!productsDialogOrder?.id,
  })

  // Reset pagination when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [statusFilter, typeFilter, tableFilter, waiterFilter, totalFilter, tipFilter, dateRange, debouncedSearchTerm])

  const [sortField, setSortField] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null)
  // Manual payment is standalone — no order context — so just track open/closed.
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false)
  const { can } = useAccess()
  const canCreateManualPayment = can('payment:create-manual')
  // tipAmount/total widened to allow `undefined` so the inline edit inputs
  // can be cleared (the previous `parseFloat(...) || 0` fallback locked the
  // field to 0 on every keystroke). We coerce back to a number at submit.
  const [editValues, setEditValues] = useState<{
    status: OrderStatus
    customerName: string
    tableId: string
    servedById: string
    tipAmount: number | undefined
    total: number | undefined
    createdAt: string
    orderNumber: string
    type: OrderTypeEnum
  }>({
    status: OrderStatus.PENDING,
    customerName: '',
    tableId: '',
    servedById: '',
    tipAmount: 0,
    total: 0,
    createdAt: '',
    orderNumber: '',
    type: OrderTypeEnum.DINE_IN,
  })

  // Multi-select filters, date range and search are sent to backend so pagination
  // respects them. Amount filters (total/tip) remain client-side — backend does not
  // support them yet.
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      'orders',
      venueId,
      pagination.pageIndex,
      pagination.pageSize,
      statusFilter,
      typeFilter,
      tableFilter,
      waiterFilter,
      dateRange,
      debouncedSearchTerm,
    ],
    queryFn: async () => {
      const response = await orderService.getOrders(venueId, pagination, {
        statuses: statusFilter.length > 0 ? statusFilter : undefined,
        types: typeFilter.length > 0 ? typeFilter : undefined,
        tableIds: tableFilter.length > 0 ? tableFilter : undefined,
        staffIds: waiterFilter.length > 0 ? waiterFilter : undefined,
        search: debouncedSearchTerm || undefined,
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      })
      return response
    },
    refetchOnWindowFocus: true,
  })

  const totalOrders = data?.meta?.total || 0 // CAMBIO: variable renombrada

  // Query for tables (SUPERADMIN edit dropdown)
  const { data: tablesData } = useQuery({
    queryKey: ['tables', venueId],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Table[] }>(`/api/v1/tpv/venues/${venueId}/tables`)
      return response.data.data
    },
    enabled: isSuperAdmin && editDialogOpen,
  })

  // Query for staff (SUPERADMIN edit dropdown)
  const { data: staffData } = useQuery({
    queryKey: ['team', venueId],
    queryFn: () => teamService.getTeamMembers(venueId, 1, 100),
    enabled: isSuperAdmin && editDialogOpen,
  })

  // Query for pay-later summary (for the banner)
  const { data: payLaterSummary } = useQuery({
    queryKey: ['pay-later-summary', venueId],
    queryFn: async () => {
      const response = await api.get<{
        success: boolean
        data: {
          summary: {
            total_balance: number
            total_count: number
          }
        }
      }>(`/api/v1/dashboard/reports/venues/${venueId}/pay-later-aging`)
      return response.data.data.summary
    },
    staleTime: 60000, // Cache for 1 minute
  })

  // Separate query to get all filter options (without filters applied)
  const { data: filterOptionsData } = useQuery({
    queryKey: ['orders-filter-options', venueId],
    queryFn: async () => {
      const response = await orderService.getOrders(venueId, { pageIndex: 0, pageSize: 500 })
      return response
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Aggregation query: fetches the FULL server-filtered set (not paginated) so
  // the summary cards and tab counts reflect everything inside the date range /
  // filters, not just the page currently visible in the table.
  const { data: summaryOrders } = useQuery({
    queryKey: [
      'orders-summary',
      venueId,
      statusFilter,
      typeFilter,
      tableFilter,
      waiterFilter,
      dateRange,
      debouncedSearchTerm,
    ],
    queryFn: async () => {
      const response = await orderService.getOrders(
        venueId,
        { pageIndex: 0, pageSize: 10000 },
        {
          statuses: statusFilter.length > 0 ? statusFilter : undefined,
          types: typeFilter.length > 0 ? typeFilter : undefined,
          tableIds: tableFilter.length > 0 ? tableFilter : undefined,
          staffIds: waiterFilter.length > 0 ? waiterFilter : undefined,
          search: debouncedSearchTerm || undefined,
          startDate: dateRange.from.toISOString(),
          endDate: dateRange.to.toISOString(),
        },
      )
      return (response.data || []) as Order[]
    },
    staleTime: 30 * 1000,
  })

  // Extract unique options for filters from unfiltered data
  const {
    statuses,
    typeOptions,
    tables,
    waiters: waiterOptions,
  } = useMemo(() => {
    const allOrders = filterOptionsData?.data || []

    // Unique statuses
    const statusesSet = new Set(allOrders.map((o: Order) => o.status).filter(Boolean))

    // Order types + fast sales (FAST prefix = venta sin productos)
    const orderTypesSet = new Set<string>()
    let hasFastSales = false
    allOrders.forEach((o: Order) => {
      if (o.type) {
        orderTypesSet.add(o.type)
      }
      if (o.orderNumber?.startsWith('FAST-')) {
        hasFastSales = true
      }
    })

    const preferredOrderTypes = ['DINE_IN', 'TAKEOUT', 'DELIVERY', 'PICKUP']
    const orderedTypes = preferredOrderTypes.filter(type => orderTypesSet.has(type))
    const extraTypes = Array.from(orderTypesSet).filter(type => !preferredOrderTypes.includes(type))
    const typeOptions = [...orderedTypes, ...extraTypes]
    if (hasFastSales) {
      typeOptions.push('FAST')
    }

    // Unique tables
    const tablesMap = new Map()
    allOrders.forEach((o: Order) => {
      if (o.table) {
        tablesMap.set(o.table.id, o.table)
      }
    })

    // Unique waiters (servedBy or createdBy)
    const waitersMap = new Map()
    allOrders.forEach((o: Order) => {
      const waiter = o.servedBy || o.createdBy
      if (waiter) {
        waitersMap.set(waiter.id, waiter)
      }
    })

    return {
      statuses: Array.from(statusesSet) as string[],
      typeOptions,
      tables: Array.from(tablesMap.values()),
      waiters: Array.from(waitersMap.values()),
    }
  }, [filterOptionsData?.data])

  // Count active filters (arrays with values count as active)
  const activeFiltersCount = [
    statusFilter.length > 0,
    typeFilter.length > 0,
    tableFilter.length > 0,
    waiterFilter.length > 0,
    totalFilter !== null,
    tipFilter !== null,
    dateRange !== null,
    searchTerm !== '',
  ].filter(Boolean).length

  // Reset all filters
  const resetFilters = useCallback(() => {
    setStatusFilter([])
    setTypeFilter([])
    setTableFilter([])
    setWaiterFilter([])
    setTotalFilter(null)
    setTipFilter(null)
    const now = DateTime.now().setZone(venueTimezone)
    setDateRange({ from: now.minus({ days: 365 }).startOf('day').toJSDate(), to: now.endOf('day').toJSDate() })
    setSearchTerm('')
  }, [venueTimezone])

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
  const getAmountFilterLabel = (filter: AmountFilter | null) => {
    if (!filter) return null
    const value = Currency(filter.value || 0)
    switch (filter.operator) {
      case 'gt':
        return `> ${value}`
      case 'lt':
        return `< ${value}`
      case 'eq':
        return `= ${value}`
      case 'between':
        return `${value} - ${Currency(filter.value2 || 0)}`
      default:
        return value
    }
  }

  // Helper to get display label for date filters
  useSocketEvents(venueId, socketData => {
    console.log('Received dashboard update via socket:', socketData)
    // La lógica de refetch sigue siendo válida
    refetch()
  })

  // Delete mutation (SUPERADMIN only)
  const deleteOrderMutation = useMutation({
    mutationFn: (orderId: string) => orderService.deleteOrder(venueId, orderId),
    onSuccess: () => {
      toast({
        title: tCommon('superadmin.delete.success'),
      })
      queryClient.invalidateQueries({ queryKey: ['orders', venueId] })
      setDeleteDialogOpen(false)
      setOrderToDelete(null)
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
  const updateOrderMutation = useMutation({
    mutationFn: (data: {
      orderId: string
      status: OrderStatus
      customerName: string
      tableId: string
      servedById: string
      tipAmount: number
      total: number
      createdAt: string
      orderNumber: string
      type: OrderTypeEnum
    }) =>
      orderService.updateOrder(venueId, data.orderId, {
        status: data.status,
        customerName: data.customerName,
        tableId: data.tableId || null,
        servedById: data.servedById || null,
        tipAmount: data.tipAmount,
        total: data.total,
        createdAt: data.createdAt,
        orderNumber: data.orderNumber,
        type: data.type,
      }),
    onSuccess: () => {
      toast({
        title: tCommon('superadmin.edit.success'),
      })
      queryClient.invalidateQueries({ queryKey: ['orders', venueId] })
      setEditDialogOpen(false)
      setOrderToEdit(null)
    },
    onError: (error: Error) => {
      toast({
        title: tCommon('superadmin.edit.error'),
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleDeleteClick = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation()
    setOrderToDelete(order)
    setDeleteDialogOpen(true)
  }

  const handleEditClick = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation()
    setOrderToEdit(order)
    setEditValues({
      status: order.status || OrderStatus.PENDING,
      customerName: order.customerName || '',
      tableId: order.tableId || '',
      servedById: order.servedById || '',
      tipAmount: Number(order.tipAmount) || 0,
      total: Number(order.total) || 0,
      createdAt: order.createdAt ? new Date(order.createdAt).toISOString().slice(0, 16) : '',
      orderNumber: order.orderNumber || '',
      type: order.type || OrderTypeEnum.DINE_IN,
    })
    setEditDialogOpen(true)
  }

  const confirmDelete = () => {
    if (orderToDelete) {
      deleteOrderMutation.mutate(orderToDelete.id)
    }
  }

  const confirmEdit = () => {
    if (orderToEdit) {
      updateOrderMutation.mutate({
        orderId: orderToEdit.id,
        status: editValues.status,
        customerName: editValues.customerName,
        tableId: editValues.tableId,
        servedById: editValues.servedById,
        // Coerce undefined (cleared input) → 0 at submit. Schema expects number.
        tipAmount: editValues.tipAmount ?? 0,
        total: editValues.total ?? 0,
        createdAt: editValues.createdAt,
        orderNumber: editValues.orderNumber,
        type: editValues.type,
      })
    }
  }

  // Handle sorting — wrapped in useCallback for stable identity (consumed by renderSortableHeader memo)
  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField(field)
        setSortOrder('desc')
      }
    },
    [sortField],
  )

  // Render sortable header — wrapped in useCallback so it doesn't change on every render
  // (otherwise the columns useMemo would recompute on every render).
  const renderSortableHeader = useCallback(
    (label: string | JSX.Element, field: string) => {
      const isSorted = sortField === field
      return (
        <div className="flex items-center gap-2 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort(field)}>
          {label}
          <span className="flex items-center">
            {isSorted && sortOrder === 'asc' && <ArrowUp className="h-4 w-4" />}
            {isSorted && sortOrder === 'desc' && <ArrowDown className="h-4 w-4" />}
            {!isSorted && <ArrowUpDown className="h-4 w-4 opacity-50" />}
          </span>
        </div>
      )
    },
    [sortField, sortOrder, handleSort],
  )

  const columns = useMemo<ColumnDef<Order, unknown>[]>(
    () => [
      // AI column - only show if venue has chatbot feature
      ...(hasChatbot
        ? [
            {
              id: 'ai',
              header: () => <span className="sr-only">{tCommon('screenReaderOnly.ai')}</span>,
              cell: ({ row }: { row: { original: Order } }) => (
                <div className="flex justify-center">
                  <AddToAIButton type="order" data={row.original} variant="icon" />
                </div>
              ),
              size: 50,
              enableSorting: false,
            } as ColumnDef<Order, unknown>,
          ]
        : []),
      {
        accessorKey: 'createdAt',
        meta: { label: t('columns.date') },
        header: () => renderSortableHeader(t('columns.date'), 'createdAt'),
        cell: ({ cell }) => {
          const value = cell.getValue() as string
          // Format as "13 ene 14:30" - day, month abbrev, 24-hour time (no year, no AM/PM)
          const dateObj = new Date(value)
          const day = dateObj.getDate()
          const month = dateObj.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
          const hours = dateObj.getHours().toString().padStart(2, '0')
          const minutes = dateObj.getMinutes().toString().padStart(2, '0')
          return (
            <span className="text-sm text-foreground whitespace-nowrap">
              {day} {month} {hours}:{minutes}
            </span>
          )
        },
      },
      {
        // CAMBIO: `folio` ahora es `orderNumber`
        accessorKey: 'orderNumber',
        meta: { label: t('columns.orderNumber') },
        header: t('columns.orderNumber'),
        cell: ({ row }) => {
          const orderNumber = row.original.orderNumber || '-'

          // Show last 6 digits for ALL orders: "ORD-1767664106975" → "#106975", "FAST-1766069887997" → "#887997"
          if (orderNumber !== '-' && orderNumber.length > 6) {
            const shortNumber = orderNumber.slice(-6)
            return <span className="font-mono text-sm text-foreground">#{shortNumber}</span>
          }

          return <span className="text-sm">{orderNumber}</span>
        },
      },
      {
        // Cliente (from orderCustomers for pay-later orders)
        accessorFn: row => {
          if (row.orderCustomers && row.orderCustomers.length > 0) {
            const customer = row.orderCustomers[0].customer
            return getCustomerDisplayName(customer)
          }
          return null
        },
        id: 'customerName',
        meta: { label: t('columns.customer', { defaultValue: 'Cliente' }) },
        header: t('columns.customer', { defaultValue: 'Cliente' }),
        cell: ({ row }) => {
          if (!row.original.orderCustomers || row.original.orderCustomers.length === 0) {
            return <span className="text-sm text-muted-foreground">—</span>
          }

          const customer = row.original.orderCustomers[0].customer
          const customerName = getCustomerDisplayName(customer)
          const isPayLater =
            (row.original.paymentStatus === 'PENDING' || row.original.paymentStatus === 'PARTIAL') &&
            Number(row.original.remainingBalance ?? 0) > 0

          const nameButton = (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-sm font-medium text-foreground underline decoration-dotted decoration-muted-foreground underline-offset-4 hover:bg-transparent hover:text-primary hover:decoration-primary"
              onClick={e => {
                e.stopPropagation()
                e.preventDefault()
                navigate(`${fullBasePath}/customers/${customer.id}`)
              }}
            >
              {customerName}
            </Button>
          )

          if (isPayLater) {
            return (
              <div className="flex items-center gap-1.5">
                {nameButton}
                <Badge
                  variant="outline"
                  className="text-xs px-1.5 py-0.5 bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                >
                  <Clock className="h-3 w-3 mr-0.5" />
                  {t('payLater.badge', { defaultValue: 'Por Cobrar' })}
                </Badge>
              </div>
            )
          }

          return nameButton
        },
      },
      {
        accessorKey: 'type',
        meta: { label: t('columns.type') },
        header: () => <div className="flex justify-center">{t('columns.type')}</div>,
        cell: ({ row }) => {
          const displayText = getOrderTypeDisplayLabel(row.original.type, row.original.orderNumber)
          return <span className="text-sm text-foreground">{displayText}</span>
        },
      },
      {
        id: 'productsCount',
        meta: { label: t('columns.products') },
        header: () => <div className="flex justify-center">{t('columns.products')}</div>,
        cell: ({ row }) => {
          const count = row.original._count?.items ?? row.original.items?.length ?? 0
          if (count === 0) {
            return (
              <div className="flex justify-center">
                <span className="text-sm text-muted-foreground">—</span>
              </div>
            )
          }
          return (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-sm font-normal text-foreground underline decoration-dotted decoration-muted-foreground underline-offset-4 hover:bg-transparent hover:text-primary hover:decoration-primary"
                onClick={e => {
                  e.stopPropagation()
                  e.preventDefault()
                  setProductsDialogOrder(row.original)
                }}
              >
                {t('columns.productsCount', { count, defaultValue: `${count} artículos` })}
              </Button>
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
        cell: info => <span className="text-sm text-foreground">{info.getValue() as string}</span>,
      },
      {
        // Waiter: use servedBy (who served the table) or fallback to createdBy
        // Mostramos nombre + inicial del apellido (ej: "Jose Antonio A.")
        accessorFn: row => {
          const waiter = row.servedBy || row.createdBy
          if (!waiter) return '-'
          const firstName = waiter.firstName || ''
          const lastInitial = waiter.lastName ? `${waiter.lastName.charAt(0)}.` : ''
          return `${firstName} ${lastInitial}`.trim() || '-'
        },
        id: 'waiterName',
        meta: { label: t('columns.waiter') },
        header: () => renderSortableHeader(t('columns.waiter'), 'waiterName'),
        cell: info => <span className="text-sm text-foreground">{info.getValue() as string}</span>,
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
            <Badge variant="soft" className={`${statusClasses.bg} ${statusClasses.text} border-transparent text-xs px-2 py-0.5`}>
              {statusMap[status] || status}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'tipAmount',
        meta: { label: t('columns.tip') },
        header: () => renderSortableHeader(t('columns.tip'), 'tipAmount'),
        cell: ({ cell }) => {
          const value = (cell.getValue() as number) || 0
          return <span className="text-sm text-foreground">{Currency(value)}</span>
        },
      },
      {
        // CAMBIO: El total es un campo numérico directo, no un string.
        accessorKey: 'total',
        meta: { label: t('columns.total') },
        header: () => renderSortableHeader(t('columns.total'), 'total'),
        cell: ({ cell }) => {
          const value = (cell.getValue() as number) || 0
          return <span className="text-sm font-medium">{Currency(value)}</span>
        },
      },
      // Manual payment is always standalone (external service, no related Avoqado order),
      // so we expose ONE entry point in the page header — no per-row shortcut.
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
              cell: ({ row }: { row: { original: Order } }) => (
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
    // formatDate/formatTime/venueTimezoneShort/sortField/sortOrder are captured transitively
    // through renderSortableHeader, so they are not direct deps of this useMemo.
    [t, tCommon, isSuperAdmin, hasChatbot, renderSortableHeader, canCreateManualPayment, navigate, fullBasePath],
  )

  // Filter columns based on visibility settings
  const filteredColumns = useMemo(() => {
    // Columns that should always be visible (not customizable)
    const alwaysVisibleColumns = ['ai', 'actions', 'row-actions']
    return columns.filter(col => {
      // Get column id (either from 'id' or 'accessorKey')
      const colId = col.id || (col as any).accessorKey
      // Always show columns without id
      if (!colId) return true
      // Always show AI and superadmin actions columns (they have their own visibility logic)
      if (alwaysVisibleColumns.includes(colId)) return true
      return visibleColumns.includes(colId)
    })
  }, [columns, visibleColumns])

  // Filter and sort data before displaying
  const sortedData = useMemo(() => {
    let orders = data?.data || []

    // Status tab filter
    if (activeStatusTab !== 'all') {
      const tabStatusMap: Record<string, OrderStatus[]> = {
        active: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY],
        completed: [OrderStatus.COMPLETED],
        cancelled: [OrderStatus.CANCELLED],
      }
      const allowedStatuses = tabStatusMap[activeStatusTab] || []
      if (allowedStatuses.length > 0) {
        orders = orders.filter((o: Order) => allowedStatuses.includes(o.status))
      }
    }

    // NOTE: status/type/table/waiter/search multi-select filters are applied server-side
    // via query params so pagination respects them. Client-side filtering here would only
    // filter within the current paginated page — which misses records on other pages.
    // Amount filters (total/tip) remain client-side because the backend does not yet
    // support them.
    // Total amount filter
    if (totalFilter) {
      orders = orders.filter((o: Order) => {
        const total = Number(o.total) || 0
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
    // Tip amount filter
    if (tipFilter) {
      orders = orders.filter((o: Order) => {
        const tip = o.tipAmount || 0
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
    // Date range is applied server-side; no client-side filter needed.
    // Search is applied server-side via query param (matches order number / customer name).
    // Client-side search would only match orders on the current page, missing the rest.

    if (!sortField) return orders

    return [...orders].sort((a: any, b: any) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        case 'waiterName': {
          const aWaiter = a.servedBy || a.createdBy
          const bWaiter = b.servedBy || b.createdBy
          aValue = aWaiter ? aWaiter.firstName.toLowerCase() : ''
          bValue = bWaiter ? bWaiter.firstName.toLowerCase() : ''
          break
        }
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
    // NOTE: filter states (status/type/table/waiter/search/dateRange) are applied server-side,
    // so they don't belong here. Only amount filters (total/tip) and sort/tab still affect
    // this memo's output.
  }, [data?.data, activeStatusTab, sortField, sortOrder, totalFilter, tipFilter])

  // Status tab counts (computed over ALL server-filtered orders, not just the
  // paginated page, so "Activos 12" means 12 in the whole date range).
  const statusTabCounts = useMemo(() => {
    const allOrders = summaryOrders || []
    const active = [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY]
    return {
      all: allOrders.length,
      active: allOrders.filter((o: Order) => active.includes(o.status)).length,
      completed: allOrders.filter((o: Order) => o.status === OrderStatus.COMPLETED).length,
      cancelled: allOrders.filter((o: Order) => o.status === OrderStatus.CANCELLED).length,
    }
  }, [summaryOrders])

  const orderStatusTabs = useMemo<StatusTab[]>(
    () => [
      { value: 'all', label: t('statusTabs.all'), count: statusTabCounts.all },
      { value: 'active', label: t('statusTabs.active'), count: statusTabCounts.active },
      { value: 'completed', label: t('statusTabs.completed'), count: statusTabCounts.completed },
      { value: 'cancelled', label: t('statusTabs.cancelled'), count: statusTabCounts.cancelled },
    ],
    [t, statusTabCounts],
  )

  // Summary cards — computed over ALL server-filtered orders (not just the
  // current page) so "Total" reflects the whole date range. We still apply the
  // status tab + client-side amount filters (total/tip) here so cards match
  // whatever the table is currently narrowed to.
  const orderSummaryCards = useMemo<SummaryCardItem[]>(() => {
    let orders: Order[] = summaryOrders || []

    if (activeStatusTab !== 'all') {
      const tabStatusMap: Record<string, OrderStatus[]> = {
        active: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY],
        completed: [OrderStatus.COMPLETED],
        cancelled: [OrderStatus.CANCELLED],
      }
      const allowed = tabStatusMap[activeStatusTab] || []
      if (allowed.length > 0) orders = orders.filter((o: Order) => allowed.includes(o.status))
    }

    if (totalFilter) {
      orders = orders.filter((o: Order) => {
        const total = Number(o.total) || 0
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

    if (tipFilter) {
      orders = orders.filter((o: Order) => {
        const tip = o.tipAmount || 0
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

    const count = orders.length
    const total = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
    const avgTicket = count > 0 ? total / count : 0
    return [
      { label: t('summaryCards.orders'), value: count, format: 'number' as const },
      { label: t('summaryCards.total'), value: total, format: 'currency' as const },
      { label: t('summaryCards.avgTicket'), value: avgTicket, format: 'currency' as const },
    ]
  }, [summaryOrders, activeStatusTab, totalFilter, tipFilter, t])

  // Export functionality
  const handleExport = useCallback(
    async (format: 'csv' | 'excel') => {
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
          const waiter = order.servedBy || order.createdBy
          const waiterName = waiter ? `${waiter.firstName} ${waiter.lastName}` : '-'
          const tableName = order.table?.number || '-'

          // Show last 6 digits for ALL orders: "ORD-1767664106975" → "#106975", "FAST-1766069887997" → "#887997"
          const displayFolio =
            order.orderNumber && order.orderNumber.length > 6 ? `#${order.orderNumber.slice(-6)}` : order.orderNumber || '-'
          const displayType = getOrderTypeDisplayLabel(order.type, order.orderNumber)

          return {
            [t('columns.date')]: formatDate(order.createdAt),
            [t('columns.orderNumber')]: displayFolio,
            // [t('columns.customer')]: order.customerName || t('counter'),
            [t('columns.type')]: displayType,
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
          await exportToExcel(exportData, filename, 'Orders')
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
        <PageTitleWithInfo
          title={t('title')}
          className="text-xl font-semibold"
          tooltip={t('info.list', {
            defaultValue: 'Consulta y filtra las ordenes del venue, con acceso al detalle y exportacion.',
          })}
        />
      </div>

      {/* Status Filter Tabs */}
      <StatusFilterTabs tabs={orderStatusTabs} activeTab={activeStatusTab} onTabChange={setActiveStatusTab} className="mb-4" />

      {/* Summary Cards */}
      <SummaryCards cards={orderSummaryCards} isLoading={isLoading} className="mb-4" />

      {/* Pay-Later Alert Banner - Uses backend data for accurate counts */}
      {payLaterSummary && payLaterSummary.total_count > 0 && (
        <div
          className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          onClick={() => navigate('../reports/pay-later-aging')}
        >
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <p className="font-semibold text-red-900 dark:text-red-200">
                {t('payLater.banner.title', { defaultValue: '⚠️ Cuentas por Cobrar Pendientes' })}
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {payLaterSummary.total_count} {payLaterSummary.total_count === 1 ? 'orden' : 'órdenes'} pendiente
                {payLaterSummary.total_count === 1 ? '' : 's'} de pago - {Currency(payLaterSummary.total_balance)}
              </p>
            </div>
            <span className="text-xs text-red-600 dark:text-red-400">
              {t('payLater.banner.viewDetails', { defaultValue: 'Ver reporte →' })}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className={`p-4 mb-4 rounded bg-red-100 text-red-800`}>
          {t('errorPrefix')}: {(error as Error).message}
        </div>
      )}

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
                    placeholder={t('searchPlaceholder')}
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

          {/* Type Filter Pill */}
          <FilterPill
            label={t('columns.type')}
            activeValue={getFilterDisplayLabel(
              typeFilter,
              typeOptions.map(type => ({
                value: type,
                label: getOrderTypeDisplayLabel(type),
              })),
            )}
            isActive={typeFilter.length > 0}
            onClear={() => setTypeFilter([])}
          >
            <CheckboxFilterContent
              title={`Filtrar por: ${t('columns.type').toLowerCase()}`}
              options={typeOptions.map(type => ({
                value: type,
                label: getOrderTypeDisplayLabel(type),
              }))}
              selectedValues={typeFilter}
              onApply={setTypeFilter}
            />
          </FilterPill>

          {/* Table Filter Pill */}
          <FilterPill
            label={t('columns.table')}
            activeValue={getFilterDisplayLabel(
              tableFilter,
              tables.map((tb: any) => ({
                value: tb.id,
                label: tb.area?.name ? `${tb.area.name} - ${tb.number}` : tb.number,
              })),
            )}
            isActive={tableFilter.length > 0}
            onClear={() => setTableFilter([])}
          >
            <CheckboxFilterContent
              title={`Filtrar por: ${t('columns.table').toLowerCase()}`}
              options={tables.map((tb: any) => ({
                value: tb.id,
                label: tb.area?.name ? `${tb.area.name} - ${tb.number}` : tb.number,
              }))}
              selectedValues={tableFilter}
              onApply={setTableFilter}
              searchable={tables.length > 5}
              searchPlaceholder="Buscar mesa..."
            />
          </FilterPill>

          {/* Waiter Filter Pill */}
          <FilterPill
            label={t('columns.waiter')}
            activeValue={getFilterDisplayLabel(
              waiterFilter,
              waiterOptions.map((w: any) => ({
                value: w.id,
                label: `${w.firstName} ${w.lastName}`.trim(),
              })),
            )}
            isActive={waiterFilter.length > 0}
            onClear={() => setWaiterFilter([])}
          >
            <CheckboxFilterContent
              title={`Filtrar por: ${t('columns.waiter').toLowerCase()}`}
              options={waiterOptions.map((w: any) => ({
                value: w.id,
                label: `${w.firstName} ${w.lastName}`.trim(),
              }))}
              selectedValues={waiterFilter}
              onApply={setWaiterFilter}
              searchable={waiterOptions.length > 5}
              searchPlaceholder="Buscar personal..."
            />
          </FilterPill>

          {/* Status Filter Pill */}
          <FilterPill
            label={t('columns.status')}
            activeValue={getFilterDisplayLabel(
              statusFilter,
              statuses.map(s => ({ value: s, label: t(`statuses.${s}`, { defaultValue: s }) })),
            )}
            isActive={statusFilter.length > 0}
            onClear={() => setStatusFilter([])}
          >
            <CheckboxFilterContent
              title={`Filtrar por: ${t('columns.status').toLowerCase()}`}
              options={statuses.map(s => ({ value: s, label: t(`statuses.${s}`, { defaultValue: s }) }))}
              selectedValues={statusFilter}
              onApply={setStatusFilter}
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
            {canCreateManualPayment && (
              <Button size="sm" className="h-8 gap-1.5" onClick={() => setManualPaymentOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Nuevo pago manual
              </Button>
            )}

            {/* Pay Later - Navigate to dedicated report */}
            <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => navigate('../reports/pay-later-aging')}>
              <Clock className="h-3.5 w-3.5" />
              {t('payLater.button', { defaultValue: 'Cuentas por Cobrar' })}
            </Button>

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
                { id: 'orderNumber', label: t('columns.orderNumber'), visible: visibleColumns.includes('orderNumber'), disabled: true },
                { id: 'customerName', label: t('columns.customer'), visible: visibleColumns.includes('customerName') },
                { id: 'type', label: t('columns.type'), visible: visibleColumns.includes('type') },
                { id: 'productsCount', label: t('columns.products'), visible: visibleColumns.includes('productsCount') },
                { id: 'tableName', label: t('columns.table'), visible: visibleColumns.includes('tableName') },
                { id: 'waiterName', label: t('columns.waiter'), visible: visibleColumns.includes('waiterName') },
                { id: 'status', label: t('columns.status'), visible: visibleColumns.includes('status') },
                { id: 'tipAmount', label: t('columns.tip'), visible: visibleColumns.includes('tipAmount') },
                { id: 'total', label: t('columns.total'), visible: visibleColumns.includes('total'), disabled: true },
              ]}
              onApply={setVisibleColumns}
              label={t('filters.columns', { defaultValue: 'Columnas' })}
              title={t('filters.editColumns', { defaultValue: 'Editar columnas' })}
            />
          </div>
        </div>
      </div>

      <DataTable
        data={sortedData}
        rowCount={totalOrders}
        columns={filteredColumns}
        isLoading={isLoading}
        enableSearch={false}
        showColumnCustomizer={false}
        tableId="orders:main"
        clickableRow={row => ({
          to: row.id,
          state: { from: location.pathname },
        })}
        pagination={pagination}
        setPagination={setPagination}
        enableRowSelection
        onRowSelectionChange={setSelectedOrders}
        clearSelectionTrigger={clearSelectionTrigger}
      />

      <SelectionSummaryBar
        selectedRows={selectedOrders}
        fields={[
          { label: t('columns.subtotal', { defaultValue: 'Subtotal' }), getValue: row => Number(row.subtotal) || 0 },
          { label: t('columns.tip'), getValue: row => Number(row.tipAmount) || 0 },
          { label: t('columns.total'), getValue: row => Number(row.total) || 0 },
        ]}
        onClear={() => {
          setSelectedOrders([])
          setClearSelectionTrigger(v => v + 1)
        }}
      />

      {/* Delete confirmation dialog (SUPERADMIN only) */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon('superadmin.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tCommon('superadmin.delete.description', { item: orderToDelete?.orderNumber || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteOrderMutation.isPending}
            >
              {deleteOrderMutation.isPending ? tCommon('deleting') : tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog (SUPERADMIN only) */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge className="bg-linear-to-r from-amber-400 to-pink-500 text-primary-foreground border-0">
                {tCommon('superadmin.edit.editMode')}
              </Badge>
              {tCommon('superadmin.edit.title')}
            </DialogTitle>
            <DialogDescription>{t('editDialog.description', { id: orderToEdit?.orderNumber || '' })}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Row 1: Order Number and Status */}
            <div className="grid grid-cols-2 gap-4">
              {/* Order Number (Folio) */}
              <div className="space-y-2">
                <Label htmlFor="edit-orderNumber">{t('columns.orderNumber')}</Label>
                <Input
                  id="edit-orderNumber"
                  value={editValues.orderNumber}
                  onChange={e => setEditValues(prev => ({ ...prev, orderNumber: e.target.value }))}
                  className="border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20"
                />
              </div>

              {/* Status field */}
              <div className="space-y-2">
                <Label htmlFor="edit-status">{t('columns.status')}</Label>
                <Select
                  value={editValues.status}
                  onValueChange={(value: OrderStatus) => setEditValues(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger className="border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OrderStatus.PENDING}>{t('statuses.PENDING')}</SelectItem>
                    <SelectItem value={OrderStatus.CONFIRMED}>{t('statuses.CONFIRMED')}</SelectItem>
                    <SelectItem value={OrderStatus.PREPARING}>{t('statuses.PREPARING')}</SelectItem>
                    <SelectItem value={OrderStatus.READY}>{t('statuses.READY')}</SelectItem>
                    <SelectItem value={OrderStatus.COMPLETED}>{t('statuses.COMPLETED')}</SelectItem>
                    <SelectItem value={OrderStatus.CANCELLED}>{t('statuses.CANCELLED')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Type and Date */}
            <div className="grid grid-cols-2 gap-4">
              {/* Type field */}
              <div className="space-y-2">
                <Label htmlFor="edit-type">{t('columns.type')}</Label>
                <Select value={editValues.type} onValueChange={(value: OrderTypeEnum) => setEditValues(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger className="border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OrderTypeEnum.DINE_IN}>{getOrderTypeDisplayLabel(OrderTypeEnum.DINE_IN)}</SelectItem>
                    <SelectItem value={OrderTypeEnum.TAKEOUT}>{getOrderTypeDisplayLabel(OrderTypeEnum.TAKEOUT)}</SelectItem>
                    <SelectItem value={OrderTypeEnum.DELIVERY}>{t('types.DELIVERY')}</SelectItem>
                    <SelectItem value={OrderTypeEnum.PICKUP}>{t('types.PICKUP')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date field */}
              <div className="space-y-2">
                <Label htmlFor="edit-createdAt">{t('columns.date')}</Label>
                <Input
                  id="edit-createdAt"
                  type="datetime-local"
                  value={editValues.createdAt}
                  onChange={e => setEditValues(prev => ({ ...prev, createdAt: e.target.value }))}
                  className="border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20"
                />
              </div>
            </div>

            {/* Row 3: Table and Waiter */}
            <div className="grid grid-cols-2 gap-4">
              {/* Table dropdown */}
              <div className="space-y-2">
                <Label htmlFor="edit-table">{t('columns.table')}</Label>
                <Select
                  value={editValues.tableId || 'none'}
                  onValueChange={value => setEditValues(prev => ({ ...prev, tableId: value === 'none' ? '' : value }))}
                >
                  <SelectTrigger className="border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20">
                    <SelectValue placeholder={t('detail.fields.noTable')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('detail.fields.noTable')}</SelectItem>
                    {tablesData?.map((table: Table) => (
                      <SelectItem key={table.id} value={table.id}>
                        {table.area?.name ? `${table.area.name} - ${table.number}` : table.number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Waiter dropdown */}
              <div className="space-y-2">
                <Label htmlFor="edit-waiter">{t('columns.waiter')}</Label>
                <Select
                  value={editValues.servedById || 'none'}
                  onValueChange={value => setEditValues(prev => ({ ...prev, servedById: value === 'none' ? '' : value }))}
                >
                  <SelectTrigger className="border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20">
                    <SelectValue placeholder={t('detail.fields.noWaiter')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('detail.fields.noWaiter')}</SelectItem>
                    {staffData?.data?.map((staff: TeamMember) => (
                      <SelectItem key={staff.id} value={staff.staffId}>
                        {staff.firstName} {staff.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 4: Tip and Total */}
            <div className="grid grid-cols-2 gap-4">
              {/* Tip field */}
              <div className="space-y-2">
                <Label htmlFor="edit-tip">{t('columns.tip')}</Label>
                <Input
                  id="edit-tip"
                  type="number"
                  step="0.01"
                  value={editValues.tipAmount ?? ''}
                  onChange={e => {
                    const raw = e.target.value
                    setEditValues(prev => ({ ...prev, tipAmount: raw === '' ? undefined : parseFloat(raw) }))
                  }}
                  className="border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20"
                />
              </div>

              {/* Total field */}
              <div className="space-y-2">
                <Label htmlFor="edit-total">{t('columns.total')}</Label>
                <Input
                  id="edit-total"
                  type="number"
                  step="0.01"
                  value={editValues.total ?? ''}
                  onChange={e => {
                    const raw = e.target.value
                    setEditValues(prev => ({ ...prev, total: raw === '' ? undefined : parseFloat(raw) }))
                  }}
                  className="border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20"
                />
              </div>
            </div>

            {/* Row 5: Customer Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-customerName">{t('columns.customer')}</Label>
              <Input
                id="edit-customerName"
                value={editValues.customerName}
                onChange={e => setEditValues(prev => ({ ...prev, customerName: e.target.value }))}
                className="border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20"
                placeholder={t('detail.fields.customerPlaceholder')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={confirmEdit}
              disabled={updateOrderMutation.isPending}
              className="bg-linear-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground border-0"
            >
              {updateOrderMutation.isPending ? tCommon('saving') : tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Products-only dialog — opens when user clicks "N productos" in the list */}
      <Dialog open={!!productsDialogOrder} onOpenChange={open => !open && setProductsDialogOrder(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {productsDialogOrder?.orderNumber
                ? t('productsDialog.title', { number: formatOrderNumber(productsDialogOrder.orderNumber) })
                : t('productsDialog.title', { number: '' })}
            </DialogTitle>
          </DialogHeader>
          {productsDialogLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('productsDialog.loading')}</p>
          ) : productsDialogFullOrder ? (
            <ItemsSection order={productsDialogFullOrder} />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('productsDialog.empty')}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Square-style drawer: URL /orders/:orderId opens this Sheet over the list.
          OrderDrawerContent renders its own header (with X) and handles its own scroll. */}
      <Sheet
        open={!!drawerOrderId}
        onOpenChange={open => {
          if (!open) navigate(`${fullBasePath}/orders`)
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 [&>button]:hidden">
          {drawerOrderId && <OrderDrawerContent orderId={drawerOrderId} onClose={() => navigate(`${fullBasePath}/orders`)} />}
        </SheetContent>
      </Sheet>

      <ManualPaymentDialog
        open={manualPaymentOpen}
        onClose={() => setManualPaymentOpen(false)}
        venueId={venueId}
      />
    </div>
  )
}
