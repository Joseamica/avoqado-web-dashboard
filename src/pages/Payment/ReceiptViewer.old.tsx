// src/pages/Payment/ReceiptViewer.tsx
import api from '@/api'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'

import { useQuery } from '@tanstack/react-query'
import { Mail, Download, Share2 } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { Currency as CurrencyFormat } from '@/utils/currency'
import { useToast } from '@/hooks/use-toast'
import { ReceiptUrls, RECEIPT_PATHS } from '@/constants/receipt'
import { ModernReceiptDesign } from '@/components/receipts/ModernReceiptDesign'

// Type guard para verificar si tenemos un objeto con dataSnapshot
const hasDataSnapshot = (obj: any): obj is { dataSnapshot: ReceiptDataSnapshot } => {
  return obj && typeof obj === 'object' && 'dataSnapshot' in obj
}

interface ReceiptDataSnapshot {
  payment: {
    id: string
    amount: number
    tipAmount: number
    totalAmount: number
    method: string
    status: string
    createdAt: string
  }
  venue: {
    id: string
    name: string
    address: string
    city: string
    state: string
    zipCode: string
    phone: string
    logo: string | null
  }
  order: {
    id: string
    number: number
    items: Array<{
      name: string
      quantity: number
      price: number
      totalPrice: number
      modifiers: Array<{
        name: string
        price: number
      }>
    }>
    subtotal: number
    tax: number
    total: number
    createdAt: string
  }
  processedBy: {
    name: string
  } | null
  customer: {
    name: string
    email: string | null
  } | null
}

