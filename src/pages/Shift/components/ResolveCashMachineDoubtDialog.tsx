/**
 * Máquina de efectivo · fase 1a · B2 (plan `2026-11-20-maquina-de-efectivo-fase-1a.md`, R4-4): el gerente resuelve, con SU sesión
 * (`cash-machine:resolve`), un cobro cuyo final la PC de la máquina no alcanzó a oír. Teclea lo que ve en la máquina; el SERVIDOR
 * registra la venta o el cierre con `resolvedBy GERENTE`. La regla de importes es la de `validarCierre` del SERVIDOR: aquí sólo
 * evita mandar algo imposible (el SERVIDOR igual lo rechaza con 422). Importes en CENTAVOS enteros; la hora del comprobante en la
 * zona del negocio. Sin hora, la venta queda con hora y turno por conciliar (R5#8). Con una cancelación, el gerente dice además qué
 * VIO hacer a la máquina con el dinero (`cancelMode`, Codex r2 #10): nunca se infiere del desenlace, y «No sé» no deja guardar.
 * Rediseño r3 del SERVIDOR (r6-4): se manda la `version` de la duda que el gerente está viendo. Si llegó evidencia nueva, 409
 * `CASH_MACHINE_DOUBT_CHANGED`: se refresca la lista (la página le pasa la fila nueva), lo tecleado se queda y hay que volver a
 * confirmar con la versión nueva. La respuesta dice si quedó la venta, si quedó como incidencia (dinero sin venta) o si sigue terminándose.
 * H1 del SERVIDOR: la ventana enseña a la vista lo MÁS que la PC vio entrar (`creditCents`), sin pre-llenar lo que teclea el gerente.
 */
import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { DateTime } from 'luxon'
import api from '@/api'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { cashMachineDoubtsKey } from '@/hooks/use-cash-machine-doubts'
import { useToast } from '@/hooks/use-toast'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'

export type CashMachineOutcome = 'PAGADO' | 'CANCELADO' | 'GUARDADO'
/** Lo que el gerente VIO hacer a la máquina con el dinero de una cancelación: '1' lo devolvió, '2' se lo quedó. */
export type CashMachineCancelMode = '1' | '2'
type ModoElegido = CashMachineCancelMode | 'NO_SE'

/** Una fila de `GET /dashboard/venues/:venueId/cash-machine/doubts` (`listarDudasDeLaMaquina`). Importes en CENTAVOS, congelados en
 *  el folio (lo que la PC subió al empezar la duda); null sólo si el folio no existe. */
export interface CashMachineDoubt {
  id: string
  referenceCC: string
  kind?: 'ESPERANDO'
  status: 'ABIERTO' | 'RESUELTO'
  deviceId: string | null
  createdAt: string
  dueCents: number | null
  saleCents: number | null
  tipCents: number | null
  startedAt: string
  /** Lo que vio la PC junto con el MAYOR crédito que vio (H1 del SERVIDOR). */
  lastSeen: unknown
  /** H1 del SERVIDOR: lo MÁS que la PC vio entrar en este folio, en centavos; null = ninguna PC lo dijo en números. */
  creditCents?: number | null
  /** El carrito congelado: el mismo JSON de `POST /orders`. */
  pedido: ({ items?: Array<{ name?: string; quantity?: number; promotionRef?: unknown }> } & Record<string, unknown>) | null
  saleShiftId: string | null
  /** La versión de la evidencia (r6-4): la que se manda al resolver (entero ≥ 1). Sube con cada cosa nueva que vio la PC. */
  version?: number
}

/** «2× Café, Promoción»: el carrito congelado en una línea (la tabla y la ventana dicen lo mismo). */
export const carritoDeLaDuda = (pedido: CashMachineDoubt['pedido'], promocion: string) =>
  (pedido?.items ?? []).map(i => (i.promotionRef ? promocion : `${i.quantity ?? 1}× ${i.name ?? ''}`)).join(', ') || '—'

