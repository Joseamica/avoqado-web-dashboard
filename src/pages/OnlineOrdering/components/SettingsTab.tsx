import { useMemo, useRef, useState, type RefObject } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Circle } from 'lucide-react'
import { z } from 'zod'

import { AvisoDeCarga, BotonReintentar } from '@/components/AvisoDeCarga'
import { PermissionGate } from '@/components/PermissionGate'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { falloDeCarga } from '@/lib/falloDeCarga'
import { PrivacyNoticeModal } from '@/pages/Customers/components/PrivacyNoticeModal'
import { OperatingHoursEditor } from '@/pages/Reservations/components/OperatingHoursEditor'
import { getSettings, getToPay, onlineOrderingKeys, serverMessage, updateSettings } from '@/services/onlineOrdering.service'
import { StaffRole } from '@/types'
import type { OnlineOrderingSettings, OnlineOrderingSettingsInput, StoreRequirement } from '@/types/onlineOrdering'
import type { OperatingHours } from '@/types/reservation'
import { useVenueDateTime } from '@/utils/datetime'

import { defaultWeek, overnightNotes, validateWeek } from '../lib/hours'
import { pauseLabel } from '../lib/pauseLabel'
import { StorefrontShareCard } from './StorefrontShareCard'

const PREP_OPTIONS = [10, 15, 20, 25, 30, 40, 45, 60, 90]
const REQUIREMENTS: StoreRequirement[] = ['address', 'phone', 'privacyNotice']
// El 4.º paso refleja la regla `NO_PAYMENT_MODE` del servidor: no se enciende (ni se queda encendida) sin un medio de pago VIVO:
// «Pagar al recoger», o la tarjeta prendida con un Stripe que sí cobra (`card.merchantStatus === 'READY'`).
// Mismo plazo que el servidor (`FOLIO_DEVICE_WINDOW_MS`): un aparato que cobra folios visto en los últimos 7 días cuenta como conectado.
const FOLIO_DEVICE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const CONFIRM_ERROR_CODES = ['NO_FOLIO_DEVICE', 'HOURS_REQUIRED', 'PAY_AT_PICKUP_REQUIRED']
const STEPS: (StoreRequirement | 'payment')[] = [...REQUIREMENTS, 'payment']

const schema = z.object({
  enabled: z.boolean(),
  acceptsPayAtPickup: z.boolean(),
  acceptsCardOnline: z.boolean(),
  requiresAcceptance: z.boolean(),
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
  acceptsCardOnline: !!s.acceptsCardOnline, // `!!`: un servidor sin fase 2 no lo manda y zod no deja guardar con undefined
  requiresAcceptance: s.requiresAcceptance !== false, // sin el campo (servidor viejo) = «Mi equipo»
  manualPause: s.manualPause,
  minOrderAmount: s.minOrderAmount,
  defaultPrepMinutes: s.defaultPrepMinutes,
  hours: s.hours,
})

/** «lunes a domingo, 07:00–21:00» sólo si toda la semana abre igual; si no, el texto general. */
const sameAllWeek = (h: OperatingHours | null) => {
  const days = h ? Object.values(h) : []
  const r = days[0]?.ranges?.[0]
  return (
    !!r &&
    days.length === 7 &&
    days.every(d => d.enabled && d.ranges.length === 1 && d.ranges[0].open === r.open && d.ranges[0].close === r.close)
  )
}

/** Patch estricto: sólo lo que cambió. `minOrderAmount` vacío NO se manda (nunca 0 a escondidas). */
function buildPatch(values: FormValues, saved: FormValues): Partial<OnlineOrderingSettingsInput> {
  const patch: Record<string, unknown> = {}
  for (const k of Object.keys(values) as (keyof FormValues)[]) {
    if (values[k] === undefined) continue
    if (JSON.stringify(values[k]) !== JSON.stringify(saved[k])) patch[k] = values[k]
  }
  return patch as Partial<OnlineOrderingSettingsInput>
}

/**
 * Los pasos para encender la tienda, cada uno con ✅ o ⬜. El aviso de privacidad se escribe y publica AQUÍ MISMO, con el editor de
 * Clientes (uno solo por negocio); quien no puede editarlo (`marketing:manage`, el mismo permiso de Clientes) ve a quién pedírselo.
 * Domicilio y teléfono ligan a la configuración del negocio sólo si quien mira puede abrirla (`settings/local` es de ADMIN o más);
 * si no, también ve a quién pedírselo, en vez de una liga que termina en «acceso denegado».
 */
