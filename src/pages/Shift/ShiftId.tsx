import api from '@/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { themeClasses } from '@/lib/theme-utils'
import { Currency } from '@/utils/currency'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
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

export default function ShiftId() {
  const { venueId, shiftId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch the shift data
  const { data: shift, isLoading } = useQuery({
    queryKey: ['shift', venueId, shiftId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/shifts/${shiftId}`)
      return response.data
    },
  })

  const from = (location.state as any)?.from || `/venues/${venueId}/shifts`

  // Delete shift mutation
  const deleteShift = useMutation({
    mutationFn: async () => {
      await api.delete(`/v2/dashboard/${venueId}/shifts/${shiftId}`)
    },
    onSuccess: () => {
      toast({
        title: 'Turno eliminado',
        description: 'El turno ha sido eliminado exitosamente',
      })
      queryClient.invalidateQueries({ queryKey: ['shifts', venueId] })
      navigate(from)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo eliminar el turno',
        variant: 'destructive',
      })
    },
  })

  if (isLoading) {
    return <div className="p-8 text-center">Cargando información del turno...</div>
  }

  // Calculate total payments and tips
  const payments = shift?.payments || []
  const totalAmount = payments.reduce((acc, payment) => acc + Number(payment.amount), 0)
  const totalTips = payments.reduce((acc, payment) => {
    const tipsSum = payment.tips.reduce((tipAcc, tip) => tipAcc + parseFloat(tip.amount), 0)
    return acc + tipsSum
  }, 0)
  const tipPercentage = totalAmount !== 0 ? (totalTips / totalAmount) * 100 : 0

  // Format dates for display
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

  return (
    <div>
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-white border-b-2 top-14">
        <div className="space-x-4 flex items-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>Detalles del Turno {shift?.turnId || ''}</span>
        </div>
        <div className="flex items-center space-x-4">
          <span
            className={`px-3 py-1 ${shift?.endTime ? themeClasses.neutral.bg : themeClasses.success.bg} ${
              shift?.endTime ? themeClasses.neutral.text : themeClasses.success.text
            } rounded-full font-medium`}
          >
            {shift?.endTime ? 'Cerrado' : 'Abierto'}
          </span>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="size-4 mr-1" />
                Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar turno</AlertDialogTitle>
                <AlertDialogDescription>
                  ¿Estás seguro de que deseas eliminar este turno? Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteShift.mutate()} className="bg-red-500 hover:bg-red-600">
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="max-w-4xl p-6 mx-auto">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label htmlFor="turnId">ID de Turno</Label>
              <Input id="turnId" value={shift?.turnId || ''} disabled />
            </div>
            <div>
              <Label htmlFor="id">ID del Sistema</Label>
              <Input id="id" value={shift?.id || ''} disabled />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label htmlFor="startTime">Hora de Apertura</Label>
              <Input id="startTime" value={formatDate(shift?.startTime)} disabled />
            </div>
            <div>
              <Label htmlFor="endTime">Hora de Cierre</Label>
              <Input id="endTime" value={formatDate(shift?.endTime)} disabled />
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Resumen Financiero</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Subtotal</Label>
              <p className="text-xl font-semibold">{Currency(totalAmount)}</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Propinas</Label>
              <p className="text-xl font-semibold">{Currency(totalTips)}</p>
              <p className="text-sm text-muted-foreground">{tipPercentage.toFixed(1)}% del subtotal</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Total</Label>
              <p className="text-xl font-semibold">{Currency(totalAmount + totalTips)}</p>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Pagos</h3>
          {payments.length > 0 ? (
            <div className="space-y-4">
              {payments.map((payment, index) => (
                <div key={payment.id} className="p-4 border rounded-md">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <Label className="text-sm text-muted-foreground">Método de Pago</Label>
                      <p className="font-medium">{payment.paymentType}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Monto</Label>
                      <p className="font-medium">{Currency(Number(payment.amount))}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Propina</Label>
                      <p className="font-medium">{Currency(payment.tips.reduce((acc, tip) => acc + parseFloat(tip.amount), 0))}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No hay pagos registrados para este turno.</p>
          )}
        </div>

        <Separator className="my-6" />

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Información adicional</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Venue ID</Label>
              <p className="text-sm">{shift?.venueId}</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Creado</Label>
              <p className="text-sm">{shift?.createdAt ? new Date(shift.createdAt).toLocaleString() : '-'}</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Última actualización</Label>
              <p className="text-sm">{shift?.updatedAt ? new Date(shift.updatedAt).toLocaleString() : '-'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
