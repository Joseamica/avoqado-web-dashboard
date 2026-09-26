/**
 * «Ver todos» de una tarjeta de plan: la lista COMPLETA de lo que incluye, por categoría. La tarjeta
 * sólo enseña los principales; aquí va todo (founder, 25-sep). Sale de `beneficiosDelPlan`, el mismo
 * catálogo que la tabla comparativa y el paywall, así que no puede prometer lo que el plan no da.
 */
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { PlanTierDef } from '@/config/plan-catalog'
import { beneficiosDelPlan, extrasDelPlan } from '@/config/plan-comparison'

interface PlanBenefitsDialogProps {
  tier: PlanTierDef
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Color de las palomitas (el acento del plan). */
  accentClassName: string
  /**
   * Acción principal del pie. Ausente ⇒ sólo «Cerrar» (Facturación: desde aquí no se cambia de plan
   * por accidente). Al elegir, la ventana se cierra sola.
   */
  action?: { label: string; onClick: () => void }
}

export function PlanBenefitsDialog({ tier, open, onOpenChange, accentClassName, action }: PlanBenefitsDialogProps) {
  const { t } = useTranslation('billing')
  const tierName = t(`plan.tiers.${tier.key}.name`)
  const extras = extrasDelPlan(tier)
  const categorias = beneficiosDelPlan(tier.id)

  const renglon = (key: string, texto: string) => (
    <li key={key} className="flex items-start gap-2 text-sm">
      <Check className={cn('mt-0.5 h-4 w-4 shrink-0', accentClassName)} aria-hidden="true" />
      <span>{texto}</span>
    </li>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hasTitle className="max-w-2xl gap-0 overflow-hidden p-0">
        {/* La marca de pruebas va aquí: `DialogContent` no reenvía atributos sueltos. */}
        <div data-testid={`plan-benefits-${tier.id}`} className="flex max-h-[85vh] flex-col">
          <DialogHeader className="border-b border-input px-6 pb-4 pt-6">
            <DialogTitle>{t('plan.benefits.title', { tier: tierName, defaultValue: 'Todo lo que incluye {{tier}}' })}</DialogTitle>
            <DialogDescription>{t(`plan.tiers.${tier.key}.pitch`)}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {extras.length > 0 && (
              <section className="mb-6">
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('plan.benefits.onlyIn', { tier: tierName, defaultValue: 'Sólo en {{tier}}' })}
                </h3>
                <ul className="grid gap-2 sm:grid-cols-2">{extras.map(k => renglon(k, t(`plan.features.${k}`)))}</ul>
              </section>
            )}
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {categorias.map(c => (
                <section key={c.categoria}>
                  <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`plan.compare.categories.${c.categoria}`)}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {c.beneficios.map(({ fila, valor }) =>
                      renglon(
                        fila.key,
                        valor === true
                          ? t(`plan.compare.rows.${fila.key}`)
                          : `${t(`plan.compare.rows.${fila.key}`)}: ${t(`plan.compare.values.${valor}`)}`,
                      ),
                    )}
                  </ul>
                </section>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-input px-6 py-4">
            <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
              {t('plan.benefits.close', { defaultValue: 'Cerrar' })}
            </Button>
            {action && (
              <Button
                className="cursor-pointer"
                data-tour={`plan-benefits-action-${tier.id.toLowerCase()}`}
                onClick={() => {
                  action.onClick()
                  onOpenChange(false)
                }}
              >
                {action.label}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
