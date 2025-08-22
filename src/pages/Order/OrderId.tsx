// src/pages/OrderId.tsx

import api from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Order as OrderType, OrderStatus, StaffRole } from '@/types' // CAMBIO: Usar tipos Order y OrderStatus
import { Currency } from '@/utils/currency'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, PencilIcon, Receipt, Save, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
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
import { useCurrentVenue } from '@/hooks/use-current-venue'
import * as orderService from '@/services/order.service'

export default function OrderId() {
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

  // CAMBIO: Opciones de estado basadas en el enum OrderStatus
  const statusOptions = Object.values(OrderStatus).map(status => ({
    value: status,
    label: status.charAt(0) + status.slice(1).toLowerCase(), // Formato simple
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
      toast({ title: 'Orden actualizada', description: 'La orden ha sido actualizada exitosamente' })
      queryClient.invalidateQueries({ queryKey: ['order', venueId, orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders', venueId] }) // Invalida la lista también
      setIsEditing(false)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo actualizar la cuenta',
        variant: 'destructive',
      })
    },
  })

  const deleteOrderMutation = useMutation({
    mutationFn: () => orderService.deleteOrder(venueId, orderId),
    onSuccess: () => {
      toast({ title: 'Orden eliminada', description: 'La orden ha sido eliminada exitosamente' })
      queryClient.invalidateQueries({ queryKey: ['orders', venueId] })
      navigate(`/venues/${venueId}/orders`)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo eliminar la cuenta',
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

  if (isLoading) return <div className="p-8 text-center">Cargando detalles de la orden...</div>
  if (!order) return <div className="p-8 text-center">No se encontró la orden.</div>

  // Format date for display

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-'

    const date = new Date(dateString)

    return date.toLocaleString('es-ES', {
      year: 'numeric',

      month: 'long',

      day: 'numeric',

      hour: '2-digit',

      minute: '2-digit',
    })
  }

  // Map status to Spanish

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      OPEN: 'Abierta',

      PAID: 'Pagada',

      PENDING: 'Pendiente',

      CLOSED: 'Cerrada',

      CANCELED: 'Cancelada',

      PRECREATED: 'Pre-creada',

      WITHOUT_TABLE: 'Sin mesa',

      DELETED: 'Eliminada',

      EARLYACCESS: 'Acceso anticipado',

      COURTESY: 'Cortesía',
    }

    return statusMap[status] || status
  }
  // Get status style classes

  const getStatusClasses = (status: string) => {
    if (status === 'PAID' || status === 'CLOSED') {
      return {
        bg: 'bg-green-100',

        text: 'text-green-800',
      }
    } else if (status === 'OPEN' || status === 'PENDING') {
      return {
        bg: 'bg-yellow-100',

        text: 'text-yellow-800',
      }
    } else if (status === 'CANCELED' || status === 'DELETED') {
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
          <span>Detalles de la Orden #{order.orderNumber}</span>
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
                      Guardar
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </>
                ) : (
                  /* Botón Editar */
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <PencilIcon className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                )}
                {/* Botón Eliminar */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. Esto eliminará permanentemente la orden.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteOrderMutation.mutate()}>Eliminar</AlertDialogAction>
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
              <Label>ID de la Orden</Label>
              <Input value={order.id} disabled />
            </div>
            <div>
              <Label>Fecha de Creación</Label>
              <Input value={formatDate(order.createdAt)} disabled />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label>Folio</Label>
              <Input value={order.orderNumber} disabled />
            </div>
            <div>
              <Label>Nombre del Cliente</Label>
              <Input
                value={isEditing ? editedOrder?.customerName || '' : order.customerName || 'Mostrador'}
                disabled={!isEditing}
                onChange={e => handleInputChange('customerName', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label>Mesa</Label>
              <Input value={order.table?.number || 'Sin Mesa'} disabled />
            </div>
            <div>
              <Label>Mesero</Label>
              <Input value={order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '-'} disabled />
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        {/* --- RESUMEN FINANCIERO --- */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Resumen Financiero</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Subtotal</Label>
              <p className="text-xl font-semibold">{Currency(order.subtotal * 100)}</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Propinas</Label>
              <p className="text-xl font-semibold">{Currency(order.tipAmount * 100)}</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Total</Label>
              <p className="text-xl font-semibold">{Currency(order.total * 100)}</p>
            </div>
          </div>
        </div>

        {/* OBSOLETO: La sección de "Detalles de Propinas" ya no es necesaria, la info está en el resumen y en los pagos. */}

        {/* --- PAGOS ASOCIADOS --- */}
        {order.payments && order.payments.length > 0 && (
          <>
            <Separator className="my-8" />
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Pagos Asociados</h3>
              {order.payments.map(payment => (
                <div key={payment.id} className="p-4 border rounded-md grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">ID del Pago</Label>
                    <p className="font-medium truncate">{payment.id}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Monto</Label>
                    <p className="font-medium">{Currency(payment.amount * 100)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Propina</Label>
                    <p className="font-medium">{Currency(payment.tipAmount * 100)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Método</Label>
                    <p className="font-medium">{payment.method}</p>
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
