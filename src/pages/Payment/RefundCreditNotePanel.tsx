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

  const { data, isLoading, error } = useRefundCreditNote(refundId)
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
    const folio = `${creditNote.serie ?? ''}${creditNote.folio ?? ''}`
    return (
      <Section>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                {t('creditNote.issued', { defaultValue: 'Nota de crédito emitida' })}
              </p>
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
  if (!eligibility.eligible) {
    return (
      <Section>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {t('creditNote.title', { defaultValue: 'Nota de crédito (CFDI de Egreso)' })}
          </p>
          <p className="text-xs text-muted-foreground">{eligibility.message}</p>
        </div>
      </Section>
    )
  }

  // ── Se puede emitir ─────────────────────────────────────────────────────────
  const amount = (preview?.amountToCreditCents ?? 0) / 100
  const tipAmount = (preview?.tipRefundCents ?? 0) / 100
  const folioOriginal = preview?.facturaOriginal?.folio ?? ''
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
              defaultValue:
                'La factura original NO se cancela: se emite un comprobante nuevo relacionado a ella por el importe devuelto.',
            })}
          </p>
        </div>

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
                </dl>
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
                  await emit.mutateAsync(refundId)
                  setConfirmOpen(false)
                } catch (err: any) {
                  const status = err?.response?.status
                  const serverMessage = err?.response?.data?.error ?? err?.response?.data?.message
                  const reasons: string[] | undefined = err?.response?.data?.reasons
                  toast({
                    variant: 'destructive',
                    title:
                      status === 502
                        ? t('creditNote.error.pac', { defaultValue: 'El PAC rechazó el timbrado' })
                        : t('creditNote.error.generic', { defaultValue: 'No se pudo emitir la nota de crédito' }),
                    description: reasons?.length ? reasons.join(' · ') : serverMessage,
                  })
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
