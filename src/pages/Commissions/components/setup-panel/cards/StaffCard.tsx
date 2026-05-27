import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Users, UserPlus, UserX, Search, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { cn, includesNormalized } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useRoleConfig } from '@/hooks/use-role-config'
import { teamService } from '@/services/team.service'
import type { CommissionSetupState, StaffOverride } from '../types'
import type { SetupAction } from '../useSetupReducer'
import { isCardValid, isCardTouched } from '../useSetupReducer'
import SetupCard from '../SetupCard'

interface StaffCardProps {
  state: CommissionSetupState
  dispatch: (action: SetupAction) => void
}

export default function StaffCard({ state, dispatch }: StaffCardProps) {
  const { t } = useTranslation('commissions')
  const { venueId } = useCurrentVenue()
  const { getDisplayName: getRoleDisplayName } = useRoleConfig()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const { data: staffData } = useQuery({
    queryKey: ['team-members', venueId],
    queryFn: () => teamService.getTeamMembers(venueId!, 1, 100),
    enabled: !!venueId && open,
  })
  const staffList = staffData?.data || []

  const isValid = isCardValid(state, 'staff')
  const { mode, overrides } = state.staff

  const getDescription = () => {
    if (mode === 'all') {
      const excluded = overrides.filter(o => o.excluded).length
      const custom = overrides.filter(o => !o.excluded && o.customRate !== null).length
      if (excluded === 0 && custom === 0) return t('setup.staff.allStaff')
      const parts: string[] = [t('setup.staff.allStaff')]
      if (excluded > 0) parts.push(t('setup.staff.excludedCount', { count: excluded }))
      if (custom > 0) parts.push(t('setup.staff.customCount', { count: custom }))
      return parts.join(' · ')
    }
    const selected = overrides.filter(o => !o.excluded).length
    return selected === 0
      ? t('setup.staff.noneSelected')
      : t('setup.staff.selectedCount', { count: selected })
  }

  const isStaffInOverrides = (staffId: string) =>
    overrides.some(o => o.staffId === staffId)

  const addStaffOverride = (staffId: string, staffName: string) => {
    const newOverride: StaffOverride = {
      staffId,
      staffName,
      customRate: null,
      excluded: mode === 'all',
    }
    dispatch({
      type: 'SET_STAFF',
      data: { overrides: [...overrides, newOverride] },
    })
  }

  const removeOverride = (staffId: string) => {
    dispatch({
      type: 'SET_STAFF',
      data: { overrides: overrides.filter(o => o.staffId !== staffId) },
    })
  }

  const updateOverride = (staffId: string, updates: Partial<StaffOverride>) => {
    dispatch({
      type: 'SET_STAFF',
      data: {
        overrides: overrides.map(o =>
          o.staffId === staffId ? { ...o, ...updates } : o,
        ),
      },
    })
  }

  const toggleMode = () => {
    const newMode = mode === 'all' ? 'selected' : 'all'
    dispatch({
      type: 'SET_STAFF',
      data: { mode: newMode as 'all' | 'selected', overrides: [] },
    })
  }

  const filteredStaff = staffList.filter(
    s => !isStaffInOverrides(s.staffId) &&
      includesNormalized(`${s.firstName} ${s.lastName}`, search),
  )

  return (
    <>
      <SetupCard
        icon={Users}
        title={t('setup.staff.title')}
        description={getDescription()}
        isValid={isValid}
        touched={isCardTouched(state, 'staff')}
        onClick={() => setOpen(true)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('setup.staff.title')}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {/* Mode toggle */}
            <div className="flex items-center gap-3 p-3 rounded-xl border border-input bg-muted/20">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {mode === 'all' ? t('setup.staff.modeAll') : t('setup.staff.modeSelected')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {mode === 'all'
                    ? t('setup.staff.modeAllDesc')
                    : t('setup.staff.modeSelectedDesc')}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={toggleMode}>
                {mode === 'all' ? t('setup.staff.switchToSelected') : t('setup.staff.switchToAll')}
              </Button>
            </div>

            {/* Current overrides */}
            {overrides.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {mode === 'all' ? t('setup.staff.exceptions') : t('setup.staff.assigned')}
                </p>
                {overrides.map(override => (
                  <div
                    key={override.staffId}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border',
                      override.excluded
                        ? 'border-destructive/30 bg-destructive/5'
                        : 'border-input',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{override.staffName}</p>
                      {override.excluded ? (
                        <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 mt-1">
                          <UserX className="w-3 h-3 mr-1" />
                          {t('setup.staff.excluded')}
                        </Badge>
                      ) : override.customRate !== null ? (
                        <span className="text-xs text-muted-foreground">
                          {(override.customRate * 100).toFixed(1)}%
                        </span>
                      ) : null}
                    </div>

                    {mode === 'all' && !override.excluded && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground whitespace-nowrap">
                          {t('setup.staff.exclude')}
                        </label>
                        <Switch
                          checked={override.excluded}
                          onCheckedChange={checked =>
                            updateOverride(override.staffId, { excluded: checked })
                          }
                          className="scale-90"
                        />
                      </div>
                    )}

                    {!override.excluded && (
                      <div className="w-20">
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            placeholder={String((state.rate.defaultRate * 100).toFixed(1))}
                            value={override.customRate !== null ? (override.customRate * 100).toFixed(1) : ''}
                            onChange={e => {
                              const raw = e.target.value
                              updateOverride(override.staffId, {
                                customRate: raw === '' ? null : Number(raw) / 100,
                              })
                            }}
                            className="h-8 text-xs pr-5"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                            %
                          </span>
                        </div>
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                      onClick={() => removeOverride(override.staffId)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add staff */}
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {mode === 'all' ? t('setup.staff.addException') : t('setup.staff.addStaff')}
              </p>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('setup.staff.searchPlaceholder')}
                  className="pl-9"
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto space-y-1 rounded-lg border border-input p-1">
                {filteredStaff.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">
                    {t('setup.staff.noResults')}
                  </p>
                ) : (
                  filteredStaff.map(staff => (
                    <button
                      key={staff.staffId}
                      type="button"
                      onClick={() =>
                        addStaffOverride(staff.staffId, `${staff.firstName} ${staff.lastName}`)
                      }
                      className="w-full text-left flex items-center gap-2 rounded-md p-2 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {staff.firstName} {staff.lastName}
                        </p>
                        {staff.role && (
                          <p className="text-xs text-muted-foreground">
                            {getRoleDisplayName(staff.role)}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                )}
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
