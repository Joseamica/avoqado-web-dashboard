import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calculator } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useCurrentVenue } from '@/hooks/use-current-venue'
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
  const { venue } = useCurrentVenue()
  const [open, setOpen] = useState(false)

  const isMexico =
    venue?.country?.toLowerCase() === 'mexico' ||
    venue?.country?.toLowerCase() === 'méxico' ||
    venue?.country === 'MX'

  const { includeTax, includeTips, includeDiscount } = state.calculationBase

  const parts: string[] = []
  if (!includeTax && !includeTips && !includeDiscount) {
    parts.push(t('setup.calcBase.subtotalOnly'))
  } else {
    if (includeTax) parts.push(isMexico ? 'IVA' : t('setup.calcBase.tax'))
    if (includeTips) parts.push(t('setup.calcBase.tips'))
    if (includeDiscount) parts.push(t('setup.calcBase.discounts'))
  }

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
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">
                    {t('wizard.step2.includeTax')}{isMexico ? ' (IVA 16%)' : ''}
                  </Label>
                  {isMexico && !includeTax && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('wizard.step2.taxExcludedHint')}
                    </p>
                  )}
                </div>
                <Switch
                  checked={includeTax}
                  onCheckedChange={checked =>
                    dispatch({ type: 'SET_CALCULATION_BASE', data: { includeTax: checked } })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">{t('wizard.step2.includeTips')}</Label>
                <Switch
                  checked={includeTips}
                  onCheckedChange={checked =>
                    dispatch({ type: 'SET_CALCULATION_BASE', data: { includeTips: checked } })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">{t('wizard.step2.includeDiscount')}</Label>
                <Switch
                  checked={includeDiscount}
                  onCheckedChange={checked =>
                    dispatch({ type: 'SET_CALCULATION_BASE', data: { includeDiscount: checked } })
                  }
                />
              </div>
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
