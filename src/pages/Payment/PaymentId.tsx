import api from '@/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Currency } from '@/utils/currency'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Receipt, Mail, Eye, ExternalLink } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import getIcon from '@/utils/getIcon'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import ReceiptPreview from '@/components/receipts/ReceiptPreview'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useCurrentVenue } from '@/hooks/use-current-venue'

export default function PaymentId() {
  const { paymentId } = useParams<{ paymentId: string }>()
  const location = useLocation()

  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null)
  const { toast } = useToast()
  const { venueId } = useCurrentVenue() // Hook actualizado

  const { data: payment, isLoading, refetch } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}`)
      return response.data
    },
    enabled: !!paymentId,
  })

  // Consulta para obtener los recibos asociados a este pago
  const { data: receipts = [], isLoading: isLoadingReceipts } = useQuery({
    queryKey: ['receipts', paymentId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}/receipts`)
      return response.data
    },
    enabled: !!paymentId,
  })  

  const from = (location.state as any)?.from || `/venues/${venueId}/payments`

  // Mutación para enviar recibos digitales
  const sendReceiptMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const response = await api.post(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}/send-receipt`, {
        recipientEmail: email
      })
      return response.data
    },
    onSuccess: (_data) => {
      toast({
        title: 'Recibo enviado',
        description: `Se ha enviado el recibo digital exitosamente`,
      })
      setEmailDialogOpen(false)
      refetch()
    },
    onError: (_error) => {
      toast({
        title: 'Error',
        description: 'No se pudo enviar el recibo digital',
        variant: 'destructive',
      })
    },
  })

  // Generar color de insignia según el estado del recibo
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'VIEWED': return 'bg-green-500'
      case 'DELIVERED': return 'bg-blue-500'
      case 'SENT': return 'bg-yellow-500'
      case 'ERROR': return 'bg-red-500'
      case 'PENDING': 
      default: return 'bg-gray-400'
    }
  }

  const formatReceiptDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('es-ES', { 
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Función para ver la vista previa de un recibo
  const viewReceipt = (receipt: any) => {
    setSelectedReceipt(receipt)
  }

  if (isLoading) {
    return <div className="p-8 text-center">Cargando información del pago...</div>
  }

  return (
    <div>
      <div className="flex sticky top-14 z-10 flex-row justify-between px-4 py-3 mb-4 w-full bg-white border-b-2">
        <div className="flex items-center space-x-4">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>Detalles del Pago</span>
        </div>
        <div>
          <span
            className={`px-3 py-1 ${payment?.status === 'ACCEPTED' ? bg-green-100 : bg-secondary} ${
              payment?.status === 'ACCEPTED' ? text-green-800 : text-secondary-foreground
            } rounded-full font-medium`}
          >
            {payment?.status === 'ACCEPTED' ? 'Aceptado' : payment?.status}
          </span>
        </div>
      </div>

      <div className="p-6 mx-auto max-w-4xl">
        {payment?.token && (
          <div className="flex justify-end mb-6 space-x-2">
            {/* Botón para enviar recibo por email */}
            <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex gap-2 items-center" variant="outline">
                  <Mail className="w-4 h-4" />
                  <span>Enviar Recibo Digital</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar Recibo Digital</DialogTitle>
                </DialogHeader>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                    />
                  </div>
                  <Button 
                    disabled={!recipientEmail || sendReceiptMutation.isPending} 
                    onClick={() => sendReceiptMutation.mutate({ email: recipientEmail })}
                    className="w-full"
                  >
                    {sendReceiptMutation.isPending ? 'Enviando...' : 'Enviar'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            {/* Botón para recibo tradicional si existe */}
            {payment?.token && (
              <Button
                className="flex gap-2 items-center"
                variant="outline"
                onClick={() => window.open(`${import.meta.env.VITE_FRONTEND_URL}/receipt?token=${payment.token}`, '_blank')}
              >
                <Receipt className="w-4 h-4" />
                <span>Ver Recibo</span>
              </Button>
            )}
          </div>
        )}
        
        {/* Sección de recibos digitales */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Recibos Digitales</CardTitle>
            <CardDescription>Historial de recibos asociados a este pago</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingReceipts ? (
              <p className="py-4 text-center">Cargando recibos...</p>
            ) : receipts && receipts.length > 0 ? (
              <div className="space-y-4">
                {receipts.map((receipt: any) => (
                  <div key={receipt.id} className="flex justify-between items-center p-3 rounded-md border standard-hover">
                    <div>
                      <div className="flex gap-2 items-center">
                        <Badge variant="outline" className={getStatusBadgeColor(receipt.status)}>
                          {receipt.status}
                        </Badge>
                        <span className="text-sm font-medium">
                          {receipt.recipientEmail || 'Sin destinatario'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatReceiptDate(receipt.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => viewReceipt(receipt)} className="flex gap-1 items-center">
                        <Eye size={16} />
                        Ver
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex gap-1 items-center"
                        onClick={() => {
                          const publicUrl = `${window.location.origin}/receipts/public/${receipt.accessKey}`
                          window.open(publicUrl, '_blank')
                        }}
                      >
                        <ExternalLink size={16} />
                        Enlace público
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  No se han enviado recibos digitales para este pago.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label htmlFor="id">ID del Pago</Label>
              <Input id="id" value={payment?.id || ''} disabled />
            </div>
            <div>
              <Label htmlFor="created">Fecha y Hora</Label>
              <Input id="created" value={payment?.createdAt ? new Date(payment.createdAt).toLocaleString('es-ES') : '-'} disabled />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label htmlFor="method">Método de Pago</Label>
              <div className="flex gap-2 items-center p-2 rounded-md border">
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
            <div className="p-4 rounded-md border">
              <Label className="text-sm text-muted-foreground">Subtotal</Label>
              <p className="text-xl font-semibold">{Currency(payment?.amount || 0)}</p>
            </div>
            <div className="p-4 rounded-md border">
              <Label className="text-sm text-muted-foreground">Propinas</Label>
              <p className="text-xl font-semibold">{Currency(payment?.tipAmount || 0)}</p>
              <p className="text-sm text-muted-foreground">
                {payment?.amount && payment.amount > 0 
                  ? ((payment?.tipAmount || 0) / payment.amount * 100).toFixed(1) 
                  : '0.0'
                }% del subtotal
              </p>
            </div>
            <div className="p-4 rounded-md border">
              <Label className="text-sm text-muted-foreground">Total</Label>
              <p className="text-xl font-semibold">{Currency(payment?.totalAmount || 0)}</p>
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
                  <div key={index} className="p-4 rounded-md border">
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
            <div className="p-4 rounded-md border">
              <Label className="text-sm text-muted-foreground">Referencia</Label>
              <p className="text-sm">{payment?.reference || '-'}</p>
            </div>
            <div className="p-4 rounded-md border">
              <Label className="text-sm text-muted-foreground">Autorización</Label>
              <p className="text-sm">{payment?.mentaAuthorizationReference || '-'}</p>
            </div>
            <div className="p-4 rounded-md border">
              <Label className="text-sm text-muted-foreground">Número de Mesa</Label>
              <p className="text-sm">{payment?.tableNumber || '-'}</p>
            </div>
            <div className="p-4 rounded-md border">
              <Label className="text-sm text-muted-foreground">ID del Turno</Label>
              <p className="text-sm">{payment?.shift?.turnId || '-'}</p>
            </div>
            <div className="p-4 rounded-md border">
              <Label className="text-sm text-muted-foreground">ID de la Cuenta</Label>
              <p className="text-sm">{payment?.billId || payment?.billV2Id || '-'}</p>
            </div>
            <div className="p-4 rounded-md border">
              <Label className="text-sm text-muted-foreground">Última actualización</Label>
              <p className="text-sm">{payment?.updatedAt ? new Date(payment.updatedAt).toLocaleString() : '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de vista previa del recibo */}
      {selectedReceipt && (
        <ReceiptPreview
          receipt={selectedReceipt}
          open={!!selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  )
}
