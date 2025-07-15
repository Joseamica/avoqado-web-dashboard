// src/components/receipts/ReceiptPreview.tsx
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Share2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Currency } from '@/utils/currency'

interface ReceiptPreviewProps {
  receipt: {
    id: string
    accessKey: string
    dataSnapshot: ReceiptDataSnapshot
    status: string
    recipientEmail: string | null
    createdAt: string
  }
  open: boolean
  onClose: () => void
}

// Interfaz mixta para soportar tanto el formato anidado como el formato plano del dataSnapshot
interface ReceiptDataSnapshot {
  // Formato anidado (legacy)
  payment?: {
    createdAt: string
    totalAmount: number
    tipAmount: number
    method?: string
  }
  venue?: {
    name: string
    address: string
    city: string
    state: string
    zipCode: string
    phone: string
    logo?: string
  }
  order?: {
    number: string
    items: {
      id?: string
      name: string
      price: number
      quantity: number
      modifiers: { name: string; price: number }[]
      totalPrice: number
    }[]
    subtotal: number
    tax: number
    total: number
  }
  processedBy?: {
    name: string
  } | null
  customer?: {
    name: string
    email: string | null
  } | null

  // Formato plano (nuevo)
  venueName?: string
  orderNumber?: string
  items?: any[]
  total?: number
  subtotal?: number
  taxAmount?: number
  tipAmount?: number
  paymentMethod?: string
  sentAt?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  phone?: string
  logo?: string
}

