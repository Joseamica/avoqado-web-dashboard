import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAccess } from '@/hooks/use-access'
import { useInvalidatePasses, usePassesAccess } from '@/hooks/use-passes'
import { useToast } from '@/hooks/use-toast'
import { isValidSpots, readSpots } from '@/pages/Settings/components/passes/passesFormat'
import { setSessionPassCap } from '@/services/passes.service'
import { apiErrorDescription } from '@/utils/apiError'
import type { SessionPasses } from '@/types/passes'

interface SessionPassCapFieldProps {
  venueId: string
  sessionId: string
  passes: SessionPasses
}

/**
 * Capa 3 de los lugares para pases (spec §6): el ajuste de UNA sesión desde el calendario. Tiene su propio botón y
 * su propia mutación —no entra al formulario de la clase— para que «vacío = regla del día/horario o general» viaje como
 * `null` y no ensucie el `isDirty` del formulario ni se pierda si el dueño sólo cambia esto.
 *
 * Editar el cupo es comportamiento de PAGO: sólo con el plan comprobado y concedido (P1-2). Recibir `passes` del server
 * no demuestra tener el plan (la conexión puede sobrevivir a una baja de plan). El permiso es el que pide el server para
 * guardar (`reservations:manage-passes`), aparte del plan, para que el motivo de sólo lectura sea el verdadero.
 */
export function SessionPassCapField({ venueId, sessionId, passes }: SessionPassCapFieldProps) {
  const { t } = useTranslation('reservations')
  const { toast } = useToast()
  const { can } = useAccess()
  const { hasFeature, resolved, unresolved } = usePassesAccess(venueId)
  const invalidate = useInvalidatePasses()
  // Borrador atado al valor del server sobre el que se tecleó (mismo patrón que el tope general, R2b-20): si el server
  // trae OTRO valor (el guardado, u otro administrador), gana el nuevo; si no, lo tecleado se queda.
  const [draft, setDraft] = useState<{ base: number | null; value: number | null } | null>(null)
  const value = draft && draft.base === passes.sessionCap ? draft.value : passes.sessionCap

  // onSuccess y onError DEVUELVEN la recarga (R2b-17): el campo sigue deshabilitado hasta que calendario y sesión se
  // refrescaron, y tras un error se ve lo que de verdad quedó guardado.
  const save = useMutation({
    mutationFn: (maxSpots: number | null) => setSessionPassCap(venueId, sessionId, maxSpots),
    onSuccess: () => {
      toast({ title: t('classSession.sessionPassCap.saved') })
      return invalidate(venueId, 'rules')
    },
    onError: (error: unknown) => {
      toast({ variant: 'destructive', title: apiErrorDescription(error) || t('toasts.error') })
      return invalidate(venueId, 'rules')
    },
  })

  const readOnly = (reason?: string) => (
    <div className="rounded-lg bg-muted/50 p-3 text-sm">
      <p>{t('classSession.passes', { taken: passes.taken, cap: passes.cap })}</p>
      {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
    </div>
  )
  if (!can('reservations:manage-passes')) return readOnly(t('classSession.sessionPassCap.readOnly'))
  // Mientras el plan carga no se acusa «no tienes el plan»: sólo el dato.
  if (!resolved) return readOnly(unresolved ? t('classSession.sessionPassCap.planUnresolved') : undefined)
  if (!hasFeature) return readOnly(t('classSession.sessionPassCap.planRequired'))

  // `NaN` = algo que no es número («-», «e»): inválido y distinto del server.
  const valid = value === null || isValidSpots(value)
  const dirty = value !== passes.sessionCap
  const canSave = dirty && valid && !save.isPending
  return (
    <div className="space-y-1.5" data-tour="class-session-pass-cap">
      <Label htmlFor="edit-pass-cap">{t('classSession.sessionPassCap.label')}</Label>
      <div className="flex items-center gap-2">
        <Input
          id="edit-pass-cap"
          type="number"
          min={0}
          max={500}
          step={1}
          className="w-28"
          value={Number.isNaN(value) ? '' : (value ?? '')}
          onChange={e => setDraft({ base: passes.sessionCap, value: readSpots(e.target) })}
          // Está dentro del <form> de la clase: Enter lo mandaría (guarda la clase y cierra sin guardar esto).
          onKeyDown={e => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            if (canSave) save.mutate(value)
          }}
          disabled={save.isPending}
          aria-invalid={!valid}
          aria-describedby="edit-pass-cap-help"
          data-tour="class-session-pass-cap-input"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canSave}
          onClick={() => save.mutate(value)}
          data-tour="class-session-pass-cap-save"
        >
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('classSession.sessionPassCap.save')}
        </Button>
        {/* Este botón es aparte del «Guardar» de la clase: lo tecleado y no guardado se dice a la vista. */}
        {dirty && !save.isPending && (
          <span className="text-xs font-medium text-muted-foreground">{t('classSession.sessionPassCap.unsaved')}</span>
        )}
      </div>
      <p id="edit-pass-cap-help" className={valid ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>
        {valid ? t('classSession.sessionPassCap.hint', { count: passes.taken }) : t('classSession.sessionPassCap.invalid')}
      </p>
    </div>
  )
}
