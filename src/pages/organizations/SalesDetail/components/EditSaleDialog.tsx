/**
 * EditSaleDialog — back-office editor for a single org sale (OWNER-only).
 *
 * P1 fields: Monto, Forma de pago, Tipo de venta, Estado, Motivo (obligatorio).
 * Uses FullScreenModal (mandatory for edit flows per ui-patterns.md). On success
 * invalidates the list + summary queries (same keys as the reopen flow).
 */
import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Save } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { editOrgSaleVerification, type EditOrgSaleParams, type OrgSaleRow } from '@/services/saleVerification.org.service'
import type { SaleVerificationRejectionReason, SaleVerificationStatus } from '@/services/saleVerification.service'
import { ReviewReasonsFields, isPromoterFeedbackValid, PROMOTER_FEEDBACK_ERROR } from '@/components/sale-verification/ReviewReasonsFields'

type PaymentFormChoice = 'CASH' | 'CARD' | 'OTHER'

function currentPaymentForm(row: OrgSaleRow): PaymentFormChoice {
  const f = row.payment?.paymentForm
  if (f === 'CASH') return 'CASH'
  if (f === 'CARD') return 'CARD'
  return 'OTHER'
}

export function EditSaleDialog({
  open,
  row,
  orgId,
  onClose,
}: {
  open: boolean
  row: OrgSaleRow | null
  orgId: string
  onClose: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [amount, setAmount] = useState<number | undefined>(undefined)
  const [paymentForm, setPaymentForm] = useState<PaymentFormChoice>('OTHER')
  const [isPortabilidad, setIsPortabilidad] = useState(false)
  const [status, setStatus] = useState<SaleVerificationStatus>('COMPLETED')
  const [reason, setReason] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [rejectionReasons, setRejectionReasons] = useState<SaleVerificationRejectionReason[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && row) {
      setAmount(row.payment ? Number(row.payment.amount) : undefined)
      setPaymentForm(currentPaymentForm(row))
      setIsPortabilidad(row.saleType === 'PORTABILIDAD')
      setStatus(row.status)
      setReason('')
      setReviewNotes(row.status === 'FAILED' ? (row.reviewNotes?.trim() ?? '') : '')
      setRejectionReasons(row.status === 'FAILED' ? row.rejectionReasons : [])
      setError(null)
    }
  }, [open, row])

  const mutation = useMutation({
    mutationFn: (params: EditOrgSaleParams) => {
      if (!row) throw new Error('No row selected')
      return editOrgSaleVerification(orgId, row.id, params)
    },
    onSuccess: () => {
      toast({ title: 'Venta actualizada', description: 'Los cambios quedaron guardados y registrados en la auditoría.' })
      queryClient.invalidateQueries({ queryKey: ['org', orgId, 'sale-verifications'] })
      queryClient.invalidateQueries({ queryKey: ['org', orgId, 'sales-summary'] })
      onClose()
    },
    onError: (err: any) => {
      toast({
        title: 'No se pudo guardar',
        description: err?.response?.data?.message || err?.message || 'Intenta de nuevo.',
        variant: 'destructive',
      })
    },
  })

  const isLoading = mutation.isPending

  const handleSubmit = () => {
    if (reason.trim().length < 5) {
      setError('Escribe un motivo de al menos 5 caracteres (queda en la auditoría).')
      return
    }
    // Candado: dejar la venta en "Revisar por promotor" sin decirle qué corregir
    // lo deja atorado en su TPV sin instrucciones.
    if (status === 'FAILED' && !isPromoterFeedbackValid(reviewNotes)) {
      setError(PROMOTER_FEEDBACK_ERROR)
      return
    }
    mutation.mutate({
      amount,
      paymentForm,
      isPortabilidad,
      status,
      reason: reason.trim(),
      ...(status === 'FAILED' ? { reviewNotes: reviewNotes.trim(), rejectionReasons } : {}),
    })
  }

  return (
    <FullScreenModal
      open={open}
      onClose={() => !isLoading && onClose()}
      title="Editar venta"
      subtitle={row ? `${row.venue.name} · ${row.serialNumbers[0] ?? row.id.slice(-6)}` : undefined}
      contentClassName="bg-muted/30"
      actions={
        <Button onClick={handleSubmit} disabled={isLoading} data-tour="edit-sale-submit">
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-lg p-4 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="edit-amount">Monto (MXN)</Label>
          <Input
            id="edit-amount"
            type="number"
            inputMode="decimal"
            min={0}
            value={amount ?? ''}
            onChange={e => {
              const raw = e.target.value
              setAmount(raw === '' ? undefined : parseFloat(raw))
            }}
            className="h-12 text-base"
            placeholder="0"
          />
          <p className="text-[11px] text-muted-foreground">Si el monto es 0, la forma de pago se muestra como “Gratis”.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Forma de pago</Label>
          <Select value={paymentForm} onValueChange={v => setPaymentForm(v as PaymentFormChoice)}>
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">Efectivo</SelectItem>
              <SelectItem value="CARD">Tarjeta</SelectItem>
              <SelectItem value="OTHER">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Tipo de venta</Label>
          <Select value={isPortabilidad ? 'PORTABILIDAD' : 'LINEA_NUEVA'} onValueChange={v => setIsPortabilidad(v === 'PORTABILIDAD')}>
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LINEA_NUEVA">Línea nueva</SelectItem>
              <SelectItem value="PORTABILIDAD">Portabilidad</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Estado</Label>
          <Select
            value={status}
            onValueChange={v => {
              setError(null)
              setStatus(v as SaleVerificationStatus)
            }}
          >
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="COMPLETED">Aprobada</SelectItem>
              <SelectItem value="PENDING">En revisión por administración</SelectItem>
              <SelectItem value="FAILED">Revisar por promotor</SelectItem>
              <SelectItem value="REJECTED">Rechazada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {status === 'FAILED' && (
          <div className="rounded-lg border border-input bg-card p-4">
            <p className="text-xs text-muted-foreground mb-3">El promotor va a ver esto en su TPV para poder corregir la venta.</p>
            <ReviewReasonsFields
              reasons={rejectionReasons}
              onReasonsChange={next => {
                setError(null)
                setRejectionReasons(next)
              }}
              notes={reviewNotes}
              onNotesChange={next => {
                setError(null)
                setReviewNotes(next)
              }}
              showError={error === PROMOTER_FEEDBACK_ERROR}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="edit-reason">
            Motivo del cambio <span className="text-red-600">*</span>
          </Label>
          <Textarea
            id="edit-reason"
            value={reason}
            onChange={e => {
              setError(null)
              setReason(e.target.value)
            }}
            placeholder="Explica por qué editas esta venta (mín. 5 caracteres). Queda registrado con tu nombre y la fecha."
            rows={3}
          />
          {/* El error del comentario al promotor se muestra dentro de su propio bloque,
              no aquí — si no, parecería que el motivo de auditoría es el que está mal. */}
          {error && error !== PROMOTER_FEEDBACK_ERROR && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </FullScreenModal>
  )
}

export default EditSaleDialog