/** Centavos en pesos; lo que el SERVIDOR no sabe (null: p. ej. un reparto venta/propina que no llegó en números) es «—». */
export const pesosOGuion = (centavos: number | null | undefined) => (typeof centavos === 'number' ? Currency(centavos, true) : '—')

const P = 'cashMachineDoubts.resolve'

/**
 * El aviso de cómo quedó el folio: 200/202 TERMINADO (con o sin venta, y lo que se le debe al cliente) o 202 RECIBIDO. Es la MISMA
 * respuesta al resolver una duda y al terminar un folio «por terminar», así que las dos ventanas dicen lo mismo.
 */
export function useAvisoDelResultado() {
  const { t } = useTranslation('shifts')
  const { toast } = useToast()
  return (res: { status?: number; data?: any }, folio: string) => {
    const d = res.data ?? {}
    const owed = Number(d.owedCents ?? 0)
    const debe = owed > 0 ? { description: t(`${P}.owed`, { amount: Currency(owed, true) }) } : {}
    if (d.ack === 'RECIBIDO') {
      // 202 RECIBIDO: lo que vio el gerente quedó guardado; la venta se termina sola (la PC la reanuda al volver a preguntar).
      toast({ title: t(`${P}.processing`) })
    } else if (d.incident || res.status === 202) {
      // 202 TERMINADO sin venta: el dinero quedó anotado como incidencia (un descuento, un producto borrado…), con lo que se debe.
      const motivo = typeof d.motivo === 'string' ? d.motivo : 'VENTA_RECHAZADA'
      toast({
        title: t(`${P}.notRegistered`, { motivo: t(`${P}.motivos.${motivo}`, { defaultValue: motivo }) }),
        variant: 'destructive',
        ...debe,
      })
    } else {
      toast({ title: t(`${P}.saved`, { folio }), ...debe })
    }
  }
}

/** Lo que el SERVIDOR ya tiene para el folio (409): la evidencia del cierre o la resolución de la duda. */
interface Registrado {
  outcome?: string
  creditCents?: number
  changeDispensedCents?: number
  evidence?: string | null
}

const OUTCOMES: CashMachineOutcome[] = ['PAGADO', 'CANCELADO', 'GUARDADO']
const MODOS: ModoElegido[] = ['1', '2', 'NO_SE']
/** El 409 de una resolución que contradice lo ya registrado (antes `…DOUBT_CONFLICT`, hoy `…CLOSE_CONFLICT`). Otro 409 (p. ej.
 *  `CASH_MACHINE_CLOSE_RETRY`, «intenta otra vez») no es «ya estaba resuelto»: enseña el mensaje del SERVIDOR. */
const CONFLICTOS = ['CASH_MACHINE_CLOSE_CONFLICT', 'CASH_MACHINE_DOUBT_CONFLICT']
const MAX_EVIDENCE = 500 // el tope del SERVIDOR (`resolverDudaDeLaMaquinaSchema`)

/** «200.50» → 20050. Exacto (sin `* 100` de punto flotante); null si no es un importe con hasta 2 decimales. */
export function pesosACentavos(texto: string): number | null {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(texto.trim())
  if (!m) return null
  const centavos = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(centavos) ? centavos : null
}

/** El `datetime-local` tecleado, leído en la zona del NEGOCIO, como ISO UTC. Vacío o inválido → null. */
export function horaDelComprobante(local: string, zona: string): string | null {
  if (!local) return null
  const dt = DateTime.fromISO(local, { zone: zona })
  return dt.isValid ? dt.toUTC().toISO() : null
}

