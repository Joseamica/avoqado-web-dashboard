/**
 * Nota de crédito (CFDI de Egreso) de un reembolso.
 *
 * 🔴 Decisión del founder (2026-08-18): tras un reembolso la VENTA ORIGINAL NO se modifica
 * y su factura NO se cancela. El comprobante de la devolución es un documento fiscal NUEVO
 * —CFDI de Egreso— RELACIONADO a la factura original (TipoRelacion 01, uso G02) por el
 * importe devuelto. Se emite MANUALMENTE con este botón: nunca en automático, porque
 * timbrar es irreversible.
 *
 * Reglas del workspace que este panel implementa a propósito:
 *   - **Apagado se VE y se EXPLICA**: si el local no tiene CFDI, o la venta no está
 *     facturada, el panel NO desaparece — dice por qué y a quién pedirlo.
 *   - La elegibilidad la decide el SERVIDOR (`eligibility`), no la UI: así el botón no
 *     puede prometer algo que el backend va a rechazar.
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { useEmitRefundCreditNote, useRefundCreditNote } from '@/hooks/use-cfdi'
import type { AlternativaPorImporte, DesgloseDeNota, RedondeoDeNota } from '@/services/cfdi.service'
import { Currency } from '@/utils/currency'
import { Download, FileText, Lock } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface RefundCreditNotePanelProps {
  /** Id del pago de tipo REFUND que se ampara. */
  refundId: string
}