export default function ReceiptPreview({ receipt, open, onClose }: ReceiptPreviewProps) {
  const { toast } = useToast()
  
  // Verificamos que dataSnapshot exista y contenga los datos necesarios
  // Esto puede venir en formato anidado (payment, venue, order) o plano (venueName, orderNumber, etc)
  const dataSnapshot = receipt?.dataSnapshot as ReceiptDataSnapshot
  const isLegacyFormat = dataSnapshot?.payment && dataSnapshot?.venue && dataSnapshot?.order
  const isNewFormat = dataSnapshot?.venueName && dataSnapshot?.orderNumber && dataSnapshot?.items
  const hasValidData = receipt && dataSnapshot && (isLegacyFormat || isNewFormat)
  
  // Si los datos no son válidos, manejamos el error de forma elegante
  if (!hasValidData) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error al cargar el recibo</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <p className="text-red-500">No se pudieron cargar los datos del recibo correctamente.</p>
            <p className="mt-2">Puede que el formato del recibo sea incompatible o falten datos esenciales.</p>
            <Button className="mt-4 w-full" onClick={onClose}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }
  
  // Extraemos los datos dependiendo del formato
  let payment: any = {}
  let venue: any = {}
  let order: any = {}
  let customer: any = null
  let processedBy: any = null

  // Usamos as para evitar problemas de tipo
  const snapshot = receipt.dataSnapshot as ReceiptDataSnapshot
  
  if (snapshot.payment && snapshot.venue && snapshot.order) {
    // Formato anidado (legacy)
    payment = snapshot.payment
    venue = snapshot.venue
    order = snapshot.order
    customer = snapshot.customer || null
    processedBy = snapshot.processedBy || null
  } else {
    // Formato plano (new)
    payment = {
      createdAt: snapshot.sentAt || receipt.createdAt,
      totalAmount: snapshot.total || 0,
      tipAmount: snapshot.tipAmount || 0,
      method: snapshot.paymentMethod || 'CARD'
    }
    venue = {
      name: snapshot.venueName || 'Restaurant',
      address: snapshot.address || '',
      city: snapshot.city || '',
      state: snapshot.state || '',
      zipCode: snapshot.zipCode || '',
      phone: snapshot.phone || '',
      logo: snapshot.logo || ''
    }
    order = {
      number: snapshot.orderNumber || '',
      items: (snapshot.items || []).map(item => ({
        name: item.productId || item.name || 'Producto',
        quantity: item.quantity || 1,
        price: item.unitPrice || item.price || 0,
        totalPrice: item.total || 0,
        modifiers: []
      })),
      subtotal: snapshot.subtotal || 0,
      tax: snapshot.taxAmount || 0,
      total: snapshot.total || 0
    }
  }
  
  // Función para copiar el enlace público al portapapeles
  const copyPublicLink = () => {
    // Usamos la URL de la API para obtener recibos públicos usando el accessKey
    const frontendUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin
    const publicUrl = `${frontendUrl}/receipts/public/${receipt.accessKey}`
    
    navigator.clipboard.writeText(publicUrl)
    toast({
      title: 'Enlace copiado',
      description: 'El enlace público ha sido copiado al portapapeles',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vista previa del recibo</DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-2 justify-end mb-4">
          <Button variant="outline" className="flex gap-2 items-center" onClick={copyPublicLink}>
            <Share2 size={16} />
            Copiar enlace público
          </Button>
          <Button variant="outline" className="flex gap-2 items-center" onClick={() => window.print()}>
            <Download size={16} />
            Imprimir/Guardar PDF
          </Button>
        </div>

        {/* Contenido del recibo */}
        <div className="p-6 bg-white rounded-lg border print:shadow-none" id="printable-receipt">
          <div className="pb-4 mb-6 text-center border-b">
            {venue?.logo && <img src={venue.logo} alt={venue.name} className="mx-auto mb-3 h-12" />}
            <h2 className="text-xl font-bold">{venue?.name || 'Restaurante'}</h2>
            <p className="text-sm">{venue?.address || ''}</p>
            <p className="text-sm">{venue?.city || ''}{venue?.state ? `, ${venue.state}` : ''} {venue?.zipCode || ''}</p>
            <p className="text-sm">{venue?.phone || ''}</p>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-sm">
              <p>Recibo: #{receipt?.id ? receipt.id.substring(0, 6) : 'N/A'}</p>
              <p>Fecha: {payment?.createdAt ? new Date(payment.createdAt).toLocaleString() : 'N/A'}</p>
            </div>
            <div className="flex justify-between text-sm">
              <p>Orden: #{order?.number || 'N/A'}</p>
              {customer?.name && <p>Cliente: {customer.name}</p>}
            </div>
            {processedBy?.name && <p className="text-sm">Atendido por: {processedBy.name}</p>}
          </div>

          <table className="mb-4 w-full text-sm">
            <thead className="border-b">
              <tr className="text-left">
                <th className="pb-2 font-medium">Producto</th>
                <th className="pb-2 font-medium text-right">Cant.</th>
                <th className="pb-2 font-medium text-right">Precio</th>
                <th className="pb-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order?.items?.map((item, index) => (
                <tr key={index} className="border-b last:border-b-0">
                  <td className="py-2">
                    <div>{item?.name || item?.productId || 'Producto'}</div>
                    {Array.isArray(item?.modifiers) && item.modifiers.length > 0 && (
                      <ul className="pl-4 text-xs text-gray-600">
                        {item.modifiers.map((mod, idx) => (
                          <li key={idx}>{mod?.name || 'Modificador'} (+{Currency(mod?.price || 0)})</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="py-2 text-right">{item?.quantity || 0}</td>
                  <td className="py-2 text-right">{Currency(item?.price || 0)}</td>
                  <td className="py-2 text-right">{Currency(item?.totalPrice || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-col items-end mb-4 space-y-1 text-sm">
            <div className="flex justify-between w-40">
              <span>Subtotal:</span>
              <span>{Currency(order?.subtotal || 0)}</span>
            </div>
            <div className="flex justify-between w-40">
              <span>Impuesto:</span>
              <span>{Currency(order?.tax || 0)}</span>
            </div>
            <div className="flex justify-between w-40 font-medium">
              <span>Total:</span>
              <span>{Currency(order?.total || 0)}</span>
            </div>
            <div className="flex justify-between w-40">
              <span>Propina:</span>
              <span>{Currency(payment?.tipAmount || 0)}</span>
            </div>
            <div className="flex justify-between pt-1 w-40 text-base font-bold border-t">
              <span>Total Pagado:</span>
              <span>{Currency(payment?.totalAmount || 0)}</span>
            </div>
          </div>

          <div className="pt-4 text-sm text-center text-gray-600 border-t">
            <p>¡Gracias por su visita!</p>
            <p>Recibo generado por Avoqado</p>
            {receipt?.recipientEmail && (
              <p className="mt-2 text-xs">Enviado a: {receipt.recipientEmail}</p>
            )}
            <p className="text-xs">Estado: {receipt?.status || 'PENDIENTE'}</p>
            <p className="text-xs">ID: {receipt?.id || 'N/A'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
