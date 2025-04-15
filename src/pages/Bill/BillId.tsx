import api from '@/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { themeClasses } from '@/lib/theme-utils'
import { Currency } from '@/utils/currency'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Receipt } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function BillId() {
  const { venueId, billId } = useParams()
  const location = useLocation()

  // Fetch the bill data
  const { data: bill, isLoading } = useQuery({
    queryKey: ['bill', venueId, billId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/bills/${billId}`)
      return response.data
    },
  })

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
        <div>
          <span className={`px-3 py-1 ${statusClasses.bg} ${statusClasses.text} rounded-full font-medium`}>
            {getStatusText(bill?.status)}
          </span>
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
              <Input id="folio" value={bill?.folio || '-'} disabled />
            </div>
            <div>
              <Label htmlFor="billName">Nombre de la Cuenta</Label>
              <Input id="billName" value={bill?.billName || '-'} disabled />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <Label htmlFor="tableNumber">Mesa</Label>
              <Input id="tableNumber" value={bill?.tableNumber?.toString() || bill?.tableName || '-'} disabled />
            </div>
            <div>
              <Label htmlFor="waiter">Mesero</Label>
              <Input id="waiter" value={bill?.waiterName || '-'} disabled />
            </div>
            <div>
              <Label htmlFor="shift">Turno</Label>
              <Input id="shift" value={bill?.shiftId || '-'} disabled />
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Resumen Financiero</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Subtotal</Label>
              <p className="text-xl font-semibold">{Currency(total * 100)}</p>
            </div>
            {bill?.tips && bill.tips.length > 0 && (
              <div className="p-4 border rounded-md">
                <Label className="text-sm text-muted-foreground">Propinas</Label>
                <p className="text-xl font-semibold">{Currency(totalTips * 100)}</p>
              </div>
            )}
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Total</Label>
              <p className="text-xl font-semibold">{Currency((total + totalTips) * 100)}</p>
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