export function RefundCreditNotePanel({ refundId }: RefundCreditNotePanelProps) {
  const { t } = useTranslation('cfdi')
  const { can } = useAccess()
  const { toast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [porImporteOpen, setPorImporteOpen] = useState(false)

  const { data, isLoading, error, refetch, esperaDelXmlAgotada, volverAConsultar } = useRefundCreditNote(refundId)
  const emit = useEmitRefundCreditNote()

  // El local NO tiene la feature CFDI (403). Apagado se VE y se EXPLICA: se pinta el
  // punto de entrada, qué falta y a quién pedírselo — nunca desaparece en silencio.
  const planLocked = (error as any)?.response?.status === 403
  if (planLocked) {
    return (
      <Section>
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {t('creditNote.title', { defaultValue: 'Nota de crédito (CFDI de Egreso)' })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('creditNote.planLocked', {
                defaultValue:
                  'La facturación (CFDI) no está activa en este local, así que no se puede emitir la nota de crédito de esta devolución. Actívala en tu plan o pídeselo al dueño de la cuenta.',
              })}
            </p>
          </div>
        </div>
      </Section>
    )
  }

  if (isLoading || !data) return null

  const { creditNote, eligibility, preview } = data

  // ── Ya emitida ──────────────────────────────────────────────────────────────
  if (creditNote && creditNote.status === 'STAMPED') {
    // C2 · ronda QA (D7): como lo escribe la lista de Facturas («A-7»).
    const folio = [creditNote.serie, creditNote.folio].filter(Boolean).join('-')
    return (
      <Section>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">{t('creditNote.issued', { defaultValue: 'Nota de crédito emitida' })}</p>
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {t('creditNote.badge', { defaultValue: 'CFDI de Egreso' })}
              </Badge>
            </div>
            {folio && <p className="text-xs text-muted-foreground">{folio}</p>}
            <p className="break-all font-mono text-[11px] text-muted-foreground">{creditNote.uuid}</p>
            <p className="text-xs text-muted-foreground">{Currency(creditNote.totalCents / 100)}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            {creditNote.pdfUrl && (
              <Button asChild variant="outline" size="sm" className="cursor-pointer">
                <a href={creditNote.pdfUrl} target="_blank" rel="noreferrer">
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {t('creditNote.pdf', { defaultValue: 'PDF' })}
                </a>
              </Button>
            )}
            {creditNote.xmlUrl && (
              <Button asChild variant="outline" size="sm" className="cursor-pointer">
                <a href={creditNote.xmlUrl} target="_blank" rel="noreferrer">
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {t('creditNote.xml', { defaultValue: 'XML' })}
                </a>
              </Button>
            )}
          </div>
        </div>
      </Section>
    )
  }

  // ── No procede: se DICE por qué (nunca se esconde en silencio) ──────────────
  // C2 (Tarea 9, P10): si por artículos falta evidencia de lo facturado, el servidor ofrece «acreditar por importe»; la persona lo elige
  // viendo el importe y el reparto. Nunca se elige solo.
  if (!eligibility.eligible) {
    const alternativa = preview?.alternativa
    return (
      <Section>
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {t('creditNote.title', { defaultValue: 'Nota de crédito (CFDI de Egreso)' })}
            </p>
            {/* C2 · T10: mientras se recupera el XML de la original, el texto del plan (el panel vuelve a consultar cada 15 s); sin
                `message` del servidor, el texto del motivo (N4). */}
            {/* C2 · ronda QA (D2): la nota quedó EN DUDA (`recoveryOnly`): lo que está en espera es la NOTA. El texto del servidor
                (`PROCESANDO`) habla de «la factura de esta venta» e invita a reintentar. */}
            <p className="text-xs text-muted-foreground">
              {data.recoveryOnly
                ? t('creditNote.error.inDoubt')
                : eligibility.reason === 'ESPERA_XML'
                  ? t(esperaDelXmlAgotada ? 'creditNote.waitingXmlStopped' : 'creditNote.waitingXml')
                  : (eligibility.message ?? (eligibility.reason ? t(`creditNote.reason.${eligibility.reason}`) : null))}
            </p>
            {/* C2 · ronda QA (D3): el aviso de la facturación apagada también en «Acreditar por importe» (como en la rama elegible). */}
            {alternativa && preview?.avisoFacturacionApagada && (
              <p className="text-xs text-muted-foreground">{preview.avisoFacturacionApagada}</p>
            )}
          </div>
          {/* T10 ronda 1 (M4): la espera del XML ya no consulta sola (tope ≈2 min): la persona decide cuándo volver a preguntar. */}
          {eligibility.reason === 'ESPERA_XML' && esperaDelXmlAgotada && (
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => volverAConsultar()}>
              {t('creditNote.retryXml')}
            </Button>
          )}
          {alternativa &&
            (can('cfdi:issue') ? (
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={emit.isPending}
                onClick={() => setPorImporteOpen(true)}
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                {t('creditNote.byAmount.button', { defaultValue: 'Acreditar por importe' })}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('creditNote.noPermission', {
                  defaultValue: 'No tienes permiso para facturar. Pídeselo a un administrador de este local.',
                })}
              </p>
            ))}
        </div>
        {alternativa && (
          <PorImporteDialog
            open={porImporteOpen}
            onOpenChange={setPorImporteOpen}
            alternativa={alternativa}
            amountCents={preview?.amountToCreditCents ?? 0}
            folio={preview?.facturaOriginal?.etiqueta ?? preview?.facturaOriginal?.folio ?? ''}
            uuid={preview?.facturaOriginal?.uuid ?? ''}
            esGlobal={preview?.facturaOriginal?.esGlobal === true}
            receptor={preview?.receptor ?? null}
            tipCents={preview?.tipRefundCents ?? 0}
            pending={emit.isPending}
            onConfirm={async () => {
              try {
                await emit.mutateAsync({ refundId, eleccion: { modalidad: 'POR_IMPORTE', huella: alternativa.huella } })
                setPorImporteOpen(false)
              } catch (err: any) {
                const status = err?.response?.status
                toast(avisoDelFallo(err, t))
                // 409 (p. ej. «El reparto cambió desde la vista previa»): se cierra y se recarga la vista previa, para que la persona
                // revise el reparto NUEVO antes de volver a confirmar.
                if (status === 409) {
                  setPorImporteOpen(false)
                  void refetch()
                }
              }
            }}
          />
        )}
      </Section>
    )
  }

  // ── Se puede emitir ─────────────────────────────────────────────────────────
  const amount = (preview?.amountToCreditCents ?? 0) / 100
  const tipAmount = (preview?.tipRefundCents ?? 0) / 100
  // C2 · ronda QA (D7): con el formato de la lista si el servidor lo manda.
  const folioOriginal = preview?.facturaOriginal?.etiqueta ?? preview?.facturaOriginal?.folio ?? ''
  const esGlobal = preview?.facturaOriginal?.esGlobal === true
  const canIssue = can('cfdi:issue')

  return (
    <Section>
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {t('creditNote.title', { defaultValue: 'Nota de crédito (CFDI de Egreso)' })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('creditNote.help', {
              defaultValue: 'La factura original NO se cancela: se emite un comprobante nuevo relacionado a ella por el importe devuelto.',
            })}
          </p>
          {/* C2 · T10: la original es la factura global del periodo; la nota va a Público en General. */}
          {esGlobal && <p className="text-xs font-medium text-foreground">{t('creditNote.global')}</p>}
          {preview?.avisoFacturacionApagada && <p className="text-xs text-muted-foreground">{preview.avisoFacturacionApagada}</p>}
        </div>

        {/* C2 · T10: lo que se acredita de cada tasa (total, base e IVA) y el redondeo que lleva, declarado. */}
        {preview?.desglose && preview.desglose.length > 0 && (
          <div className="space-y-1.5 rounded-lg border border-input p-3 text-xs">
            <dl className="space-y-1.5" data-testid="desglose-de-la-nota">
              <FilasDelDesglose desglose={preview.desglose} />
            </dl>
            <LineasDeRedondeo redondeo={preview.redondeo ?? []} />
          </div>
        )}

        {canIssue ? (
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            data-tour="refund-credit-note-btn"
            disabled={emit.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            {t('creditNote.cta', { defaultValue: 'Emitir nota de crédito' })}
          </Button>
        ) : (
          // Sin permiso tampoco desaparece: se dice a quién pedírselo.
          <p className="text-xs text-muted-foreground">
            {t('creditNote.noPermission', {
              defaultValue: 'No tienes permiso para facturar. Pídeselo a un administrador de este local.',
            })}
          </p>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('creditNote.confirm.title', { defaultValue: '¿Emitir la nota de crédito?' })}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  {t('creditNote.confirm.body', {
                    amount: Currency(amount),
                    folio: folioOriginal,
                    defaultValue: `Se timbrará ante el SAT una nota de crédito por ${Currency(amount)} relacionada a la factura ${folioOriginal}.`,
                  })}
                </p>
                <dl className="space-y-1.5 rounded-lg border border-input p-3 text-xs">
                  <Row label={t('creditNote.confirm.amount', { defaultValue: 'Importe a acreditar' })} value={Currency(amount)} />
                  <Row
                    label={t('creditNote.confirm.relatedInvoice', { defaultValue: 'Factura relacionada' })}
                    value={folioOriginal || '-'}
                  />
                  <Row
                    label={t('creditNote.confirm.relatedUuid', { defaultValue: 'UUID relacionado' })}
                    value={preview?.facturaOriginal?.uuid ?? '-'}
                    mono
                  />
                  <Row label={t('creditNote.confirm.receptor', { defaultValue: 'Receptor' })} value={preview?.receptor?.nombre ?? '-'} />
                  <Row label={t('creditNote.confirm.rfc', { defaultValue: 'RFC' })} value={preview?.receptor?.rfc ?? '-'} mono />
                  {preview?.desglose && <FilasDelDesglose desglose={preview.desglose} />}
                </dl>
                <LineasDeRedondeo redondeo={preview?.redondeo ?? []} />
                {tipAmount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t('creditNote.confirm.tipExcluded', {
                      tip: Currency(tipAmount),
                      defaultValue: `La propina devuelta (${Currency(tipAmount)}) no entra: nunca formó parte de la factura.`,
                    })}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('creditNote.confirm.irreversible', {
                    defaultValue: 'Esto es irreversible: deshacerlo obliga a cancelar la nota de crédito ante el SAT.',
                  })}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">{t('creditNote.confirm.cancel', { defaultValue: 'Cancelar' })}</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              disabled={emit.isPending}
              onClick={async e => {
                // Se evita el cierre automático para poder mantener el diálogo si falla.
                e.preventDefault()
                try {
                  // T10 ronda 1 (M9): con la huella de la vista previa que se vio (un servidor anterior no la manda: el POST de siempre).
                  await emit.mutateAsync(preview?.huella ? { refundId, huella: preview.huella } : refundId)
                  setConfirmOpen(false)
                } catch (err: any) {
                  const status = err?.response?.status
                  toast(avisoDelFallo(err, t))
                  // T10 ronda 1 (M9): un 409 («La factura cambió…») cierra y recarga la vista previa, para revisar la nota NUEVA.
                  if (status === 409) {
                    setConfirmOpen(false)
                    void refetch()
                  }
                }
              }}
            >
              {emit.isPending
                ? t('creditNote.confirm.submitting', { defaultValue: 'Emitiendo…' })
                : t('creditNote.confirm.submit', { defaultValue: 'Emitir' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  )
}

/**
 * El aviso de un POST de la nota que no timbró. C2 · ronda QA (D1): un 502 con `timbreEnDuda` NO es un rechazo: el PAC no contestó claro y
 * la nota quedó en espera de confirmación (no se vuelve a emitir). Un 502 de rechazo lleva el porqué del PAC (`message`), no el mismo
 * «El PAC rechazó el timbrado» del título dos veces.
 */
function avisoDelFallo(err: any, t: (key: string, opts?: Record<string, unknown>) => string) {
  const status = err?.response?.status
  const data = err?.response?.data ?? {}
  if (status === 502 && data.timbreEnDuda)
    return { variant: 'destructive' as const, title: t('creditNote.error.pacNoAnswer'), description: t('creditNote.error.inDoubt') }
  const reasons: string[] | undefined = data.reasons
  return {
    variant: 'destructive' as const,
    title:
      status === 502
        ? t('creditNote.error.pac', { defaultValue: 'El PAC rechazó el timbrado' })
        : t('creditNote.error.generic', { defaultValue: 'No se pudo emitir la nota de crédito' }),
    description: reasons?.length ? reasons.join(' · ') : status === 502 ? (data.message ?? data.error) : (data.error ?? data.message),
  }
}

/** C2 (Tarea 9): el diálogo de «acreditar por importe»: el total, el reparto por tasa (base, IVA, total), el redondeo y el aviso. */
function PorImporteDialog({
  open,
  onOpenChange,
  alternativa,
  amountCents,
  folio,
  uuid,
  esGlobal,
  receptor,
  tipCents,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  alternativa: AlternativaPorImporte
  amountCents: number
  folio: string
  uuid: string
  /** T9 ronda 1 (M-3): la original es la factura global; lo que queda es lo del ticket. */
  esGlobal: boolean
  receptor: { rfc: string; nombre: string } | null
  tipCents: number
  pending: boolean
  onConfirm: () => Promise<void>
}) {
  const { t } = useTranslation('cfdi')
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('creditNote.byAmount.title', { defaultValue: 'Acreditar lo devuelto por importe' })}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                {esGlobal
                  ? t('creditNote.byAmount.explainGlobal', {
                      defaultValue:
                        'Avoqado no puede comprobar cuánto se facturó de cada artículo de esta devolución. Puedes acreditar lo devuelto repartido por tasa en proporción a lo que queda de este ticket en la factura global.',
                    })
                  : t('creditNote.byAmount.explain', {
                      defaultValue:
                        'Avoqado no puede comprobar cuánto se facturó de cada artículo de esta devolución. Puedes acreditar lo devuelto repartido por tasa en proporción a lo que queda en la factura.',
                    })}
              </p>
              <dl className="space-y-1.5 rounded-lg border border-input p-3 text-xs" data-testid="reparto-por-importe">
                <Row label={t('creditNote.byAmount.total', { defaultValue: 'Total a acreditar' })} value={Currency(amountCents / 100)} />
                <Row label={t('creditNote.confirm.relatedInvoice', { defaultValue: 'Factura relacionada' })} value={folio || '-'} />
                {/* T9 ronda 1 (M-4): lo mismo que enseña el diálogo normal. */}
                <Row label={t('creditNote.confirm.relatedUuid', { defaultValue: 'UUID relacionado' })} value={uuid || '-'} mono />
                <Row label={t('creditNote.confirm.receptor', { defaultValue: 'Receptor' })} value={receptor?.nombre ?? '-'} />
                <Row label={t('creditNote.confirm.rfc', { defaultValue: 'RFC' })} value={receptor?.rfc ?? '-'} mono />
                <FilasDelDesglose desglose={alternativa.desglose} />
              </dl>
              {/* T9 ronda 1 (M-5): el ámbito. T10: el mismo texto que el diálogo normal (y «hasta N ¢» en el documento global, N4 de la T8). */}
              <LineasDeRedondeo redondeo={alternativa.redondeo} />
              {alternativa.aviso && <p className="text-xs font-medium text-foreground">{alternativa.aviso}</p>}
              {tipCents > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('creditNote.confirm.tipExcluded', {
                    tip: Currency(tipCents / 100),
                    defaultValue: `La propina devuelta (${Currency(tipCents / 100)}) no entra: nunca formó parte de la factura.`,
                  })}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t('creditNote.confirm.irreversible', {
                  defaultValue: 'Esto es irreversible: deshacerlo obliga a cancelar la nota de crédito ante el SAT.',
                })}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">{t('creditNote.confirm.cancel', { defaultValue: 'Cancelar' })}</AlertDialogCancel>
          <AlertDialogAction
            className="cursor-pointer"
            disabled={pending}
            onClick={async e => {
              // Se evita el cierre automático: el diálogo se cierra al timbrar, o al recargar el reparto tras un 409.
              e.preventDefault()
              await onConfirm()
            }}
          >
            {pending
              ? t('creditNote.confirm.submitting', { defaultValue: 'Emitiendo…' })
              : t('creditNote.byAmount.confirm', { defaultValue: 'Confirmar y emitir' })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** C2 · T10: la tasa como la lee el dueño («IVA 16 %»); exento y no objeto, por su nombre. */
const TASA: Partial<Record<string, string>> = { IVA_16: '16 %', IVA_8: '8 %', IVA_0: '0 %' }
function useNombreDeLaTasa() {
  const { t } = useTranslation('cfdi')
  return (tratamiento: string) =>
    TASA[tratamiento]
      ? t('creditNote.breakdown', { tasa: TASA[tratamiento], defaultValue: `IVA ${TASA[tratamiento]}` })
      : t(`creditNote.tratamiento.${tratamiento}`, { defaultValue: tratamiento })
}

/** C2 · T10: una fila por tratamiento: total (base + IVA). La usan el panel, la confirmación y «acreditar por importe». */
function FilasDelDesglose({ desglose }: { desglose: DesgloseDeNota[] }) {
  const { t } = useTranslation('cfdi')
  const nombre = useNombreDeLaTasa()
  return (
    <>
      {desglose.map(d => (
        <Row
          key={d.tratamiento}
          label={nombre(d.tratamiento)}
          value={t('creditNote.byAmount.row', {
            total: Currency(d.cents / 100),
            base: Currency(d.baseCents / 100),
            iva: Currency(d.ivaCents / 100),
            defaultValue: `${Currency(d.cents / 100)} (base ${Currency(d.baseCents / 100)} + IVA ${Currency(d.ivaCents / 100)})`,
          })}
        />
      ))}
    </>
  )
}

/**
 * C2 · T10 (P8, Codex C2-15): cada centavo de redondeo que lleva la nota, declarado: «Incluye 1 ¢ de redondeo del SAT en la base.» (o «en el
 * IVA», o «en un artículo»), con su tasa delante y su ámbito detrás. 🔴 N4 de la T8: el del documento global es una COTA (la suma de las notas
 * vivas; de más si una se cancela o se recaptura, nunca de menos) ⇒ «hasta N ¢ … (de la factura global)».
 */
function LineasDeRedondeo({ redondeo }: { redondeo: RedondeoDeNota[] }) {
  const { t } = useTranslation('cfdi')
  const nombre = useNombreDeLaTasa()
  if (redondeo.length === 0) return null
  const clave: Partial<Record<string, string>> = {
    BASE: 'creditNote.roundingBase',
    IVA: 'creditNote.roundingIva',
    ARTICULO: 'creditNote.roundingArticle',
  }
  const ambito: Partial<Record<string, string>> = { TICKET: 'creditNote.roundingTicket', DOCUMENTO_GLOBAL: 'creditNote.roundingDocument' }
  return (
    <>
      {redondeo.map((r, i) => {
        const cents = r.ambito === 'DOCUMENTO_GLOBAL' ? t('creditNote.roundingUpTo', { cents: r.cents }) : r.cents
        // T10 ronda 1 (M7): un componente que esta pantalla no conoce no se pinta como «en la base» (sería falso): el texto sin el dónde.
        const texto = t(clave[r.componente] ?? 'creditNote.roundingGeneric', { cents })
        // T10 ronda 1 (M7, nit): el ámbito va ANTES del punto («… en el IVA (de la factura global).»).
        const donde = ambito[r.ambito] ? ` ${t(ambito[r.ambito]!)}` : ''
        const conDonde = donde ? `${texto.replace(/\.$/, '')}${donde}.` : texto
        return (
          <p key={i} className="text-xs text-muted-foreground">
            {`${nombre(r.tratamiento)}: ${conDonde}`}
          </p>
        )
      })}
    </>
  )
}

function Section({ children }: { children: ReactNode }) {
  return <div className="space-y-2 border-t border-border/60 pt-4">{children}</div>
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={`min-w-0 break-all text-right text-foreground ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</dd>
    </div>
  )
}
