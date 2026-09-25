/**
 * «Ver todo lo que incluye cada plan»: la lista completa, por categoría, debajo de las tarjetas.
 * Cerrada por default para que la elección de plan siga siendo simple; las palomitas salen del
 * catálogo (ver `config/plan-comparison.ts`), nunca de texto escrito a mano.
 */
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Minus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { getTierDef, type TierId } from '@/config/plan-catalog'
import { PLAN_COMPARISON, TIERS_COMPARADOS, esComun, valorDeCelda, type ValorDeCelda } from '@/config/plan-comparison'

interface PlanComparisonProps {
  /** Plan elegido en este momento: su columna se resalta. */
  selectedTier?: TierId
  defaultOpen?: boolean
}

export function PlanComparison({ selectedTier, defaultOpen = false }: PlanComparisonProps) {
  const { t } = useTranslation('billing')
  const [abierta, setAbierta] = useState(defaultOpen)
  const panelId = useId()
  const columnas = 'grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(3.25rem,5.5rem))] sm:grid-cols-[minmax(0,1fr)_repeat(3,7rem)]'

  // Lo que todos los planes tienen igual no ayuda a elegir: va en una sola línea arriba y la tabla
  // sólo enseña lo que CAMBIA de un plan a otro (la lista completa era demasiado larga).
  const comunes = PLAN_COMPARISON.flatMap(c => c.rows.filter(esComun))
  const categorias = PLAN_COMPARISON.map(c => ({ ...c, rows: c.rows.filter(f => !esComun(f)) })).filter(c => c.rows.length > 0)

  const celda = (valor: ValorDeCelda) =>
    valor === true ? (
      <Check className="h-4 w-4 text-foreground" aria-label={t('plan.compare.included', { defaultValue: 'Incluido' })} />
    ) : valor === false ? (
      <Minus className="h-4 w-4 text-muted-foreground/50" aria-label={t('plan.compare.notIncluded', { defaultValue: 'No incluido' })} />
    ) : (
      <span className="text-xs font-medium">{t(`plan.compare.values.${valor}`)}</span>
    )

  return (
    <section className="mx-auto w-full max-w-[880px]">
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={panelId}
        data-tour="plan-compare-toggle"
        onClick={() => setAbierta(v => !v)}
        className="mx-auto flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {abierta
          ? t('plan.compare.hide', { defaultValue: 'Ocultar la comparación' })
          : t('plan.compare.show', { defaultValue: 'Ver todo lo que incluye cada plan' })}
        <ChevronDown className={cn('h-4 w-4 transition-transform duration-200 ease-out', abierta && 'rotate-180')} aria-hidden="true" />
      </button>

      {abierta && comunes.length > 0 && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('plan.compare.allPlansInclude', {
            defaultValue: 'Todos los planes incluyen: {{list}}.',
            list: comunes.map(f => t(`plan.compare.rows.${f.key}`)).join(', '),
          })}
        </p>
      )}

      {abierta && (
        <div
          id={panelId}
          role="table"
          aria-label={t('plan.compare.title', { defaultValue: 'Comparación de planes' })}
          className="mt-4 overflow-hidden rounded-2xl border border-input"
        >
          <div role="row" className={cn(columnas, 'border-b border-input bg-background')}>
            <div role="columnheader" className="px-4 py-3" />
            {TIERS_COMPARADOS.map(tier => (
              <div
                key={tier}
                role="columnheader"
                className={cn(
                  'flex items-center justify-center px-2 py-3 text-sm font-semibold transition-colors duration-150',
                  selectedTier === tier && 'bg-muted/60',
                )}
              >
                {t(`plan.tiers.${getTierDef(tier).key}.name`)}
              </div>
            ))}
          </div>

          {categorias.map(categoria => (
            <div key={categoria.key} role="rowgroup">
              <div role="row" className="border-b border-input bg-muted/30 px-4 py-2">
                <span role="rowheader" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(`plan.compare.categories.${categoria.key}`)}
                </span>
              </div>
              {categoria.rows.map(fila => (
                <div key={fila.key} role="row" className={cn(columnas, 'border-b border-input/60 last:border-b-0')}>
                  <div role="rowheader" className="px-4 py-2 text-sm">
                    {t(`plan.compare.rows.${fila.key}`)}
                  </div>
                  {TIERS_COMPARADOS.map(tier => (
                    <div
                      key={tier}
                      role="cell"
                      data-testid={`compare-${fila.key}-${tier}`}
                      className={cn('flex items-center justify-center px-2 py-2', selectedTier === tier && 'bg-muted/60')}
                    >
                      {celda(valorDeCelda(fila, tier))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
