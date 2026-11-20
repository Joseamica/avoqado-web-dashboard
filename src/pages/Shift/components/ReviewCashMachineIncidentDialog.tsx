/**
 * Máquina de efectivo · fase 1a (Codex r1 #7, r2 #8): una incidencia de la máquina que NO es duda (importes imposibles, folio con dos
 * versiones, venta sin registrar, folio de una PC desemparejada). El gerente lee su evidencia y la marca como revisada con una nota;
 * no mueve dinero ni cambia el desenlace del folio. Manda la `version` de la evidencia que VIO: si llegó otra mientras la leía, el
 * SERVIDOR contesta 409 `CASH_MACHINE_INCIDENT_CHANGED`, se refresca la lista (la página le pasa la fila nueva) y hay que leerla otra vez.
 */
import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import api from '@/api'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cashMachineDoubtsKey } from '@/hooks/use-cash-machine-doubts'
import { useToast } from '@/hooks/use-toast'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'

export type CashMachineIncidentKind = 'IMPOSIBLE' | 'CONFLICTO' | 'NO_SE_PUDO_REGISTRAR' | 'TRAS_REVOCAR'
const INCIDENT_KINDS: CashMachineIncidentKind[] = ['IMPOSIBLE', 'CONFLICTO', 'NO_SE_PUDO_REGISTRAR', 'TRAS_REVOCAR']

/** Una fila de `GET …/cash-machine/doubts` cuyo `kind` no es `ESPERANDO` (`listarDudasDeLaMaquina`). */
export interface CashMachineIncident {
  id: string
  referenceCC: string
  kind: string
  status: 'ABIERTO' | 'RESUELTO'
  deviceId: string | null
  createdAt: string
  /** Cuántas veces llegó (incluidas las repetidas) y cuántas fueron iguales a la anterior. */
  veces?: number
  repetidas?: number
  /** La versión de la evidencia: la que se confirma al revisar (entero ≥ 1). */
  version?: number
  primerEvento?: unknown
  ultimoEvento?: unknown
  revisiones?: Array<{ nota?: string; en?: string; version?: number }>
}

const MAX_NOTE = 500 // el tope del SERVIDOR (`revisarIncidenciaDeLaMaquinaSchema`)
const P = 'cashMachineDoubts.incidents'

type Evento = {
  recibidoEn?: string
  motivo?: string
  evidence?: string | null
  cierre?: { outcome?: string; creditCents?: number; changeDispensedCents?: number }
}

/** Lo legible de un evento (lo que se sabe leer) y, debajo, el evento completo. */
function Evidencia({ titulo, evento }: { titulo: string; evento: unknown }) {
  const { t } = useTranslation('shifts')
  const { formatDateTime } = useVenueDateTime()
  const e = (evento && typeof evento === 'object' ? evento : {}) as Evento
  const c = e.cierre
  return (
    <div className="space-y-1 rounded-lg border border-input p-3 text-sm">
      <p className="font-medium">{titulo}</p>
      {e.recibidoEn && <p className="text-muted-foreground">{t(`${P}.arrivedAt`, { time: formatDateTime(e.recibidoEn) })}</p>}
      {c?.outcome && <p>{t(`cashMachineDoubts.resolve.outcomes.${c.outcome}.label`, { defaultValue: c.outcome })}</p>}
      {typeof c?.creditCents === 'number' && (
        <p className="text-muted-foreground">
          {t('cashMachineDoubts.resolve.conflict.received', { amount: Currency(c.creditCents, true) })}
        </p>
      )}
      {typeof c?.changeDispensedCents === 'number' && (
        <p className="text-muted-foreground">
          {t('cashMachineDoubts.resolve.conflict.returned', { amount: Currency(c.changeDispensedCents, true) })}
        </p>
      )}
      {e.motivo && <p className="text-muted-foreground">{t(`${P}.reason`, { reason: e.motivo })}</p>}
      {e.evidence && <p className="text-muted-foreground">{t('cashMachineDoubts.resolve.conflict.evidence', { text: e.evidence })}</p>}
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">{t(`${P}.raw`)}</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">{JSON.stringify(evento, null, 2)}</pre>
      </details>
    </div>
  )
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
  incident: CashMachineIncident
}

