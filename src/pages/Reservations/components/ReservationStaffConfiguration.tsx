import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { TimePicker } from '@/components/ui/time-picker'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { getProducts } from '@/services/menu.service'
import reservationService from '@/services/reservation.service'
import teamService, { type TeamMember } from '@/services/team.service'
import type { OperatingHours, StaffScheduleException } from '@/types/reservation'
import {
  createDefaultWeeklySchedule,
  getScheduleExceptionError,
  prepareProductStaffIds,
  prepareStaffSchedulePayload,
  type ScheduleExceptionError,
} from '../staff-schedule-editor-model'
import { OperatingHoursEditor } from './OperatingHoursEditor'

interface ReservationStaffConfigurationProps {
  venueId: string
  venueHours: OperatingHours | null
}

function memberName(member: TeamMember) {
  return [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email
}

function ProductStaffEditor({
  venueId,
  members,
  products,
  canRead,
  canUpdate,
}: {
  venueId: string
  members: TeamMember[]
  products: Array<{ id: string; name: string }>
  canRead: boolean
  canUpdate: boolean
}) {
  const { t } = useTranslation('reservations')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [productId, setProductId] = useState('')
  const [restrictToSelected, setRestrictToSelected] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const mappingQuery = useQuery({
    queryKey: ['reservation-product-staff', venueId, productId],
    queryFn: () => reservationService.getProductStaff(venueId, productId),
    enabled: canRead && !!productId,
  })

  useEffect(() => {
    if (!mappingQuery.data) return
    const activeIds = members.map(member => member.id)
    const mappedIds = mappingQuery.data.staffVenueIds
    const mapsEveryActiveMember = activeIds.length > 0 && activeIds.every(id => mappedIds.includes(id))
    setRestrictToSelected(mappingQuery.data.explicit && !mapsEveryActiveMember)
    setSelectedIds(mappingQuery.data.explicit ? mappedIds : activeIds)
  }, [mappingQuery.data, members])

  const saveMutation = useMutation({
    mutationFn: () => {
      const staffVenueIds = prepareProductStaffIds(
        restrictToSelected,
        selectedIds,
        members.map(member => member.id),
      )
      if (staffVenueIds === null) throw new Error('EMPTY_EXPLICIT_MAPPING')
      return reservationService.replaceProductStaff(venueId, productId, staffVenueIds)
    },
    onSuccess: result => {
      queryClient.setQueryData(['reservation-product-staff', venueId, productId], result)
      toast({ title: t('settings.staffing.mappingSaved') })
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description:
          error.message === 'EMPTY_EXPLICIT_MAPPING'
            ? t('settings.staffing.selectAtLeastOne')
            : error.response?.data?.message || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  const toggleSelected = (staffVenueId: string, selected: boolean) => {
    setSelectedIds(current => (selected ? [...new Set([...current, staffVenueId])] : current.filter(id => id !== staffVenueId)))
  }

  return (
    <Card className="border-input p-4 sm:p-6">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{t('settings.staffing.serviceMappingTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('settings.staffing.serviceMappingHelp')}</p>
      </div>

      {!canRead ? (
        <p className="mt-4 text-sm text-muted-foreground">{t('settings.staffing.mappingReadPermission')}</p>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="staff-service">{t('settings.staffing.service')}</Label>
            <Select
              value={productId}
              onValueChange={value => {
                setProductId(value)
                setRestrictToSelected(false)
                setSelectedIds([])
              }}
            >
              <SelectTrigger id="staff-service" data-tour="reservation-service-staff-mapping">
                <SelectValue placeholder={t('settings.staffing.selectService')} />
              </SelectTrigger>
              <SelectContent>
                {products.map(product => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {productId && mappingQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {productId && mappingQuery.isError ? <p className="text-sm text-destructive">{t('settings.staffing.mappingLoadError')}</p> : null}

          {productId && mappingQuery.data ? (
            <>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-input p-3">
                <div>
                  <Label htmlFor="restrict-staff">{t('settings.staffing.restrictStaff')}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">{t('settings.staffing.restrictStaffHelp')}</p>
                </div>
                <Switch
                  id="restrict-staff"
                  checked={restrictToSelected}
                  onCheckedChange={checked => {
                    setRestrictToSelected(checked)
                    if (selectedIds.length === 0) setSelectedIds(members.map(member => member.id))
                  }}
                />
              </div>

              {restrictToSelected ? (
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-input p-2">
                  {members.map(member => (
                    <label key={member.id} className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/60">
                      <Checkbox
                        checked={selectedIds.includes(member.id)}
                        onCheckedChange={checked => toggleSelected(member.id, checked === true)}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">{memberName(member)}</span>
                    </label>
                  ))}
                  {members.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground">{t('settings.staffing.noActiveStaff')}</p>
                  ) : null}
                </div>
              ) : (
                <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{t('settings.staffing.allStaffEligible')}</p>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => saveMutation.mutate()}
                  disabled={!canUpdate || saveMutation.isPending || members.length === 0 || (restrictToSelected && selectedIds.length === 0)}
                >
                  {saveMutation.isPending ? tCommon('loading') : t('settings.staffing.saveMapping')}
                </Button>
              </div>
              {!canUpdate ? (
                <p className="text-right text-xs text-muted-foreground">{t('settings.staffing.mappingUpdatePermission')}</p>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </Card>
  )
}

function StaffScheduleEditor({
  venueId,
  venueHours,
  members,
  canRead,
  canUpdate,
}: {
  venueId: string
  venueHours: OperatingHours | null
  members: TeamMember[]
  canRead: boolean
  canUpdate: boolean
}) {
  const { t } = useTranslation('reservations')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [staffVenueId, setStaffVenueId] = useState('')
  const [useCustomWeekly, setUseCustomWeekly] = useState(false)
  const [weekly, setWeekly] = useState(() => createDefaultWeeklySchedule(venueHours))
  const [exceptions, setExceptions] = useState<StaffScheduleException[]>([])

  const scheduleQuery = useQuery({
    queryKey: ['reservation-staff-schedule', venueId, staffVenueId],
    queryFn: () => reservationService.getStaffSchedule(venueId, staffVenueId),
    enabled: canRead && !!staffVenueId,
  })

  useEffect(() => {
    if (!scheduleQuery.data) return
    setUseCustomWeekly(scheduleQuery.data.weekly !== null)
    setWeekly(createDefaultWeeklySchedule(scheduleQuery.data.weekly ?? venueHours))
    setExceptions(structuredClone(scheduleQuery.data.exceptions))
  }, [scheduleQuery.data, venueHours])

  const saveMutation = useMutation({
    mutationFn: () => {
      const error = getScheduleExceptionError(exceptions)
      if (error) throw new Error(error)
      return reservationService.replaceStaffSchedule(
        venueId,
        staffVenueId,
        prepareStaffSchedulePayload({ useCustomWeekly, weekly, exceptions }),
      )
    },
    onSuccess: result => {
      queryClient.setQueryData(['reservation-staff-schedule', venueId, staffVenueId], result)
      toast({ title: t('settings.staffing.scheduleSaved') })
    },
    onError: (error: any) => {
      const code = error.message as ScheduleExceptionError
      const localMessage = ['MAX_EXCEPTIONS', 'DATE_REQUIRED', 'DATE_RANGE', 'HOURS_REQUIRED', 'INVALID_HOURS'].includes(code)
        ? t(`settings.staffing.exceptionErrors.${code}`)
        : null
      toast({
        title: tCommon('error'),
        description: localMessage || error.response?.data?.message || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  const updateException = (index: number, patch: Partial<StaffScheduleException>) => {
    setExceptions(current =>
      current.map((exception, currentIndex) => {
        if (currentIndex !== index) return exception
        const next = { ...exception, ...patch }
        if (next.kind === 'OFF') {
          delete next.startTime
          delete next.endTime
        }
        return next
      }),
    )
  }

  return (
    <Card className="border-input p-4 sm:p-6">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{t('settings.staffing.scheduleTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('settings.staffing.scheduleHelp')}</p>
      </div>

      {!canRead ? (
        <p className="mt-4 text-sm text-muted-foreground">{t('settings.staffing.scheduleReadPermission')}</p>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="schedule-staff">{t('settings.staffing.professional')}</Label>
            <Select
              value={staffVenueId}
              onValueChange={value => {
                setStaffVenueId(value)
                setUseCustomWeekly(false)
                setWeekly(createDefaultWeeklySchedule(venueHours))
                setExceptions([])
              }}
            >
              <SelectTrigger id="schedule-staff" data-tour="reservation-staff-schedule">
                <SelectValue placeholder={t('settings.staffing.selectProfessional')} />
              </SelectTrigger>
              <SelectContent>
                {members.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {memberName(member)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {staffVenueId && scheduleQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {staffVenueId && scheduleQuery.isError ? (
            <p className="text-sm text-destructive">{t('settings.staffing.scheduleLoadError')}</p>
          ) : null}

          {staffVenueId && scheduleQuery.data ? (
            <>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-input p-3">
                <div>
                  <Label htmlFor="custom-weekly">{t('settings.staffing.customWeekly')}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">{t('settings.staffing.customWeeklyHelp')}</p>
                </div>
                <Switch id="custom-weekly" checked={useCustomWeekly} onCheckedChange={setUseCustomWeekly} />
              </div>

              {useCustomWeekly ? <OperatingHoursEditor value={weekly} onChange={setWeekly} /> : null}

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-medium">{t('settings.staffing.exceptions')}</h4>
                    <p className="text-xs text-muted-foreground">{t('settings.staffing.exceptionsHelp')}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={exceptions.length >= 30}
                    onClick={() => setExceptions(current => [...current, { startDate: '', endDate: '', kind: 'OFF' }])}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    {t('settings.staffing.addException')}
                  </Button>
                </div>

                {exceptions.map((exception, index) => (
                  <div key={index} className="space-y-3 rounded-lg border border-input p-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1.5">
                        <Label htmlFor={`exception-start-${index}`}>{t('settings.staffing.startDate')}</Label>
                        <Input
                          id={`exception-start-${index}`}
                          type="date"
                          value={exception.startDate}
                          onChange={event => updateException(index, { startDate: event.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`exception-end-${index}`}>{t('settings.staffing.endDate')}</Label>
                        <Input
                          id={`exception-end-${index}`}
                          type="date"
                          value={exception.endDate}
                          onChange={event => updateException(index, { endDate: event.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t('settings.staffing.exceptionType')}</Label>
                        <Select
                          value={exception.kind}
                          onValueChange={kind => updateException(index, { kind: kind as StaffScheduleException['kind'] })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OFF">{t('settings.staffing.exceptionOff')}</SelectItem>
                            <SelectItem value="HOURS">{t('settings.staffing.exceptionHours')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t('settings.staffing.removeException')}
                          onClick={() => setExceptions(current => current.filter((_, currentIndex) => currentIndex !== index))}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {exception.kind === 'HOURS' ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <TimePicker
                          value={exception.startTime ?? ''}
                          onChange={startTime => updateException(index, { startTime })}
                          label={t('settings.staffing.startTime')}
                        />
                        <TimePicker
                          value={exception.endTime ?? ''}
                          onChange={endTime => updateException(index, { endTime })}
                          label={t('settings.staffing.endTime')}
                        />
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <Label htmlFor={`exception-note-${index}`}>{t('settings.staffing.note')}</Label>
                      <Input
                        id={`exception-note-${index}`}
                        value={exception.note ?? ''}
                        maxLength={200}
                        onChange={event => updateException(index, { note: event.target.value })}
                        placeholder={t('settings.staffing.notePlaceholder')}
                      />
                    </div>
                  </div>
                ))}

                {exceptions.length === 0 ? (
                  <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{t('settings.staffing.noExceptions')}</p>
                ) : null}
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={() => saveMutation.mutate()} disabled={!canUpdate || saveMutation.isPending}>
                  {saveMutation.isPending ? tCommon('loading') : t('settings.staffing.saveSchedule')}
                </Button>
              </div>
              {!canUpdate ? (
                <p className="text-right text-xs text-muted-foreground">{t('settings.staffing.scheduleUpdatePermission')}</p>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </Card>
  )
}

export function ReservationStaffConfiguration({ venueId, venueHours }: ReservationStaffConfigurationProps) {
  const { t } = useTranslation('reservations')
  const { can, isLoading: accessLoading } = useAccess()
  const canReadTeam = can('teams:read')
  const canReadMenu = can('menu:read')

  const teamQuery = useQuery({
    queryKey: ['team', venueId, 'reservation-staff-configuration'],
    queryFn: () => teamService.getTeamMembers(venueId, 1, 100),
    enabled: !accessLoading && canReadTeam,
    staleTime: 60_000,
  })
  const productsQuery = useQuery({
    queryKey: ['products', venueId, 'all'],
    queryFn: () => getProducts(venueId, { orderBy: 'name' }),
    enabled: !accessLoading && canReadMenu,
    staleTime: 60_000,
  })

  const members = useMemo(() => (teamQuery.data?.data ?? []).filter(member => member.active), [teamQuery.data])
  const appointmentProducts = useMemo(
    () =>
      (productsQuery.data ?? [])
        .filter(product => product.active && product.type === 'APPOINTMENTS_SERVICE')
        .map(product => ({ id: product.id, name: product.name })),
    [productsQuery.data],
  )

  return (
    <section className="space-y-3" data-tour="reservation-settings-staffing">
      <div>
        <h2 className="text-base font-semibold">{t('settings.sections.staffing')}</h2>
        <p className="text-sm text-muted-foreground">{t('settings.staffing.sectionHelp')}</p>
      </div>

      {accessLoading || teamQuery.isLoading || productsQuery.isLoading ? (
        <Card className="flex min-h-28 items-center justify-center border-input">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <ProductStaffEditor
            venueId={venueId}
            members={members}
            products={appointmentProducts}
            canRead={canReadTeam && canReadMenu}
            canUpdate={can('menu:update')}
          />
          <StaffScheduleEditor
            venueId={venueId}
            venueHours={venueHours}
            members={members}
            canRead={canReadTeam}
            canUpdate={can('teams:update')}
          />
        </div>
      )}
    </section>
  )
}
