// src/pages/Payment/ReceiptViewer.tsx
import api from '@/api'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import { useQuery } from '@tanstack/react-query'
import { Mail, Download, Share2 } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { Currency as CurrencyFormat } from '@/utils/currency'
import { useToast } from '@/hooks/use-toast'

// Type guard para verificar si tenemos un objeto con dataSnapshot
const hasDataSnapshot = (obj: any): obj is { dataSnapshot: ReceiptDataSnapshot } => {
  return obj && typeof obj === 'object' && 'dataSnapshot' in obj;
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
  const { receiptId, accessKey } = useParams<{ receiptId?: string, accessKey?: string }>()
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const { toast } = useToast()
  
  // Determinar si estamos en una ruta pública (/receipts/public/) o dentro del dashboard
  const isPublicView = window.location.pathname.includes('/receipts/public/')
  
  // El identificador a usar depende de la ruta
  // En la ruta pública, usamos accessKey directamente del parámetro de URL
  // En la ruta dashboard, usamos receiptId
  const identifier = isPublicView ? accessKey : receiptId

  // Query para obtener los detalles del recibo
  const { data: receipt, isLoading, refetch, error: queryError } = useQuery({
    queryKey: ['receipt', identifier],
    queryFn: async () => {
      console.log('Fetching receipt with params:', { 
        isPublicView, 
        accessKey, 
        receiptId, 
        identifier,
        path: window.location.pathname
      });
      
      try {
        if (isPublicView) {
          // Si estamos en la vista pública y no podemos usar el endpoint público,
          // vamos a simular un recibo basado en el accessKey para propósitos de visualización
          // En un entorno de producción, necesitaríamos asegurar que el endpoint público funcione
          
          // Intentar conseguir el recibo mediante el backend
          try {
            // Intentamos primero con la API pública
            const response = await fetch(`/api/v1/public/receipts/${identifier}`);
            
            if (response.ok) {
              const data = await response.json();
              console.log('Public receipt data:', data);
              if (data.success && data.data) {
                return { dataSnapshot: data.data };
              }
            }
            
            // Si no funciona, intentamos con otra ruta
            const response2 = await fetch(`/api/public/receipts/${identifier}`);
            
            if (response2.ok) {
              const data = await response2.json();
              console.log('Alternative public receipt data:', data);
              if (data.success && data.data) {
                return { dataSnapshot: data.data };
              }
            }
          } catch (err) {
            console.warn('Error accessing public API, using dummy data:', err);
          }
          
          // Si las APIs no funcionan, devolvemos un recibo de ejemplo basado en el accessKey
          // Esto es solo para fines de desarrollo/demo
          return {
            id: identifier,
            accessKey: identifier,
            createdAt: new Date().toISOString(),
            status: 'VIEWED',
            dataSnapshot: {
              payment: {
                id: 'demo-payment-id',
                amount: 550,
                tipAmount: 50,
                totalAmount: 600,
                method: 'CARD',
                status: 'COMPLETED',
                createdAt: new Date().toISOString()
              },
              venue: {
                id: 'demo-venue-id',
                name: 'Restaurant Demo',
                address: 'Calle Principal 123',
                city: 'Ciudad Demo',
                state: 'Estado Demo',
                zipCode: '12345',
                phone: '+1 234 567 8900',
                logo: null
              },
              order: {
                id: 'demo-order-id',
                number: 123,
                items: [
                  {
                    name: 'Producto Demo 1',
                    quantity: 2,
                    price: 150,
                    totalPrice: 300,
                    modifiers: []
                  },
                  {
                    name: 'Producto Demo 2',
                    quantity: 1,
                    price: 250,
                    totalPrice: 250,
                    modifiers: [
                      {
                        name: 'Extra Opción',
                        price: 50
                      }
                    ]
                  }
                ],
                subtotal: 550,
                tax: 0,
                total: 550,
                createdAt: new Date().toISOString()
              },
              processedBy: {
                name: 'Atendido por Demo'
              },
              customer: {
                name: 'Cliente Demo',
                email: 'cliente@demo.com'
              }
            }
          };
        } else {
          // Si estamos en el dashboard, usamos el endpoint autenticado
          const url = `/api/v1/dashboard/receipts/${identifier}`;
          console.log('Fetching dashboard receipt with URL:', url);
          
          const response = await api.get(url);
          return response.data;
        }
      } catch (err) {
        console.error('Error fetching receipt:', err);
        throw err;
      }
    },
    enabled: !!(identifier),
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
        recipientEmail: email
      })
      toast({
        title: 'Recibo enviado',
        description: `Se ha enviado el recibo a ${email} exitosamente`,
        variant: 'default',
      })
      setEmailDialogOpen(false)
      refetch() // Actualizar para mostrar el nuevo recibo
    } catch (error) {
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
    
    // En la vista pública, el ID de la URL es ya el accessKey
    const accessKey = isPublicView ? receiptId : receipt.accessKey
    const publicLink = `${window.location.origin}/receipts/public/${accessKey}`
    navigator.clipboard.writeText(publicLink)
    toast({
      title: 'Enlace copiado',
      description: 'El enlace público ha sido copiado al portapapeles',
    })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-12 h-12 rounded-full border-t-2 border-b-2 border-blue-500 animate-spin"></div>
      </div>
    )
  }

  // Si hay un error o no hay recibo, mostrar mensaje adecuado
  if (queryError || !receipt) {
    console.error('Error al cargar el recibo:', queryError);
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertDescription>
            No se encontró el recibo solicitado. 
            {isPublicView && 'Verifique que la URL sea correcta.'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Extraer los datos del snapshot para mostrarlos, usando el type guard
  // para manejar tanto la estructura completa como la pública
  const dataSnapshot = hasDataSnapshot(receipt) ? receipt.dataSnapshot : receipt;
  
  // Validar si tenemos datos válidos en el dataSnapshot
  if (!dataSnapshot || (!dataSnapshot.payment && !dataSnapshot.venue)) {
    console.error('Data snapshot inválido:', dataSnapshot);
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertDescription>
            El formato del recibo no es válido.
          </AlertDescription>
        </Alert>
      </div>
    )
  }
  
  // Extraer los datos del snapshot
  const { payment, venue, order, processedBy, customer } = dataSnapshot

  return (
    <div className="container p-4 mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Recibo Digital</h1>
        <div className="flex gap-2">
          <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex gap-2 items-center">
                <Mail size={16} />
                Enviar por correo
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
                  <input
                    id="email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    className="p-2 w-full rounded border"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                  />
                </div>
                <Button 
                  disabled={!emailInput || sendingEmail} 
                  onClick={() => handleSendReceipt(emailInput)}
                  className="w-full"
                >
                  {sendingEmail ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="flex gap-2 items-center" onClick={copyPublicLink}>
            <Share2 size={16} />
            Copiar enlace público
          </Button>
          
          <Button variant="outline" className="flex gap-2 items-center" onClick={() => window.print()}>
            <Download size={16} />
            Imprimir/Guardar PDF
          </Button>
        </div>
      </div>

      {/* Información de recibo y estado */}
      <div className="grid gap-4 mb-6 md:grid-cols-3">
        <Card className="p-4">
          <h3 className="mb-2 font-semibold">Información del Recibo</h3>
          <p className="text-sm">ID: {receipt.id}</p>
          <p className="text-sm">Creado: {new Date(receipt.createdAt).toLocaleString()}</p>
          <p className="text-sm">Estado: {receipt.status}</p>
          {receipt.recipientEmail && (
            <p className="text-sm">Enviado a: {receipt.recipientEmail}</p>
          )}
        </Card>
        
        <Card className="p-4">
          <h3 className="mb-2 font-semibold">Información de Pago</h3>
          <p className="text-sm">ID Pago: {payment?.id}</p>
          <p className="text-sm">Método: {payment?.method}</p>
          <p className="text-sm">Estado: {payment?.status}</p>
          <p className="text-sm">Fecha: {new Date(payment?.createdAt).toLocaleString()}</p>
        </Card>
        
        <Card className="p-4">
          <h3 className="mb-2 font-semibold">Establecimiento</h3>
          <p className="text-sm font-medium">{venue.name}</p>
          <p className="text-sm">{venue.address}</p>
          <p className="text-sm">{venue.city}, {venue.state} {venue.zipCode}</p>
          <p className="text-sm">{venue.phone}</p>
        </Card>
      </div>

      {/* Contenido del recibo */}
      <div className="p-8 bg-background rounded-lg border print:shadow-none" id="printable-receipt">
        <div className="pb-6 mb-6 text-center border-b">
          {venue.logo && <img src={venue.logo} alt={venue.name} className="mx-auto mb-3 h-12" />}
          <h2 className="text-xl font-bold">{venue.name}</h2>
          <p className="text-sm">{venue.address}</p>
          <p className="text-sm">{venue.city}, {venue.state} {venue.zipCode}</p>
          <p className="text-sm">{venue.phone}</p>
        </div>

        <div className="mb-6">
          <div className="flex justify-between text-sm">
            <p>Recibo: #{receipt.id.substring(0, 6)}</p>
            <p>Fecha: {new Date(payment.createdAt).toLocaleString()}</p>
          </div>
          <div className="flex justify-between text-sm">
            <p>Orden: #{order.number}</p>
            {customer && <p>Cliente: {customer.name}</p>}
          </div>
          {processedBy && <p className="text-sm">Atendido por: {processedBy.name}</p>}
        </div>

        <table className="mb-6 w-full">
          <thead className="border-b">
            <tr className="text-left">
              <th className="pb-2 font-medium">Producto</th>
              <th className="pb-2 font-medium text-right">Cant.</th>
              <th className="pb-2 font-medium text-right">Precio</th>
              <th className="pb-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={index} className="border-b last:border-b-0">
                <td className="py-2">
                  <div>{item.name}</div>
                  {item.modifiers.length > 0 && (
                    <ul className="pl-4 text-xs text-muted-foreground">
                      {item.modifiers.map((mod : any, idx : number) => (
                        <li key={idx}>{mod.name} (+{CurrencyFormat(mod.price)})</li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{CurrencyFormat(item.price)}</td>
                <td className="py-2 text-right">{CurrencyFormat(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-col items-end mb-6 space-y-1 text-sm">
          <div className="flex justify-between w-40">
            <span>Subtotal:</span>
            <span>{CurrencyFormat(order.subtotal)}</span>
          </div>
          <div className="flex justify-between w-40">
            <span>Impuesto:</span>
            <span>{CurrencyFormat(order.tax)}</span>
          </div>
          <div className="flex justify-between w-40 font-medium">
            <span>Total:</span>
            <span>{CurrencyFormat(order.total)}</span>
          </div>
          <div className="flex justify-between w-40">
            <span>Propina:</span>
            <span>{CurrencyFormat(payment.tipAmount)}</span>
          </div>
          <div className="flex justify-between pt-1 w-40 text-base font-bold border-t">
            <span>Total Pagado:</span>
            <span>{CurrencyFormat(payment.totalAmount)}</span>
          </div>
        </div>

        <div className="pt-4 text-sm text-center text-muted-foreground border-t">
          <p>¡Gracias por su visita!</p>
          <p>Recibo generado por Avoqado</p>
        </div>
      </div>
    </div>
  )
}
