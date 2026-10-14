import { Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { useEstadoIva } from './SelectorIva'

/** Aparatos que el aviso pinta; el resto va en «y N más» (con 20 aparatos el aviso ocupaba ~430 px y empujaba la pantalla). */
const MAX_APARATOS = 5

/**
 * IVA por producto (plan 6b, spec §5.5): con el negocio encendido, aviso FIJO si un aparato imprime el IVA mal o se usó una app vieja.
 * Nunca bloquea una venta: sólo pide actualizar. Los textos los arma el servidor (aparatosIva.service.ts). Patrón: AvisosHonestos.tsx.
 * Lee la MISMA consulta del estado que el selector (useEstadoIva), sin otra llamada.
 */
export function AvisoAparatosIva({ venueId, className }: { venueId: string; className?: string }) {
  const { t } = useTranslation('menu')
  const { data } = useEstadoIva(venueId)
  if (!data?.encendido || !data.avisos?.length) return null
  // El servidor manda a lo más 20 y, si hay más, `avisosTotal` (Codex código r1 #7): el total real es el mayor de los dos.
  const mostrados = data.avisos.slice(0, MAX_APARATOS)
  const faltan = Math.max(data.avisosTotal ?? 0, data.avisos.length) - mostrados.length
  return (
    <div
      role="status"
      className={cn('flex items-start gap-2 rounded-xl border border-warning-border bg-warning-muted p-3 text-xs', className)}
    >
      <Smartphone aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div>
        <p className="font-medium">{t('iva.aviso.titulo')}</p>
        <p className="mt-0.5 text-muted-foreground">{t('iva.aviso.accion')}</p>
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          {mostrados.map((a, i) => (
            <li key={`${a.codigo}-${i}`}>{a.mensaje}</li>
          ))}
          {faltan > 0 && <li>{t('iva.aviso.mas', { count: faltan })}</li>}
        </ul>
      </div>
    </div>
  )
}
