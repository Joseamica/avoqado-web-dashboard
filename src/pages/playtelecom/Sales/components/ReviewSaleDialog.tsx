/**
 * ReviewSaleDialog
 *
 * Back-office documentation review dialog (PlayTelecom / Walmart).
 *
 * Three modes:
 *   - "approve": one-click confirmation that the sale's documentation is correct
 *   - "reject": back-office picks rejection reason(s) + optional notes; promoter sees feedback in TPV and CAN correct it
 *   - "mark-rejected": terminal "Rechazada" — sale lost (couldn't link/port, customer gone); no promoter correction
 *
 * Submitting any mode calls PATCH /sale-verifications/:id/review and the backend
 * emits `sale-verification.reviewed` to the promoter so their TPV refreshes in real time.
 */

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { CheckCircle2, XCircle, Ban, Loader2, AlertTriangle } from 'lucide-react'
import {
  reviewSaleVerification,
  SALE_VERIFICATION_REJECTION_REASON_LABELS,
  type SaleVerification,
  type SaleVerificationRejectionReason,
  type ReviewSaleVerificationParams,
} from '@/services/saleVerification.service'
import { reviewOrgSaleVerification } from '@/services/saleVerification.org.service'

export type ReviewMode = 'approve' | 'reject' | 'mark-rejected'

/**
 * Minimal shape required for the dialog. Both venue-scoped `SaleVerification`
 * and org-scoped `OrgSaleRow` satisfy this — keeps the dialog reusable across
 * both surfaces without coupling to either type fully.
 *
 * `payment.order.orderNumber` is venue-scoped only (org list doesn't surface
 * it). When missing, the dialog falls back to the verification's `id` as a
 * tracking handle.
 */
export interface ReviewableSale {
  id: string
  staff?: { firstName: string; lastName: string } | null
  /** Optional. Venue-scoped SaleVerification surfaces the order number; org-scoped rows don't. */
  payment?: unknown
}

interface ReviewSaleDialogProps {
  open: boolean
  mode: ReviewMode
  verification: ReviewableSale | null
  /** Provide ONE of these. Org scope takes precedence when both are given. */
  venueId?: string
  orgId?: string
  onClose: () => void
  /** Optional callback fired after a successful review. */
  onReviewed?: (updated: SaleVerification | unknown) => void
}

const REJECTION_REASONS: SaleVerificationRejectionReason[] = [
  'REVIEW_MISSING_LINKING_IMAGE',
  'REVIEW_PORTABILIDAD',
  'REVIEW_ILLEGIBLE_IMAGES',
  'REVIEW_DUPLICATE_VINCULACION',
  'OTHER',
]

