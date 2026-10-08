/**
 * C1 · Tarea 13 — las ventas de un periodo que no entraron a la factura global, y por qué (el listado de la Tarea 12).
 *
 * 🔴 Tres cosas que esta pantalla no puede hacer:
 * - sumar la estadística de la ÚLTIMA CAPTURA al total de hoy (Codex C1-18): van en párrafos separados;
 * - dar un número exacto cuando el servidor dejó de revisar: entonces dice «al menos N»;
 * - decir «ninguna quedó fuera» mientras quedan páginas.
 *
 * Cada venta muestra el `detalle` que manda el servidor tal cual (nombra productos o montos), y debajo el texto general del motivo
 * cuando dice algo más.
 */
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useGlobalExcluidas } from '@/hooks/use-cfdi'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { botonDeComplementaria, listaDeMotivos, rangoFiscal, textoDelServidor } from './facturaGlobalUi'

export interface GlobalExcluidasDialogProps {
  /** El emisor; `null` = cerrado. */
  emisorId: string | null
  /** Una global que ya existe: su periodo GUARDADO (C1-32). */
  principalId?: string
  /** Un periodo reciente por su inicio; sin `principalId` ni `desde`, el último cerrado. */
  desde?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si se da, el diálogo ofrece «Emitir complementaria» cuando hay ventas pendientes y la principal está timbrada o cancelada. */
  onEmitirComplementaria?: (principalId: string) => void
}

export function GlobalExcluidasDialog({
  emisorId,
  principalId,
  desde,
  open,
  onOpenChange,
  onEmitirComplementaria,
}: GlobalExcluidasDialogProps) {
  const { t, i18n } = useTranslation('cfdi')
  // La fecha de la captura es un instante: se escribe en la zona del negocio. El PERIODO se escribe en la fiscal (`rangoFiscal`).
  const { formatDate } = useVenueDateTime()
  const q = useGlobalExcluidas(emisorId, { principalId, desde }, { enabled: open && !!emisorId })

  const primera = q.data?.pages[0]
  const ventas = q.data?.pages.flatMap(p => p.excluidas) ?? []
  // Los totales viajan SÓLO en la primera página; las siguientes traen `totales: null`.
  const totales = primera?.totales ?? null
  const vacio = !!totales && totales.total === 0 && !q.hasNextPage
  const sePuedeComplementar =
    !!onEmitirComplementaria && !!principalId && (primera?.estadoDelPeriodo === 'TIMBRADA' || primera?.estadoDelPeriodo === 'CANCELADA')
  const complementaria = sePuedeComplementar ? botonDeComplementaria(t, primera?.corregidasPendientes) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hasTitle className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('globalInvoice.excluded.title')}</DialogTitle>
          <DialogDescription>
            {primera
              ? t('globalInvoice.excluded.description', {
                  period: rangoFiscal(primera.periodo.desde, primera.periodo.hasta, i18n.language),
                })
              : t('globalInvoice.excluded.loading')}
          </DialogDescription>
        </DialogHeader>

        {q.isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {q.isError && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {textoDelServidor(q.error) ?? t('globalInvoice.excluded.loadError')}
          </p>
        )}

        {totales && (
          <p className="text-sm font-medium">
            {totales.completo
              ? t('globalInvoice.excluded.total', { count: totales.total })
              : t('globalInvoice.excluded.totalAtLeast', { count: totales.total })}
          </p>
        )}
        {/* Ronda 2: el resumen dice por qué, motivo por motivo (también `SIN_TERMINAL`, el interruptor del founder de la T10). */}
        {totales && listaDeMotivos(t, totales.porMotivo) && (
          <p className="text-sm text-muted-foreground">
            {t('globalInvoice.excluded.byReason', { list: listaDeMotivos(t, totales.porMotivo) })}
          </p>
        )}

        {/* C1-18: lo que se excluyó al CAPTURAR la global es historia: va aparte y nunca se suma al total de hoy. */}
        {primera?.ultimaCaptura && (
          <p className="text-xs text-muted-foreground">
            {t('globalInvoice.excluded.lastCapture', {
              date: formatDate(primera.ultimaCaptura.al),
              list: listaDeMotivos(t, primera.ultimaCaptura.excluidas),
            })}
          </p>
        )}

        {ventas.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-input">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('globalInvoice.excluded.folio')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('globalInvoice.excluded.amount')}</th>
                  <th className="px-3 py-2 font-medium">{t('globalInvoice.excluded.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map(v => (
                  <tr key={v.orderId} className="border-t border-input align-top">
                    <td className="px-3 py-2 font-medium">{v.folio}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Currency(v.cobradoCents, true)}</td>
                    <td className="px-3 py-2">
                      <p>{v.detalle}</p>
                      {/* M1: el detalle del servidor suele ser el texto del motivo + qué productos; entonces no se repite. */}
                      {v.texto && !v.detalle.includes(v.texto) && <p className="mt-1 text-xs text-muted-foreground">{v.texto}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {vacio && <p className="text-sm text-muted-foreground">{t('globalInvoice.excluded.empty')}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {q.hasNextPage ? (
            <Button variant="outline" size="sm" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
              {q.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('globalInvoice.excluded.loadMore')}
            </Button>
          ) : (
            <span />
          )}
          {complementaria && principalId && (
            <div className="flex flex-col items-end gap-1">
              <Button size="sm" onClick={() => onEmitirComplementaria?.(principalId)}>
                {complementaria.label}
              </Button>
              {complementaria.ayuda && <p className="max-w-xs text-right text-xs text-muted-foreground">{complementaria.ayuda}</p>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
