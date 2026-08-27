import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { PermissionGate } from '@/components/PermissionGate'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { OperatingHoursEditor } from '@/pages/Reservations/components/OperatingHoursEditor'
import { attendanceService, type WeeklySchedule, type WorkScheduleException } from '@/services/attendance.service'
import { useVenueDateTime } from '@/utils/datetime'

/**
 * Cuadrante LABORAL de una persona: a qué hora entra y sale cada día.
 *
 * 🔴 No es la disponibilidad para citas (`StaffSchedule`) ni el turno de caja (`Shift`).
 * Es opcional siempre: sin cuadrante, a la persona no se le cuentan retardos ni faltas.
 * Nunca se pide en el alta — invitar a alguien no obliga a definirle la semana.
 */

interface Props {
  venueId: string
  staffVenueId: string
}

const EMPTY_DAY = { enabled: false, ranges: [] as { open: string; close: string }[] }
const DEFAULT_WEEK: WeeklySchedule = {
  monday: { enabled: true, ranges: [{ open: '09:00', close: '18:00' }] },
  tuesday: { enabled: true, ranges: [{ open: '09:00', close: '18:00' }] },
  wednesday: { enabled: true, ranges: [{ open: '09:00', close: '18:00' }] },
  thursday: { enabled: true, ranges: [{ open: '09:00', close: '18:00' }] },
  friday: { enabled: true, ranges: [{ open: '09:00', close: '18:00' }] },
  saturday: EMPTY_DAY,
  sunday: EMPTY_DAY,
}

