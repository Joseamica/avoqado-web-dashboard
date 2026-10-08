/**
 * C1 · Tarea 13 — emitir la factura global COMPLEMENTARIA de una principal (Tarea 11 del servidor).
 *
 * Se pide por el id de la principal, nunca por una fecha (Codex C1-25): el servidor usa el periodo que esa global tiene guardado,
 * aunque la periodicidad del emisor haya cambiado. Antes de timbrar enseña lo que entraría; si el servidor dice que no se puede
 * (`motivo`, p. ej. un año que ya no se admite: C1-33), lo dice y no ofrece «Emitir». La emite sólo una persona: el job nunca.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useEmitGlobalComplementaria, useGlobalComplementariaPreview } from '@/hooks/use-cfdi'
import type { CorregidasPendientes } from '@/services/cfdi.service'
import { GlobalExcluidasDialog } from './GlobalExcluidasDialog'
import { avisoDeError, rangoFiscal, textoDelServidor, useAvisoDeLaGlobal, type Traducir } from './facturaGlobalUi'

export interface GlobalComplementariaDialogProps {
  emisorId: string | null
  /** La global principal; `null` = cerrado. */
  principalId: string | null
  onOpenChange: (open: boolean) => void
}

/** Cuántas ventas entrarían, con la regla de C1-27: exacto, «al menos n», o «no se sabe» (nunca «200 o más»). */
function cuantasEntrarian(t: Traducir, cp: CorregidasPendientes): string {
  if (cp.completo)
    return cp.n > 0 ? t('globalInvoice.complementaryDialog.salesCount', { count: cp.n }) : t('globalInvoice.complementaryDialog.none')
  if (cp.n > 0) return t('globalInvoice.complementaryDialog.salesAtLeast', { count: cp.n })
  return t('globalInvoice.periods.complementaryUnknown')
}

export function GlobalComplementariaDialog({ emisorId, principalId, onOpenChange }: GlobalComplementariaDialogProps) {
  const { t, i18n } = useTranslation('cfdi')
  const { avisarResultado } = useAvisoDeLaGlobal()
  const preview = useGlobalComplementariaPreview(emisorId, principalId)
  const emitir = useEmitGlobalComplementaria()
  const [error, setError] = useState<{ title: string; description?: string } | null>(null)
  const [verExcluidas, setVerExcluidas] = useState(false)

  const open = !!principalId
  const vista = preview.data
  const nadaPendiente = !!vista && vista.corregidasPendientes.completo && vista.corregidasPendientes.n === 0
  // Ronda 2 (T11): `siguienteLlave: null` = el periodo ya tiene 20 complementarias; el servidor rechazaría la 21.ª.
  const sinCupo = !!vista && vista.siguienteLlave === null
  const puedeEmitir = !!vista && !vista.motivo && !nadaPendiente && !sinCupo

  const cerrar = () => {
    setError(null)
    setVerExcluidas(false)
    onOpenChange(false)
  }

  const onEmitir = () => {
    if (!emisorId || !principalId) return
    setError(null)
    emitir.mutate(
      { emisorId, principalId },
      {
        onSuccess: result => {
          // El mismo aviso que el botón de hoy, más qué es una complementaria (se emite tarde por naturaleza).
          avisarResultado(result, { nota: t('globalInvoice.periods.complementaryHelp') })
          cerrar()
        },
        // El texto del servidor se queda EN el diálogo: la persona decide qué hacer sin perder lo que estaba viendo.
        onError: err => setError(avisoDeError(t, err)),
      },
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={o => !o && !emitir.isPending && cerrar()}>
        <DialogContent hasTitle className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('globalInvoice.complementaryDialog.title')}</DialogTitle>
            <DialogDescription>{t('globalInvoice.complementaryDialog.description')}</DialogDescription>
          </DialogHeader>

          {preview.isLoading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('globalInvoice.complementaryDialog.loading')}
            </p>
          )}

          {preview.isError && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {textoDelServidor(preview.error) ?? t('globalInvoice.complementaryDialog.loadError')}
            </p>
          )}

          {vista && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t('globalInvoice.complementaryDialog.period')}</dt>
              <dd>{rangoFiscal(vista.periodo.desde, vista.periodo.hasta, i18n.language)}</dd>
              <dt className="text-muted-foreground">{t('globalInvoice.complementaryDialog.principal')}</dt>
              <dd>{vista.estadoPrincipal === 'TIMBRADA' ? t('globalInvoice.periods.stamped') : t('globalInvoice.periods.cancelled')}</dd>
              <dt className="text-muted-foreground">{t('globalInvoice.complementaryDialog.sales')}</dt>
              <dd>{cuantasEntrarian(t, vista.corregidasPendientes)}</dd>
            </dl>
          )}

          {sinCupo && !vista?.motivo && (
            <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              {t('globalInvoice.complementaryDialog.limitReached')}
            </p>
          )}

          {vista?.motivo && (
            <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              {vista.motivo}
            </p>
          )}

          {puedeEmitir && <p className="text-xs text-muted-foreground">{t('globalInvoice.complementaryDialog.irreversible')}</p>}

          {error && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">{error.title}</p>
              {error.description && <p className="mt-1">{error.description}</p>}
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" size="sm" onClick={() => setVerExcluidas(true)}>
              {t('globalInvoice.complementaryDialog.seeExcluded')}
            </Button>
            <div className="flex gap-2">
              {/* M6: sin «Emitir» no hay nada que cancelar: el botón dice «Cerrar». */}
              <Button variant="outline" disabled={emitir.isPending} onClick={cerrar}>
                {puedeEmitir ? t('globalInvoice.complementaryDialog.cancel') : t('globalInvoice.complementaryDialog.close')}
              </Button>
              {puedeEmitir && (
                <Button disabled={emitir.isPending} onClick={onEmitir}>
                  {emitir.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {emitir.isPending ? t('globalInvoice.complementaryDialog.issuing') : t('globalInvoice.complementaryDialog.issue')}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* C1-32: el listado de esa global por SU id (su periodo guardado), sin ofrecer otra vez la complementaria desde ahí. */}
      <GlobalExcluidasDialog
        emisorId={emisorId}
        principalId={principalId ?? undefined}
        open={open && verExcluidas}
        onOpenChange={o => setVerExcluidas(o)}
      />
    </>
  )
}