export function ReviewCashMachineIncidentDialog({ open, onOpenChange, venueId, incident }: Props) {
  const { t } = useTranslation('shifts')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatDateTime } = useVenueDateTime()
  const [note, setNote] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)
  /** La versión que el SERVIDOR rechazó por vieja: no se vuelve a mandar hasta que la lista traiga la nueva. */
  const [versionVieja, setVersionVieja] = useState<number | null>(null)
  const inFlight = useRef(false)

  const version = incident.version ?? 1
  const trimmed = note.trim()
  const kind = (INCIDENT_KINDS as string[]).includes(incident.kind) ? incident.kind : null

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/dashboard/venues/${venueId}/cash-machine/incidents/${incident.id}/review`, { note: trimmed, version }),
    onSettled: () => {
      inFlight.current = false
    },
    onSuccess: () => {
      toast({ title: t(`${P}.reviewed`, { folio: incident.referenceCC }) })
      queryClient.invalidateQueries({ queryKey: cashMachineDoubtsKey(venueId) })
      onOpenChange(false)
    },
    onError: (e: any) => {
      const data = e?.response?.data
      if (e?.response?.status === 409 && data?.code === 'CASH_MACHINE_INCIDENT_CHANGED') {
        setVersionVieja(version)
        setServerError(t(`${P}.changed`))
        queryClient.invalidateQueries({ queryKey: cashMachineDoubtsKey(venueId) })
        return
      }
      setServerError(data?.message || e?.message || '')
    },
  })

  const saving = mutation.isPending
  const canSave = trimmed.length > 0 && trimmed.length <= MAX_NOTE && !saving && versionVieja !== version

  const cerrar = () => {
    if (!saving && !inFlight.current) onOpenChange(false)
  }

  const submit = () => {
    if (!canSave || inFlight.current) return
    inFlight.current = true
    setServerError(null)
    mutation.mutate()
  }

  return (
    <FullScreenModal
      open={open}
      onClose={cerrar}
      title={t(`${P}.title`, { folio: incident.referenceCC })}
      contentClassName="bg-muted/30"
      actions={
        <Button className="cursor-pointer" onClick={submit} disabled={!canSave} data-tour="cash-machine-incident-review-submit">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t(`${P}.markReviewed`)}
        </Button>
      }
    >
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <section className="space-y-1 rounded-2xl border border-border/50 bg-card p-6 text-sm">
          <p className="font-medium">{kind ? t(`${P}.kinds.${kind}.label`) : incident.kind}</p>
          {kind && <p className="text-muted-foreground">{t(`${P}.kinds.${kind}.hint`)}</p>}
          <p className="text-muted-foreground">{t(`${P}.createdAt`, { time: formatDateTime(incident.createdAt) })}</p>
          <p className="text-muted-foreground">
            {t(`${P}.times`, { count: incident.veces ?? 1 })}
            {(incident.repetidas ?? 0) > 0 && ` · ${t(`${P}.repeated`, { count: incident.repetidas })}`}
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-border/50 bg-card p-6" data-tour="cash-machine-incident-evidence">
          <Label>{t(`${P}.evidenceTitle`)}</Label>
          {incident.primerEvento != null && <Evidencia titulo={t(`${P}.firstEvent`)} evento={incident.primerEvento} />}
          {incident.ultimoEvento != null && <Evidencia titulo={t(`${P}.lastEvent`)} evento={incident.ultimoEvento} />}
        </section>

        {(incident.revisiones?.length ?? 0) > 0 && (
          <section className="space-y-2 rounded-2xl border border-border/50 bg-card p-6 text-sm">
            <Label>{t(`${P}.previousReviews`)}</Label>
            {incident.revisiones!.map((r, i) => (
              <p key={i} className="text-muted-foreground">
                {t(`${P}.reviewLine`, { time: r.en ? formatDateTime(r.en) : '—', version: r.version ?? 1, note: r.nota ?? '' })}
              </p>
            ))}
          </section>
        )}

        <section className="space-y-2 rounded-2xl border border-border/50 bg-card p-6">
          <Label htmlFor="cash-machine-incident-note">{t(`${P}.note`)}</Label>
          <Textarea
            id="cash-machine-incident-note"
            className="text-base"
            value={note}
            maxLength={MAX_NOTE}
            disabled={saving}
            placeholder={t(`${P}.notePlaceholder`)}
            onChange={e => setNote(e.target.value)}
            data-tour="cash-machine-incident-note"
          />
          {serverError && (
            <p role="alert" className="text-sm text-destructive">
              {serverError}
            </p>
          )}
        </section>
      </div>
    </FullScreenModal>
  )
}
