import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { OperatingHoursEditor } from '@/pages/Reservations/components/OperatingHoursEditor'
import { getSettings, onlineOrderingKeys, serverMessage, updateSettings } from '@/services/onlineOrdering.service'
import type { OnlineOrderingSettings, OnlineOrderingSettingsInput, StoreRequirement } from '@/types/onlineOrdering'
import type { OperatingHours } from '@/types/reservation'
import { useVenueDateTime } from '@/utils/datetime'

import { defaultWeek, overnightNotes, validateWeek } from '../lib/hours'
import { StorefrontShareCard } from './StorefrontShareCard'

const PREP_OPTIONS = [10, 15, 20, 25, 30, 40, 45, 60, 90]
const REQUIREMENTS: StoreRequirement[] = ['address', 'phone', 'privacyNotice']

const schema = z.object({
  enabled: z.boolean(),
  acceptsPayAtPickup: z.boolean(),
  manualPause: z.boolean(),
  minOrderAmount: z
    .number({ invalid_type_error: 'range' })
    .min(0, 'range')
    .max(100000, 'range')
    .refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'decimals')
    .optional(),
  defaultPrepMinutes: z.number(),
  hours: z.custom<OperatingHours | null>(),
})
type FormValues = z.infer<typeof schema>

const toForm = (s: OnlineOrderingSettings): FormValues => ({
  enabled: s.enabled,
  acceptsPayAtPickup: s.acceptsPayAtPickup,
  manualPause: s.manualPause,
  minOrderAmount: s.minOrderAmount,
  defaultPrepMinutes: s.defaultPrepMinutes,
  hours: s.hours,
})

/** Patch estricto: sólo lo que cambió. `minOrderAmount` vacío NO se manda (nunca 0 a escondidas). */
function buildPatch(values: FormValues, saved: FormValues): Partial<OnlineOrderingSettingsInput> {
  const patch: Record<string, unknown> = {}
  for (const k of Object.keys(values) as (keyof FormValues)[]) {
    if (values[k] === undefined) continue
    if (JSON.stringify(values[k]) !== JSON.stringify(saved[k])) patch[k] = values[k]
  }
  return patch as Partial<OnlineOrderingSettingsInput>
}

