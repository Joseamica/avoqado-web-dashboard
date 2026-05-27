import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserCog, Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useRoleConfig } from '@/hooks/use-role-config'
import type { CommissionSetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'
import { isCardValid, isCardTouched } from '../useSetupReducer'
import SetupCard from '../SetupCard'

const NON_SALES_ROLES = ['SUPERADMIN', 'VIEWER']

interface RoleRatesCardProps {
  state: CommissionSetupState
  dispatch: (action: SetupAction) => void
}

export default function RoleRatesCard({ state, dispatch }: RoleRatesCardProps) {
  const { t } = useTranslation('commissions')
  const { activeRoles, getDisplayName } = useRoleConfig()
  const [open, setOpen] = useState(false)

  const isValid = isCardValid(state, 'roleRates')
  const roleOptions = activeRoles
    .filter(r => !NON_SALES_ROLES.includes(r.role))
    .map(r => ({ key: r.role, label: getDisplayName(r.role) }))

  const description = state.roleRates.enabled
    ? t('setup.roleRates.enabledDesc', { count: Object.keys(state.roleRates.rates).length })
    : t('setup.roleRates.disabledDesc')

  const handleEnable = () => {
    const defaults: Record<string, number> = {}
    const DEFAULT_ROLES = ['WAITER', 'CASHIER', 'MANAGER']
    for (const key of DEFAULT_ROLES) {
      if (roleOptions.some(r => r.key === key)) {
        defaults[key] = state.rate.defaultRate
      }
    }
    if (Object.keys(defaults).length === 0) {
      for (const role of roleOptions.slice(0, 3)) {
        defaults[role.key] = state.rate.defaultRate
      }
    }
    dispatch({ type: 'SET_ROLE_RATES', data: { enabled: true, rates: defaults } })
  }

  const updateRate = (role: string, displayValue: number) => {
    dispatch({
      type: 'SET_ROLE_RATES',
      data: { rates: { ...state.roleRates.rates, [role]: displayValue / 100 } },
    })
  }

  const removeRole = (role: string) => {
    const next = { ...state.roleRates.rates }
    delete next[role]
    dispatch({ type: 'SET_ROLE_RATES', data: { rates: next } })
  }

  const addableRoles = roleOptions.filter(r => !(r.key in state.roleRates.rates))

  return (
    <>
      <SetupCard
        icon={UserCog}
        title={t('setup.roleRates.title')}
        description={description}
        isValid={isValid}
        touched={isCardTouched(state, 'roleRates')}
        onClick={() => setOpen(true)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t('setup.roleRates.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!state.roleRates.enabled ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-4">
                  {t('setup.roleRates.enablePrompt')}
                </p>
                <Button onClick={handleEnable}>{t('setup.roleRates.enable')}</Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {t('setup.roleRates.description')}
                </p>

                <div className="space-y-2">
                  {roleOptions
                    .filter(r => r.key in state.roleRates.rates)
                    .map(role => (
                      <div key={role.key} className="flex items-center gap-3 p-3 rounded-lg border border-input">
                        <span className="text-sm font-medium flex-1">{role.label}</span>
                        <div className="w-24 relative">
                          <Input
                            type="number"
                            step="0.1"
                            min={0}
                            max={100}
                            value={((state.roleRates.rates[role.key] ?? 0) * 100).toFixed(1)}
                            onChange={e => {
                              const raw = e.target.value
                              updateRate(role.key, raw === '' ? 0 : Number(raw))
                            }}
                            className="h-8 text-sm font-semibold pr-6"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                          onClick={() => removeRole(role.key)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                </div>

                {addableRoles.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        {t('setup.roleRates.addRole')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[240px] p-1" align="start">
                      {addableRoles.map(role => (
                        <button
                          key={role.key}
                          type="button"
                          onClick={() => updateRate(role.key, state.rate.defaultRate * 100)}
                          className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left hover:bg-accent cursor-pointer"
                        >
                          <span className="text-sm">{role.label}</span>
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    dispatch({ type: 'SET_ROLE_RATES', data: { enabled: false } })
                    setOpen(false)
                  }}
                >
                  {t('setup.roleRates.disable')}
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