/** Espejo de `validarCierre` del SERVIDOR con importes del gerente. null = posible. `cancelMode` sin elegir no es error aquí. */
export function errorDeLaResolucion(r: {
  outcome: CashMachineOutcome
  creditCents: number
  changeCents: number
  dueCents: number
  cancelMode?: CashMachineCancelMode | null
}): { key: string; params?: Record<string, string> } | null {
  const { outcome, creditCents, changeCents, dueCents, cancelMode } = r
  if (outcome === 'PAGADO') {
    if (creditCents < dueCents) return { key: 'paidNeedsFull', params: { due: Currency(dueCents, true) } }
    if (changeCents > creditCents - dueCents) return { key: 'changeTooHigh', params: { max: Currency(creditCents - dueCents, true) } }
    return null
  }
  if (creditCents >= dueCents) return { key: 'cancelNeedsLess', params: { due: Currency(dueCents, true) } }
  if (outcome === 'GUARDADO') {
    if (changeCents !== 0) return { key: 'keptMustBeZero' }
  } else if (changeCents > creditCents) return { key: 'refundTooHigh' }
  if (cancelMode && cancelMode !== (outcome === 'GUARDADO' ? '2' : '1')) return { key: 'cancelModeMismatch' }
  return null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
  doubt: CashMachineDoubt
}

