import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

/**
 * Base de la comisión respecto al IVA (decisión D5 enmendada, spec §9-1). La etiqueta dice SIEMPRE la base vigente —«Sin IVA»,
 * la de fábrica, o «Con IVA»—, nunca «Incluir IVA» (prendido sumaba el IVA dos veces y apagado prometía «sin IVA» sobre una
 * base que ya lo traía). `checked` es `includeTax`. Sin `onChange` es de sólo lectura (la ficha del esquema).
 */
export default function BaseIvaSwitch({ id, checked, onChange }: { id: string; checked: boolean; onChange?: (v: boolean) => void }) {
  const { t } = useTranslation('commissions')
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm">
          {checked ? t('wizard.step2.taxBaseWith') : t('wizard.step2.taxBaseWithout')}
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{checked ? t('wizard.step2.taxBaseWithHint') : t('wizard.step2.taxBaseWithoutHint')}</p>
      </div>
      {onChange && <Switch id={id} checked={checked} onCheckedChange={onChange} />}
    </div>
  )
}