export function ReviewSaleDialog({ open, mode, verification, venueId, orgId, onClose, onReviewed }: ReviewSaleDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedReasons, setSelectedReasons] = useState<SaleVerificationRejectionReason[]>([])
  const [reviewNotes, setReviewNotes] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  // Reset state whenever the dialog opens or the target verification changes
  useEffect(() => {
    if (open) {
      setSelectedReasons([])
      setReviewNotes('')
      setValidationError(null)
    }
  }, [open, verification?.id, mode])

  const reviewMutation = useMutation({
    mutationFn: (params: ReviewSaleVerificationParams) => {
      if (!verification) throw new Error('No verification selected')
      // Org scope takes precedence — back-office reviewing across all venues.
      if (orgId) {
        return reviewOrgSaleVerification(orgId, verification.id, params)
      }
      if (!venueId) throw new Error('Either venueId or orgId is required')
      return reviewSaleVerification(venueId, verification.id, params)
    },
    onSuccess: updated => {
      toast({
        title:
          mode === 'approve' ? 'Venta confirmada' : mode === 'mark-rejected' ? 'Venta rechazada' : 'Documentación marcada para revisar',
        description:
          mode === 'approve'
            ? 'El promotor verá la venta como correcta en la TPV.'
            : mode === 'mark-rejected'
              ? 'La venta queda como rechazada. El promotor la verá como rechazada en la TPV.'
              : 'El promotor verá las observaciones en la TPV.',
      })
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ['org', orgId, 'sale-verifications'] })
        queryClient.invalidateQueries({ queryKey: ['org', orgId, 'sales-summary'] })
      }
      if (venueId) {
        queryClient.invalidateQueries({ queryKey: ['sale-verifications', venueId] })
        queryClient.invalidateQueries({ queryKey: ['sale-verifications-summary', venueId] })
      }
      onReviewed?.(updated)
      onClose()
    },
    onError: (error: any) => {
      toast({
        title: 'No se pudo guardar la revisión',
        description: error?.response?.data?.message || error?.message || 'Error desconocido',
        variant: 'destructive',
      })
    },
  })

  const toggleReason = (reason: SaleVerificationRejectionReason) => {
    setValidationError(null)
    setSelectedReasons(prev => (prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]))
  }

  const handleSubmit = () => {
    if (!verification) return

    if (mode === 'reject') {
      const hasReason = selectedReasons.length > 0
      const hasNotes = reviewNotes.trim().length > 0
      if (!hasReason && !hasNotes) {
        setValidationError('Selecciona al menos una opción o escribe una observación.')
        return
      }
    }

    reviewMutation.mutate({
      decision: mode === 'approve' ? 'APPROVE' : mode === 'mark-rejected' ? 'REJECT_FINAL' : 'REJECT',
      // Reasons only apply to the fixable "Revisar" path; an observación is optional otherwise.
      rejectionReasons: mode === 'reject' ? selectedReasons : undefined,
      reviewNotes: mode === 'reject' || mode === 'mark-rejected' ? reviewNotes.trim() || undefined : undefined,
    })
  }

  const isLoading = reviewMutation.isPending
  // Venue-scoped SaleVerification surfaces an order number on payment.order; org-scoped rows don't.
  // Read it best-effort and fall back to verification id (last 6 chars) for a short tracking handle.
  const paymentObj = verification?.payment as { order?: { orderNumber?: string } } | null | undefined
  const orderNumber = paymentObj?.order?.orderNumber ?? (verification ? `…${verification.id.slice(-6)}` : '—')
  const sellerName = verification?.staff ? `${verification.staff.firstName} ${verification.staff.lastName}`.trim() : 'Promotor desconocido'

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && !isLoading && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'approve' ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Confirmar venta
              </>
            ) : mode === 'mark-rejected' ? (
              <>
                <Ban className="w-5 h-5 text-red-600" />
                Rechazar venta
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-yellow-600" />
                Revisar documentación
              </>
            )}
          </DialogTitle>
          <DialogDescription className="space-y-1 pt-2">
            <span className="block">
              <span className="text-muted-foreground">Orden:</span>{' '}
              <span className="font-mono font-bold">{orderNumber}</span>
            </span>
            <span className="block">
              <span className="text-muted-foreground">Promotor:</span>{' '}
              <span className="font-bold">{sellerName}</span>
            </span>
          </DialogDescription>
        </DialogHeader>

        {mode === 'approve' ? (
          <div className="py-2 text-sm text-muted-foreground">
            La venta se marcará como <span className="font-bold text-green-700 dark:text-green-400">VENTA CORRECTA</span>{' '}
            en la TPV del promotor.
          </div>
        ) : mode === 'mark-rejected' ? (
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">
              La venta se marcará como <span className="font-bold text-red-700 dark:text-red-400">RECHAZADA</span>. Úsalo cuando la
              venta se inició pero no se logró vincular/portar la línea y el cliente se perdió. El promotor la verá como rechazada y{' '}
              <span className="font-semibold">no podrá corregirla</span>.
            </div>
            <div>
              <Label htmlFor="reviewNotes" className="text-sm font-bold mb-2 block">
                Motivo (opcional)
              </Label>
              <Textarea
                id="reviewNotes"
                value={reviewNotes}
                onChange={e => {
                  setValidationError(null)
                  setReviewNotes(e.target.value)
                }}
                placeholder="Ej. No se logró la portabilidad, el cliente desistió"
                rows={3}
                maxLength={500}
              />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">{reviewNotes.length}/500</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-bold mb-2 block">Motivos de revisión</Label>
              <div className="space-y-2">
                {REJECTION_REASONS.map(reason => (
                  <div key={reason} className="flex items-start gap-2">
                    <Checkbox
                      id={`reason-${reason}`}
                      checked={selectedReasons.includes(reason)}
                      onCheckedChange={() => toggleReason(reason)}
                    />
                    <Label htmlFor={`reason-${reason}`} className="text-sm leading-tight cursor-pointer">
                      {SALE_VERIFICATION_REJECTION_REASON_LABELS[reason]}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="reviewNotes" className="text-sm font-bold mb-2 block">
                Observaciones (opcional)
              </Label>
              <Textarea
                id="reviewNotes"
                value={reviewNotes}
                onChange={e => {
                  setValidationError(null)
                  setReviewNotes(e.target.value)
                }}
                placeholder="Escribe lo que el promotor necesita revisar"
                rows={3}
                maxLength={500}
              />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">{reviewNotes.length}/500</p>
            </div>

            {validationError && (
              <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className={
              mode === 'approve'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : mode === 'reject'
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
            }
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === 'approve' ? 'Confirmar venta' : mode === 'mark-rejected' ? 'Rechazar venta' : 'Marcar para revisar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ReviewSaleDialog
