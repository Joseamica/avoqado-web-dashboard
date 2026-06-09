import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { StatusPulse } from '@/components/ui/status-pulse'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import api from '@/api'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Eye,
  MoreHorizontal,
  PartyPopper,
  User,
  X,
} from 'lucide-react'
import DataTable from '@/components/data-table'
import { type ColumnDef } from '@tanstack/react-table'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface AgingOrder {
  id: string
  orderNumber: string
  total: number
  paidAmount: number
  remainingBalance: number
  daysOld: number
  createdAt: string
  tableName: string | null
  customerId?: string | null
  customer: {
    name: string
    phone: string | null
  } | null
}

interface AgingSummary {
  aging_0_30_total: number
  aging_0_30_count: number
  aging_31_60_total: number
  aging_31_60_count: number
  aging_61_90_total: number
  aging_61_90_count: number
  aging_90_plus_total: number
  aging_90_plus_count: number
  total_balance: number
  total_count: number
}

interface AgingData {
  summary: AgingSummary
  orders: {
    aging_0_30: AgingOrder[]
    aging_31_60: AgingOrder[]
    aging_61_90: AgingOrder[]
    aging_90_plus: AgingOrder[]
  }
}

type BucketKey = '0_30' | '31_60' | '61_90' | '90_plus'
type BucketColor = 'green' | 'yellow' | 'orange' | 'red'

// Risk-coded styling per aging bucket. Solid status colors only — no gradients.
const COLOR: Record<
  BucketColor,
  { dot: string; bar: string; ring: string; soft: string; text: string }