function RequirementsList({
  missing,
  hasPayment,
  basePath,
  canOpenBusinessSettings,
  focusRef,
  noticeButtonRef,
  onWriteNotice,
  onEnable,
  enableDisabled,
  waitingDevice,
}: {
  missing: StoreRequirement[]
  /** Con el valor VIVO del formulario: apagar «Pagar al recoger» sin guardar ya quita el «Todo listo». */
  hasPayment: boolean
  basePath: string
  canOpenBusinessSettings: boolean
  focusRef: RefObject<HTMLDivElement>
  noticeButtonRef: RefObject<HTMLButtonElement>
  onWriteNotice: () => void
  onEnable: () => void
  enableDisabled: boolean
  /** Con «Nadie» y ningún aparato que cobre folios: aunque lo demás esté listo, todavía no se puede encender. */
  waitingDevice: boolean
}) {
  const { t } = useTranslation('onlineOrdering')
  const allSet = missing.length === 0 && hasPayment && !waitingDevice
  return (
    // Destino estable del foco tras publicar (el botón que abrió el editor desaparece). `Alert` no reenvía `ref` en React 18.
    <div ref={focusRef} tabIndex={-1} className="outline-none">
      <Alert role="status" data-tour="online-ordering-requirements">
        <AlertDescription className="space-y-2">
          <p className="font-medium">{t(allSet ? 'settings.requirements.allSet' : 'settings.requirements.title')}</p>
          {allSet && (
            <Button type="button" size="sm" className="cursor-pointer" disabled={enableDisabled} onClick={onEnable}>
              {t('settings.enable')}
            </Button>
          )}
          {/* Sin viñetas, Safari/VoiceOver deja de anunciarla como lista si no lleva el rol explícito. */}
          <ul role="list" className="space-y-2">
            {STEPS.map(r => {
              const done = r === 'payment' ? hasPayment : !missing.includes(r)
              return (
                <li key={r} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {done ? (
                    // `text-success` no se genera: el @theme no registra --color-success (sólo la variable --success).
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-(--success)" />
                  ) : (
                    <Circle aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="sr-only">{t(done ? 'settings.requirements.done' : 'settings.requirements.pending')}</span>
                  <span>{t(`settings.requirements.${r}.label`)}</span>
                  {!done &&
                    (r === 'privacyNotice' ? (
                      <PermissionGate
                        permission="marketing:manage"
                        fallback={<span className="text-muted-foreground">{t('settings.requirements.privacyNotice.askAdmin')}</span>}
                      >
                        <Button
                          ref={noticeButtonRef}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 cursor-pointer"
                          onClick={onWriteNotice}
                          data-tour="online-ordering-privacy-notice-btn"
                        >
                          {t('settings.requirements.privacyNotice.action')}
                        </Button>
                      </PermissionGate>
                    ) : r === 'payment' ? (
                      // El nombre sale de la misma etiqueta del interruptor de abajo: nunca se desfasan.
                      <span className="text-muted-foreground">
                        {t('settings.requirements.payment.hint', { name: t('settings.payAtPickup') })}
                      </span>
                    ) : canOpenBusinessSettings ? (
                      // Cada dato liga a la pestaña donde se captura: el teléfono vive en «Contacto e Imágenes».
                      <Link
                        to={`${basePath}/settings/local/${r === 'phone' ? 'contact-images' : 'basic-info'}`}
                        className="text-primary underline underline-offset-2"
                      >
                        {t(`settings.requirements.${r}.link`)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{t(`settings.requirements.${r}.askAdmin`)}</span>
                    ))}
                </li>
              )
            })}
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  )
}

export function SettingsTab() {
  const { t } = useTranslation('onlineOrdering')
  const { t: tRes } = useTranslation('reservations')
  const { venueId, venueSlug, fullBasePath } = useCurrentVenue()
  const { formatTime } = useVenueDateTime()
  const { toast } = useToast()
  const { role } = useAccess()
  // La misma regla que la guardia de `settings/local` (AdminProtectedRoute, nivel ADMIN): ADMIN, OWNER o SUPERADMIN.
  const canOpenBusinessSettings = role === StaffRole.ADMIN || role === StaffRole.OWNER || role === StaffRole.SUPERADMIN
  const qc = useQueryClient()
  const [serverMissing, setServerMissing] = useState<StoreRequirement[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  // Tras guardar una vez, la sugerencia por giro ya no se vuelve a preseleccionar (el servidor no guarda «ya elegí»).
  const [decided, setDecided] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const stepsRef = useRef<HTMLDivElement>(null)
  const noticeButtonRef = useRef<HTMLButtonElement>(null)
  const enableSwitchRef = useRef<HTMLButtonElement>(null)

  const settingsQuery = useQuery({
    queryKey: onlineOrderingKeys.settings(venueId ?? ''),
    queryFn: () => getSettings(venueId!),
    enabled: !!venueId,
  })
  const { data: settings } = settingsQuery

  const saved = useMemo(() => (settings ? toForm(settings) : undefined), [settings])
  // R37: el servidor nunca pone «Nadie» solo. Mientras el negocio no haya elegido (tienda apagada, sin Bandeja usada, sin guardar aquí),
  // el formulario ARRANCA en lo sugerido para su giro; como difiere de lo guardado, sale «Cambios sin guardar» hasta Guardar.
  const preselectNoOne =
    !decided &&
    !!settings &&
    !settings.enabled &&
    settings.requiresAcceptance !== false &&
    settings.suggestedRequiresAcceptance === false &&
    !settings.lastInboxPollAt
  const formValues = useMemo(() => (saved && preselectNoOne ? { ...saved, requiresAcceptance: false } : saved), [saved, preselectNoOne])
  const form = useForm<FormValues>({ resolver: zodResolver(schema), values: formValues })
  const { control, watch, setValue, handleSubmit, reset, formState } = form
  const hours = watch('hours')
  const enabled = watch('enabled')
  const payAtPickup = !!watch('acceptsPayAtPickup')
  const cardOn = !!watch('acceptsCardOnline')
  const noOne = watch('requiresAcceptance') === false
  const merchantStatus = settings?.card?.merchantStatus ?? 'NOT_CONNECTED'
  // Sólo con un Stripe que cobra se puede usar el switch; sin él va apagado y en gris (founder, 3-nov).
  const cardAvailable = merchantStatus === 'READY'
  // Con «Nadie» se paga en caja: el servidor fuerza «Pagar al recoger» prendido.
  const hasPayment = noOne || payAtPickup || (cardOn && merchantStatus === 'READY')

  const watched = watch()
  const hasChanges = !!saved && Object.keys(buildPatch(watched, saved)).length > 0
  const hourErrors = validateWeek(hours)
  const notes = overnightNotes(hours)

  const lastPoll = settings?.lastToPayPollAt ? new Date(settings.lastToPayPollAt).getTime() : null
  const deviceAgeMs = lastPoll === null ? null : Math.max(0, Date.now() - lastPoll)
  const deviceLive = deviceAgeMs !== null && deviceAgeMs <= FOLIO_DEVICE_WINDOW_MS

  // Volver a «Mi equipo» desde «Nadie» guardado: cuántos folios siguen esperando pago (el panel no manda latido).
  const backToTeam = settings?.requiresAcceptance === false && !noOne
  const toPayQuery = useQuery({
    queryKey: onlineOrderingKeys.toPay(venueId ?? ''),
    queryFn: () => getToPay(venueId!),
    enabled: !!venueId && backToTeam,
  })
  const foliosToPay = backToTeam ? (toPayQuery.data?.counts.toPay ?? 0) : 0

  const missing = REQUIREMENTS.filter(r => settings?.requirements?.[r] === false || serverMissing.includes(r))

  const mutation = useMutation({
    mutationFn: (patch: Partial<OnlineOrderingSettingsInput>) => updateSettings(venueId!, patch),
    onSuccess: next => {
      setDecided(true)
      // 🔴 La respuesta del PUT puede venir SIN `store`/`requirements` (sólo el GET los trae): se MEZCLA sobre la caché, nunca la
      // reemplaza, y luego se vuelve a pedir el GET como fuente de verdad.
      const key = onlineOrderingKeys.settings(venueId!)
      const cached = qc.getQueryData<OnlineOrderingSettings>(key)
      if (cached) {
        const merged = { ...cached, ...next }
        qc.setQueryData(key, merged)
        reset(toForm(merged))
      }
      void qc.invalidateQueries({ queryKey: key })
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
      if (data?.code && CONFIRM_ERROR_CODES.includes(data.code)) {
        setSaveError(t(`settings.confirm.errors.${data.code}`))
        return
      }
      setSaveError(serverMessage(error, t('settings.saveFailed')))
    },
  })

  if (!venueId || (settings === undefined && !falloDeCarga(settingsQuery))) return <Skeleton className="h-64 w-full rounded-xl" />
  // Un refetch fallido deja `isError` en true CON los datos de antes: la pestaña sigue en pie, con su aviso; el error sólo si nunca hubo datos.
  if (!settings || !saved) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-destructive">{t('settings.loadFailed')}</p>
        <BotonReintentar query={settingsQuery} />
      </div>
    )
  }

  const onSubmit = handleSubmit(values => {
    if (hourErrors.length) return
    const patch = buildPatch(values, saved)
    if (Object.keys(patch).length) mutation.mutate(patch)
  })

  // El interruptor sólo prende y espera «Guardar»; un botón «Encender» que no enciende sería otra trampa, así que éste prende y guarda
  // por el MISMO camino (mismo PUT, errores y aviso), junto con lo que hubiera sin guardar. Al encenderse, la lista y este botón se van:
  // el foco pasa al interruptor, no a <body>.
  const enableStore = () => {
    setValue('enabled', true, { shouldDirty: true })
    enableSwitchRef.current?.focus({ preventScroll: true })
    void onSubmit()
  }

  // El editor guarda el aviso en SU llave (`privacy-notice`); el requisito viaja en los ajustes. Al cerrarlo (al publicar, por
  // `onSaved`; sin publicar, con la X) se vuelven a pedir para que el ⬜ pase a ✅ y el interruptor se habilite solo, y lo que dijo un
  // 400 `STORE_REQUIREMENTS_MISSING` anterior sobre el aviso ya no manda: decide el GET nuevo.
  // 🔴 El foco lo pone este componente: el editor es un Dialog de Radix SIN `Dialog.Trigger`, así que al cerrar no lo devuelve a
  // nadie y caería a <body>. Publicado, el botón que lo abrió ya no existe: va a la lista de pasos. Sin publicar: de vuelta a ese
  // botón. Sólo si el foco se perdió o sigue en el editor que se cierra: si la persona ya pasó a otro campo mientras llegaba la
  // recarga, no se le roba.
  const closeNotice = () => {
    setNoticeOpen(false)
    setServerMissing(prev => prev.filter(r => r !== 'privacyNotice'))
    const key = onlineOrderingKeys.settings(venueId)
    void qc.invalidateQueries({ queryKey: key }).then(() => {
      const active = document.activeElement
      // N-4: el botón que abrió el editor también cuenta como «foco nuestro» (X o Esc con el guardado en vuelo, o el que puso este
      // componente): si la recarga dice publicado, ese botón se va y el foco caería a <body>.
      if (active && active !== document.body && active !== noticeButtonRef.current && !active.closest('[role="dialog"]')) return
      const published = qc.getQueryData<OnlineOrderingSettings>(key)?.requirements?.privacyNotice
      const target = published ? stepsRef.current : noticeButtonRef.current
      target?.focus({ preventScroll: true })
    })
  }

  // «Encender» se bloquea, y su texto lo dice, sólo con la tienda GUARDADA apagada y algo pendiente: un dato del negocio o la forma de
  // cobro. Con ella encendida, apagarla sin guardar debe poder volverse a encender, y la lista que el texto señala ni se ve.
  const waitingDevice = noOne && !deviceLive
  const enableBlocked = !settings.enabled && (missing.length > 0 || !hasPayment || waitingDevice)

  const store = settings.store
  const pause = pauseLabel(store, formatTime)
  const statusText = pause
    ? t(pause.key, pause.params)
    : store?.status
      ? t(`settings.status.${store.status}`, { defaultValue: store.status })
      : '—'

  return (
    // En tema oscuro, un interruptor apagado era `bg-muted` sobre la tarjeta (1.2:1) y no se veía; así da 3.3:1. Va aquí y no en `switch.tsx`
    // porque allá le ganaría al rojo de «inactivo» de Productos y Servicios.
    <form noValidate onSubmit={onSubmit} className="space-y-6 dark:[&_[role=switch][data-state=unchecked]]:bg-muted-foreground/60">
      <AvisoDeCarga query={settingsQuery} hayDatos />
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-background/95 p-3 backdrop-blur">
        <div className="text-sm" data-tour="online-ordering-store-status">
          <span className="text-muted-foreground">{t('settings.status.label')}: </span>
          <span className="font-medium">{statusText}</span>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && <span className="text-xs font-medium text-muted-foreground">{t('settings.unsaved')}</span>}
          <Button type="submit" className="cursor-pointer" disabled={!hasChanges || hourErrors.length > 0 || mutation.isPending}>
            {t('settings.save')}
          </Button>
        </div>
      </div>

      {saveError && (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      {/* Los pasos se ven mientras la tienda GUARDADA esté apagada (el servidor sólo los exige al encenderla), también con todo
          listo. Sin `requirements` no se sabe qué falta: sólo se pinta si un 400 `STORE_REQUIREMENTS_MISSING` lo dijo, nunca un
          «Todo listo» inventado. */}
      {!settings.enabled && (!!settings.requirements || serverMissing.length > 0) && (
        <RequirementsList
          missing={missing}
          hasPayment={hasPayment}
          basePath={fullBasePath}
          canOpenBusinessSettings={canOpenBusinessSettings}
          focusRef={stepsRef}
          noticeButtonRef={noticeButtonRef}
          onWriteNotice={() => setNoticeOpen(true)}
          onEnable={enableStore}
          enableDisabled={hourErrors.length > 0 || mutation.isPending}
          waitingDevice={waitingDevice}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.store.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="oo-enabled">{t('settings.enable')}</Label>
              {/* El texto y el interruptor usan la MISMA condición (`enableBlocked`, arriba): nunca se contradicen. */}
              <p className="text-xs text-muted-foreground">
                {!enabled && enableBlocked
                  ? missing.length === 0 && hasPayment && waitingDevice
                    ? t('settings.confirm.enableNoDevice')
                    : t('settings.enableBlocked')
                  : t('settings.enableHelp')}
              </p>
            </div>
            <Controller
              control={control}
              name="enabled"
              render={({ field }) => (
                <Switch
                  ref={enableSwitchRef}
                  id="oo-enabled"
                  aria-label={t('settings.enable')}
                  checked={!!field.value}
                  disabled={!field.value && enableBlocked}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <fieldset className="space-y-3" data-tour="online-ordering-confirm">
            <legend id="oo-confirm-legend" className="text-sm font-medium">
              {t('settings.confirm.title')}
            </legend>
            <Controller
              control={control}
              name="requiresAcceptance"
              render={({ field }) => (
                <RadioGroup
                  aria-labelledby="oo-confirm-legend"
                  value={field.value === false ? 'noOne' : 'team'}
                  onValueChange={v => field.onChange(v === 'team')}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  {(['team', 'noOne'] as const).map(k => (
                    <label
                      key={k}
                      htmlFor={`oo-confirm-${k}`}
                      className="flex cursor-pointer gap-3 rounded-lg border border-input p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-muted/50"
                    >
                      <RadioGroupItem
                        id={`oo-confirm-${k}`}
                        value={k}
                        className="mt-1"
                        aria-labelledby={`oo-confirm-${k}-label`}
                        aria-describedby={`oo-confirm-${k}-help`}
                      />
                      <span className="min-w-0 space-y-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span id={`oo-confirm-${k}-label`} className="text-sm font-medium">
                            {t(`settings.confirm.${k}.label`)}
                          </span>
                          {k === 'noOne' && settings.suggestedRequiresAcceptance === false && (
                            <Badge variant="secondary">{t('settings.confirm.suggested')}</Badge>
                          )}
                        </span>
                        <span id={`oo-confirm-${k}-help`} className="block text-xs text-muted-foreground">
                          {t(`settings.confirm.${k}.help`)}
                        </span>
                        <span className="block text-xs font-medium">{t(`settings.confirm.${k}.path`)}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              )}
            />
            {noOne && (
              <>
                <p className="text-xs text-muted-foreground">{t('settings.confirm.noOneNote')}</p>
                <Alert role="status" data-tour="online-ordering-no-one-checklist">
                  <AlertDescription className="space-y-2">
                    <p className="font-medium">{t('settings.confirm.checklistTitle')}</p>
                    <ul role="list" className="space-y-2">
                      <li className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {hours ? (
                          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-(--success)" />
                        ) : (
                          <Circle aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        {hours ? (
                          <span>
                            {sameAllWeek(hours)
                              ? t('settings.confirm.hoursOk', {
                                  days: t('settings.confirm.allWeek'),
                                  open: Object.values(hours)[0].ranges[0].open,
                                  close: Object.values(hours)[0].ranges[0].close,
                                })
                              : t('settings.confirm.hoursCustom')}
                          </span>
                        ) : (
                          <>
                            <span>{t('settings.confirm.hoursMissing')}</span>
                            <a href="#oo-hours-card" className="text-primary underline underline-offset-2">
                              {t('settings.confirm.hoursLink')}
                            </a>
                          </>
                        )}
                      </li>
                      <li className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {deviceLive ? (
                          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-(--success)" />
                        ) : (
                          <Circle aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span>
                          {deviceLive && deviceAgeMs !== null
                            ? deviceAgeMs < 3_600_000
                              ? t('settings.confirm.deviceOk', { minutes: Math.floor(deviceAgeMs / 60_000) })
                              : deviceAgeMs < 86_400_000
                                ? t('settings.confirm.deviceOkHours', { hours: Math.floor(deviceAgeMs / 3_600_000) })
                                : t('settings.confirm.deviceOkDays', { days: Math.floor(deviceAgeMs / 86_400_000) })
                            : t('settings.confirm.deviceMissing')}
                        </span>
                      </li>
                    </ul>
                    {!deviceLive && <p className="text-muted-foreground">{t('settings.confirm.deviceWhatToDo')}</p>}
                  </AlertDescription>
                </Alert>
              </>
            )}
            {foliosToPay > 0 && (
              <Alert role="status" data-tour="online-ordering-to-pay-notice">
                <AlertDescription className="space-y-1">
                  <p className="font-medium">{t('settings.confirm.toPayNotice.title', { count: foliosToPay })}</p>
                  <p className="text-muted-foreground">{t('settings.confirm.toPayNotice.body')}</p>
                </AlertDescription>
              </Alert>
            )}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 rounded-lg border border-input p-3">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="oo-pay">{t('settings.payAtPickup')}</Label>
                <Controller
                  control={control}
                  name="acceptsPayAtPickup"
                  render={({ field }) => (
                    <Switch
                      id="oo-pay"
                      aria-label={t('settings.payAtPickup')}
                      checked={noOne || !!field.value}
                      disabled={noOne}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
              {noOne && <p className="text-xs text-muted-foreground">{t('settings.confirm.payNoOne')}</p>}
            </div>
            <div className="space-y-1.5 rounded-lg border border-input p-3">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="oo-card">{t('settings.cardOnline')}</Label>
                <Controller
                  control={control}
                  name="acceptsCardOnline"
                  render={({ field }) => (
                    // El valor guardado no se toca: nace prendido de fábrica (paso 5) y, al conectar Stripe, la tarjeta queda lista sola.
                    <Switch
                      id="oo-card"
                      aria-label={t('settings.cardOnline')}
                      checked={!noOne && cardAvailable && !!field.value}
                      disabled={!cardAvailable || noOne}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
              {/* Sin Stripe que cobre: la línea dice qué falta y que Mercado Pago viene después. Con Stripe: el valor VIVO del switch. */}
              {noOne ? (
                <p className="text-xs text-muted-foreground">{t('settings.confirm.cardNoOne')}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {!cardAvailable
                    ? t(merchantStatus === 'NOT_CHARGEABLE' ? 'settings.card.notChargeable' : 'settings.card.notConnected')
                    : cardOn
                      ? t('settings.card.ready')
                      : t('settings.card.off')}{' '}
                  {!cardAvailable && canOpenBusinessSettings && (
                    // Integraciones es de ADMIN o más (la misma guardia que la configuración del negocio): sin ella, ni liga.
                    <Link to={`${fullBasePath}/settings/integrations`} className="text-primary underline underline-offset-2">
                      {t(merchantStatus === 'NOT_CHARGEABLE' ? 'settings.card.review' : 'settings.card.connect')}
                    </Link>
                  )}
                  {!cardAvailable && <span className="block">{t('settings.card.mercadoPagoSoon')}</span>}
                </p>
              )}
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

      <Card id="oo-hours-card" data-tour="online-ordering-hours">
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

      {/* El editor se pinta en un portal (FullScreenModal = Radix Dialog): en el DOM queda fuera de este <form>, así que su
          «Guardar aviso» nunca manda el formulario de la tienda. */}
      {/* Al publicar se cierra solo (`onSaved`): la lista de pasos se actualiza sin tener que cerrar con la X. */}
      <PrivacyNoticeModal venueId={venueId} open={noticeOpen} onClose={closeNotice} onSaved={closeNotice} />
    </form>
  )
}
