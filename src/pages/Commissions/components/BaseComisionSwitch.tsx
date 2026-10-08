import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

/**
 * Base de la comisión respecto a descuentos y promociones. `checked` es `includeDiscount` (compatibilidad de API): prendido = precio de
 * lista (los descuentos NO bajan la comisión), apagado = lo realmente cobrado (el de fábrica, recomendado).
 * Igual que `BaseIvaSwitch` (G4, guía E6c): la etiqueta es la ACCIÓN, «Calcular sobre el precio de lista», y debajo dice cómo está
 * AHORA. Antes decía «Base de la comisión: Lo realmente cobrado» con el interruptor APAGADO a un lado, y se leía como «no».
 */
export default function BaseComisionSwitch({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTranslation('commissions')
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm">
          {t('wizard.step2.commissionBaseAction')}
        </Label>
        <p className="mt-0.5 text-sm">{checked ? t('wizard.step2.commissionBaseNowList') : t('wizard.step2.commissionBaseNowNet')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {checked ? t('wizard.step2.commissionBaseListHint') : t('wizard.step2.commissionBaseNetHint')}
        </p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