> = {
  green: {
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    ring: 'ring-emerald-500/60',
    soft: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  yellow: {
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
    ring: 'ring-amber-500/60',
    soft: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
  },
  orange: {
    dot: 'bg-orange-500',
    bar: 'bg-orange-500',
    ring: 'ring-orange-500/60',
    soft: 'bg-orange-500/10',
    text: 'text-orange-600 dark:text-orange-400',
  },
  red: {
    dot: 'bg-rose-500',
    bar: 'bg-rose-500',
    ring: 'ring-rose-500/60',
    soft: 'bg-rose-500/10',
    text: 'text-rose-600 dark:text-rose-400',
  },
}

const inBucket = (days: number): BucketKey => {
  if (days <= 30) return '0_30'
  if (days <= 60) return '31_60'
  if (days <= 90) return '61_90'
  return '90_plus'
}

export default function PayLaterAging() {
  const { t } = useTranslation('reports')
  const { venueId } = useCurrentVenue()
  const { formatDate } = useVenueDateTime()
  const { toast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Singular/plural helpers — project uses separate keys (e.g. businessDay/businessDays)
  const ordersLabel = useCallback(
    (n: number) => t(n === 1 ? 'payLaterAging.order' : 'payLaterAging.orders', { count: n }),
    [t]
  )
  const daysLabel = useCallback(
    (n: number) => t(n === 1 ? 'payLaterAging.day' : 'payLaterAging.days', { count: n }),
    [t]
  )

  const [settleDialogOpen, setSettleDialogOpen] = useState(false)
  const [orderToSettle, setOrderToSettle] = useState<AgingOrder | null>(null)
  const [settleNotes, setSettleNotes] = useState('')
  const [selectedBucket, setSelectedBucket] = useState<BucketKey | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['pay-later-aging', venueId],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: AgingData }>(
        `/api/v1/dashboard/reports/venues/${venueId}/pay-later-aging`
      )
      return response.data.data
    },
    refetchInterval: 60000, // Refresh every minute
  })

  // Mutation to settle a single order
  const settleOrderMutation = useMutation({
    mutationFn: async ({ orderId, notes }: { orderId: string; notes?: string }) => {
      const response = await api.post(`/api/v1/dashboard/venues/${venueId}/orders/${orderId}/settle`, {
        notes,
      })
      return response.data
    },
    onSuccess: () => {
      toast({
        title: t('payLaterAging.settle.successTitle'),
        description: t('payLaterAging.settle.successDesc', { order: orderToSettle?.orderNumber }),
      })
      queryClient.invalidateQueries({ queryKey: ['pay-later-aging', venueId] })
      queryClient.invalidateQueries({ queryKey: ['customers', venueId] })
      setSettleDialogOpen(false)
      setOrderToSettle(null)
      setSettleNotes('')
    },
    onError: (error: any) => {
      toast({
        title: t('payLaterAging.settle.errorTitle'),
        description: error.response?.data?.message || t('payLaterAging.settle.errorDesc'),
        variant: 'destructive',
      })
    },
  })

  const handleSettleClick = (order: AgingOrder) => {
    setOrderToSettle(order)
    setSettleDialogOpen(true)
  }

  const handleSettleConfirm = () => {
    if (orderToSettle) {
      settleOrderMutation.mutate({
        orderId: orderToSettle.id,
        notes: settleNotes || undefined,
      })
    }
  }

  // Combine all orders, oldest first
  const allOrders = useMemo(() => {
    if (!data) return []
    return [
      ...data.orders.aging_0_30,
      ...data.orders.aging_31_60,
      ...data.orders.aging_61_90,
      ...data.orders.aging_90_plus,
    ].sort((a, b) => b.daysOld - a.daysOld)
  }, [data])

  // Apply the active bucket filter (driven by clicking a summary tile)
  const visibleOrders = useMemo(() => {
    if (!selectedBucket) return allOrders
    return allOrders.filter(o => inBucket(o.daysOld) === selectedBucket)
  }, [allOrders, selectedBucket])

  const summary = data?.summary
  const totalBalance = summary?.total_balance || 0

  const buckets = useMemo(
    () => [
      {
        key: '0_30' as BucketKey,
        color: 'green' as BucketColor,
        label: t('payLaterAging.buckets.current'),
        caption: t('payLaterAging.captions.current'),
        total: summary?.aging_0_30_total || 0,
        count: summary?.aging_0_30_count || 0,
      },
      {
        key: '31_60' as BucketKey,
        color: 'yellow' as BucketColor,
        label: t('payLaterAging.buckets.soon'),
        caption: t('payLaterAging.captions.soon'),
        total: summary?.aging_31_60_total || 0,
        count: summary?.aging_31_60_count || 0,
      },
      {
        key: '61_90' as BucketKey,
        color: 'orange' as BucketColor,
        label: t('payLaterAging.buckets.overdue'),
        caption: t('payLaterAging.captions.overdue'),
        total: summary?.aging_61_90_total || 0,
        count: summary?.aging_61_90_count || 0,
      },
      {
        key: '90_plus' as BucketKey,
        color: 'red' as BucketColor,
        label: t('payLaterAging.buckets.critical'),
        caption: t('payLaterAging.captions.critical'),
        total: summary?.aging_90_plus_total || 0,
        count: summary?.aging_90_plus_count || 0,
      },
    ],
    [summary, t]
  )

  // Money at risk = anything 61+ days overdue
  const atRisk = (summary?.aging_61_90_total || 0) + (summary?.aging_90_plus_total || 0)
  const atRiskPct = totalBalance > 0 ? Math.round((atRisk / totalBalance) * 100) : 0

  const columns: ColumnDef<AgingOrder>[] = useMemo(
    () => [
      {
        accessorKey: 'orderNumber',
        header: t('payLaterAging.columns.order'),
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.orderNumber}</span>,
      },
      {
        accessorKey: 'customer',
        header: t('payLaterAging.columns.customer'),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.customer?.name || t('payLaterAging.noName')}</span>
            {row.original.customer?.phone && (
              <span className="text-xs text-muted-foreground">{row.original.customer.phone}</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'tableName',
        header: t('payLaterAging.columns.table'),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.tableName || '—'}</span>,
      },
      {
        accessorKey: 'daysOld',
        header: t('payLaterAging.columns.aging'),
        cell: ({ row }) => {
          const days = row.original.daysOld
          const c = COLOR[
            (['green', 'yellow', 'orange', 'red'] as BucketColor[])[
              ['0_30', '31_60', '61_90', '90_plus'].indexOf(inBucket(days))
            ]
          ]
          return (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                c.soft,
                c.text
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
              {daysLabel(days)}
            </span>
          )
        },
      },
      {
        accessorKey: 'createdAt',
        header: t('payLaterAging.columns.date'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>
        ),
      },
      {
        accessorKey: 'total',
        header: t('payLaterAging.columns.total'),
        cell: ({ row }) => <span className="text-sm tabular-nums">{Currency(row.original.total)}</span>,
      },
      {
        accessorKey: 'paidAmount',
        header: t('payLaterAging.columns.paid'),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-muted-foreground">{Currency(row.original.paidAmount)}</span>
        ),
      },
      {
        accessorKey: 'remainingBalance',
        header: t('payLaterAging.columns.balance'),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-foreground">
            {Currency(row.original.remainingBalance)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('payLaterAging.columns.actions'),
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`../orders/${row.original.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                {t('payLaterAging.rowActions.viewOrder')}
              </DropdownMenuItem>
              {row.original.customerId && (
                <DropdownMenuItem onClick={() => navigate(`../customers/${row.original.customerId}`)}>
                  <User className="mr-2 h-4 w-4" />
                  {t('payLaterAging.rowActions.viewCustomer')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleSettleClick(row.original)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                {t('payLaterAging.rowActions.settle')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [formatDate, navigate, t, daysLabel]
  )

  if (error) {
    return (
      <div className="p-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {t('payLaterAging.error.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{t('payLaterAging.error.load', { message: (error as Error).message })}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isEmpty = !isLoading && (summary?.total_count || 0) === 0

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('payLaterAging.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('payLaterAging.subtitle')}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-input bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <StatusPulse status="success" size="sm" />
          {t('payLaterAging.liveBadge')}
        </div>
      </div>

      {/* Hero: total owed + proportional risk bar + clickable buckets */}
      <Card className="border-input overflow-hidden">
        <CardContent className="p-5 sm:p-6 space-y-6">
          {/* Top row: total + at-risk */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('payLaterAging.totalLabel')}</p>
              <div className="mt-1 flex items-baseline gap-2.5">
                {isLoading ? (
                  <div className="h-9 w-44 animate-pulse rounded-md bg-muted" />
                ) : (
                  <span className="text-4xl font-bold tracking-tight tabular-nums text-foreground">
                    {Currency(totalBalance)}
                  </span>
                )}
                <span className="text-sm text-muted-foreground">{ordersLabel(summary?.total_count || 0)}</span>
              </div>
            </div>

            {!isLoading && atRisk > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 px-3.5 py-2 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold tabular-nums">
                    {t('payLaterAging.atRisk', { amount: Currency(atRisk) })}
                  </p>
                  <p className="text-xs opacity-80">{t('payLaterAging.atRiskCaption', { pct: atRiskPct })}</p>
                </div>
              </div>
            )}
          </div>

          {/* Proportional aging bar */}
          {isLoading ? (
            <div className="h-3 w-full animate-pulse rounded-full bg-muted" />
          ) : totalBalance > 0 ? (
            <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
              {buckets.map(b => {
                const pct = (b.total / totalBalance) * 100
                if (pct <= 0) return null
                const isActive = !selectedBucket || selectedBucket === b.key
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setSelectedBucket(prev => (prev === b.key ? null : b.key))}
                    title={`${b.label} · ${Currency(b.total)} (${Math.round(pct)}%)`}
                    style={{ width: `${pct}%` }}
                    className={cn(
                      'h-full min-w-[3px] cursor-pointer transition-opacity hover:opacity-100',
                      COLOR[b.color].bar,
                      isActive ? 'opacity-100' : 'opacity-30'
                    )}
                  />
                )
              })}
            </div>
          ) : (
            <div className="h-3 w-full rounded-full bg-muted" />
          )}

          {/* Bucket tiles — click to filter the table below */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {buckets.map(b => {
              const c = COLOR[b.color]
              const isSelected = selectedBucket === b.key
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setSelectedBucket(prev => (prev === b.key ? null : b.key))}
                  className={cn(
                    'group flex flex-col items-start rounded-xl border border-input bg-card p-3.5 text-left transition-all',
                    'hover:border-foreground/20 hover:bg-muted/40',
                    isSelected && cn('ring-2 ring-offset-1 ring-offset-background', c.ring, c.soft)
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <span className={cn('h-2 w-2 rounded-full', c.dot)} />
                      {b.label}
                    </span>
                    {isSelected && <X className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  {isLoading ? (
                    <div className="mt-2 h-7 w-20 animate-pulse rounded bg-muted" />
                  ) : (
                    <span className={cn('mt-1.5 text-2xl font-bold tabular-nums', c.text)}>
                      {Currency(b.total)}
                    </span>
                  )}
                  <span className="mt-0.5 text-xs text-muted-foreground">
                    {b.caption} · {ordersLabel(b.count)}
                  </span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Orders Table — or celebratory empty state */}
      {isEmpty ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
              <PartyPopper className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{t('payLaterAging.empty.title')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('payLaterAging.empty.subtitle')}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-input">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>{t('payLaterAging.detailTitle')}</CardTitle>
                <CardDescription>{t('payLaterAging.detailSubtitle')}</CardDescription>
              </div>
              {selectedBucket && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedBucket(null)}
                  className="h-8 gap-1.5 rounded-full"
                >
                  <X className="h-3.5 w-3.5" />
                  {buckets.find(b => b.key === selectedBucket)?.label}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              data={visibleOrders}
              rowCount={visibleOrders.length}
              columns={columns}
              isLoading={isLoading}
              enableSearch={true}
              searchPlaceholder={t('payLaterAging.searchPlaceholder')}
              tableId="pay-later-aging:main"
              stickyFirstColumn={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Settle Order Dialog */}
      <Dialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('payLaterAging.settle.dialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('payLaterAging.settle.dialogDesc', { order: orderToSettle?.orderNumber })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-xl border border-input bg-muted/30 p-4 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('payLaterAging.settle.customer')}</span>
                <span className="font-medium">{orderToSettle?.customer?.name || t('payLaterAging.noName')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('payLaterAging.settle.balance')}</span>
                <span className="font-semibold tabular-nums">
                  {Currency(orderToSettle?.remainingBalance || 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('payLaterAging.settle.daysOverdue')}</span>
                <span className="tabular-nums">{daysLabel(orderToSettle?.daysOld || 0)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{t('payLaterAging.settle.notesLabel')}</Label>
              <Input
                id="notes"
                placeholder={t('payLaterAging.settle.notesPlaceholder')}
                value={settleNotes}
                onChange={(e) => setSettleNotes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t('payLaterAging.settle.notesHelp')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleDialogOpen(false)}>
              {t('payLaterAging.settle.cancel')}
            </Button>
            <Button onClick={handleSettleConfirm} disabled={settleOrderMutation.isPending}>
              {settleOrderMutation.isPending ? t('payLaterAging.settle.submitting') : t('payLaterAging.settle.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
