import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useCommissionConfigs } from '@/hooks/useCommissions'
import { getMenuCategories } from '@/services/menu.service'
import type { CommissionConfig } from '@/types/commission'
import { reemplazadoPor, solapesDe, type EsquemaDePago, type Solape } from '../quienPaga'

/** Los nombres de las categorías (misma llave que la tarjeta del esquema). Sin catálogo todavía: «N categorías», nunca ids. */
function useNombresDeCategorias(activo: boolean) {
  const { t } = useTranslation('commissions')
  const { venueId } = useCurrentVenue()
  const { data = [] } = useQuery({
    queryKey: ['categories', venueId],
    queryFn: () => getMenuCategories(venueId!),
    enabled: !!venueId && activo,
    staleTime: 5 * 60 * 1000,
  })
  return (ids: string[]) => {
    const nombres = ids.map(id => (data as Array<{ id: string; name: string }>).find(c => c.id === id)?.name)
    return nombres.every(Boolean) ? nombres.join(', ') : t('config.overlap.nCategories', { count: ids.length })
  }
}

/**
 * Cada solape en una línea, con nombres: qué comparten y cuál paga según la prioridad (ft-graves, D-REACTIVAR). La regla del server:
 * una categoría la paga un solo esquema, el de mayor prioridad; de dos generales paga sólo uno.
 */
export function AvisoDeSolapes({ solapes, max = 3 }: { solapes: Solape<EsquemaDePago>[]; max?: number }) {
  const { t } = useTranslation('commissions')
  const nombres = useNombresDeCategorias(solapes.some(s => s.categorias))
  const texto = (s: Solape<EsquemaDePago>) => {
    const general = s.categorias === null
    const clave = `config.overlap.${general ? 'general' : 'categories'}${s.paga ? '' : 'Tie'}`
    return t(clave, {
      a: s.a.name,
      b: s.b.name,
      categorias: s.categorias ? nombres(s.categorias) : undefined,
      paga: s.paga?.name,
      prioridad: s.a.priority,
    })
  }
  return (
    <ul className="space-y-1">
      {solapes.slice(0, max).map(s => (
        <li key={`${s.a.id}:${s.b.id}`}>{texto(s)}</li>
      ))}
      {solapes.length > max && <li>{t('config.overlap.more', { count: solapes.length - max })}</li>}
    </ul>
  )
}

/** Al reactivar: si lo reemplazó otro, por cuál; y con qué esquemas activos chocaría y cuál pagaría. */
export function AvisoAlReactivar({ config }: { config: CommissionConfig }) {
  const { t } = useTranslation('commissions')
  const { data: todos = [] } = useCommissionConfigs(true)
  const activos = todos.filter(c => c.active && c.id !== config.id)
  const reemplazo = reemplazadoPor(config, activos)
  const solapes = solapesDe(config, activos)
  if (!reemplazo && solapes.length === 0) return <p className="text-sm text-muted-foreground">{t('config.reactivateNoOverlap')}</p>
  return (
    <div className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
      {reemplazo && <p className="font-medium">{t('config.reactivateReplacedBy', { otro: reemplazo.name })}</p>}
      {solapes.length > 0 && <AvisoDeSolapes solapes={solapes} />}
    </div>
  )
}
