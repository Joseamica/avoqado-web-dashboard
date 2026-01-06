import api from '@/api'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { useCallback, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import DataTable from '@/components/data-table'
// import { Shift } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useAuth } from '@/context/AuthContext'
import { StaffRole } from '@/types'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { useLocation, useNavigate } from 'react-router-dom'
import { useShiftSocketEvents } from '@/hooks/use-shift-socket-events'
import { usePaymentSocketEvents } from '@/hooks/use-payment-socket-events'
import { useToast } from '@/hooks/use-toast'
import { AddToAIButton } from '@/components/AddToAIButton'
import { Pencil, Trash2 } from 'lucide-react'
import type { ShiftReference } from '@/types/chat-references'

export default function Shifts() {
  const { t, i18n } = useTranslation('shifts')
  const { t: tCommon } = useTranslation('common')
  const localeCode = getIntlLocale(i18n.language)
  const { venueId } = useCurrentVenue()
  const { formatTime, formatDate, venueTimezoneShort } = useVenueDateTime()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user, checkFeatureAccess } = useAuth()
  const isSuperAdmin = user?.role === StaffRole.SUPERADMIN
  const hasChatbot = checkFeatureAccess('CHATBOT')

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [shiftToDelete, setShiftToDelete] = useState<any>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [shiftToEdit, setShiftToEdit] = useState<any>(null)
  const [editValues, setEditValues] = useState({ totalSales: 0, totalTips: 0 })

  const { data, isLoading } = useQuery({
    queryKey: ['shifts', venueId, pagination.pageIndex, pagination.pageSize],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/shifts`, {
        params: {
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
        },
      })
      return response.data
    },
  })

  // Real-time shift updates via Socket.IO
  useShiftSocketEvents(venueId, {
    onShiftOpened: event => {
      console.log('🟢 Shift opened:', event.shiftId, 'by', event.staffName)
      toast({
        title: t('notifications.shiftOpened'),
        description: `${event.staffName} - ${formatTime(event.startTime)}`,
      })
      // ✅ FIX: Invalidate ALL shift queries (including paginated ones)
      queryClient.invalidateQueries({
        predicate: query => query.queryKey[0] === 'shifts' && query.queryKey[1] === venueId,
      })
    },
    onShiftClosed: event => {
      console.log('🔴 Shift closed:', event.shiftId, 'Total sales:', event.totalSales)
      toast({
        title: t('notifications.shiftClosed'),
        description: `${event.staffName} - ${t('columns.totalSales')}: ${Currency(event.totalSales || 0)}`,
      })
      // ✅ FIX: Invalidate ALL shift queries (including paginated ones)
      queryClient.invalidateQueries({
        predicate: query => query.queryKey[0] === 'shifts' && query.queryKey[1] === venueId,
      })
    },
  })

  // Real-time payment updates to refresh shift totals
  const handlePaymentCompleted = useCallback(
    (event: any) => {
      console.log('💰 Payment completed:', event.paymentId, 'Amount:', event.amount)
      // Invalidate ALL shift queries to refresh totals when payments are processed
      queryClient.invalidateQueries({
        predicate: query => query.queryKey[0] === 'shifts' && query.queryKey[1] === venueId,
      })
    },
    [venueId, queryClient],
  )

  usePaymentSocketEvents(venueId, {
    onPaymentCompleted: handlePaymentCompleted,
  })

  // Delete mutation (SUPERADMIN only)
  const deleteShiftMutation = useMutation({
    mutationFn: (shiftId: string) => api.delete(`/api/v1/dashboard/venues/${venueId}/shifts/${shiftId}`),
    onSuccess: () => {
      toast({
        title: tCommon('superadmin.delete.success'),
      })
      queryClient.invalidateQueries({
        predicate: query => query.queryKey[0] === 'shifts' && query.queryKey[1] === venueId,
      })
      setDeleteDialogOpen(false)
      setShiftToDelete(null)
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
  const updateShiftMutation = useMutation({
    mutationFn: (data: { shiftId: string; totalSales: number; totalTips: number }) =>
      api.put(`/api/v1/dashboard/venues/${venueId}/shifts/${data.shiftId}`, {
        totalSales: data.totalSales,
        totalTips: data.totalTips,
      }),
    onSuccess: () => {
      toast({
        title: tCommon('superadmin.edit.success'),
      })
      queryClient.invalidateQueries({
        predicate: query => query.queryKey[0] === 'shifts' && query.queryKey[1] === venueId,
      })
      setEditDialogOpen(false)
      setShiftToEdit(null)
    },
    onError: (error: Error) => {
      toast({
        title: tCommon('superadmin.edit.error'),
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleDeleteClick = (e: React.MouseEvent, shift: any) => {
    e.stopPropagation()
    setShiftToDelete(shift)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (shiftToDelete) {
      deleteShiftMutation.mutate(shiftToDelete.id)
    }
  }

  const handleEditClick = (e: React.MouseEvent, shift: any) => {
    e.stopPropagation()
    setShiftToEdit(shift)
    setEditValues({
      totalSales: Number(shift.totalSales) || 0,
      totalTips: Number(shift.totalTips) || 0,
    })
    setEditDialogOpen(true)
  }

  const confirmEdit = () => {
    if (shiftToEdit) {
      updateShiftMutation.mutate({
        shiftId: shiftToEdit.id,
        totalSales: editValues.totalSales,
        totalTips: editValues.totalTips,
      })
    }
  }

  const totalShifts = data?.meta?.totalCount || 0

  // Transform row data to ShiftReference for AI button
  const toShiftReference = useCallback((row: any): ShiftReference => ({
    id: row.id,
    staffId: row.staff?.id || '',
    staffName: row.staff ? `${row.staff.firstName} ${row.staff.lastName}` : 'Unknown',
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.endTime ? 'CLOSED' : 'ACTIVE',
    totalSales: row.totalSales || 0,
    totalTips: row.totalTips || 0,
    totalOrders: row.orderCount || 0,
  }), [])

  const columns: ColumnDef<any, unknown>[] = useMemo(() => [
    // AI column - only show if venue has chatbot feature
    ...(hasChatbot
      ? [
          {
            id: 'ai',
            header: () => <span className="sr-only">{tCommon('screenReaderOnly.ai')}</span>,
            cell: ({ row }: { row: { original: any } }) => (
              <div className="flex justify-center">
                <AddToAIButton type="shift" data={toShiftReference(row.original)} variant="icon" />
              </div>
            ),
            size: 50,
            enableSorting: false,
          } as ColumnDef<any, unknown>,
        ]
      : []),
    {
      accessorFn: row => {
        return row.endTime ? t('closed') : t('open')
      },
      id: 'active',
      sortDescFirst: true,
      header: t('columns.status'),
      cell: ({ cell }) => {
        const value = cell.getValue() as string

        if (value === t('open')) {
          return (
            <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full font-medium">
              {t('open')}
            </span>
          )
        } else {
          return <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full font-medium">{t('closed')}</span>
        }
      },
    },
    {
      accessorKey: 'id',
      sortDescFirst: true,
      header: t('columns.shiftId'),
      cell: ({ cell }) => {
        const value = cell.getValue() as string
        return value.slice(-8) // Show last 8 characters of ID
      },
    },
    {
      accessorKey: 'startTime',
      sortDescFirst: true,
      header: () => (
        <div className="flex flex-col">
          <span>{t('columns.openTime')}</span>
          <span className="text-xs font-normal text-muted-foreground">({venueTimezoneShort})</span>
        </div>
      ),
      cell: ({ cell }) => {
        const value = cell.getValue() as string
        // ✅ CRITICAL: Uses venue timezone for accurate payroll calculations
        const time = formatTime(value)
        const date = formatDate(value)

        return (
          <div className="flex flex-col space-y-2">
            <span className="text-sm font-medium">{time}</span>
            <span className="text-xs text-muted-foreground">{date}</span>
          </div>
        )
      },
      footer: props => props.column.id,
      sortingFn: 'datetime',
    },
    {
      accessorKey: 'endTime',
      sortDescFirst: true,
      header: () => (
        <div className="flex flex-col">
          <span>{t('columns.closeTime')}</span>
          <span className="text-xs font-normal text-muted-foreground">({venueTimezoneShort})</span>
        </div>
      ),
      cell: ({ cell }) => {
        if (!cell.getValue()) return '-'
        const value = cell.getValue() as string
        // ✅ CRITICAL: Uses venue timezone for accurate payroll calculations
        const time = formatTime(value)
        const date = formatDate(value)

        return (
          <div className="flex flex-col space-y-2">
            <span className="text-sm font-medium">{time}</span>
            <span className="text-xs text-muted-foreground">{date}</span>
          </div>
        )
      },
      footer: props => props.column.id,
      sortingFn: 'datetime',
    },

    {
      accessorKey: 'totalSales',
      id: 'totalSales',
      header: t('columns.subtotal'),
      cell: ({ cell }) => {
        const value = cell.getValue() as number
        return value ? Currency(value) : Currency(0)
      },
      footer: props => props.column.id,
      sortingFn: 'alphanumeric',
    },
    {
      accessorKey: 'totalTips',
      id: 'totalTips',
      header: t('columns.totalTip'),
      cell: ({ row }) => {
        // Robust locale-aware parse: handles "1,231.00", "1.231,00", and plain numbers
        const parseAmount = (v: any): number => {
          if (typeof v === 'number') return Number.isFinite(v) ? v : 0
          if (v == null) return 0
          let s = String(v).trim()
          // Drop currency symbols and spaces
          s = s.replace(/[^0-9.,-]/g, '')
          if (!s) return 0
          const lastComma = s.lastIndexOf(',')
          const lastDot = s.lastIndexOf('.')
          const hasComma = lastComma !== -1
          const hasDot = lastDot !== -1
          if (hasComma && hasDot) {
            // Assume the right-most separator is the decimal, drop the other as thousand
            if (lastComma > lastDot) {
              s = s.replace(/\./g, '') // remove thousands dots
              s = s.replace(',', '.') // decimal comma -> dot
            } else {
              s = s.replace(/,/g, '') // remove thousands commas
              // decimal dot stays
            }
          } else if (hasComma && !hasDot) {
            // Treat comma as decimal
            s = s.replace(',', '.')
          }
          // Only dot or plain digits: nothing to do
          const n = Number(s)
          return Number.isFinite(n) ? n : 0
        }

        const totalTips = parseAmount(row.original.totalTips)
        const totalSales = parseAmount(row.original.totalSales)
        const providedSubtotal = parseAmount((row.original as any).subtotal)
        // totalSales already represents subtotal (before tips), use it directly
        let subtotal = providedSubtotal > 0 ? providedSubtotal : totalSales
        if (subtotal <= 0) subtotal = totalSales // fallback
        let tipPercentage = subtotal > 0 ? (totalTips / subtotal) * 100 : 0
        // Note: tipPercentage = tips / subtotal, NOT tips / (subtotal + tips)
        // Fallback to provided percentage field if available
        const providedPct = Number((row.original as any).tipPercentage ?? (row.original as any).tipsPercentage)
        if (!Number.isFinite(tipPercentage) || tipPercentage === 0) {
          if (Number.isFinite(providedPct) && providedPct > 0) tipPercentage = providedPct
        }

        let tipClasses = {
          bg: 'bg-green-100 dark:bg-green-900/30',
          text: 'text-green-700 dark:text-green-400',
        }

        if (tipPercentage < 7) {
          tipClasses = {
            bg: 'bg-red-100 dark:bg-red-900/30',
            text: 'text-red-700 dark:text-red-400',
          }
        } else if (tipPercentage >= 7 && tipPercentage < 10) {
          tipClasses = {
            bg: 'bg-yellow-100 dark:bg-yellow-900/30',
            text: 'text-yellow-700 dark:text-yellow-400',
          }
        }

        return (
          <div className="flex flex-col space-y-1 items-center">
            <span className="text-xs font-semibold text-muted-foreground">{tipPercentage.toFixed(1)}%</span>
            <Badge variant="soft" className={`${tipClasses.bg} ${tipClasses.text} border-transparent`}>
              {Currency(totalTips)}
            </Badge>
          </div>
        )
      },
      footer: props => props.column.id,
      sortingFn: 'alphanumeric',
    },
    {
      accessorFn: row => {
        const totalSales = row.totalSales || 0
        const totalTips = row.totalTips || 0
        return totalSales + totalTips
      },
      id: 'totalAmount',
      header: t('columns.total'),
      cell: ({ cell }) => {
        const value = cell.getValue() as number
        return value ? Currency(value) : Currency(0)
      },
      footer: props => props.column.id,
      sortingFn: 'alphanumeric',
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
            cell: ({ row }: { row: { original: any } }) => (
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
  ], [t, toShiftReference, formatTime, formatDate, venueTimezoneShort, isSuperAdmin, hasChatbot])

  // Search callback for DataTable
  const handleSearch = useCallback((searchTerm: string, shifts: any[]) => {
    if (!searchTerm) return shifts

    const lowerSearchTerm = searchTerm.toLowerCase()

    return shifts.filter(shift => {
      // Search by shift ID or staff name
      const shiftIdMatch = shift.id.toString().includes(lowerSearchTerm)
      const staffNameMatch = shift.staff
        ? `${shift.staff.firstName} ${shift.staff.lastName}`.toLowerCase().includes(lowerSearchTerm)
        : false
      const totalSalesMatch = shift.totalSales.toString().includes(lowerSearchTerm)

      return shiftIdMatch || staffNameMatch || totalSalesMatch
    })
  }, [])

  return (
    <div className="p-4 bg-background text-foreground">
      <div className="flex flex-row items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        {/* <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      {mutation.isPending ? 'Syncing...' : 'Syncronizar Meseros'}
    </Button> */}
        {/* TODO: Add create waiter CTA if needed */}
      </div>

      <DataTable
        data={data?.data || []}
        rowCount={totalShifts}
        columns={columns}
        isLoading={isLoading}
        enableSearch={true}
        searchPlaceholder={t('common:search')}
        onSearch={handleSearch}
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
              {tCommon('superadmin.delete.description', { item: shiftToDelete?.id?.slice(-8) || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteShiftMutation.isPending}
            >
              {deleteShiftMutation.isPending ? tCommon('deleting') : tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog (SUPERADMIN only) */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge className="bg-gradient-to-r from-amber-400 to-pink-500 text-primary-foreground border-0">
                {tCommon('superadmin.edit.editMode')}
              </Badge>
              {tCommon('superadmin.edit.title')}
            </DialogTitle>
            <DialogDescription>
              {t('editDialog.description', { id: shiftToEdit?.id?.slice(-8) || '' })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Total Sales field */}
            <div className="space-y-2">
              <Label htmlFor="edit-totalSales">{t('columns.subtotal')}</Label>
              <Input
                id="edit-totalSales"
                type="number"
                step="0.01"
                value={editValues.totalSales}
                onChange={e => setEditValues(prev => ({ ...prev, totalSales: parseFloat(e.target.value) || 0 }))}
                className="border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20"
              />
            </div>

            {/* Total Tips field */}
            <div className="space-y-2">
              <Label htmlFor="edit-totalTips">{t('columns.totalTip')}</Label>
              <Input
                id="edit-totalTips"
                type="number"
                step="0.01"
                value={editValues.totalTips}
                onChange={e => setEditValues(prev => ({ ...prev, totalTips: parseFloat(e.target.value) || 0 }))}
                className="border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20"
              />
            </div>

            {/* Total preview */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium text-muted-foreground">{t('columns.total')}</span>
              <span className="text-lg font-semibold">{Currency(editValues.totalSales + editValues.totalTips)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={confirmEdit}
              disabled={updateShiftMutation.isPending}
              className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground border-0"
            >
              {updateShiftMutation.isPending ? tCommon('saving') : tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
