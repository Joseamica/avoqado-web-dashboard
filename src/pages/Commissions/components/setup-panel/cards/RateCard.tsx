import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Percent, DollarSign } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { CommissionSetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'
import { isCardValid } from '../useSetupReducer'
import SetupCard from '../SetupCard'

interface RateCardProps {
  state: CommissionSetupState
  dispatch: (action: SetupAction) => void
}

export default function RateCard({ state, dispatch }: RateCardProps) {
  const { t } = useTranslation('commissions')
  const [open, setOpen] = useState(false)
  const [localRate, setLocalRate] = useState(() => (state.rate.defaultRate * 100).toFixed(2))
  const [localFixed, setLocalFixed] = useState(() => String(state.rate.fixedAmount))

  const isValid = isCardValid(state, 'rate')

  const description = isValid
    ? state.rate.calcType === 'PERCENTAGE'
      ? `${(state.rate.defaultRate * 100).toFixed(1)}% ${t(`recipients.${state.rate.recipient}`)}`
      : `$${state.rate.fixedAmount} ${t(`recipients.${state.rate.recipient}`)}`
    : t('setup.rate.pending')

  const handleOpen = () => {
    setLocalRate((state.rate.defaultRate * 100).toFixed(2))
    setLocalFixed(String(state.rate.fixedAmount))
    setOpen(true)
  }

  const handleSave = () => {
    const rateNum = localRate === '' ? 0 : Math.max(0, Math.min(100, Number(localRate)))
    const fixedNum = localFixed === '' ? 0 : Math.max(0, Number(localFixed))
    dispatch({
      type: 'SET_RATE',
      data: { defaultRate: rateNum / 100, fixedAmount: fixedNum },
    })
    setOpen(false)
  }

  const recipientOptions = ['SERVER', 'CREATOR', 'PROCESSOR'] as const

  return (
    <>
      <SetupCard
        icon={state.rate.calcType === 'PERCENTAGE' ? Percent : DollarSign}
        title={t('setup.rate.title')}
        description={description}
        isValid={isValid}
        isRequired
        dataTour="commission-setup-rate"
        onClick={handleOpen}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t('setup.rate.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Calc type toggle */}
            <div className="flex justify-center">
              <div className="inline-flex rounded-full bg-muted/50 p-1">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_RATE', data: { calcType: 'PERCENTAGE' } })}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
                    state.rate.calcType === 'PERCENTAGE'
                      ? 'bg-foreground text-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Percent className="w-4 h-4" />
                  {t('wizard.step2.percentage')}
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_RATE', data: { calcType: 'FIXED' } })}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
                    state.rate.calcType === 'FIXED'
                      ? 'bg-foreground text-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <DollarSign className="w-4 h-4" />
                  {t('wizard.step2.fixedAmount')}
                </button>
              </div>
            </div>

            {/* Rate input */}
            {state.rate.calcType === 'PERCENTAGE' ? (
              <div className="flex flex-col items-center">
                <div className="relative w-40">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={localRate}
                    onChange={e => setLocalRate(e.target.value)}
                    className="text-center text-3xl font-bold h-16 pr-10"
                    autoFocus
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">
                    %
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {t('wizard.step2.ofEachSale')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="relative w-40">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={localFixed}
                    onChange={e => setLocalFixed(e.target.value)}
                    className="text-center text-3xl font-bold h-16 pl-10"
                    autoFocus
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {t('wizard.step2.perTransaction')}
                </p>
              </div>
            )}

            {/* Recipient selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('setup.rate.recipientLabel')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {recipientOptions.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => dispatch({ type: 'SET_RATE', data: { recipient: r } })}
                    className={cn(
                      'rounded-lg border p-3 text-center transition-colors',
                      state.rate.recipient === r
                        ? 'border-foreground bg-muted/40'
                        : 'border-input hover:bg-muted/30',
                    )}
                  >
                    <span className={cn(
                      'block text-xs',
                      state.rate.recipient === r ? 'font-medium' : '',
                    )}>
                      {t(`recipients.${r}`)}
                    </span>
                    <span className="block text-[10px] text-muted-foreground mt-1">
                      {t(`recipients.${r}_DESC`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('actions.cancel')}
            </Button>
            <Button onClick={handleSave}>{t('actions.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