export function ResolveCashMachineDoubtDialog({ open, onOpenChange, venueId, doubt }: Props) {
  const { t } = useTranslation('shifts')
  const avisar = useAvisoDelResultado()
  const queryClient = useQueryClient()
  const { venueTimezone, formatDateTime } = useVenueDateTime()
  const [outcome, setOutcome] = useState<CashMachineOutcome | null>(null)
  const [modo, setModo] = useState<ModoElegido | null>(null)
  const [recibido, setRecibido] = useState('')
  const [devuelto, setDevuelto] = useState('0')
  const [hora, setHora] = useState('')
  const [evidence, setEvidence] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)
  const [registrado, setRegistrado] = useState<Registrado | null>(null)
  /** Tras un 409 «llegó evidencia nueva»: no se vuelve a mandar hasta que la lista traiga, al menos, la versión que dijo el SERVIDOR. */
  const [versionMinima, setVersionMinima] = useState(0)
  const inFlight = useRef(false) // isPending es estado: dos clics en el mismo tick lo ven viejo

  const version = doubt.version ?? 1
  const dueCents = doubt.dueCents
  const creditCents = recibido.trim() === '' ? null : pesosACentavos(recibido)
  const changeCents = devuelto.trim() === '' ? 0 : pesosACentavos(devuelto)
  const occurredAt = horaDelComprobante(hora, venueTimezone)
  const trimmedEvidence = evidence.trim()
  const montoInvalido = (recibido.trim() !== '' && creditCents === null) || changeCents === null
  const esCancelacion = outcome === 'CANCELADO' || outcome === 'GUARDADO'
  const cancelMode = esCancelacion && (modo === '1' || modo === '2') ? modo : null
  const regla =
    outcome && creditCents !== null && changeCents !== null && dueCents !== null
      ? errorDeLaResolucion({ outcome, creditCents, changeCents, dueCents, cancelMode })
      : null
  const aviso = montoInvalido ? t(`${P}.errors.invalidAmount`) : regla ? t(`${P}.errors.${regla.key}`, regla.params) : null
  const noSabe = esCancelacion && modo === 'NO_SE'
  const lastSeen = doubt.lastSeen == null ? '' : typeof doubt.lastSeen === 'string' ? doubt.lastSeen : JSON.stringify(doubt.lastSeen)

  const refrescar = () => queryClient.invalidateQueries({ queryKey: cashMachineDoubtsKey(venueId) })

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/api/v1/dashboard/venues/${venueId}/cash-machine/doubts/${doubt.referenceCC}/resolve`, {
        outcome,
        creditCents,
        changeDispensedCents: changeCents,
        ...(cancelMode ? { cancelMode } : {}),
        ...(occurredAt ? { occurredAt } : {}),
        evidence: trimmedEvidence,
        version,
      })
      return res
    },
    onSettled: () => {
      inFlight.current = false
    },
    onSuccess: res => {
      avisar(res, doubt.referenceCC)
      refrescar()
      onOpenChange(false)
    },
    onError: (e: any) => {
      const data = e?.response?.data
      if (e?.response?.status === 409 && data?.code === 'CASH_MACHINE_DOUBT_CHANGED') {
        setVersionMinima(Math.max(Number(data?.details?.version) || 0, version + 1))
        setServerError(t(`${P}.changed`))
        refrescar()
        return
      }
      if (e?.response?.status === 409 && CONFLICTOS.includes(data?.code)) {
        setRegistrado(data?.details?.registrado ?? data?.details?.registrada ?? {})
        refrescar()
        return
      }
      setServerError(data?.message || e?.message || '')
    },
  })

  const saving = mutation.isPending
  const canSave =
    !!outcome &&
    (!esCancelacion || !!cancelMode) &&
    creditCents !== null &&
    dueCents !== null &&
    version >= versionMinima &&
    !aviso &&
    trimmedEvidence.length > 0 &&
    trimmedEvidence.length <= MAX_EVIDENCE &&
    !saving

  // Mientras se guarda no se cierra (ni con la X ni con Esc): el resultado tiene que verse.
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
      title={t(`${P}.title`, { folio: doubt.referenceCC })}
      contentClassName="bg-muted/30"
      actions={
        registrado ? (
          <Button variant="outline" className="cursor-pointer" onClick={cerrar}>
            {t(`${P}.close`)}
          </Button>
        ) : (
          <Button className="cursor-pointer" onClick={submit} disabled={!canSave} data-tour="cash-machine-doubt-submit">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t(`${P}.submit`)}
          </Button>
        )
      }
    >
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <section className="space-y-1 rounded-2xl border border-border/50 bg-card p-6 text-sm">
          <p>
            {t(`${P}.due`, {
              due: pesosOGuion(doubt.dueCents),
              sale: pesosOGuion(doubt.saleCents),
              tip: pesosOGuion(doubt.tipCents),
            })}
          </p>
          {typeof doubt.creditCents === 'number' && (
            <p className="text-base font-semibold" data-tour="cash-machine-doubt-seen">
              {t(`${P}.seen`, { amount: Currency(doubt.creditCents, true) })}
            </p>
          )}
          <p className="text-muted-foreground" data-tour="cash-machine-doubt-cart">
            {t(`${P}.cart`, { items: carritoDeLaDuda(doubt.pedido, t('cashMachineDoubts.promotionLine')) })}
          </p>
          <p className="text-muted-foreground">{t(`${P}.startedAt`, { time: formatDateTime(doubt.startedAt) })}</p>
        </section>

        {registrado ? (
          <section className="space-y-2 rounded-2xl border border-border/50 bg-card p-6 text-sm" data-tour="cash-machine-doubt-conflict">
            <p className="font-medium">{t(`${P}.conflict.title`)}</p>
            {registrado.outcome && OUTCOMES.includes(registrado.outcome as CashMachineOutcome) && (
              <p>{t(`${P}.outcomes.${registrado.outcome}.label`)}</p>
            )}
            {typeof registrado.creditCents === 'number' && (
              <p className="text-muted-foreground">{t(`${P}.conflict.received`, { amount: Currency(registrado.creditCents, true) })}</p>
            )}
            {typeof registrado.changeDispensedCents === 'number' && (
              <p className="text-muted-foreground">
                {t(`${P}.conflict.returned`, { amount: Currency(registrado.changeDispensedCents, true) })}
              </p>
            )}
            {registrado.evidence && <p className="text-muted-foreground">{t(`${P}.conflict.evidence`, { text: registrado.evidence })}</p>}
          </section>
        ) : (
          <>
            {lastSeen && (
              <section className="space-y-1 rounded-2xl border border-border/50 bg-card p-6 text-sm">
                <p className="text-muted-foreground">{t(`${P}.lastSeen`)}</p>
                <p className="break-words font-mono text-xs">{lastSeen}</p>
              </section>
            )}

            <section className="space-y-3 rounded-2xl border border-border/50 bg-card p-6">
              <Label>{t(`${P}.whatHappened`)}</Label>
              <RadioGroup
                value={outcome ?? ''}
                onValueChange={v => setOutcome(v as CashMachineOutcome)}
                disabled={saving}
                data-tour="cash-machine-doubt-outcome"
              >
                {OUTCOMES.map(o => (
                  <div key={o} className="flex items-start gap-3 rounded-lg border border-input p-3">
                    <RadioGroupItem
                      value={o}
                      id={`cash-machine-outcome-${o}`}
                      aria-describedby={`cash-machine-outcome-${o}-hint`}
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <Label htmlFor={`cash-machine-outcome-${o}`} className="cursor-pointer font-medium">
                        {t(`${P}.outcomes.${o}.label`)}
                      </Label>
                      <p id={`cash-machine-outcome-${o}-hint`} className="text-xs text-muted-foreground">
                        {t(`${P}.outcomes.${o}.hint`)}
                      </p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </section>

            {esCancelacion && (
              <section className="space-y-3 rounded-2xl border border-border/50 bg-card p-6">
                <Label>{t(`${P}.cancelMode.question`)}</Label>
                <RadioGroup
                  value={modo ?? ''}
                  onValueChange={v => setModo(v as ModoElegido)}
                  disabled={saving}
                  className="grid gap-2 sm:grid-cols-3"
                  data-tour="cash-machine-doubt-cancel-mode"
                >
                  {MODOS.map(m => (
                    <div key={m} className="flex items-center gap-3 rounded-lg border border-input p-3">
                      <RadioGroupItem value={m} id={`cash-machine-cancel-mode-${m}`} />
                      <Label htmlFor={`cash-machine-cancel-mode-${m}`} className="cursor-pointer font-medium">
                        {t(`${P}.cancelMode.${m}`)}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                {noSabe && (
                  <p role="alert" className="text-sm text-destructive">
                    {t(`${P}.cancelMode.unknown`)}
                  </p>
                )}
              </section>
            )}

            <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cash-machine-received">{t(`${P}.received`)}</Label>
                  <Input
                    id="cash-machine-received"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    className="h-12 text-base"
                    value={recibido}
                    disabled={saving}
                    onChange={e => setRecibido(e.target.value)}
                    data-tour="cash-machine-doubt-received"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cash-machine-returned">{t(`${P}.returned`)}</Label>
                  <Input
                    id="cash-machine-returned"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    className="h-12 text-base"
                    value={devuelto}
                    disabled={saving}
                    onChange={e => setDevuelto(e.target.value)}
                    data-tour="cash-machine-doubt-returned"
                  />
                </div>
              </div>

              {aviso && (
                <p role="alert" className="text-sm text-destructive">
                  {aviso}
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="cash-machine-receipt-time">{t(`${P}.receiptTime`)}</Label>
                <Input
                  id="cash-machine-receipt-time"
                  type="datetime-local"
                  className="h-12 text-base"
                  value={hora}
                  disabled={saving}
                  onChange={e => setHora(e.target.value)}
                  data-tour="cash-machine-doubt-receipt-time"
                />
                <p className="text-xs text-muted-foreground">{t(`${P}.receiptTimeHelp`)}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cash-machine-evidence">{t(`${P}.evidence`)}</Label>
                <Textarea
                  id="cash-machine-evidence"
                  className="text-base"
                  value={evidence}
                  maxLength={MAX_EVIDENCE}
                  disabled={saving}
                  placeholder={t(`${P}.evidencePlaceholder`)}
                  onChange={e => setEvidence(e.target.value)}
                  data-tour="cash-machine-doubt-evidence"
                />
              </div>

              {serverError && (
                <p role="alert" className="text-sm text-destructive">
                  {serverError}
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </FullScreenModal>
  )
}
