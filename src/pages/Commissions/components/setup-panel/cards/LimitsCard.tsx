import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Shield } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CommissionSetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'
import { isCardTouched } from '../useSetupReducer'
import SetupCard from '../SetupCard'

interface LimitsCardProps {
  state: CommissionSetupState
  dispatch: (action: SetupAction) => void
}

export default function LimitsCard({ state, dispatch }: LimitsCardProps) {
  const { t, i18n } = useTranslation('commissions')
  const [open, setOpen] = useState(false)

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
    }).format(amount)

  const { enabled, minAmount, maxAmount } = state.limits

  let description: string
  if (!enabled) {
    description = t('setup.limits.disabledDesc')
  } else if (minAmount && maxAmount) {
    description = `${formatCurrency(minAmount)} – ${formatCurrency(maxAmount)}`
  } else if (maxAmount) {
    description = t('setup.limits.maxOnly', { max: formatCurrency(maxAmount) })
  } else if (minAmount) {
    description = t('setup.limits.minOnly', { min: formatCurrency(minAmount) })
  } else {
    description = t('setup.limits.enabledNoValues')
  }

  const handleEnable = () => {
    dispatch({ type: 'SET_LIMITS', data: { enabled: true } })
  }

  return (
    <>
      <SetupCard
        icon={Shield}
        title={t('setup.limits.title')}
        description={description}
        isValid
        touched={isCardTouched(state, 'limits')}
        onClick={() => setOpen(true)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('setup.limits.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!enabled ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-4">
                  {t('setup.limits.enablePrompt')}
                </p>
                <Button onClick={handleEnable}>{t('setup.limits.enable')}</Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {t('setup.limits.description')}
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">{t('wizard.advanced.limits.min')}</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={minAmount ?? ''}
                        onChange={e =>
                          dispatch({
                            type: 'SET_LIMITS',
                            data: { minAmount: e.target.value ? Number(e.target.value) : null },
                          })
                        }
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">{t('wizard.advanced.limits.max')}</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min={0}
                        placeholder="500"
                        value={maxAmount ?? ''}
                        onChange={e =>
                          dispatch({
                            type: 'SET_LIMITS',
                            data: { maxAmount: e.target.value ? Number(e.target.value) : null },
                          })
                        }
                        className="pl-7"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    dispatch({ type: 'SET_LIMITS', data: { enabled: false, minAmount: null, maxAmount: null } })
                    setOpen(false)
                  }}
                >
                  {t('setup.limits.disable')}
                </Button>
              </>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setOpen(false)}>{t('actions.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
