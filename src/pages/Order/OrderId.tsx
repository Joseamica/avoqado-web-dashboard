import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import * as orderService from '@/services/order.service'
import { OrderStatus, Order as OrderType, StaffRole } from '@/types'
import { Currency } from '@/utils/currency'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  Download,
  Eye,
  FileText,
  MapPin,
  PencilIcon,
  Receipt,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  TrendingUp,
  Utensils,
  X,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

export default function OrderId() {
  const { t, i18n } = useTranslation('orders')
  const { orderId } = useParams<{ orderId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { venueId } = useCurrentVenue()

  const [isEditing, setIsEditing] = useState(false)
  const [editedOrder, setEditedOrder] = useState<OrderType | null>(null)

  // Enhanced status badge styling for enterprise look
  const getOrderStatusStyle = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
      case 'PAID':
      case 'CLOSED':
        return {
          badge:
            'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800',
          icon: CheckCircle2,
          color: 'text-emerald-500',
        }
      case 'PENDING':
      case 'OPEN':
        return {
          badge: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-amber-800',
          icon: Clock,
          color: 'text-amber-500',
        }
      case 'CANCELLED':
      case 'CANCELED':
      case 'DELETED':
        return {
          badge: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-800',
          icon: XCircle,
          color: 'text-red-500',
        }
      default:
        return {
          badge: 'bg-muted text-muted-foreground border border-border',
          icon: AlertCircle,
          color: 'text-muted-foreground',
        }
    }
  }

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: t('common.copied'),
      description: t('detail.copiedToClipboard', { label }),
    })
  }

  // CAMBIO: Opciones de estado basadas en el enum OrderStatus con i18n
  const statusOptions = Object.values(OrderStatus).map(status => ({
    value: status,
    label: t(`orders.detail.statuses.${status}`),
  }))

  // CAMBIO: Fetch de la orden individual
  const { data: order, isLoading } = useQuery({
    queryKey: ['order', venueId, orderId],
    queryFn: () => orderService.getOrder(venueId, orderId),
    enabled: !!orderId, // Solo ejecutar si orderId existe
  })

  useEffect(() => {
    if (order) {
      setEditedOrder(order)
    }
  }, [order])

  // CAMBIO: Mutaciones para actualizar y eliminar la orden
  const updateOrderMutation = useMutation({
    mutationFn: (updatedOrder: Partial<OrderType>) => orderService.updateOrder(venueId, orderId, updatedOrder),
    onSuccess: () => {
      toast({
        title: t('detail.toast.updatedTitle'),
        description: t('detail.toast.updatedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['order', venueId, orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders', venueId] }) // Invalida la lista también
      setIsEditing(false)
    },
    onError: (error: any) => {
      toast({
        title: t('detail.toast.updateErrorTitle'),
        description: error.response?.data?.message || t('detail.toast.updateErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  const deleteOrderMutation = useMutation({
    mutationFn: () => orderService.deleteOrder(venueId, orderId),
    onSuccess: () => {
      toast({
        title: t('detail.toast.deletedTitle'),
        description: t('detail.toast.deletedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['orders', venueId] })
      navigate(`/venues/${venueId}/orders`)
    },
    onError: (error: any) => {
      toast({
        title: t('detail.toast.deleteErrorTitle'),
        description: error.response?.data?.message || t('detail.toast.deleteErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  const handleInputChange = (field: keyof OrderType, value: any) => {
    setEditedOrder(prev => (prev ? { ...prev, [field]: value } : null))
  }

  const handleSave = () => {
    if (editedOrder) {
      // Solo enviamos los campos que se pueden editar
      const payload: Partial<OrderType> = {
        status: editedOrder.status,
        customerName: editedOrder.customerName,
      }
      updateOrderMutation.mutate(payload)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedOrder(order || null)
  }

  const from = (location.state as any)?.from || `/venues/${venueId}/orders`

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString(getIntlLocale(i18n.language), {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getStatusText = (status: string) => t(`orders.detail.statuses.${status}`)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">{t('detail.loading')}</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <AlertCircle className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">{t('detail.notFound')}</p>
        <Button asChild>
          <Link to={from}>{t('detail.backToOrders')}</Link>
        </Button>
      </div>
    )
  }

  const orderStatus = getOrderStatusStyle(order.status)
  const StatusIcon = orderStatus.icon

  // Calculate order statistics
  const itemsCount = order.items?.length || 0
  const totalItems = order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-muted to-background">
        {/* Enhanced Header */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={from}>
                      <ArrowLeft className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('detail.backToList', { defaultValue: 'Volver a órdenes' })}</TooltipContent>
              </Tooltip>
              <div>
                <h1 className="text-xl font-semibold text-foreground">{t('detail.title', { number: order.orderNumber })}</h1>
                <p className="text-sm text-muted-foreground">
                  {t('detail.idLabel', { defaultValue: 'ID' })}:
                  <span className="font-mono text-xs break-all select-all max-w-[200px] inline-block">{order.id}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {isEditing ? (
                <Select value={editedOrder?.status} onValueChange={(value: OrderStatus) => handleInputChange('status', value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className={orderStatus.badge}>
                  <StatusIcon className={`h-3 w-3 mr-1 ${orderStatus.color}`} />
                  {getStatusText(order.status)}
                </Badge>
              )}
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t('detail.totals.total', { defaultValue: 'Total' })}</p>
                <p className="text-lg font-bold text-foreground">{Currency(order.total || 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Quick Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('detail.overview.subtotal', { defaultValue: 'Subtotal' })}
                    </p>
                    <p className="text-2xl font-bold text-foreground">{Currency(order.subtotal || 0)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('detail.overview.tips', { defaultValue: 'Propinas' })}
                    </p>
                    <p className="text-2xl font-bold text-foreground">{Currency(order.tipAmount || 0)}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.subtotal && order.subtotal > 0 ? (((order.tipAmount || 0) / order.subtotal) * 100).toFixed(1) : '0.0'}%
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('detail.overview.items', { defaultValue: 'Artículos' })}
                    </p>
                    <p className="text-2xl font-bold text-foreground">{totalItems}</p>
                    <p className="text-xs text-muted-foreground">{t('detail.overview.uniqueProducts', { count: itemsCount })}</p>
                  </div>
                  <Utensils className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('detail.overview.table', { defaultValue: 'Mesa' })}
                    </p>
                    <p className="text-lg font-bold text-foreground">{order.table?.number || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">{order.table?.area?.name || t('detail.overview.noArea')}</p>
                  </div>
                  <MapPin className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Bar */}
          {order && (
            <Card className="bg-gradient-to-r from-muted to-blue-50 dark:to-blue-950/50 border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-foreground">
                      {t('detail.actions.title', { defaultValue: 'Acciones de la Orden' })}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    {/* Edit/Save/Cancel Actions */}
                    {(user?.role === StaffRole.SUPERADMIN || user?.role === StaffRole.OWNER) && (
                      <>
                        {isEditing ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleSave}
                              disabled={updateOrderMutation.isPending}
                              className="bg-background hover:bg-green-50 dark:hover:bg-green-950/50"
                            >
                              {updateOrderMutation.isPending ? (
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4 mr-2" />
                              )}
                              {t('common.save', { defaultValue: 'Guardar' })}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancel}
                              className="bg-background hover:bg-red-50 dark:hover:bg-red-950/50"
                            >
                              <X className="w-4 h-4 mr-2" />
                              {t('common.cancel', { defaultValue: 'Cancelar' })}
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditing(true)}
                            className="bg-background hover:bg-blue-50 dark:hover:bg-blue-950/50"
                          >
                            <PencilIcon className="w-4 h-4 mr-2" />
                            {t('common.edit', { defaultValue: 'Editar' })}
                          </Button>
                        )}
                      </>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-background hover:bg-blue-50 dark:hover:bg-blue-950/50"
                      onClick={() => copyToClipboard(order.id || '', 'ID de la orden')}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {t('detail.actions.copyId')}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-background hover:bg-blue-50 dark:hover:bg-blue-950/50"
                      onClick={() => {
                        // Export order details as JSON
                        const data = JSON.stringify(order, null, 2)
                        const blob = new Blob([data], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `order-${order.orderNumber}.json`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {t('detail.actions.export')}
                    </Button>

                    {/* Delete Action (Only for SUPERADMIN/OWNER) */}
                    {(user?.role === StaffRole.SUPERADMIN || user?.role === StaffRole.OWNER) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-background hover:bg-red-50 dark:hover:bg-red-950/50 text-red-600 border-red-200"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('common.delete', { defaultValue: 'Eliminar' })}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('common.areYouSure')}</AlertDialogTitle>
                            <AlertDialogDescription>{t('detail.deleteWarning')}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteOrderMutation.mutate()}>
                              {t('common.delete', { defaultValue: 'Eliminar' })}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Order Information Card */}
              <Card className="shadow-lg">
                <CardHeader className="bg-gradient-to-r from-muted to-blue-50 dark:to-blue-950/50 border-b">
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span>{t('detail.sections.orderInfo')}</span>
                  </CardTitle>
                  <CardDescription>{t('detail.sections.orderInfoDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{t('detail.fields.dateTime')}</span>
                      </Label>
                      <div className="p-3 bg-muted rounded-md border border-border">
                        <p className="font-mono text-sm">{formatDate(order.createdAt)}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">{t('detail.fields.orderNumber')}</Label>
                      <div className="p-3 bg-muted rounded-md border border-border">
                        <p className="font-mono text-sm">{order.orderNumber}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">{t('detail.fields.customer')}</Label>
                      <div className="p-3 bg-muted rounded-md border border-border">
                        {isEditing ? (
                          <Input
                            value={editedOrder?.customerName || ''}
                            onChange={e => handleInputChange('customerName', e.target.value)}
                            placeholder={t('detail.fields.customerPlaceholder')}
                            className="border-0 p-0 h-auto bg-transparent"
                          />
                        ) : (
                          <p className="text-sm">{order.customerName || t('counter', { defaultValue: 'Mostrador' })}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">{t('detail.fields.table')}</Label>
                      <div className="p-3 bg-muted rounded-md border border-border">
                        <p className="text-sm">{order.table?.number || t('detail.fields.noTable')}</p>
                        {order.table?.area?.name && <p className="text-xs text-muted-foreground">{order.table.area.name}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">{t('detail.fields.waiter')}</Label>
                      <div className="p-3 bg-muted rounded-md border border-border">
                        <p className="text-sm">
                          {order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : t('detail.fields.noWaiter')}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">{t('detail.fields.orderType')}</Label>
                      <div className="p-3 bg-muted rounded-md border border-border">
                        <p className="text-sm">{order.type || t('detail.fields.noType')}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Order Items Section */}
              {order.items && order.items.length > 0 && (
                <Card className="shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-muted to-green-50 dark:to-green-950/50 border-b">
                    <CardTitle className="flex items-center space-x-2">
                      <Utensils className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span>{t('detail.sections.items')}</span>
                    </CardTitle>
                    <CardDescription>{t('detail.sections.itemsDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      {order.items.map((item, index) => (
                        <div
                          key={item.id || index}
                          className="flex justify-between items-center p-4 rounded-lg border border-border hover:shadow-md transition-shadow"
                        >
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <Badge variant="secondary" className="font-medium">
                                {item.quantity}x
                              </Badge>
                              <span className="font-medium text-foreground">{item.product?.name || t('detail.items.productNotAvailable')}</span>
                            </div>
                            <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                              <span>{Currency(item.unitPrice || 0)} {t('detail.items.each')}</span>
                              {item.modifiers && item.modifiers.length > 0 && <span>{t('detail.items.modifiers', { count: item.modifiers.length })}</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{Currency(item.total || 0)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Payments Section */}
              {order.payments && order.payments.length > 0 && (
                <Card className="shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-muted to-purple-50 dark:to-purple-950/50 border-b">
                    <CardTitle className="flex items-center space-x-2">
                      <Receipt className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <span>{t('detail.sections.payments')}</span>
                    </CardTitle>
                    <CardDescription>{t('detail.sections.paymentsDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      {order.payments.map(payment => (
                        <div
                          key={payment.id}
                          className="flex justify-between items-center p-4 rounded-lg border border-border hover:shadow-md transition-shadow"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3">
                              <Badge variant="secondary" className="font-medium">
                                {t(`payments.methods.${String(payment.method).toLowerCase()}`)}
                              </Badge>
                              <span className="text-sm text-muted-foreground">ID: {payment.id.slice(0, 8)}...</span>
                            </div>
                            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                              <span>{t('detail.payments.base')}: {Currency(payment.amount)}</span>
                              <span>{t('detail.payments.tip')}: {Currency(payment.tipAmount)}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{Currency(Number(payment.amount) + Number(payment.tipAmount))}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1"
                              onClick={() => navigate(`/venues/${venueId}/payments/${payment.id}`)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              {t('detail.payments.view')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Order Status Card */}
              <Card className="shadow-lg border-t-4 border-t-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <StatusIcon className={`h-5 w-5 ${orderStatus.color}`} />
                    <span>{t('detail.sidebar.statusTitle')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-4">
                    <div
                      className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-3 ${
                        orderStatus.badge.replace('text-', 'bg-').replace('dark:text-', 'dark:bg-').split(' ')[0]
                      }`}
                    >
                      <StatusIcon className={`h-8 w-8 ${orderStatus.color}`} />
                    </div>
                    <Badge variant="outline" className={`${orderStatus.badge} text-sm px-3 py-1`}>
                      {getStatusText(order.status)}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('detail.sidebar.lastUpdate')}: {order.updatedAt ? formatDate(order.updatedAt) : t('detail.sidebar.notAvailable')}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary Card */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    <span>{t('detail.sidebar.financialSummary')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium text-muted-foreground">{t('detail.overview.subtotal')}</span>
                      <span className="text-lg font-bold">{Currency(order.subtotal || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-muted-foreground">{t('detail.overview.tips')}</span>
                        <p className="text-xs text-muted-foreground">
                          {order.subtotal && order.subtotal > 0
                            ? t('detail.sidebar.tipsPercent', { percent: (((order.tipAmount || 0) / order.subtotal) * 100).toFixed(1) })
                            : t('detail.sidebar.tipsPercent', { percent: '0.0' })}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{Currency(order.tipAmount || 0)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border-2 border-green-200 dark:border-green-800">
                      <span className="text-base font-bold text-green-800 dark:text-green-200">{t('detail.overview.total')}</span>
                      <span className="text-xl font-bold text-green-800 dark:text-green-200">{Currency(order.total || 0)}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t('detail.sidebar.base')}</span>
                      <span>{t('detail.overview.tips')}</span>
                    </div>
                    <Progress
                      value={order.subtotal && order.total && order.total > 0 ? (order.subtotal / order.total) * 100 : 0}
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Quick Info Card */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span>{t('detail.sidebar.quickInfo')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('detail.sidebar.table')}:</span>
                      <span className="font-medium">{order.table?.number || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('detail.sidebar.waiter')}:</span>
                      <span className="font-medium">
                        {order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('detail.sidebar.items')}:</span>
                      <span className="font-medium">
                        {t('detail.sidebar.itemsCount', { total: totalItems, unique: itemsCount })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('detail.sidebar.type')}:</span>
                      <span className="font-medium">{order.type || 'N/A'}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('detail.sidebar.payments')}:</span>
                      <span className="font-medium">{order.payments?.length || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-muted mt-8">
          <div className="max-w-7xl mx-auto p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center space-x-4">
                <span>{t('detail.footer.copyright')}</span>
                <Separator orientation="vertical" className="h-4" />
                <span>{t('detail.footer.orderId', { id: order.id })}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>{t('detail.footer.generated', { date: new Date().toLocaleString(getIntlLocale(i18n.language)) })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
