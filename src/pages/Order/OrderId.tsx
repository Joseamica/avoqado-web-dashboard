// src/pages/OrderId.tsx

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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import * as orderService from '@/services/order.service'
import { OrderStatus, Order as OrderType, StaffRole } from '@/types' // CAMBIO: Usar tipos Order y OrderStatus
import { Currency } from '@/utils/currency'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, PencilIcon, Save, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getIntlLocale } from '@/utils/i18n-locale'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

export default function OrderId() {
  const { t, i18n } = useTranslation()
  // CAMBIO: billId ahora es orderId
  const { orderId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { venueId } = useCurrentVenue() // Hook actualizado

  const [isEditing, setIsEditing] = useState(false)
  // CAMBIO: el estado ahora es de tipo OrderType o null
  const [editedOrder, setEditedOrder] = useState<OrderType | null>(null)

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
        title: t('orders.detail.toast.updatedTitle'),
        description: t('orders.detail.toast.updatedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['order', venueId, orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders', venueId] }) // Invalida la lista también
      setIsEditing(false)
    },
    onError: (error: any) => {
      toast({
        title: t('orders.detail.toast.updateErrorTitle'),
        description: error.response?.data?.message || t('orders.detail.toast.updateErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  const deleteOrderMutation = useMutation({
    mutationFn: () => orderService.deleteOrder(venueId, orderId),
    onSuccess: () => {
      toast({
        title: t('orders.detail.toast.deletedTitle'),
        description: t('orders.detail.toast.deletedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['orders', venueId] })
      navigate(`/venues/${venueId}/orders`)
    },
    onError: (error: any) => {
      toast({
        title: t('orders.detail.toast.deleteErrorTitle'),
        description: error.response?.data?.message || t('orders.detail.toast.deleteErrorDesc'),
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

  // CAMBIO: la ruta de retorno ahora es a /orders
  const from = (location.state as any)?.from || `/venues/${venueId}/orders`

  if (isLoading) return <div className="p-8 text-center">{t('orders.detail.loading')}</div>
  if (!order) return <div className="p-8 text-center">{t('orders.detail.notFound')}</div>

  // Format date for display

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-'

    const date = new Date(dateString)

    return date.toLocaleString(getIntlLocale(i18n.language), {
      year: 'numeric',

      month: 'long',

      day: 'numeric',

      hour: '2-digit',

      minute: '2-digit',
    })
  }

  // Map status to Spanish

  const getStatusText = (status: string) => t(`orders.detail.statuses.${status}`)
  // Get status style classes

  const getStatusClasses = (status: string) => {
    if (status === 'PAID' || status === 'CLOSED' || status === 'COMPLETED') {
      return {
        bg: 'bg-green-100',

        text: 'text-green-800',
      }
    } else if (status === 'OPEN' || status === 'PENDING') {
      return {
        bg: 'bg-yellow-100',

        text: 'text-yellow-800',
      }
    } else if (status === 'CANCELED' || status === 'CANCELLED' || status === 'DELETED') {
      return {
        bg: 'bg-red-100',

        text: 'text-red-800',
      }
    }

    return {
      bg: 'bg-secondary',

      text: 'text-secondary-foreground',
    }
  }
  const statusClasses = getStatusClasses(order.status)

  return (
    <div>
      {/* --- CABECERA --- */}
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-background border-b-2 top-14">
        <div className="space-x-4 flex items-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>{t('orders.detail.title', { number: order.orderNumber })}</span>
        </div>
        <div className="flex items-center gap-2">
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
            <span className={`px-3 py-1 ${statusClasses.bg} ${statusClasses.text} rounded-full font-medium`}>
              {getStatusText(order.status)}
            </span>
          )}
          {user?.role === StaffRole.SUPERADMIN ||
            (user?.role === StaffRole.OWNER && (
              <>
                {isEditing /* Botones Guardar/Cancelar */ ? (
                  <>
                    <Button variant="default" size="sm" onClick={handleSave}>
                      <Save className="h-4 w-4 mr-2" />
                      {t('common.save', { defaultValue: 'Guardar' })}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                      <X className="h-4 w-4 mr-2" />
                      {t('common.cancel')}
                    </Button>
                  </>
                ) : (
                  /* Botón Editar */
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <PencilIcon className="h-4 w-4 mr-2" />
                    {t('common.edit', { defaultValue: 'Editar' })}
                  </Button>
                )}
                {/* Botón Eliminar */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('common.delete', { defaultValue: 'Eliminar' })}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('common.areYouSure')}</AlertDialogTitle>
                      <AlertDialogDescription>{t('orders.detail.deleteWarning')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteOrderMutation.mutate()}>
                        {t('common.delete', { defaultValue: 'Eliminar' })}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ))}
        </div>
      </div>

      {/* --- CUERPO --- */}
      <div className="max-w-4xl p-6 mx-auto">
        {/* OBSOLETO: El QR ahora está en la mesa, no en la orden. Se puede quitar o adaptar esta lógica. */}
        {/* <Button>Ver QR de la Mesa {order.table?.number}</Button> */}

        {/* --- DETALLES DE LA ORDEN --- */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label>{t('orders.detail.fields.orderId')}</Label>
              <Input value={order.id} disabled />
            </div>
            <div>
              <Label>{t('orders.detail.fields.createdAt')}</Label>
              <Input value={formatDate(order.createdAt)} disabled />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label>{t('orders.detail.fields.orderNumber')}</Label>
              <Input value={order.orderNumber} disabled />
            </div>
            <div>
              <Label>{t('orders.detail.fields.customerName')}</Label>
              <Input
                value={isEditing ? editedOrder?.customerName || '' : order.customerName || t('orders.counter')}
                disabled={!isEditing}
                onChange={e => handleInputChange('customerName', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label>{t('orders.detail.fields.table')}</Label>
              <Input value={order.table?.number || t('orders.detail.noTable')} disabled />
            </div>
            <div>
              <Label>{t('orders.detail.fields.waiter')}</Label>
              <Input value={order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '-'} disabled />
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        {/* --- RESUMEN FINANCIERO --- */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">{t('orders.detail.financialSummary.title')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">{t('orders.detail.financialSummary.subtotal')}</Label>
              <p className="text-xl font-semibold">{Currency(order.subtotal)}</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">{t('orders.detail.financialSummary.tips')}</Label>
              <p className="text-xl font-semibold">{Currency(order.tipAmount)}</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">{t('orders.detail.financialSummary.total')}</Label>
              <p className="text-xl font-semibold">{Currency(order.total)}</p>
            </div>
          </div>
        </div>

        {/* OBSOLETO: La sección de "Detalles de Propinas" ya no es necesaria, la info está en el resumen y en los pagos. */}

        {/* --- PAGOS ASOCIADOS --- */}
        {order.payments && order.payments.length > 0 && (
          <>
            <Separator className="my-8" />
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t('orders.detail.associatedPayments.title')}</h3>
              {order.payments.map(payment => (
                <div key={payment.id} className="p-4 border rounded-md grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">{t('orders.detail.associatedPayments.fields.paymentId')}</Label>
                    <p className="font-medium truncate">{payment.id}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">{t('orders.detail.associatedPayments.fields.amount')}</Label>
                    <p className="font-medium">{Currency(payment.amount)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">{t('orders.detail.associatedPayments.fields.tip')}</Label>
                    <p className="font-medium">{Currency(payment.tipAmount)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">{t('orders.detail.associatedPayments.fields.method')}</Label>
                    <p className="font-medium">{t(`payments.methods.${String(payment.method).toLowerCase()}`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
