import api from '@/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { themeClasses } from '@/lib/theme-utils'
import { Currency } from '@/utils/currency'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Receipt } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import getIcon from '@/utils/getIcon'
import { Button } from '@/components/ui/button'

export default function PaymentId() {
  const { venueId, paymentId } = useParams()
  const location = useLocation()

  // Fetch the payment data
  const { data: payment, isLoading } = useQuery({
    queryKey: ['payment', venueId, paymentId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/payments/${paymentId}`)
      return response.data
    },
  })

  const from = (location.state as any)?.from || `/venues/${venueId}/payments`

  if (isLoading) {
    return <div className="p-8 text-center">Cargando información del pago...</div>
  }

  // Calculate total with tips
  const totalAmount = parseFloat(payment?.amount) / 100 || 0
  const totalTips = payment?.tips?.reduce((acc, tip) => acc + parseFloat(tip.amount), 0) / 100 || 0
  const tipPercentage = totalAmount !== 0 ? (totalTips / totalAmount) * 100 : 0

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

  return (
    <div>
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-white border-b-2 top-14">
        <div className="space-x-4 flex items-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>Detalles del Pago</span>
        </div>
        <div>
          <span
            className={`px-3 py-1 ${payment?.status === 'ACCEPTED' ? themeClasses.success.bg : themeClasses.neutral.bg} ${
              payment?.status === 'ACCEPTED' ? themeClasses.success.text : themeClasses.neutral.text
            } rounded-full font-medium`}
          >
            {payment?.status === 'ACCEPTED' ? 'Aceptado' : payment?.status}
          </span>
        </div>
      </div>

      <div className="max-w-4xl p-6 mx-auto">
        {payment?.token && (
          <div className="mb-6 flex justify-end">
            <Button
              className="flex items-center gap-2"
              variant="outline"
              onClick={() => window.open(`${import.meta.env.VITE_FRONTEND_URL}/receipt?token=${payment.token}`, '_blank')}
            >
              <Receipt className="h-4 w-4" />
              <span>Ver Recibo</span>
            </Button>
          </div>
        )}
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label htmlFor="id">ID del Pago</Label>
              <Input id="id" value={payment?.id || ''} disabled />
            </div>
            <div>
              <Label htmlFor="created">Fecha y Hora</Label>
              <Input id="created" value={formatDate(payment?.createdAt)} disabled />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label htmlFor="method">Método de Pago</Label>
              <div className="flex items-center gap-2 p-2 border rounded-md">
                {payment?.method === 'CARD' && payment?.cardBrand && <span className="mr-2">{getIcon(payment.cardBrand)}</span>}
                <span>
                  {payment?.method === 'CARD'
                    ? `Tarjeta ${payment?.last4 ? `(${payment.last4})` : ''}`
                    : payment?.method === 'CASH'
                    ? 'Efectivo'
                    : payment?.method}
                </span>
              </div>
            </div>
            <div>
              <Label htmlFor="waiter">Mesero</Label>
              <Input id="waiter" value={payment?.waiter?.nombre || '-'} disabled />
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Resumen Financiero</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Subtotal</Label>
              <p className="text-xl font-semibold">{Currency(totalAmount * 100)}</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Propinas</Label>
              <p className="text-xl font-semibold">{Currency(totalTips * 100)}</p>
              <p className="text-sm text-muted-foreground">{tipPercentage.toFixed(1)}% del subtotal</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Total</Label>
              <p className="text-xl font-semibold">{Currency((totalAmount + totalTips) * 100)}</p>
            </div>
          </div>
        </div>

        {payment?.tips && payment.tips.length > 0 && (
          <>
            <Separator className="my-6" />
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Detalles de las Propinas</h3>
              <div className="space-y-4">
                {payment.tips.map((tip, index) => (
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
                        <p className="font-medium">{tip.waiter?.nombre || '-'}</p>
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
              <Label className="text-sm text-muted-foreground">Referencia</Label>
              <p className="text-sm">{payment?.reference || '-'}</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Autorización</Label>
              <p className="text-sm">{payment?.mentaAuthorizationReference || '-'}</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Número de Mesa</Label>
              <p className="text-sm">{payment?.tableNumber || '-'}</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">ID del Turno</Label>
              <p className="text-sm">{payment?.shift?.turnId || '-'}</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">ID de la Cuenta</Label>
              <p className="text-sm">{payment?.billId || payment?.billV2Id || '-'}</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Última actualización</Label>
              <p className="text-sm">{payment?.updatedAt ? new Date(payment.updatedAt).toLocaleString() : '-'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
