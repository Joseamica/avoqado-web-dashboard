/**
 * Unified Receipt Renderer Component
 * Handles all receipt rendering scenarios with consistent styling and behavior
 */

import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Share2, 
  Download, 
  Mail, 
  Eye, 
  Copy, 
  AlertCircle,
  Receipt as ReceiptIcon,
  Building2,
  Calendar,
  User,
  CreditCard
} from 'lucide-react'
import { Currency } from '@/utils/currency'
import { ReceiptUrls } from '@/constants/receipt'
import type { UnifiedReceiptData, DigitalReceipt } from '@/types/receipt'

// Component Props
interface UnifiedReceiptRendererProps {
  receipt?: DigitalReceipt | null
  receiptData?: UnifiedReceiptData | null
  accessKey?: string
  isLoading?: boolean
  error?: string | null
  variant?: 'full' | 'preview' | 'embedded' | 'print'
  showActions?: boolean
  onShare?: (url: string) => void
  onCopy?: (url: string) => void
  onPrint?: () => void
  onEmail?: (email: string) => void
  className?: string
}

// Receipt Status Configuration
const getReceiptStatusConfig = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'VIEWED':
      return {
        badge: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-200 border border-green-200 dark:border-green-800',
        text: 'Visualizado'
      }
    case 'SENT':
      return {
        badge: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-200 border border-blue-200 dark:border-blue-800',
        text: 'Enviado'
      }
    case 'PENDING':
      return {
        badge: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-amber-800',
        text: 'Pendiente'
      }
    case 'ERROR':
      return {
        badge: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-800',
        text: 'Error'
      }
    default:
      return {
        badge: 'bg-muted text-muted-foreground border-border',
        text: status || 'Desconocido'
      }
  }
}

// Format date helper
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

// Format payment method helper
const formatPaymentMethod = (method: string, cardBrand?: string, maskedPan?: string): string => {
  const methodMap: Record<string, string> = {
    'CASH': 'Efectivo',
    'CREDIT_CARD': 'Tarjeta de Crédito',
    'DEBIT_CARD': 'Tarjeta de Débito',
    'DIGITAL_WALLET': 'Cartera Digital',
    'BANK_TRANSFER': 'Transferencia Bancaria',
  }
  
  let methodText = methodMap[method] || method
  
  if ((method === 'CREDIT_CARD' || method === 'DEBIT_CARD') && (cardBrand || maskedPan)) {
    const parts = []
    if (cardBrand) parts.push(cardBrand)
    if (maskedPan) parts.push(maskedPan)
    methodText += ` (${parts.join(' ')})`
  }
  
  return methodText
}

