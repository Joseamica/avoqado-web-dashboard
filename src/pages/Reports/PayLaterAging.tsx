import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import api from '@/api'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { AlertCircle, Clock, DollarSign, TrendingUp, MoreHorizontal, CheckCircle, Eye, User } from 'lucide-react'
import DataTable from '@/components/data-table'
import { type ColumnDef } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

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

export default function PayLaterAging() {
  const { venueId } = useCurrentVenue()
  const { formatDate } = useVenueDateTime()
  const { toast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [settleDialogOpen, setSettleDialogOpen] = useState(false)
  const [orderToSettle, setOrderToSettle] = useState<AgingOrder | null>(null)
  const [settleNotes, setSettleNotes] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['pay-later-aging', venueId],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: AgingData }>(
        '/api/v1/dashboard/reports/pay-later-aging'
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
        title: 'Orden Liquidada',
        description: `La orden ${orderToSettle?.orderNumber} ha sido marcada como pagada`,
      })
      queryClient.invalidateQueries({ queryKey: ['pay-later-aging', venueId] })
      queryClient.invalidateQueries({ queryKey: ['customers', venueId] })
      setSettleDialogOpen(false)
      setOrderToSettle(null)
      setSettleNotes('')
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Error al liquidar la orden',
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

  // Combine all orders for the main table
  const allOrders = useMemo(() => {
    if (!data) return []
    return [
      ...data.orders.aging_0_30,
      ...data.orders.aging_31_60,
      ...data.orders.aging_61_90,
      ...data.orders.aging_90_plus,
    ].sort((a, b) => b.daysOld - a.daysOld) // Oldest first
  }, [data])

  const columns: ColumnDef<AgingOrder>[] = useMemo(
    () => [
      {
        accessorKey: 'orderNumber',
        header: 'Orden',
        cell: ({ row }) => <span className="font-mono">{row.original.orderNumber}</span>,
      },
      {
        accessorKey: 'customer',
        header: 'Cliente',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.customer?.name || 'Sin nombre'}</span>
            {row.original.customer?.phone && (
              <span className="text-xs text-muted-foreground">{row.original.customer.phone}</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'tableName',
        header: 'Mesa',
        cell: ({ row }) => <span>{row.original.tableName || '—'}</span>,
      },
      {
        accessorKey: 'daysOld',
        header: 'Días Vencido',
        cell: ({ row }) => {
          const days = row.original.daysOld
          let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default'
          let className = ''

          if (days <= 30) {
            className = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          } else if (days <= 60) {
            className = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
          } else if (days <= 90) {
            className = 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
          } else {
            className = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
          }

          return (
            <Badge variant={variant} className={className}>
              {days} día{days !== 1 ? 's' : ''}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Fecha',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>
        ),
      },
      {
        accessorKey: 'total',
        header: 'Total',
        cell: ({ row }) => <span className="text-sm">{Currency(row.original.total)}</span>,
      },
      {
        accessorKey: 'paidAmount',
        header: 'Pagado',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{Currency(row.original.paidAmount)}</span>
        ),
      },
      {
        accessorKey: 'remainingBalance',
        header: 'Saldo Pendiente',
        cell: ({ row }) => (
          <span className="font-semibold text-orange-600">{Currency(row.original.remainingBalance)}</span>
        ),
      },
      {
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`../orders/${row.original.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                Ver Orden
              </DropdownMenuItem>
              {row.original.customerId && (
                <DropdownMenuItem onClick={() => navigate(`../customers/${row.original.customerId}`)}>
                  <User className="mr-2 h-4 w-4" />
                  Ver Cliente
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleSettleClick(row.original)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Liquidar Orden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [formatDate, navigate]
  )

  if (error) {
    return (
      <div className="p-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Error al cargar el reporte de antigüedad: {(error as Error).message}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Cuentas por Cobrar - Antigüedad</h1>
        <p className="text-muted-foreground">
          Reporte de órdenes "Pagar Después" agrupadas por antigüedad de vencimiento
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total */}
        <Card className="border-primary">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Total General
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Currency(data?.summary.total_balance || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">{data?.summary.total_count || 0} órdenes</p>
          </CardContent>
        </Card>

        {/* 0-30 days */}
        <AgingCard
          title="0-30 días"
          amount={data?.summary.aging_0_30_total || 0}
          count={data?.summary.aging_0_30_count || 0}
          color="green"
          icon={<TrendingUp className="h-4 w-4" />}
          isLoading={isLoading}
        />

        {/* 31-60 days */}
        <AgingCard
          title="31-60 días"
          amount={data?.summary.aging_31_60_total || 0}
          count={data?.summary.aging_31_60_count || 0}
          color="yellow"
          icon={<Clock className="h-4 w-4" />}
          isLoading={isLoading}
        />

        {/* 61-90 days */}
        <AgingCard
          title="61-90 días"
          amount={data?.summary.aging_61_90_total || 0}
          count={data?.summary.aging_61_90_count || 0}
          color="orange"
          icon={<AlertCircle className="h-4 w-4" />}
          isLoading={isLoading}
        />

        {/* 90+ days */}
        <AgingCard
          title="+90 días"
          amount={data?.summary.aging_90_plus_total || 0}
          count={data?.summary.aging_90_plus_count || 0}
          color="red"
          icon={<AlertCircle className="h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle de Órdenes</CardTitle>
          <CardDescription>Todas las órdenes pendientes de pago ordenadas por antigüedad</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={allOrders}
            rowCount={allOrders.length}
            columns={columns}
            isLoading={isLoading}
            enableSearch={true}
            searchPlaceholder="Buscar por orden, cliente o mesa..."
            tableId="pay-later-aging:main"
            stickyFirstColumn={true}
          />
        </CardContent>
      </Card>

      {/* Settle Order Dialog */}
      <Dialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liquidar Orden</DialogTitle>
            <DialogDescription>
              Marcar la orden {orderToSettle?.orderNumber} como pagada
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-medium">{orderToSettle?.customer?.name || 'Sin nombre'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Saldo pendiente:</span>
              <span className="font-semibold text-orange-600">
                {Currency(orderToSettle?.remainingBalance || 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Días vencido:</span>
              <span>{orderToSettle?.daysOld} días</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Input
                id="notes"
                placeholder="Ej: Pago en efectivo, Transferencia bancaria..."
                value={settleNotes}
                onChange={(e) => setSettleNotes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Agrega detalles sobre cómo se recibió el pago
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSettleConfirm} disabled={settleOrderMutation.isPending}>
              {settleOrderMutation.isPending ? 'Liquidando...' : 'Liquidar Orden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface AgingCardProps {
  title: string
  amount: number
  count: number
  color: 'green' | 'yellow' | 'orange' | 'red'
  icon: React.ReactNode
  isLoading: boolean
}

function AgingCard({ title, amount, count, color, icon, isLoading }: AgingCardProps) {
  const colorClasses = {
    green: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-800 dark:text-green-400',
      border: 'border-green-200 dark:border-green-800',
      icon: 'text-green-600 dark:text-green-400',
    },
    yellow: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-800 dark:text-yellow-400',
      border: 'border-yellow-200 dark:border-yellow-800',
      icon: 'text-yellow-600 dark:text-yellow-400',
    },
    orange: {
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-800 dark:text-orange-400',
      border: 'border-orange-200 dark:border-orange-800',
      icon: 'text-orange-600 dark:text-orange-400',
    },
    red: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-800 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800',
      icon: 'text-red-600 dark:text-red-400',
    },
  }

  const classes = colorClasses[color]

  if (isLoading) {
    return (
      <Card className={classes.border}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            <div className="h-4 bg-muted animate-pulse rounded w-20" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-8 bg-muted animate-pulse rounded w-24 mb-2" />
          <div className="h-3 bg-muted animate-pulse rounded w-16" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={classes.border}>
      <CardHeader className="pb-3">
        <CardTitle className={`text-sm font-medium flex items-center gap-2 ${classes.text}`}>
          <span className={classes.icon}>{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${classes.text}`}>{Currency(amount)}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {count} orden{count !== 1 ? 'es' : ''}
        </p>
      </CardContent>
    </Card>
  )
}
