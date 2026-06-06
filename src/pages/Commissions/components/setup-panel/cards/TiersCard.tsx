import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TrendingUp, Plus, Trash2, Target } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { CommissionSetupState, TierItem, TierPeriod } from '../types'
import type { ThresholdType } from '@/types/commission'
import type { SetupAction } from '../useSetupReducer'
import { isCardValid, isCardTouched } from '../useSetupReducer'
import SetupCard from '../SetupCard'

const TIER_PERIOD_OPTIONS: TierPeriod[] = ['WEEKLY', 'BIWEEKLY', 'MONTHLY']
const TIER_EMOJIS = ['🥉', '🥈', '🥇', '💎', '👑']

interface TiersCardProps {
  state: CommissionSetupState
  dispatch: (action: SetupAction) => void
}

export default function TiersCard({ state, dispatch }: TiersCardProps) {
  const { t } = useTranslation('commissions')
  const [open, setOpen] = useState(false)

  const isValid = isCardValid(state, 'tiers')

  const description = state.tiers.enabled
    ? t('setup.tiers.enabledDesc', { count: state.tiers.items.length })
    : t('setup.tiers.disabledDesc')

  const handleEnable = () => {
    dispatch({ type: 'SET_TIERS', data: { enabled: true } })
  }

  const addTier = () => {
    const last = state.tiers.items[state.tiers.items.length - 1]
    // Determine min threshold type for the new tier based on previous tier's max type
    const newMinType: ThresholdType = last?.maxThresholdType ?? 'FIXED'
    const newTier: TierItem = {
      level: state.tiers.items.length + 1,
      name: t('setup.tiers.levelName', { n: state.tiers.items.length + 1 }),
      minThreshold: last?.maxThreshold ?? 0,
      maxThreshold: null,
      minThresholdType: newMinType,
      maxThresholdType: 'FIXED',
      rate: (last?.rate ?? 0.02) + 0.01,
    }
    dispatch({ type: 'SET_TIERS', data: { items: [...state.tiers.items, newTier] } })
  }

  const removeTier = (index: number) => {
    if (state.tiers.items.length <= 1) return
    dispatch({
      type: 'SET_TIERS',
      data: { items: state.tiers.items.filter((_, i) => i !== index) },
    })
  }

  const updateTier = (index: number, updates: Partial<TierItem>) => {
    const items = [...state.tiers.items]
    items[index] = { ...items[index], ...updates }
    // When maxThreshold changes (value or type), propagate to next tier's min
    if ((updates.maxThreshold !== undefined || updates.maxThresholdType !== undefined) && index < items.length - 1) {
      const newMaxType = updates.maxThresholdType ?? items[index].maxThresholdType
      items[index + 1] = {
        ...items[index + 1],
        minThreshold: updates.maxThreshold !== undefined ? (updates.maxThreshold ?? 0) : items[index + 1].minThreshold,
        minThresholdType: newMaxType,
      }
    }
    dispatch({ type: 'SET_TIERS', data: { items } })
  }

  return (
    <>
      <SetupCard
        icon={TrendingUp}
        title={t('setup.tiers.title')}
        description={description}
        isValid={isValid}
        touched={isCardTouched(state, 'tiers')}
        onClick={() => setOpen(true)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('setup.tiers.title')}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {!state.tiers.enabled ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-4">
                  {t('setup.tiers.enablePrompt')}
                </p>
                <Button onClick={handleEnable}>{t('setup.tiers.enable')}</Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium whitespace-nowrap">
                    {t('wizard.advanced.tiers.period')}:
                  </label>
                  <Select
                    value={state.tiers.tierPeriod}
                    onValueChange={v => dispatch({ type: 'SET_TIERS', data: { tierPeriod: v as TierPeriod } })}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIER_PERIOD_OPTIONS.map(p => (
                        <SelectItem key={p} value={p}>
                          {t(`wizard.advanced.tiers.periodOptions.${p}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  {state.tiers.items.map((tier, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-xl border border-input bg-card">
                      <span className="text-xl">{TIER_EMOJIS[index] || '🏅'}</span>
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">{t('wizard.advanced.tiers.fromHeader')}</label>
                          {index > 0 && tier.minThresholdType === 'STAFF_GOAL' ? (
                            <Badge variant="secondary" className="flex items-center gap-1 h-8 text-xs font-normal px-2 rounded-md">
                              <Target className="w-3 h-3 shrink-0" />
                              {t('wizard.advanced.tiers.boundaryGoalShort')}
                            </Badge>
                          ) : (
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                              <Input
                                type="number"
                                min={0}
                                value={tier.minThreshold ?? ''}
                                onChange={e => {
                                  const raw = e.target.value
                                  updateTier(index, { minThreshold: raw === '' ? 0 : Number(raw) })
                                }}
                                className="h-8 text-xs pl-5"
                                readOnly={index > 0}
                              />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="text-[10px] text-muted-foreground">{t('wizard.advanced.tiers.toHeader')}</label>
                            <button
                              type="button"
                              onClick={() => {
                                const newType: ThresholdType = tier.maxThresholdType === 'STAFF_GOAL' ? 'FIXED' : 'STAFF_GOAL'
                                updateTier(index, { maxThresholdType: newType })
                              }}
                              aria-label={
                                tier.maxThresholdType === 'STAFF_GOAL'
                                  ? t('wizard.advanced.tiers.useFixedBoundary')
                                  : t('wizard.advanced.tiers.useGoalBoundary')
                              }
                              className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-primary leading-none transition-colors hover:bg-primary/10"
                            >
                              <Target className="h-3 w-3 shrink-0" />
                              {tier.maxThresholdType === 'STAFF_GOAL'
                                ? t('wizard.advanced.tiers.boundaryFixed')
                                : t('wizard.advanced.tiers.boundaryGoalShort')}
                            </button>
                          </div>
                          {tier.maxThresholdType === 'STAFF_GOAL' ? (
                            <Badge variant="secondary" className="flex items-center gap-1 h-8 text-xs font-normal px-2 rounded-md w-full justify-start">
                              <Target className="w-3 h-3 shrink-0" />
                              {t('wizard.advanced.tiers.boundaryGoal')}
                            </Badge>
                          ) : (
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                              <Input
                                type="number"
                                min={0}
                                placeholder="∞"
                                value={tier.maxThreshold ?? ''}
                                onChange={e => updateTier(index, { maxThreshold: e.target.value ? Number(e.target.value) : null })}
                                className="h-8 text-xs pl-5"
                              />
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">{t('wizard.advanced.tiers.commissionHeader')}</label>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.1"
                              min={0}
                              max={100}
                              value={(tier.rate * 100).toFixed(1)}
                              onChange={e => {
                                const raw = e.target.value
                                updateTier(index, { rate: raw === '' ? 0 : Number(raw) / 100 })
                              }}
                              className="h-8 text-xs font-semibold pr-6"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                        onClick={() => removeTier(index)}
                        disabled={state.tiers.items.length <= 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button variant="outline" size="sm" onClick={addTier} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('wizard.advanced.tiers.addLevel')}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    dispatch({ type: 'SET_TIERS', data: { enabled: false } })
                    setOpen(false)
                  }}
                >
                  {t('setup.tiers.disable')}
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