export default function ReceiptViewer() {
  // El parámetro puede ser un receiptId o un accessKey dependiendo de la ruta
  const { receiptId, accessKey } = useParams<{ receiptId?: string; accessKey?: string }>()
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const { toast } = useToast()

  // Determinar si estamos en una ruta pública (/receipts/public/) o dentro del dashboard
  const isPublicView = ReceiptUrls.isPublicView()

  // El identificador a usar depende de la ruta
  // En la ruta pública, usamos accessKey directamente del parámetro de URL
  // En la ruta dashboard, usamos receiptId
  const identifier = isPublicView ? accessKey : receiptId

  // Query para obtener los detalles del recibo
  const {
    data: receipt,
    isLoading,
    refetch,
    error: queryError,
  } = useQuery({
    queryKey: ['receipt', identifier],
    queryFn: async () => {
      console.log('Fetching receipt with params:', {
        isPublicView,
        accessKey,
        receiptId,
        identifier,
        path: window.location.pathname,
      })

      try {
        if (isPublicView) {
          // Vista pública devuelve HTML; pedimos como texto y lo renderizamos tal cual
          const response = await api.get(`/api/v1/public/receipt/${identifier}` as const, {
            headers: { Accept: 'text/html' },
            responseType: 'text' as any,
          })
          return { html: response.data as unknown as string }
        } else {
          // Si estamos en el dashboard, usamos el endpoint autenticado
          const url = `/api/v1/dashboard/receipts/${identifier}`
          console.log('Fetching dashboard receipt with URL:', url)

          const response = await api.get(url)
          return response.data
        }
      } catch (err) {
        console.error('Error fetching receipt:', err)
        throw err
      }
    },
    enabled: !!identifier,
  })

  // Función para enviar el recibo por correo electrónico
  const handleSendReceipt = async (email: string) => {
    if (!receipt) return

    // Solo disponible en vista dashboard, no en vista pública
    if (isPublicView) {
      toast({
        title: 'No disponible',
        description: 'El envío de recibos no está disponible en la vista pública',
        variant: 'destructive',
      })
      return
    }

    setSendingEmail(true)
    try {
      await api.post(`/api/v1/dashboard/payments/${receipt.paymentId}/send-receipt`, {
        recipientEmail: email,
      })
      toast({
        title: 'Recibo enviado',
        description: `Se ha enviado el recibo a ${email} exitosamente`,
        variant: 'default',
      })
      setEmailDialogOpen(false)
      refetch() // Actualizar para mostrar el nuevo recibo
    } catch (error) {
      console.error('Error sending receipt email:', error)
      toast({
        title: 'Error',
        description: 'No se pudo enviar el recibo por correo electrónico',
        variant: 'destructive',
      })
    } finally {
      setSendingEmail(false)
    }
  }

  // Función para copiar el enlace público al portapapeles
  const copyPublicLink = () => {
    if (!receipt) return

    // En la vista pública, el identificador ya es el accessKey; de lo contrario usamos el del recibo
    const key = isPublicView ? identifier : receipt.accessKey
    const publicLink = ReceiptUrls.public(key)
    navigator.clipboard.writeText(publicLink)
    toast({
      title: 'Enlace copiado',
      description: 'El enlace público ha sido copiado al portapapeles',
    })
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="grid gap-4 mb-6 md:grid-cols-3">
          <Card className="p-4">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </Card>
          <Card className="p-4">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </Card>
          <Card className="p-4">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </Card>
        </div>
        <Card className="p-8">
          <div className="text-center mb-6">
            <Skeleton className="h-12 w-12 rounded-full mx-auto mb-3" />
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </Card>
      </div>
    )
  }

  // Si hay un error o no hay recibo, mostrar mensaje adecuado
  if (queryError || !receipt) {
    console.error('Error al cargar el recibo:', queryError)
    return (
      <div className="container mx-auto p-4 min-h-screen flex items-center justify-center">
        <Card className="p-6 max-w-md w-full">
          <Alert variant="destructive">
            <AlertDescription className="text-center">
              No se encontró el recibo solicitado.
              {isPublicView && ' Verifique que la URL sea correcta.'}
            </AlertDescription>
          </Alert>
        </Card>
      </div>
    )
  }

  // Si estamos en vista pública y el backend devolvió HTML, lo mostramos directamente
  if (isPublicView && (receipt as any)?.html) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="container mx-auto p-4">
          <div className="max-w-4xl mx-auto">
            <Card className="overflow-hidden shadow-lg border-0">
              <div 
                className="receipt-content"
                dangerouslySetInnerHTML={{ __html: (receipt as any).html }} 
              />
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Extraer los datos del snapshot para mostrarlos como JSON estructurado
  const dataSnapshot = hasDataSnapshot(receipt) ? (receipt as any).dataSnapshot : (receipt as any)

  // Validar si tenemos datos válidos en el dataSnapshot
  if (!dataSnapshot || (!dataSnapshot.payment && !dataSnapshot.venue)) {
    console.error('Data snapshot inválido:', dataSnapshot)
    return (
      <div className="container mx-auto p-4 min-h-screen flex items-center justify-center">
        <Card className="p-6 max-w-md w-full">
          <Alert variant="destructive">
            <AlertDescription className="text-center">
              El formato del recibo no es válido.
            </AlertDescription>
          </Alert>
        </Card>
      </div>
    )
  }

  // Extraer los datos del snapshot
  const { payment, venue, order, processedBy, customer } = dataSnapshot

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto p-4 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
          <h1 className="text-2xl font-bold text-foreground">Recibo Digital</h1>
          <div className="flex flex-wrap gap-2">
            <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex gap-2 items-center">
                  <Mail size={16} />
                  <span className="hidden sm:inline">Enviar por correo</span>
                  <span className="sm:hidden">Correo</span>
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enviar recibo por correo electrónico</DialogTitle>
              </DialogHeader>
              <div className="mt-4 space-y-4">
                <div className="grid gap-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Correo electrónico
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                  />
                </div>
                <Button disabled={!emailInput || sendingEmail} onClick={() => handleSendReceipt(emailInput)} className="w-full">
                  {sendingEmail ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

            <Button variant="outline" className="flex gap-2 items-center" onClick={copyPublicLink}>
              <Share2 size={16} />
              <span className="hidden sm:inline">Copiar enlace público</span>
              <span className="sm:hidden">Enlace</span>
            </Button>

            <Button variant="outline" className="flex gap-2 items-center" onClick={() => window.print()}>
              <Download size={16} />
              <span className="hidden sm:inline">Imprimir/Guardar PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          </div>
        </div>

        {/* Información de recibo y estado */}
        <div className="grid gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="p-4 bg-card border-border">
            <h3 className="mb-3 font-semibold text-card-foreground">Información del Recibo</h3>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">ID: <span className="text-foreground font-mono">{receipt.id}</span></p>
              <p className="text-sm text-muted-foreground">Creado: <span className="text-foreground">{new Date(receipt.createdAt).toLocaleString()}</span></p>
              <p className="text-sm text-muted-foreground">Estado: <span className="text-foreground capitalize">{receipt.status}</span></p>
              {receipt.recipientEmail && <p className="text-sm text-muted-foreground">Enviado a: <span className="text-foreground">{receipt.recipientEmail}</span></p>}
            </div>
          </Card>

          <Card className="p-4 bg-card border-border">
            <h3 className="mb-3 font-semibold text-card-foreground">Información de Pago</h3>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">ID Pago: <span className="text-foreground font-mono">{payment?.id}</span></p>
              <p className="text-sm text-muted-foreground">Método: <span className="text-foreground capitalize">{payment?.method}</span></p>
              <p className="text-sm text-muted-foreground">Estado: <span className="text-foreground capitalize">{payment?.status}</span></p>
              <p className="text-sm text-muted-foreground">Fecha: <span className="text-foreground">{new Date(payment?.createdAt).toLocaleString()}</span></p>
            </div>
          </Card>

          <Card className="p-4 bg-card border-border sm:col-span-2 lg:col-span-1">
            <h3 className="mb-3 font-semibold text-card-foreground">Establecimiento</h3>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{venue.name}</p>
              <p className="text-sm text-muted-foreground">{venue.address}</p>
              <p className="text-sm text-muted-foreground">
                {venue.city}, {venue.state} {venue.zipCode}
              </p>
              <p className="text-sm text-muted-foreground">{venue.phone}</p>
            </div>
          </Card>
        </div>

        {/* Contenido del recibo */}
        <Card className="bg-card shadow-lg border-0" id="printable-receipt">
          <div className="p-6 sm:p-8">
            <div className="pb-6 mb-6 text-center border-b border-border">
              {venue.logo && <img src={venue.logo} alt={venue.name} className="mx-auto mb-3 h-12" />}
              <h2 className="text-xl font-bold text-card-foreground">{venue.name}</h2>
              <p className="text-sm text-muted-foreground">{venue.address}</p>
              <p className="text-sm text-muted-foreground">
                {venue.city}, {venue.state} {venue.zipCode}
              </p>
              <p className="text-sm text-muted-foreground">{venue.phone}</p>
            </div>

            <div className="mb-6 space-y-2">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 text-sm">
                <p className="text-muted-foreground">Recibo: <span className="text-foreground font-mono">#{receipt.id.substring(0, 6)}</span></p>
                <p className="text-muted-foreground">Fecha: <span className="text-foreground">{new Date(payment.createdAt).toLocaleString()}</span></p>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 text-sm">
                <p className="text-muted-foreground">Orden: <span className="text-foreground">#{order.number}</span></p>
                {customer && <p className="text-muted-foreground">Cliente: <span className="text-foreground">{customer.name}</span></p>}
              </div>
              {processedBy && <p className="text-sm text-muted-foreground">Atendido por: <span className="text-foreground">{processedBy.name}</span></p>}
            </div>

            <div className="mb-6 overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr className="text-left">
                    <th className="pb-3 font-medium text-card-foreground">Producto</th>
                    <th className="pb-3 font-medium text-right text-card-foreground">Cant.</th>
                    <th className="pb-3 font-medium text-right text-card-foreground hidden sm:table-cell">Precio</th>
                    <th className="pb-3 font-medium text-right text-card-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item: ReceiptDataSnapshot['order']['items'][0], index: number) => (
                    <tr key={index} className="border-b border-border/50 last:border-b-0">
                      <td className="py-3">
                        <div className="font-medium text-card-foreground">{item.name}</div>
                        {item.modifiers.length > 0 && (
                          <ul className="pl-2 mt-1 text-xs text-muted-foreground space-y-1">
                            {item.modifiers.map((mod: any, idx: number) => (
                              <li key={idx} className="flex justify-between">
                                <span>{mod.name}</span>
                                <span>+{CurrencyFormat(mod.price)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="py-3 text-right text-card-foreground font-medium">{item.quantity}</td>
                      <td className="py-3 text-right text-muted-foreground hidden sm:table-cell">{CurrencyFormat(item.price)}</td>
                      <td className="py-3 text-right text-card-foreground font-semibold">{CurrencyFormat(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-end mb-6 space-y-2">
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="text-card-foreground">{CurrencyFormat(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Impuesto:</span>
                  <span className="text-card-foreground">{CurrencyFormat(order.tax)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium text-muted-foreground">
                  <span>Total:</span>
                  <span className="text-card-foreground">{CurrencyFormat(order.total)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Propina:</span>
                  <span className="text-card-foreground">{CurrencyFormat(payment.tipAmount)}</span>
                </div>
                <div className="flex justify-between pt-2 text-base font-bold border-t border-border">
                  <span className="text-card-foreground">Total Pagado:</span>
                  <span className="text-card-foreground">{CurrencyFormat(payment.totalAmount)}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 text-sm text-center text-muted-foreground border-t border-border">
              <p>¡Gracias por su visita!</p>
              <p>Recibo generado por Avoqado</p>
            </div>
          </div>
  // Action handlers for the modern design
  const handleShare = (url: string) => {
    // Handle sharing
    if (navigator.share) {
      navigator.share({
        title: `Recibo de ${receipt?.dataSnapshot?.venue?.name || 'Restaurant'}`,
        url: url
      })
    }
  }

  const handleCopy = (url: string) => {
    copyPublicLink()
  }

  const handlePrint = () => {
    window.print()
  }

  const handleEmail = (email: string) => {
    // Handle email sending - would integrate with your existing email functionality
    setEmailDialogOpen(true)
    setEmailInput(email)
  }

  const receiptAccessKey = isPublicView ? accessKey : receipt?.accessKey

  return (
    <ModernReceiptDesign
      receipt={receipt}
      isLoading={isLoading}
      error={error}
      accessKey={receiptAccessKey}
      variant={isPublicView ? 'full' : 'embedded'}
      showActions={true}
      onShare={handleShare}
      onCopy={handleCopy}
      onPrint={handlePrint}
      onEmail={handleEmail}
    />
  )
}
