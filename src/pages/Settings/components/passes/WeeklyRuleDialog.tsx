import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { WeeklyRuleInput, WeeklyRuleView } from '@/types/passes'
import { SPOTS_INPUT_PROPS, isValidSpots, readSpots, toStartMinute } from './passesFormat'

interface WeeklyRuleDialogProps {
  open: boolean
  onClose: () => void
  onSave: (input: WeeklyRuleInput) => void
  saving: boolean
  /** Excepciones que ya existen: si el día y la hora elegidos ya tienen una con otro valor, se avisa que se reemplaza. */
  existing?: WeeklyRuleView[]
  /** Error del server al guardar, tal cual: va aquí dentro porque el diálogo tapa la lista que habría que corregir. */
  error?: string | null
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const // lunes primero, como lo piensa un dueño; 0 = domingo

/**
 * «+ Agregar» de las excepciones por día y hora (spec §6, capa 2). Un `<select>` y un `<input type="time">` nativos:
 * son los controles que el navegador ya sabe dibujar y que un dueño ya conoce; no hay nada que un picker propio
 * resuelva mejor aquí. Si el server rechaza el guardado, el diálogo sigue abierto con lo tecleado y su mensaje (lo cierra
 * el padre sólo al guardar).
 */
export function WeeklyRuleDialog({ open, onClose, onSave, saving, existing = [], error = null }: WeeklyRuleDialogProps) {
  const { t } = useTranslation('passes')
  const [weekday, setWeekday] = useState(1)
  const [allDay, setAllDay] = useState(false)
  const [time, setTime] = useState('')
  const [spots, setSpots] = useState<number | null>(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setWeekday(1)
      setAllDay(false)
      setTime('')
      setSpots(null)
      setTouched(false)
    }
  }, [open])

  const startMinute = allDay ? null : toStartMinute(time)
  const timeError = !allDay && startMinute === null
  const spotsError = !isValidSpots(spots)
  // Con una hora a medio escribir no hay día+hora que comparar (y no debe parecerse a «todo el día», que también es null).
  const current = allDay || startMinute !== null ? existing.find(r => r.weekday === weekday && r.startMinute === startMinute) : undefined
  const showTimeError = touched && timeError
  const showSpotsError = touched && spotsError

  const submit = () => {
    setTouched(true)
    if (timeError || !isValidSpots(spots)) return
    onSave({ weekday, startMinute, maxSpots: spots })
  }

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={t('capacity.dialog.title')}
      contentClassName="bg-muted/30"
      actions={
        <Button type="button" onClick={submit} disabled={saving} data-tour="passes-weekly-save">
          {saving ? t('common:saving') : t('common:save')}
        </Button>
      }
    >
      <div className="mx-auto max-w-xl p-4 md:p-6">
        <div className="space-y-5 rounded-2xl border border-border/50 bg-card p-6">
          <p className="text-sm text-muted-foreground">{t('capacity.dialog.subtitle')}</p>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="weekly-weekday">{t('capacity.dialog.weekday')}</Label>
            <select
              id="weekly-weekday"
              className="flex h-12 w-full rounded-md border border-input bg-background px-3 text-base"
              value={weekday}
              onChange={e => setWeekday(Number(e.target.value))}
              data-tour="passes-weekly-weekday"
            >
              {WEEKDAYS.map(d => (
                <option key={d} value={d}>
                  {t(`days.${d}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-input px-4 py-3">
            <Label htmlFor="weekly-allday">{t('capacity.dialog.allDay')}</Label>
            <Switch
              id="weekly-allday"
              checked={allDay}
              onCheckedChange={setAllDay}
              aria-label={t('capacity.dialog.allDay')}
              data-tour="passes-weekly-allday"
            />
          </div>

          {!allDay && (
            <div className="space-y-1.5">
              <Label htmlFor="weekly-time">{t('capacity.dialog.time')}</Label>
              <Input
                id="weekly-time"
                type="time"
                step={300}
                className="h-12 text-base"
                value={time}
                onChange={e => setTime(e.target.value)}
                aria-invalid={showTimeError}
                aria-describedby={showTimeError ? 'weekly-time-error' : undefined}
                data-tour="passes-weekly-time"
              />
              {showTimeError && (
                <p id="weekly-time-error" className="text-xs text-destructive">
                  {t('capacity.dialog.errors.time')}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="weekly-spots">{t('capacity.dialog.spots')}</Label>
            <Input
              id="weekly-spots"
              {...SPOTS_INPUT_PROPS}
              className="h-12 text-base"
              value={spots ?? ''}
              onChange={e => setSpots(readSpots(e.target.value))}
              aria-invalid={showSpotsError}
              aria-describedby={showSpotsError ? 'weekly-spots-hint weekly-spots-error' : 'weekly-spots-hint'}
              data-tour="passes-weekly-spots"
            />
            <p id="weekly-spots-hint" className="text-xs text-muted-foreground">
              {t('capacity.dialog.spotsHint')}
            </p>
            {showSpotsError && (
              <p id="weekly-spots-error" className="text-xs text-destructive">
                {t('capacity.dialog.errors.spots')}
              </p>
            )}
          </div>

          {current && current.maxSpots !== spots && (
            <p className="rounded-lg border border-input bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {t('capacity.weekly.replaces', { count: current.maxSpots })}
            </p>
          )}
        </div>
      </div>
    </FullScreenModal>
  )
}
