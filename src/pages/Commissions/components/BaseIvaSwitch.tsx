import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

/**
 * Base de la comisión respecto al IVA (decisión D5 enmendada, spec §9-1). `checked` es `includeTax`; nunca «Incluir IVA» (prendido
 * sumaba el IVA dos veces y apagado prometía «sin IVA» sobre una base que ya lo traía).
 * - Con interruptor (G4, guía E6c): la etiqueta es la ACCIÓN, «Calcular con IVA» —apagado = sin IVA, el de fábrica—, y debajo dice
 *   cómo está AHORA («Ahora: sin IVA» / «Ahora: con IVA»). Antes la etiqueta decía la base vigente, «Sin IVA», y el interruptor
 *   apagado a su lado se leía como «sin IVA: no».
 * - Sin `onChange` (la ficha del esquema, de sólo lectura): no hay interruptor que leer, así que dice la base vigente.
 */
export default function BaseIvaSwitch({ id, checked, onChange }: { id: string; checked: boolean; onChange?: (v: boolean) => void }) {
  const { t } = useTranslation('commissions')
  const hint = <p className="mt-0.5 text-xs text-muted-foreground">{checked ? t('wizard.step2.taxBaseWithHint') : t('wizard.step2.taxBaseWithoutHint')}</p>
  if (!onChange) {
    return (
      <div>
        <p className="text-sm font-medium">{checked ? t('wizard.step2.taxBaseWith') : t('wizard.step2.taxBaseWithout')}</p>
        {hint}
      </div>
    )
  }
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm">
          {t('wizard.step2.taxBaseAction')}
        </Label>
        <p className="mt-0.5 text-sm">{checked ? t('wizard.step2.taxBaseNowWith') : t('wizard.step2.taxBaseNowWithout')}</p>
        {hint}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