export function WorkScheduleSection({ venueId, staffVenueId }: Props) {
  const { t } = useTranslation(['team', 'common'])
  const { formatCalendarDate, venueTimezone } = useVenueDateTime()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { can } = useAccess()
  const canManage = can('attendance:manage')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['work-schedule', venueId, staffVenueId],
    queryFn: () => attendanceService.getWorkSchedule(venueId, staffVenueId),
    enabled: !!venueId && !!staffVenueId,
  })

  const [hasSchedule, setHasSchedule] = useState(false)
  const [weekly, setWeekly] = useState<WeeklySchedule>(DEFAULT_WEEK)
  const [exceptions, setExceptions] = useState<WorkScheduleException[]>([])
  const [dirty, setDirty] = useState(false)

  // Con la carga fallida NO se edita: la pantalla mostraría los defaults 09–18 y un clic en
  // "Guardar" pisaría el cuadrante real con uno inventado (auditoría Codex fase 2, P2-7). Y sin
  // permiso de administrar, todo es lectura, no sólo el botón final (P3-2).
  const editable = canManage && !isError && !isLoading

  useEffect(() => {
    if (!data) return
    setHasSchedule(!!data.weekly)
    setWeekly(data.weekly ?? DEFAULT_WEEK)
    setExceptions(data.exceptions ?? [])
    setDirty(false)
  }, [data])

  const save = useMutation({
    mutationFn: () =>
      attendanceService.replaceWorkSchedule(venueId, staffVenueId, {
        weekly: hasSchedule ? weekly : null,
        exceptions: hasSchedule ? exceptions : [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-schedule', venueId, staffVenueId] })
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      setDirty(false)
      toast({ title: t('workSchedule.toasts.savedTitle'), description: t('workSchedule.toasts.savedDesc') })
    },
    onError: (error: any) => {
      toast({
        title: t('workSchedule.toasts.errorTitle'),
        description: error?.response?.data?.message || t('workSchedule.toasts.errorDesc'),
        variant: 'destructive',
      })
    },
  })

  function updateException(index: number, patch: Partial<WorkScheduleException>) {
    setExceptions(list => list.map((e, i) => (i === index ? { ...e, ...patch } : e)))
    setDirty(true)
  }

  return (
    <Card className="border-input">
      <CardContent className="p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">{t('workSchedule.title')}</h3>
            {!hasSchedule && (
              <Badge variant="outline" className="rounded-full">
                {t('workSchedule.none')}
              </Badge>
            )}
          </div>
          <PermissionGate permission="attendance:manage">
            <div className="flex items-center gap-3">
              <Label htmlFor="ws-toggle" className="text-xs text-muted-foreground cursor-pointer">
                {t('workSchedule.toggle')}
              </Label>
              <Switch
                id="ws-toggle"
                checked={hasSchedule}
                disabled={!editable}
                onCheckedChange={v => {
                  setHasSchedule(v)
                  setDirty(true)
                }}
              />
            </div>
          </PermissionGate>
        </div>

        <p className="text-xs text-muted-foreground">{t('workSchedule.hint')}</p>
        {!canManage && <p className="text-xs text-muted-foreground">{t('workSchedule.readOnly')}</p>}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common:loading')}</p>
        ) : isError ? (
          <div role="alert" className="rounded-lg border border-destructive/40 p-4 space-y-2">
            <p className="text-sm font-medium">{t('workSchedule.loadErrorTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('workSchedule.loadErrorDesc')}</p>
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => refetch()}>
              {t('workSchedule.retry')}
            </Button>
          </div>
        ) : !hasSchedule ? (
          <p className="text-sm text-muted-foreground">{t('workSchedule.emptyState')}</p>
        ) : (
          <>
            {/* El editor no expone `disabled`: en sólo lectura se apaga el puntero entero. */}
            <p className="text-[11px] text-muted-foreground">{t('workSchedule.overnightHint')}</p>
            <div aria-disabled={!editable} className={editable ? undefined : 'pointer-events-none opacity-60'}>
              <OperatingHoursEditor
                value={weekly}
                onChange={next => {
                  setWeekly(next)
                  setDirty(true)
                }}
              />
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">{t('workSchedule.exceptions.title')}</h4>
                <PermissionGate permission="attendance:manage">
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    disabled={!editable}
                    onClick={() => {
                      // "Hoy" en la zona del NEGOCIO: con `toISOString()` (UTC), en México a
                      // partir de las 18:00 se precargaba mañana (auditoría Codex fase 2, P2-5).
                      const today = new Intl.DateTimeFormat('en-CA', { timeZone: venueTimezone }).format(new Date())
                      setExceptions(list => [...list, { startDate: today, endDate: today, kind: 'OFF', note: '' }])
                      setDirty(true)
                    }}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    {t('workSchedule.exceptions.add')}
                  </Button>
                </PermissionGate>
              </div>

              {exceptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('workSchedule.exceptions.empty')}</p>
              ) : (
                <ul className="space-y-2">
                  {exceptions.map((ex, i) => (
                    <li
                      key={ex.id ?? `new-${i}`}
                      className="grid gap-2 rounded-lg border border-input p-3 sm:grid-cols-[auto_auto_auto_1fr_auto] sm:items-end"
                    >
                      <div className="space-y-1">
                        <Label className="text-[11px]">{t('workSchedule.exceptions.from')}</Label>
                        <Input
                          type="date"
                          className="h-9"
                          value={ex.startDate}
                          disabled={!editable}
                          onChange={e => updateException(i, { startDate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">{t('workSchedule.exceptions.to')}</Label>
                        <Input
                          type="date"
                          className="h-9"
                          value={ex.endDate}
                          disabled={!editable}
                          onChange={e => updateException(i, { endDate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">{t('workSchedule.exceptions.kind')}</Label>
                        <Select
                          value={ex.kind}
                          disabled={!editable}
                          onValueChange={v => updateException(i, { kind: v as 'OFF' | 'HOURS' })}
                        >
                          <SelectTrigger className="h-9 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OFF">{t('workSchedule.exceptions.off')}</SelectItem>
                            <SelectItem value="HOURS">{t('workSchedule.exceptions.hours')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        {ex.kind === 'HOURS' ? (
                          <div className="flex items-end gap-2">
                            <div className="space-y-1">
                              <Label className="text-[11px]">{t('workSchedule.exceptions.start')}</Label>
                              <Input
                                type="time"
                                className="h-9"
                                value={ex.startTime ?? ''}
                                disabled={!editable}
                                onChange={e => updateException(i, { startTime: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">{t('workSchedule.exceptions.end')}</Label>
                              <Input
                                type="time"
                                className="h-9"
                                value={ex.endTime ?? ''}
                                disabled={!editable}
                                onChange={e => updateException(i, { endTime: e.target.value })}
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <Label className="text-[11px]">{t('workSchedule.exceptions.note')}</Label>
                            <Input
                              className="h-9"
                              placeholder={t('workSchedule.exceptions.notePlaceholder')}
                              value={ex.note ?? ''}
                              disabled={!editable}
                              onChange={e => updateException(i, { note: e.target.value })}
                            />
                          </>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer text-destructive hover:text-destructive"
                        disabled={!editable}
                        onClick={() => {
                          setExceptions(list => list.filter((_, j) => j !== i))
                          setDirty(true)
                        }}
                        aria-label={t('workSchedule.exceptions.remove')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <PermissionGate permission="attendance:manage">
          {dirty && (
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                  setHasSchedule(!!data?.weekly)
                  setWeekly(data?.weekly ?? DEFAULT_WEEK)
                  setExceptions(data?.exceptions ?? [])
                  setDirty(false)
                }}
                disabled={save.isPending}
              >
                {t('common:cancel')}
              </Button>
              <Button className="cursor-pointer" onClick={() => save.mutate()} disabled={save.isPending || !editable}>
                {save.isPending ? t('workSchedule.saving') : t('workSchedule.save')}
              </Button>
            </div>
          )}
        </PermissionGate>

        {data?.exceptions?.length ? (
          <p className="text-[11px] text-muted-foreground">
            {t('workSchedule.lastException', { date: formatCalendarDate(data.exceptions[data.exceptions.length - 1].endDate) })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
