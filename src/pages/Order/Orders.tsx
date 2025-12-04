// src/pages/Orders.tsx

import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue' // Hook actualizado
import { useSocketEvents } from '@/hooks/use-socket-events'
import { useAuth } from '@/context/AuthContext'
import { StaffRole, OrderStatus, OrderType as OrderTypeEnum, Order } from '@/types'
import api from '@/api'
import * as orderService from '@/services/order.service'
import { teamService, type TeamMember } from '@/services/team.service'
import { AddToAIButton } from '@/components/AddToAIButton'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { exportToCSV, exportToExcel, generateFilename, formatCurrencyForExport } from '@/utils/export'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Download, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

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
  const { venueId } = useCurrentVenue()
  const { formatTime, formatDate, venueTimezoneShort } = useVenueDateTime()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, checkFeatureAccess } = useAuth()
  const isSuperAdmin = user?.role === StaffRole.SUPERADMIN
  const hasChatbot = checkFeatureAccess('CHATBOT')

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null)
  const [editValues, setEditValues] = useState<{
    status: OrderStatus
    customerName: string
    tableId: string
    servedById: string
    tipAmount: number
    total: number
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
      tipAmount: order.tipAmount || 0,
      total: order.total || 0,
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
        tipAmount: editValues.tipAmount,
        total: editValues.total,
        createdAt: editValues.createdAt,
        orderNumber: editValues.orderNumber,
        type: editValues.type,
      })
    }
  }

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

  const columns = useMemo<ColumnDef<Order, unknown>[]>(
    () => [
      // AI column - only show if venue has chatbot feature
      ...(hasChatbot
        ? [
            {
              id: 'ai',
              header: () => <span className="sr-only">AI</span>,
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
        // Waiter: use servedBy (who served the table) or fallback to createdBy
        accessorFn: row => {
          const waiter = row.servedBy || row.createdBy
          return waiter ? `${waiter.firstName}` : '-'
        },
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
      // Superadmin actions column
      ...(isSuperAdmin
        ? [
            {
              id: 'actions',
              header: () => (
                <span className="text-xs font-medium bg-gradient-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent">
                  Superadmin
                </span>
              ),
              cell: ({ row }: { row: { original: Order } }) => (
                <div className="flex items-center justify-end">
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-gradient-to-r from-amber-400 to-pink-500">
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
    [t, formatTime, formatDate, venueTimezoneShort, sortField, sortOrder, isSuperAdmin, hasChatbot],
  )

  // Search callback for DataTable
  const handleSearch = useCallback((searchTerm: string, orders: any[]) => {
    if (!searchTerm) return orders

    const lowerSearchTerm = searchTerm.toLowerCase()

    return orders.filter(order => {
      const folioMatch = order.orderNumber?.toLowerCase().includes(lowerSearchTerm)
      // const customerMatch = order.customerName?.toLowerCase().includes(lowerSearchTerm)
      const waiter = order.servedBy || order.createdBy
      const waiterName = waiter ? `${waiter.firstName} ${waiter.lastName}` : ''
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
          const waiter = order.servedBy || order.createdBy
          const waiterName = waiter ? `${waiter.firstName} ${waiter.lastName}` : '-'
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
              <Badge className="bg-gradient-to-r from-amber-400 to-pink-500 text-primary-foreground border-0">
                {tCommon('superadmin.edit.editMode')}
              </Badge>
              {tCommon('superadmin.edit.title')}
            </DialogTitle>
            <DialogDescription>
              {t('editDialog.description', { id: orderToEdit?.orderNumber || '' })}
            </DialogDescription>
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
                <Select
                  value={editValues.type}
                  onValueChange={(value: OrderTypeEnum) => setEditValues(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger className="border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OrderTypeEnum.DINE_IN}>{t('types.DINE_IN')}</SelectItem>
                    <SelectItem value={OrderTypeEnum.TAKEOUT}>{t('types.TAKEOUT')}</SelectItem>
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
                  value={editValues.tipAmount}
                  onChange={e => setEditValues(prev => ({ ...prev, tipAmount: parseFloat(e.target.value) || 0 }))}
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
                  value={editValues.total}
                  onChange={e => setEditValues(prev => ({ ...prev, total: parseFloat(e.target.value) || 0 }))}
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
              className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground border-0"
            >
              {updateOrderMutation.isPending ? tCommon('saving') : tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
