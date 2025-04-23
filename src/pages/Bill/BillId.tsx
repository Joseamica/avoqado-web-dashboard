import api from '@/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { themeClasses } from '@/lib/theme-utils'
import { Currency } from '@/utils/currency'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Receipt, Trash2, PencilIcon, Save, X } from 'lucide-react'
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
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
import { useToast } from '@/hooks/use-toast'
import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function BillId() {
  const { venueId, billId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'SUPERADMIN'
  const [isEditing, setIsEditing] = useState(false)
  const [editedBill, setEditedBill] = useState<any>(null)

  // Status options
  const statusOptions = [
    { value: 'OPEN', label: 'Abierta' },
    { value: 'PAID', label: 'Pagada' },
    { value: 'PENDING', label: 'Pendiente' },
    { value: 'CLOSED', label: 'Cerrada' },
    { value: 'CANCELED', label: 'Cancelada' },
    { value: 'PRECREATED', label: 'Pre-creada' },
    { value: 'WITHOUT_TABLE', label: 'Sin mesa' },
    { value: 'DELETED', label: 'Eliminada' },
    { value: 'EARLYACCESS', label: 'Acceso anticipado' },
    { value: 'COURTESY', label: 'Cortesía' },
  ]

  // Fetch the bill data
  const { data: bill, isLoading } = useQuery({
    queryKey: ['bill', venueId, billId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/bills/${billId}`)
      return response.data
    },
  })

  // Set editedBill when bill data is loaded
  useEffect(() => {
    if (bill && !editedBill) {
      setEditedBill(bill)
    }
  }, [bill, editedBill])

  // Delete bill mutation
  const deleteBillMutation = useMutation({
    mutationFn: async () => {
      return await api.delete(`/v2/dashboard/${venueId}/bills/${billId}`)
    },
    onSuccess: () => {
      toast({
        title: 'Cuenta eliminada',
        description: 'La cuenta ha sido eliminada exitosamente',
      })
      queryClient.invalidateQueries({ queryKey: ['bills', venueId] })
      navigate(`/venues/${venueId}/bills`)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo eliminar la cuenta',
        variant: 'destructive',
      })
    },
  })

  // Update bill mutation
  const updateBillMutation = useMutation({
    mutationFn: async (updatedBill: any) => {
      return await api.put(`/v2/dashboard/${venueId}/bills/${billId}`, updatedBill)
    },
    onSuccess: () => {
      toast({
        title: 'Cuenta actualizada',
        description: 'La cuenta ha sido actualizada exitosamente',
      })
      queryClient.invalidateQueries({ queryKey: ['bill', venueId, billId] })
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

  const handleInputChange = (field: string, value: string) => {
    setEditedBill((prev: any) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSave = () => {
    updateBillMutation.mutate(editedBill)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedBill(bill) // Reset to original data
  }

  const from = (location.state as any)?.from || `/venues/${venueId}/bills`

  if (isLoading) {
    return <div className="p-8 text-center">Cargando información de la cuenta...</div>
  }

  // Calculate total with tips
  const total = bill?.total ? parseFloat(bill.total) : 0
  const totalTips = bill?.tips?.reduce((acc, tip) => acc + parseFloat(tip.amount), 0) / 100 || 0

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
        bg: themeClasses.success.bg,
        text: themeClasses.success.text,
      }
    } else if (status === 'OPEN' || status === 'PENDING') {
      return {
        bg: themeClasses.warning.bg,
        text: themeClasses.warning.text,
      }
    } else if (status === 'CANCELED' || status === 'DELETED') {
      return {
        bg: themeClasses.error.bg,
        text: themeClasses.error.text,
      }
    }
    return {
      bg: themeClasses.neutral.bg,
      text: themeClasses.neutral.text,
    }
  }

  const statusClasses = getStatusClasses(bill?.status)

  return (
    <div>
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-white border-b-2 top-14">
        <div className="space-x-4 flex items-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>Detalles de la Cuenta</span>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <Select value={editedBill?.status} onValueChange={value => handleInputChange('status', value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Seleccionar estado" />
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
              {getStatusText(bill?.status)}
            </span>
          )}

          {isSuperAdmin && (
            <>
              {isEditing ? (
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
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
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
                      Esta acción no se puede deshacer. Esto eliminará permanentemente la cuenta y todos los datos asociados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteBillMutation.mutate()}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      <div className="max-w-4xl p-6 mx-auto">
        {bill?.qrCode && (
          <div className="mb-6 flex justify-end">
            <Button
              className="flex items-center gap-2"
              variant="outline"
              onClick={() => window.open(`${import.meta.env.VITE_FRONTEND_URL}/bill?qr=${bill.qrCode}`, '_blank')}
            >
              <Receipt className="h-4 w-4" />
              <span>Ver Cuenta</span>
            </Button>
          </div>
        )}
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label htmlFor="id">ID de la Cuenta</Label>
              <Input id="id" value={bill?.id || ''} disabled />
            </div>
            <div>
              <Label htmlFor="created">Fecha y Hora</Label>
              <Input id="created" value={formatDate(bill?.createdAt)} disabled />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label htmlFor="folio">Folio</Label>
              <Input
                id="folio"
                value={isEditing ? editedBill?.folio || '' : bill?.folio || '-'}
                disabled={!isEditing}
                onChange={e => handleInputChange('folio', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="billName">Nombre de la Cuenta</Label>
              <Input
                id="billName"
                value={isEditing ? editedBill?.billName || '' : bill?.billName || '-'}
                disabled={!isEditing}
                onChange={e => handleInputChange('billName', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <Label htmlFor="tableNumber">Mesa</Label>
              <Input
                id="tableNumber"
                value={
                  isEditing
                    ? editedBill?.tableNumber?.toString() || editedBill?.tableName || ''
                    : bill?.tableNumber?.toString() || bill?.tableName || '-'
                }
                disabled={!isEditing}
                onChange={e => handleInputChange('tableNumber', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="waiter">Mesero</Label>
              <Input
                id="waiter"
                value={isEditing ? editedBill?.waiterName || '' : bill?.waiterName || '-'}
                disabled={!isEditing}
                onChange={e => handleInputChange('waiterName', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="shift">Turno</Label>
              <Input
                id="shift"
                value={isEditing ? editedBill?.shiftId || '' : bill?.shiftId || '-'}
                disabled={!isEditing}
                onChange={e => handleInputChange('shiftId', e.target.value)}
              />
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Resumen Financiero</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Subtotal</Label>
              <p className="text-xl font-semibold">{Currency(total)}</p>
            </div>
            {bill?.tips && bill.tips.length > 0 && (
              <div className="p-4 border rounded-md">
                <Label className="text-sm text-muted-foreground">Propinas</Label>
                <p className="text-xl font-semibold">{Currency(totalTips)}</p>
              </div>
            )}
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Total</Label>
              <p className="text-xl font-semibold">{Currency(total + totalTips)}</p>
            </div>
          </div>
        </div>

        {bill?.tips && bill.tips.length > 0 && (
          <>
            <Separator className="my-6" />
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Detalles de las Propinas</h3>
              <div className="space-y-4">
                {bill.tips.map((tip, index) => (
                  <div key={index} className="p-4 border rounded-md">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <Label className="text-sm text-muted-foreground">Monto</Label>
                        <p className="font-medium">{Currency(parseFloat(tip.amount))}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Porcentaje</Label>
                        <p className="font-medium">{parseFloat(tip.percentage) * 100}%</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Mesero</Label>
                        <p className="font-medium">{tip.waiterName || '-'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {bill?.payments && bill.payments.length > 0 && (
          <>
            <Separator className="my-6" />
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Pagos Asociados</h3>
              <div className="space-y-4">
                {bill.payments.map((payment, index) => (
                  <div key={index} className="p-4 border rounded-md">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <Label className="text-sm text-muted-foreground">ID del Pago</Label>
                        <p className="font-medium">{payment.id}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Monto</Label>
                        <p className="font-medium">{Currency(parseFloat(payment.amount))}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Método</Label>
                        <p className="font-medium">
                          {payment.method === 'CARD' ? 'Tarjeta' : payment.method === 'CASH' ? 'Efectivo' : payment.method}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Separator className="my-6" />

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Información adicional</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Origen</Label>
              <p className="text-sm">{bill?.splitFromPos ? 'Dividida desde POS' : 'Normal'}</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Actualizada</Label>
              <p className="text-sm">{bill?.updatedAt ? new Date(bill.updatedAt).toLocaleString() : '-'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
