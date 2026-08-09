/**
 * ReviewReasonsFields — motivos + observaciones para dejar una venta en
 * "Revisar por promotor" (SaleVerificationStatus.FAILED).
 *
 * Compartido por los DOS caminos que pueden producir ese estado:
 *   - ReviewSaleDialog (modo "reject")
 *   - EditSaleDialog (Estado = "Revisar por promotor")
 *
 * Regla (espejo del backend, `assertPromoterFeedback`): las observaciones son
 * OBLIGATORIAS con mínimo 5 caracteres — un checkbox solo no le dice al promotor
 * CUÁL imagen está mal. Los motivos son opcionales: categorizan para el reporte.
 *
 * Componente controlado: el padre es dueño del estado y de cuándo mostrar el error.
 */
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle } from 'lucide-react'
import { SALE_VERIFICATION_REJECTION_REASON_LABELS, type SaleVerificationRejectionReason } from '@/services/saleVerification.service'

/** Espejo de PROMOTER_FEEDBACK_MIN_CHARS en avoqado-server. */
export const PROMOTER_FEEDBACK_MIN_CHARS = 5

export const PROMOTER_FEEDBACK_ERROR = 'Escribe qué debe corregir el promotor (mínimo 5 caracteres).'

export function isPromoterFeedbackValid(notes: string): boolean {
  return notes.trim().length >= PROMOTER_FEEDBACK_MIN_CHARS
}

const REJECTION_REASONS: SaleVerificationRejectionReason[] = [
  'REVIEW_MISSING_LINKING_IMAGE',
  'REVIEW_PORTABILIDAD',
  'REVIEW_ILLEGIBLE_IMAGES',
  'REVIEW_DUPLICATE_VINCULACION',
  'OTHER',
]

export interface ReviewReasonsFieldsProps {
  reasons: SaleVerificationRejectionReason[]
  onReasonsChange: (reasons: SaleVerificationRejectionReason[]) => void
  notes: string
  onNotesChange: (notes: string) => void
  /** Muestra el error sólo después de un intento de submit. */
  showError?: boolean
}

export function ReviewReasonsFields({ reasons, onReasonsChange, notes, onNotesChange, showError }: ReviewReasonsFieldsProps) {
  const toggle = (reason: SaleVerificationRejectionReason) => {
    onReasonsChange(reasons.includes(reason) ? reasons.filter(r => r !== reason) : [...reasons, reason])
  }

  const invalid = showError && !isPromoterFeedbackValid(notes)

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-bold mb-2 block">Motivos de revisión (opcional)</Label>
        <div className="space-y-2">
          {REJECTION_REASONS.map(reason => (
            <div key={reason} className="flex items-start gap-2">
              <Checkbox id={`reason-${reason}`} checked={reasons.includes(reason)} onCheckedChange={() => toggle(reason)} />
              <Label htmlFor={`reason-${reason}`} className="text-sm leading-tight cursor-pointer">
                {SALE_VERIFICATION_REJECTION_REASON_LABELS[reason]}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="reviewNotes" className="text-sm font-bold mb-2 block">
          Observaciones <span className="text-red-600">*</span>
        </Label>
        <Textarea
          id="reviewNotes"
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          placeholder="Escribe qué debe corregir el promotor. Lo va a leer en su TPV."
          rows={3}
          maxLength={500}
          data-tour="review-promoter-notes"
        />
        <p className="text-[10px] text-muted-foreground mt-1 text-right">{notes.length}/500</p>
      </div>

      {invalid && (
        <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{PROMOTER_FEEDBACK_ERROR}</span>
        </div>
      )}
    </div>
  )
}

export default ReviewReasonsFields
