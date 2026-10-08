/**
 * C1 · Tarea 13, ronda 2 (T10 ronda 1, I1) — las globales sin timbrar de una periodicidad ANTERIOR (de antes de que el RFC la cambiara).
 *
 * 🔴 Sólo para mostrar: nunca se mezclan con los periodos de hoy y nunca ofrecen «Emitir» (su `desde` es de otra periodicidad; el servidor
 * respondería «pídelo a soporte» o, peor, timbraría las mismas fechas en la periodicidad de hoy). Cada una dice su estado y su motivo; una
 * complementaria se emite desde la lista de facturas. `completo: false` ⇒ hay más de las que caben (a lo más 10): se piden a soporte.
 */
import { useTranslation } from 'react-i18next'
import { ListChecks } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { GlobalPeriodosResponse } from '@/services/cfdi.service'
import { principalParaElListado, rangoFiscal } from './facturaGlobalUi'

const VARIANTE = { APARTADA: 'secondary', RECHAZADA: 'destructive', DETENIDA: 'outline' } as const

export function GlobalOtrasPeriodicidades({
  otras,
  onVerExcluidas,
}: {
  otras: GlobalPeriodosResponse['otrasPeriodicidades'] | undefined
  /** «Ver cuáles»: abre el listado de la global PRINCIPAL de esa fila, por su id (su periodo guardado, C1-32). */
  onVerExcluidas: (principalId: string) => void
}) {
  const { t, i18n } = useTranslation('cfdi')
  if (!otras || otras.globales.length === 0) return null

  return (
    <section data-testid="otras-periodicidades" className="space-y-2 rounded-lg border border-dashed border-input p-3">
      <div>
        <p className="text-sm font-medium">{t('globalInvoice.periods.other.title')}</p>
        <p className="text-xs text-muted-foreground">{t('globalInvoice.periods.other.description')}</p>
      </div>
      <ul className="space-y-2">
        {otras.globales.map(o => (
          <li key={o.cfdiId} data-testid={`otra-${o.cfdiId}`} className="space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{rangoFiscal(o.desde, o.hasta, i18n.language)}</span>
              <span className="text-xs text-muted-foreground">{t(`periodicity.${o.periodicidad}`)}</span>
              <Badge variant={VARIANTE[o.estado] ?? 'outline'}>{t(`globalInvoice.periods.other.estados.${o.estado}`)}</Badge>
              {o.folio && <span className="text-xs text-muted-foreground">{t('globalInvoice.periods.folio', { folio: o.folio })}</span>}
              <Button variant="ghost" size="sm" onClick={() => onVerExcluidas(principalParaElListado(o))}>
                <ListChecks className="mr-1.5 h-4 w-4" />
                {t('globalInvoice.excluded.see')}
              </Button>
            </div>
            {o.motivo && <p className="text-xs">{o.motivo}</p>}
            {o.complementariaDe && <p className="text-xs text-muted-foreground">{t('globalInvoice.periods.other.complementaria')}</p>}
          </li>
        ))}
      </ul>
      {!otras.completo && <p className="text-xs text-muted-foreground">{t('globalInvoice.periods.other.more')}</p>}
    </section>
  )
}