function RequirementsList({ missing, basePath }: { missing: StoreRequirement[]; basePath: string }) {
  const { t } = useTranslation('onlineOrdering')
  const to = (r: StoreRequirement) => (r === 'privacyNotice' ? `${basePath}/customers` : `${basePath}/settings/local/basic-info`)
  return (
    <Alert data-tour="online-ordering-requirements">
      <AlertDescription className="space-y-2">
        <p className="font-medium">{t('settings.requirements.title')}</p>
        <ul className="list-disc space-y-1 pl-5">
          {missing.map(r => (
            <li key={r}>
              {t(`settings.requirements.${r}.label`)}{' '}
              <Link to={to(r)} className="text-primary underline underline-offset-2">
                {t(`settings.requirements.${r}.link`)}
              </Link>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

export function SettingsTab() {
  const { t } = useTranslation('onlineOrdering')
  const { t: tRes } = useTranslation('reservations')
  const { venueId, venueSlug, fullBasePath } = useCurrentVenue()
  const { formatTime } = useVenueDateTime()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [serverMissing, setServerMissing] = useState<StoreRequirement[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)

  const { data: settings, isLoading, isError } = useQuery({
    queryKey: onlineOrderingKeys.settings(venueId ?? ''),
    queryFn: () => getSettings(venueId!),
    enabled: !!venueId,
  })

  const saved = useMemo(() => (settings ? toForm(settings) : undefined), [settings])
  const form = useForm<FormValues>({ resolver: zodResolver(schema), values: saved })
  const { control, watch, setValue, handleSubmit, reset, formState } = form
  const hours = watch('hours')
  const enabled = watch('enabled')

  const watched = watch()
  const hasChanges = !!saved && Object.keys(buildPatch(watched, saved)).length > 0
  const hourErrors = validateWeek(hours)
  const notes = overnightNotes(hours)

  const missing = REQUIREMENTS.filter(r => settings?.requirements?.[r] === false || serverMissing.includes(r))

  const mutation = useMutation({
    mutationFn: (patch: Partial<OnlineOrderingSettingsInput>) => updateSettings(venueId!, patch),
    onSuccess: next => {
      qc.setQueryData(onlineOrderingKeys.settings(venueId!), next)
      reset(toForm(next))
      setServerMissing([])
      setSaveError(null)
      toast({ title: t('settings.saved') })
    },
    onError: (error: unknown) => {
      const data = (error as { response?: { data?: { code?: string; details?: { missing?: StoreRequirement[] } } } })?.response?.data
      if (data?.code === 'STORE_REQUIREMENTS_MISSING') {
        setServerMissing(data.details?.missing ?? [])
        setSaveError(null)
        return
      }
      setSaveError(serverMessage(error, t('settings.saveFailed')))
    },
  })

  if (isLoading || !venueId) return <Skeleton className="h-64 w-full rounded-xl" />
  if (isError || !settings || !saved) return <p className="text-sm text-destructive">{t('settings.loadFailed')}</p>

  const onSubmit = handleSubmit(values => {
    if (hourErrors.length) return
    const patch = buildPatch(values, saved)
    if (Object.keys(patch).length) mutation.mutate(patch)
  })

  const store = settings.store
  const statusText = (() => {
    if (store.status === 'PAUSED') {
      return store.manualPause || !store.pausedUntil
        ? t('settings.status.pausedManual')
        : t('settings.status.pausedUntil', { time: formatTime(store.pausedUntil) })
    }
    return t(`settings.status.${store.status}`, { defaultValue: store.status })
  })()

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-6">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-background/95 p-3 backdrop-blur">
        <div className="text-sm" data-tour="online-ordering-store-status">
          <span className="text-muted-foreground">{t('settings.status.label')}: </span>
          <span className="font-medium">{statusText}</span>
        </div>
        <Button type="submit" className="cursor-pointer" disabled={!hasChanges || hourErrors.length > 0 || mutation.isPending}>
          {t('settings.save')}
        </Button>
      </div>

      {saveError && (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      {missing.length > 0 && <RequirementsList missing={missing} basePath={fullBasePath} />}

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.store.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="oo-enabled">{t('settings.enable')}</Label>
              <p className="text-xs text-muted-foreground">
                {!enabled && missing.length > 0 ? t('settings.enableBlocked') : t('settings.enableHelp')}
              </p>
            </div>
            <Controller
              control={control}
              name="enabled"
              render={({ field }) => (
                <Switch
                  id="oo-enabled"
                  aria-label={t('settings.enable')}
                  checked={!!field.value}
                  disabled={!field.value && missing.length > 0}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-input p-3">
              <Label htmlFor="oo-pay">{t('settings.payAtPickup')}</Label>
              <Controller
                control={control}
                name="acceptsPayAtPickup"
                render={({ field }) => (
                  <Switch id="oo-pay" aria-label={t('settings.payAtPickup')} checked={!!field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-input p-3 opacity-70">
              <Label htmlFor="oo-card">{t('settings.cardOnline')}</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t('settings.soon')}</span>
                <Switch id="oo-card" aria-label={t('settings.cardOnline')} checked={false} disabled />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="oo-min">{t('settings.minOrder')}</Label>
              <Controller
                control={control}
                name="minOrderAmount"
                render={({ field }) => (
                  <Input
                    id="oo-min"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100000}
                    step="0.01"
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                  />
                )}
              />
              {formState.errors.minOrderAmount ? (
                <p role="alert" className="text-xs text-destructive">
                  {t(`settings.minOrderErrors.${formState.errors.minOrderAmount.message === 'decimals' ? 'decimals' : 'range'}`)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{t('settings.minOrderHelp')}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oo-prep">{t('settings.prepTime')}</Label>
              <Controller
                control={control}
                name="defaultPrepMinutes"
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={v => field.onChange(Number(v))}>
                    <SelectTrigger id="oo-prep" aria-label={t('settings.prepTime')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PREP_OPTIONS.map(m => (
                        <SelectItem key={m} value={String(m)}>
                          {t('settings.prepOption', { minutes: m })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-input p-3">
            <div>
              <Label htmlFor="oo-pause">{t('settings.manualPause')}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.manualPauseHelp')}</p>
            </div>
            <Controller
              control={control}
              name="manualPause"
              render={({ field }) => (
                <Switch id="oo-pause" aria-label={t('settings.manualPause')} checked={!!field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card data-tour="online-ordering-hours">
        <CardHeader>
          <CardTitle>{t('settings.hours.title')}</CardTitle>
          <CardDescription>{hours ? t('settings.hours.onHelp') : t('settings.hours.offHelp')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              id="oo-hours"
              aria-label={t('settings.hours.use')}
              checked={hours !== null}
              onCheckedChange={on => setValue('hours', on ? defaultWeek() : null, { shouldDirty: true })}
            />
            <Label htmlFor="oo-hours">{t('settings.hours.use')}</Label>
          </div>
          {hours && (
            <>
              <OperatingHoursEditor value={hours} onChange={next => setValue('hours', next, { shouldDirty: true })} />
              {hourErrors.map(e => (
                <p key={e} className="text-sm text-destructive">
                  {t(`settings.hours.errors.${e}`)}
                </p>
              ))}
              {notes.map(n => (
                <p key={`${n.day}-${n.close}`} className="text-xs text-muted-foreground">
                  {t('settings.hours.overnight', {
                    day: tRes(`settings.operatingHours.days.${n.day}`),
                    time: n.close,
                    nextDay: tRes(`settings.operatingHours.days.${n.nextDay}`).toLowerCase(),
                  })}
                </p>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {venueSlug && <StorefrontShareCard slug={venueSlug} />}
    </form>
  )
}