export const UnifiedReceiptRenderer: React.FC<UnifiedReceiptRendererProps> = ({
  receipt,
  receiptData,
  accessKey,
  isLoading = false,
  error,
  variant = 'full',
  showActions = true,
  onShare,
  onCopy,
  onPrint,
  onEmail,
  className = ''
}) => {
  // Extract data from either receipt or receiptData prop
  const data = receipt?.dataSnapshot || receiptData
  const receiptAccessKey = receipt?.accessKey || accessKey
  const receiptStatus = receipt?.status

  // Loading state
  if (isLoading) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-3/4" />
              </Card>
            ))}
          </div>
          <Card className="p-6">
            <Skeleton className="h-32 w-full" />
          </Card>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error || !data) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'No se pudieron cargar los datos del recibo'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const { payment, venue, order, processedBy, customer } = data
  const statusConfig = receiptStatus ? getReceiptStatusConfig(receiptStatus) : null
  const publicUrl = receiptAccessKey ? ReceiptUrls.public(receiptAccessKey) : null

  // Action handlers
  const handleShare = () => publicUrl && onShare?.(publicUrl)
  const handleCopy = () => publicUrl && onCopy?.(publicUrl)
  const handlePrint = () => onPrint?.()

  return (
    <Card className={`receipt-container ${variant === 'print' ? 'print-optimized' : ''} ${className}`}>
      {/* Header with venue info and status */}
      <CardHeader className={`${variant === 'preview' ? 'pb-4' : 'pb-6'} text-center border-b border-border`}>
        <div className="space-y-4">
          {/* Venue logo */}
          {venue.logo && variant !== 'preview' && (
            <div className="flex justify-center">
              <img 
                src={venue.logo} 
                alt={venue.name}
                className="h-16 w-16 rounded-full object-cover border-2 border-border"
              />
            </div>
          )}
          
          {/* Venue info */}
          <div>
            <h1 className="text-xl font-bold text-card-foreground mb-2">{venue.name}</h1>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>{venue.address}</p>
              <p>{venue.city}{venue.state ? `, ${venue.state}` : ''} {venue.zipCode || ''}</p>
              <p>{venue.phone}</p>
              {venue.email && <p>{venue.email}</p>}
            </div>
          </div>

          {/* Status badge */}
          {statusConfig && variant === 'full' && (
            <div className="flex justify-center">
              <Badge variant="outline" className={statusConfig.badge}>
                {statusConfig.text}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className={`${variant === 'preview' ? 'p-4' : 'p-6'} space-y-6`}>
        {/* Receipt metadata */}
        {variant !== 'preview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <ReceiptIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Recibo:</span>
                <span className="font-medium">#{receipt?.id?.slice(0, 8) || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Fecha:</span>
                <span className="font-medium">{formatDate(payment.createdAt)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Orden:</span>
                <span className="font-medium">#{order.number}</span>
              </div>
              {processedBy && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Atendido por:</span>
                  <span className="font-medium">{processedBy.name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Order items */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b border-border pb-2">Productos</h2>
          {order.items?.length > 0 ? (
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div key={index} className="flex justify-between items-start py-2 border-b border-border/50 last:border-b-0">
                  <div className="flex-1">
                    <div className="font-medium text-card-foreground">{item.name}</div>
                    <div className="text-sm text-muted-foreground">Cantidad: {item.quantity}</div>
                    {item.modifiers?.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {item.modifiers.map((modifier, modIndex) => (
                          <div key={modIndex} className="text-xs text-muted-foreground pl-2">
                            + {modifier.name} ({Currency(modifier.price)})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {variant !== 'preview' && (
                      <div className="text-sm text-muted-foreground">{Currency(item.price)}</div>
                    )}
                    <div className="font-semibold">{Currency(item.totalPrice)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ReceiptIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No se registraron productos individuales</p>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-medium">{Currency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">IVA:</span>
            <span className="font-medium">{Currency(order.taxAmount)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold border-t border-border pt-2">
            <span>Total:</span>
            <span>{Currency(order.total)}</span>
          </div>
          {payment.tipAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Propina:</span>
              <span className="font-medium text-green-600">{Currency(payment.tipAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold border-t border-border pt-3">
            <span>Total Pagado:</span>
            <span className="text-green-600">{Currency(payment.totalAmount)}</span>
          </div>
        </div>

        {/* Payment method */}
        <div className="bg-muted p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium">
                {formatPaymentMethod(payment.method, payment.cardBrand, payment.maskedPan)}
              </div>
              <div className="text-sm text-muted-foreground">
                Estado: {payment.status === 'COMPLETED' ? 'Completado' : payment.status}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {showActions && variant !== 'preview' && publicUrl && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Compartir
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar enlace
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Download className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            {onEmail && (
              <Button variant="outline" size="sm" onClick={() => onEmail('')}>
                <Mail className="h-4 w-4 mr-2" />
                Enviar email
              </Button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-6 border-t border-border text-sm text-muted-foreground">
          <p>¡Gracias por su preferencia!</p>
          <p className="mt-1">Recibo digital generado por Avoqado</p>
          {customer?.email && (
            <p className="mt-2 text-xs">Enviado a: {customer.email}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default UnifiedReceiptRenderer