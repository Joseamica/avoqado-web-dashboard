import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CommissionSetupState, TierPeriod } from '../types'
import type { SetupAction } from '../useSetupReducer'
import { isCardTouched } from '../useSetupReducer'
import SetupCard from '../SetupCard'

const PERIOD_OPTIONS: TierPeriod[] = ['WEEKLY', 'BIWEEKLY', 'MONTHLY']

interface PeriodCardProps {
  state: CommissionSetupState
  dispatch: (action: SetupAction) => void
}

export default function PeriodCard({ state, dispatch }: PeriodCardProps) {
  const { t } = useTranslation('commissions')
  const [open, setOpen] = useState(false)

  const description = t(`setup.period.options.${state.period.aggregationPeriod}`)

  return (
    <>
      <SetupCard
        icon={Calendar}
        title={t('setup.period.title')}
        description={description}
        isValid
        touched={isCardTouched(state, 'period')}
        onClick={() => setOpen(true)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>{t('setup.period.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {t('setup.period.description')}
            </p>

            <div className="space-y-2">
              {PERIOD_OPTIONS.map(period => (
                <button
                  key={period}
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'SET_PERIOD', data: { aggregationPeriod: period } })
                    setOpen(false)
                  }}
                  className={cn(
                    'w-full text-left rounded-lg border p-3 transition-colors cursor-pointer',
                    state.period.aggregationPeriod === period
                      ? 'border-foreground bg-muted/40 font-medium'
                      : 'border-input hover:bg-muted/30',
                  )}
                >
                  <p className="text-sm font-medium">{t(`setup.period.options.${period}`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`setup.period.hints.${period}`)}</p>
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('actions.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
