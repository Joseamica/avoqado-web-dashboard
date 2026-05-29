// src/pages/Tpv/TerminalOrderDetail.tsx
//
// Order detail page Stripe redirects to after successful Checkout.
// Polls every 3s while in AWAITING_PAYMENT so the user sees the status
// flip to PAID once the webhook fires.

import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, Copy, FileText, Upload } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import { formatMxnCents } from '@/config/tpvCatalog'
import {
  tpvOrderService,
  type TerminalOrder,
  type TerminalOrderFulfillmentStatus,
  type TerminalOrderPaymentStatus,
} from '@/services/tpvOrder.service'

const PAYMENT_STATUS_LABELS: Record<TerminalOrderPaymentStatus, string> = {
  AWAITING_PAYMENT: 'Esperando pago',
  AWAITING_PROOF: 'Esperando comprobante',
  PROOF_UPLOADED: 'Comprobante subido',
  PAID: 'Pagado',
  REJECTED: 'Rechazado',
  EXPIRED: 'Expirado',
  REFUNDED: 'Reembolsado',
}

const FULFILLMENT_STATUS_LABELS: Record<TerminalOrderFulfillmentStatus, string> = {
  NEW: 'Nuevo',
  AWAITING_SERIALS: 'Pendiente de asignar',
  SERIALS_ASSIGNED: 'Listo para enviar',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

export default function TerminalOrderDetail() {
  const { t } = useTranslation('tpv')
  const { t: tCommon } = useTranslation('common')
  const { id } = useParams<{ id: string }>()
  const { venueId } = useCurrentVenue()
  const [searchParams] = useSearchParams()
  const { formatDate } = useVenueDateTime()
  const { toast } = useToast()

  // Show "Estamos procesando tu pago" toast when returning from Stripe success.
  // Stripe appends ?session_id={CHECKOUT_SESSION_ID} on success_url.
  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    if (sessionId) {
      toast({
        title: t('orders.detail.stripeReturn.title', {
          defaultValue: 'Estamos procesando tu pago',
        }),
        description: t('orders.detail.stripeReturn.description', {
          defaultValue:
            'Tu pago se está confirmando. La página se actualizará automáticamente cuando esté listo.',
        }),
      })
    }
  }, [searchParams, toast, t])

  const { data: order, isLoading } = useQuery<TerminalOrder>({
    queryKey: ['tpv-order', venueId, id],
    queryFn: () => tpvOrderService.getById(venueId!, id!),
    enabled: !!venueId && !!id,
    // Poll every 3s while waiting for Stripe webhook to flip the order to PAID.
    refetchInterval: q => {
      const data = q.state.data as TerminalOrder | undefined
      if (data?.paymentStatus === 'AWAITING_PAYMENT') return 3000
      return false
    },
  })

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {tCommon('loading', { defaultValue: 'Cargando…' })}
      </div>
    )
  }

  if (!order) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t('orders.detail.notFound', { defaultValue: 'Pedido no encontrado' })}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {t('orders.detail.title', { defaultValue: 'Pedido' })} {order.orderNumber}
          </h1>
          <p className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={order.paymentStatus === 'PAID' ? 'default' : 'secondary'}>
            {t(`orders.paymentStatus.${order.paymentStatus}`, {
              defaultValue: PAYMENT_STATUS_LABELS[order.paymentStatus],
            })}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {t(`orders.fulfillmentStatus.${order.fulfillmentStatus}`, {
              defaultValue: FULFILLMENT_STATUS_LABELS[order.fulfillmentStatus],
            })}
          </span>
        </div>
      </div>

      {/* Items */}
      <Card className="border-input">
        <CardHeader>
          <CardTitle className="text-base">
            {t('orders.detail.items', { defaultValue: 'Productos' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {order.items.map(item => (
            <div key={item.id} className="flex justify-between">
              <span>
                {item.productName} × {item.quantity}
              </span>
              <span>{formatMxnCents(item.unitPriceCents * item.quantity)}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-input space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>
                {t('purchaseWizard.step1.cart.subtotal', { defaultValue: 'Subtotal' })}
              </span>
              <span>{formatMxnCents(order.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>
                {t('purchaseWizard.step1.cart.tax', { defaultValue: 'Impuestos' })}
              </span>
              <span>{formatMxnCents(order.taxCents)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>
                {t('purchaseWizard.step1.cart.total', { defaultValue: 'Total' })}
              </span>
              <span>
                {formatMxnCents(order.totalCents)} {order.currency}
              </span>
            </div>
          </div>
          {order.stripeReceiptUrl && (
            <a
              href={order.stripeReceiptUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline"
            >
              {t('orders.detail.viewReceipt', { defaultValue: 'Ver recibo' })} →
            </a>
          )}
        </CardContent>
      </Card>

      {/* Shipping */}
      <Card className="border-input">
        <CardHeader>
          <CardTitle className="text-base">
            {t('orders.detail.shipping', { defaultValue: 'Envío' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>
            <strong>{order.contactName}</strong>
          </p>
          <p>
            {order.shippingAddress}
            {order.shippingAddress2 ? `, ${order.shippingAddress2}` : ''}
          </p>
          <p>
            {order.shippingCity}, {order.shippingState} {order.shippingZip}
          </p>
          <p>{order.shippingCountry}</p>
          <p className="mt-2 text-muted-foreground">
            {order.contactEmail} · {order.contactPhone}
          </p>
        </CardContent>
      </Card>

      {/* SPEI bank details + upload */}
      {order.paymentMethod === 'SPEI' && order.speiRecipient && (
        <SpeiPaymentSection order={order} />
      )}

      {/* Assigned terminals (visible when fulfillmentStatus >= SERIALS_ASSIGNED) */}
      {order.terminals && order.terminals.length > 0 && (
        <Card className="border-input">
          <CardHeader>
            <CardTitle className="text-base">
              {t('orders.detail.assignedTerminals', { defaultValue: 'Terminales asignados' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {order.terminals.map(tr => (
              <div
                key={tr.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
              >
                <div>
                  <div className="font-medium">{tr.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    Serial: {tr.serialNumber ?? '—'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">
                    {t('orders.detail.activationCode', { defaultValue: 'Código de activación' })}
                  </div>
                  <div className="font-mono font-bold tracking-wider">
                    {tr.activationCode ?? '—'}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function CopyableRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between py-2 border-b border-input last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono">{value}</span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            void navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  )
}

function SpeiPaymentSection({ order }: { order: TerminalOrder }) {
  const { t } = useTranslation('tpv')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const showUpload =
    order.paymentStatus === 'AWAITING_PROOF' || order.paymentStatus === 'REJECTED'
  const showProofUploaded = order.paymentStatus === 'PROOF_UPLOADED'

  const uploadMutation = useMutation({
    mutationFn: (file: File) => tpvOrderService.uploadProof(order.venueId, order.id, file),
    onSuccess: () => {
      toast({
        title: t('orders.detail.spei.uploadSuccess.title', {
          defaultValue: 'Comprobante recibido',
        }),
        description: t('orders.detail.spei.uploadSuccess.description', {
          defaultValue: 'Te avisaremos cuando lo verifiquemos.',
        }),
      })
      queryClient.invalidateQueries({ queryKey: ['tpv-order', order.venueId, order.id] })
    },
    onError: (err: any) => {
      toast({
        title: tCommon('common.error', { defaultValue: 'Error' }),
        description: err.response?.data?.error ?? err.message,
        variant: 'destructive',
      })
    },
  })

  const handleFileSelect = (file: File | undefined) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: tCommon('common.error', { defaultValue: 'Error' }),
        description: t('orders.detail.spei.fileTooLarge', {
          defaultValue: 'El archivo es demasiado grande (máximo 10 MB).',
        }),
        variant: 'destructive',
      })
      return
    }
    uploadMutation.mutate(file)
  }

  const fmtMx = (cents: number) =>
    `$${(cents / 100).toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${order.currency}`

  return (
    <>
      {/* Bank details */}
      <Card className="border-input">
        <CardHeader>
          <CardTitle className="text-base">
            {t('orders.detail.spei.bankDetailsTitle', {
              defaultValue: 'Datos para tu transferencia SPEI',
            })}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('orders.detail.spei.bankDetailsHelp', {
              defaultValue:
                'Copia los datos y haz la transferencia desde tu banco. El concepto debe ser exactamente el número de pedido.',
            })}
          </p>
        </CardHeader>
        <CardContent>
          <CopyableRow
            label={t('orders.detail.spei.beneficiary', { defaultValue: 'Beneficiario' })}
            value={order.speiRecipient!.beneficiary}
          />
          <CopyableRow label="CLABE" value={order.speiRecipient!.clabe} />
          <CopyableRow
            label={t('orders.detail.spei.bank', { defaultValue: 'Banco' })}
            value={order.speiRecipient!.bank}
          />
          <CopyableRow label="RFC" value={order.speiRecipient!.rfc} />
          <CopyableRow
            label={t('orders.detail.spei.amount', { defaultValue: 'Monto exacto' })}
            value={fmtMx(order.totalCents)}
          />
          <CopyableRow
            label={t('orders.detail.spei.concept', { defaultValue: 'Concepto' })}
            value={order.orderNumber}
          />
        </CardContent>
      </Card>

      {/* Rejection notice */}
      {order.paymentStatus === 'REJECTED' && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <div className="font-medium text-amber-900 dark:text-amber-100">
                {t('orders.detail.spei.rejected.title', {
                  defaultValue: 'Necesitamos verificar tu pago',
                })}
              </div>
              <div className="text-amber-800 dark:text-amber-200 mt-1">
                {order.speiRejectionReason ??
                  t('orders.detail.spei.rejected.fallbackReason', {
                    defaultValue: 'Hubo un problema con el comprobante.',
                  })}
              </div>
              <div className="text-amber-700 dark:text-amber-300 mt-2 text-xs">
                {t('orders.detail.spei.rejected.callToAction', {
                  defaultValue: 'Por favor verifica los datos y vuelve a subirlo.',
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload dropzone (only when AWAITING_PROOF or REJECTED) */}
      {showUpload && (
        <Card className="border-input">
          <CardHeader>
            <CardTitle className="text-base">
              {t('orders.detail.spei.uploadTitle', { defaultValue: 'Sube tu comprobante' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              role="button"
              tabIndex={0}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-primary bg-accent/30'
                  : 'border-input hover:border-muted-foreground'
              }`}
              onDragOver={e => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => {
                e.preventDefault()
                setIsDragging(false)
                handleFileSelect(e.dataTransfer.files[0])
              }}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">
                {t('orders.detail.spei.dropzone.title', {
                  defaultValue: 'Arrastra el comprobante aquí',
                })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('orders.detail.spei.dropzone.help', {
                  defaultValue: 'o haz click para seleccionar. PDF o imagen, máx 10 MB.',
                })}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={e => handleFileSelect(e.target.files?.[0])}
              />
            </div>
            {uploadMutation.isPending && (
              <p className="text-sm text-center mt-3 text-muted-foreground">
                {t('orders.detail.spei.uploading', { defaultValue: 'Subiendo comprobante…' })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Proof uploaded — awaiting verification */}
      {showProofUploaded && (
        <Card className="border-blue-300 bg-blue-50 dark:bg-blue-950/30">
          <CardContent className="p-4 text-sm">
            <div className="flex gap-3">
              <FileText className="h-5 w-5 text-blue-700 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  {t('orders.detail.spei.proofUploaded.title', {
                    defaultValue: 'Recibimos tu comprobante',
                  })}
                </p>
                <p className="text-blue-800 dark:text-blue-200 mt-1">
                  {t('orders.detail.spei.proofUploaded.message', {
                    defaultValue:
                      'En 1-2 días hábiles confirmamos el depósito y te avisamos.',
                  })}
                </p>
                {order.speiProofUrl && (
                  <a
                    href={order.speiProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-700 dark:text-blue-300 hover:underline mt-2 inline-block"
                  >
                    {t('orders.detail.spei.proofUploaded.viewProof', {
                      defaultValue: 'Ver mi comprobante',
                    })}{' '}
                    →
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
