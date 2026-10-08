import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calculator } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import BaseIvaSwitch from '../../BaseIvaSwitch'
import BaseComisionSwitch from '../../BaseComisionSwitch'
import type { CommissionSetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'
import { isCardTouched } from '../useSetupReducer'
import SetupCard from '../SetupCard'

interface CalculationBaseCardProps {
  state: CommissionSetupState
  dispatch: (action: SetupAction) => void
}

export default function CalculationBaseCard({ state, dispatch }: CalculationBaseCardProps) {
  const { t } = useTranslation('commissions')
  const [open, setOpen] = useState(false)


  const { includeTax, includeTips, includeDiscount } = state.calculationBase

  // La base SIEMPRE se ve en el resumen: es la decisión que más mueve el dinero
  // del vendedor, y antes sólo aparecía la palabra "Descuentos" cuando estaba
  // prendida — apagada no decía nada.
  const parts: string[] = [
    includeDiscount ? t('wizard.step2.commissionBaseList') : t('wizard.step2.commissionBaseNet'),
  ]
  parts.push(includeTax ? t('wizard.step2.taxBaseWith') : t('wizard.step2.taxBaseWithout'))
  if (includeTips) parts.push(t('setup.calcBase.tips'))

  return (
    <>
      <SetupCard
        icon={Calculator}
        title={t('setup.calcBase.title')}
        description={parts.join(' + ') || t('setup.calcBase.subtotalOnly')}
        isValid
        touched={isCardTouched(state, 'calculationBase')}
        onClick={() => setOpen(true)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('setup.calcBase.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {t('setup.calcBase.description')}
            </p>

            <div className="space-y-3">
              <BaseIvaSwitch
                id="setup-includeTax"
                checked={includeTax}
                onChange={checked => dispatch({ type: 'SET_CALCULATION_BASE', data: { includeTax: checked } })}
              />

              <div className="flex items-center justify-between">
                <Label className="text-sm">{t('wizard.step2.includeTips')}</Label>
                <Switch
                  checked={includeTips}
                  onCheckedChange={checked =>
                    dispatch({ type: 'SET_CALCULATION_BASE', data: { includeTips: checked } })
                  }
                />
              </div>

              <BaseComisionSwitch
                id="setup-includeDiscount"
                checked={includeDiscount}
                onChange={checked => dispatch({ type: 'SET_CALCULATION_BASE', data: { includeDiscount: checked } })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setOpen(false)}>{t('actions.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
