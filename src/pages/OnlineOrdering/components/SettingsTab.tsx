import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
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
  cardOnlineNadie: z.boolean(),
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
  cardOnlineNadie: s.cardOnlineNadie === true, // D661: apagado de fábrica; sin el campo (servidor viejo), apagado
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

/** Ruling 64: sin respuesta, un 5xx o un 408: el SERVIDOR pudo haber guardado sin que nos enteráramos. */
const sinRespuesta = (err: unknown) => {
  const res = (err as { response?: { status?: unknown } } | undefined)?.response
  return !res || (typeof res.status === 'number' && (res.status >= 500 || res.status === 408))
}
/**
 * Ruling 92: si contestó NUESTRO servidor (su error trae JSON), la petición ya terminó. Sin respuesta, o con la página de error de un
 * intermediario, pudo seguir en el SERVIDOR; pasado este plazo ya no puede estar en camino (el mismo de las devoluciones en duda).
 */
const contestoElServidor = (err: unknown) => {
  const data = (err as { response?: { data?: unknown } } | undefined)?.response?.data
  return typeof data === 'object' && data !== null
}
const EN_CAMINO_MS = 10 * 60_000

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
  const { formatTime, formatDateTime } = useVenueDateTime()
  const { toast } = useToast()
  const { role } = useAccess()
  // La misma regla que la guardia de `settings/local` (AdminProtectedRoute, nivel ADMIN): ADMIN, OWNER o SUPERADMIN.
  const canOpenBusinessSettings = role === StaffRole.ADMIN || role === StaffRole.OWNER || role === StaffRole.SUPERADMIN
  const qc = useQueryClient()
  const [serverMissing, setServerMissing] = useState<StoreRequirement[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  // D661: 409 NO_CARD_ALERT_DEVICE al prender «Pagar en línea»; el aviso va junto a su interruptor.
  const [cardAlertMissing, setCardAlertMissing] = useState(false)
  // Ruling 92: un guardado sin respuesta cierta, hasta saber en qué quedó: lo mandado, cuándo salió y hasta cuándo pudo seguir en camino.
  const [sinConfirmar, setSinConfirmar] = useState<{ patch: Partial<FormValues>; salio: number; hasta: number } | null>(null)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const stepsRef = useRef<HTMLDivElement>(null)
  const noticeButtonRef = useRef<HTMLButtonElement>(null)
  const enableSwitchRef = useRef<HTMLButtonElement>(null)

  // D661 · Ruling 92: `vistaDesde` = cuándo EMPEZÓ la lectura de lo que se ve (el SERVIDOR no manda versión ni `updatedAt` de los
  // ajustes); con eso se sabe si una lectura empezó después del guardado en duda o de que ya no pudo estar en camino. (La respuesta tardía
  // de un guardado la decide la caché de la sucursal: Ruling 103, en `onSuccess`.)
  const vistaDesde = useRef(0)
  const leerAjustes = async () => {
    const desde = Date.now()
    const ajustes = await getSettings(venueId!)
    vistaDesde.current = Math.max(vistaDesde.current, desde)
    return ajustes
  }

  const settingsQuery = useQuery({
    queryKey: onlineOrderingKeys.settings(venueId ?? ''),
    queryFn: () => leerAjustes(),
    enabled: !!venueId,
    // D661 · Ruling 63: «¿se ofrece la tarjeta AHORA?» es una foto (el SERVIDOR la mide en 90 s) y otra persona puede prenderla: en
    // «Nadie» se vuelve a pedir cada 30 s, prendida o apagada. Lo que se está editando no se pisa (`keepDirtyValues`, abajo).
    // Ruling 92: con un guardado sin confirmar también se relee así, en los dos modos, hasta saber en qué quedó.
    refetchInterval: q => (q.state.data?.requiresAcceptance === false || sinConfirmar ? 30_000 : false),
  })
  const { data: settings } = settingsQuery
  // Ruling 63: «ahora» sólo con una lectura buena de hace ≤ 60 s y sin fallar; si no, la hora de esa lectura. El temporizador vuelve a
  // pintar justo cuando la última lectura buena cumple 60 s (una lectura que no termina no avisa de nada).
  const leidoEn = settingsQuery.dataUpdatedAt
  const [, repintar] = useState(0)
  useEffect(() => {
    const falta = leidoEn + 60_000 - Date.now()
    if (!leidoEn || falta <= 0) return
    const id = setTimeout(() => repintar(n => n + 1), falta + 50)
    return () => clearTimeout(id)
  }, [leidoEn])
  // Ronda 3: «sin conexión» sólo si la lectura falla. Una vieja (> 60 s) es la de «Nadie», que se relee sola; en «Mi equipo» una lectura
  // vieja es lo normal y sólo cuenta si falla.
  const lecturaFalla = settingsQuery.isError || settingsQuery.failureCount > 0 || settingsQuery.isPaused
  const lecturaVieja = settingsQuery.data?.requiresAcceptance === false && Date.now() - leidoEn > 60_000

  const saved = useMemo(() => (settings ? toForm(settings) : undefined), [settings])
  // R37/R66: el servidor nunca pone «Nadie» solo. Sólo si el negocio NO tiene ajustes guardados (`hasSavedSettings === false`) el
  // formulario ARRANCA en lo sugerido para su giro; como difiere de lo guardado, sale «Cambios sin guardar» hasta Guardar.
  // Sin el campo (servidor viejo) o con true: se muestra lo guardado, sin preselección.
  const preselectNoOne = !!settings && settings.hasSavedSettings === false && settings.suggestedRequiresAcceptance === false
  const formValues = useMemo(() => (saved && preselectNoOne ? { ...saved, requiresAcceptance: false } : saved), [saved, preselectNoOne])
  // Ruling 65: una lectura nueva (cada 30 s en «Nadie», al volver a la pestaña) pone lo que cambió otra persona, pero no pisa los
  // campos que se están editando aquí.
  const form = useForm<FormValues>({ resolver: zodResolver(schema), values: formValues, resetOptions: { keepDirtyValues: true } })
  const { control, watch, setValue, getValues, resetField, handleSubmit, reset, formState } = form
  const hours = watch('hours')
  const enabled = watch('enabled')
  const payAtPickup = !!watch('acceptsPayAtPickup')
  const cardOn = !!watch('acceptsCardOnline')
  const noOne = watch('requiresAcceptance') === false
  const cardNadieOn = !!watch('cardOnlineNadie')
  const merchantStatus = settings?.card?.merchantStatus ?? 'NOT_CONNECTED'
  // Sólo con un Stripe que cobra se puede usar el switch; sin él va apagado y en gris (founder, 3-nov).
  const cardAvailable = merchantStatus === 'READY'
  // Con «Nadie» se paga en caja: el servidor fuerza «Pagar al recoger» prendido.
  const hasPayment = noOne || payAtPickup || (cardOn && merchantStatus === 'READY')

  const watched = watch()
  const hasChanges = !!saved && Object.keys(buildPatch(watched, saved)).length > 0
  // Ruling 65: los campos que se editan aquí (distintos de lo guardado) y que otra persona cambió en el SERVIDOR desde la lectura sobre
  // la que se empezó a editar (`base`). Al guardar se queda lo de aquí; se avisa debajo de cada uno antes.
  const editados = saved
    ? (Object.keys(formState.dirtyFields) as (keyof FormValues)[]).filter(k => JSON.stringify(watched[k]) !== JSON.stringify(saved[k]))
    : []
  const [base, setBase] = useState(saved)
  if (saved !== base && editados.length === 0) setBase(saved)
  const otraPersona = new Set(base && saved ? editados.filter(k => JSON.stringify(saved[k]) !== JSON.stringify(base[k])) : [])
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
    // Ruling 91: cuándo salió este guardado. Ruling 92: uno nuevo deja atrás lo que no se pudo confirmar del anterior (decide el suyo).
    onMutate: () => {
      setSinConfirmar(null)
      return { salio: Date.now() }
    },
    onSuccess: (next, _patch, enviado) => {
      // 🔴 La respuesta del PUT puede venir SIN `store`/`requirements` (sólo el GET los trae): se MEZCLA sobre la caché, nunca la
      // reemplaza, y luego se vuelve a pedir el GET como fuente de verdad.
      // Ruling 91: si ya se ve una lectura más nueva, la respuesta no regresa la tarjeta ni el estado de la tienda; se queda lo que se ve y
      // se vuelve a leer (ya con lo guardado). Ruling 103: lo decide la caché de la sucursal, no esta pantalla (sobrevive a salir y volver,
      // y la ponen al día todas las que leen los ajustes): si una lectura llegó después de que salió el guardado, la respuesta no se pone.
      const key = onlineOrderingKeys.settings(venueId!)
      const cached = qc.getQueryData<OnlineOrderingSettings>(key)
      if (cached) {
        const vigente = (qc.getQueryState(key)?.dataUpdatedAt ?? 0) <= enviado.salio
        const vista = vigente ? { ...cached, ...next } : cached
        if (vigente) qc.setQueryData(key, vista)
        reset(toForm(vista))
      }
      void qc.invalidateQueries({ queryKey: key })
      setServerMissing([])
      setSaveError(null)
      setCardAlertMissing(false)
      toast({ title: t('settings.saved') })
    },
    onError: async (error: unknown, patch, enviado) => {
      // Ruling 64: sin respuesta (o un 5xx) no se sabe si se guardó (el guardado ya no se repite solo). Nada se anuncia hasta releer.
      // Ronda 3: una lectura que ya iba en camino empezó ANTES del guardado: se cancela y se lee otra vez. Lo tecleado se queda sin
      // guardar (la relectura no pisa lo que se edita). Ruling 92: decide cada lectura (ésta y las del sondeo, en el efecto de abajo).
      if (sinRespuesta(error)) {
        const key = onlineOrderingKeys.settings(venueId!)
        await qc.cancelQueries({ queryKey: key })
        const salio = enviado?.salio ?? Date.now()
        setSaveError(null)
        setSinConfirmar({
          patch: patch as Partial<FormValues>,
          salio,
          hasta: contestoElServidor(error) ? Date.now() : salio + EN_CAMINO_MS,
        })
        await qc.fetchQuery({ queryKey: key, queryFn: () => leerAjustes(), staleTime: 0 }).catch(() => null)
        return
      }
      const data = (error as { response?: { data?: { code?: string; details?: { missing?: StoreRequirement[] } } } })?.response?.data
      if (data?.code === 'STORE_REQUIREMENTS_MISSING') {
        setServerMissing(data.details?.missing ?? [])
        setSaveError(null)
        return
      }
      // D661: nada se guardó. «Pagar en línea» se queda apagado y lo demás sin guardar sigue ahí para volver a guardarlo. El aviso va
      // junto al interruptor; si ya se eligió «Mi equipo» (el interruptor no se ve), arriba, para que no se pierda.
      if (data?.code === 'NO_CARD_ALERT_DEVICE') {
        setValue('cardOnlineNadie', false)
        setCardAlertMissing(true)
        setSaveError(noOne ? null : t('settings.confirm.cardNoOneNoDevice'))
        return
      }
      if (data?.code && CONFIRM_ERROR_CODES.includes(data.code)) {
        setSaveError(t(`settings.confirm.errors.${data.code}`))
        return
      }
      setSaveError(serverMessage(error, t('settings.saveFailed')))
    },
  })

  // Ruling 104: mientras un guardado está en duda, cada edición de la dueña se anota (la última de cada campo), también la que deja un
  // campo igual a la última lectura (para el formulario eso ya no es «editado», y la lectura que confirma lo pisaría).
  const tocados = useRef(new Map<keyof FormValues, unknown>())
  // Al llegar una lectura, react-hook-form pone sus valores con eventos `change` en el efecto de `values` (corre antes que los de aquí):
  // ésos no son de ella. Se marca en el render en que cambian los datos y se quita después de ese efecto.
  const leidos = useRef(settings)
  const sincronizando = useRef(false)
  if (leidos.current !== settings) {
    leidos.current = settings
    sincronizando.current = true
  }
  useEffect(() => {
    sincronizando.current = false
  })
  useEffect(() => {
    if (!sinConfirmar) return
    tocados.current.clear()
    const sub = watch((valores, { name, type }) => {
      if (!name || type !== 'change' || sincronizando.current) return
      tocados.current.set(name as keyof FormValues, valores[name as keyof FormValues])
    })
    return () => sub.unsubscribe()
  }, [sinConfirmar, watch])
  /** El horario cambia con `setValue` (no por un `Controller`): también cuenta como edición. */
  const editarHorario = (h: OperatingHours | null) => {
    setValue('hours', h, { shouldDirty: true })
    if (sinConfirmar) tocados.current.set('hours', h)
  }

  // Ruling 92: tras un guardado sin respuesta cierta, cada lectura que llega (también la del sondeo, aunque traiga lo mismo) decide:
  // si trae lo mandado, «Guardado»; si no, y ya empezó cuando la petición no podía seguir en camino, «No se guardó»; si no, sigue «No se
  // pudo confirmar todavía». Una lectura que empezó antes del guardado no dice nada.
  useEffect(() => {
    if (!sinConfirmar || !settings || vistaDesde.current < sinConfirmar.salio) return
    const ahora = toForm(settings)
    const trae = (Object.keys(sinConfirmar.patch) as (keyof FormValues)[]).every(
      k => JSON.stringify(ahora[k]) === JSON.stringify(sinConfirmar.patch[k]),
    )
    if (trae) {
      setSinConfirmar(null)
      // Ruling 97: sin `reset` de todo el formulario (borraría lo que se editó mientras se esperaba). Lo demás ya lo puso la lectura
      // (`keepDirtyValues`); aquí sólo se da por guardado lo confirmado que sigue igual y que no se volvió a tocar.
      for (const k of Object.keys(sinConfirmar.patch) as (keyof FormValues)[]) {
        if (!tocados.current.has(k) && JSON.stringify(getValues(k)) === JSON.stringify(ahora[k])) {
          resetField(k, { defaultValue: ahora[k] })
        }
      }
      // Ruling 104: lo que tocó mientras esperaba se queda, aunque fuera igual a la lectura de antes (la lectura que confirma lo pisó).
      tocados.current.forEach((valor, k) => setValue(k, valor as never, { shouldDirty: true }))
      tocados.current.clear()
      setServerMissing([])
      setCardAlertMissing(false)
      toast({ title: t('settings.saved') })
    } else if (vistaDesde.current >= sinConfirmar.hasta) {
      setSinConfirmar(null)
      setSaveError(t('settings.saveNotSaved'))
    }
  }, [leidoEn, settings, sinConfirmar, getValues, resetField, setValue, toast, t])

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
  // D661: apagada, cerrada o en pausa, nadie puede pedir: eso se dice antes que lo de la caja (Ruling 47). OFFLINE (sin aparato que
  // cobre folios) no entra: ahí la razón ES la caja, y «vuelve sola en cuanto una caja… esté abierta» es verdad.
  const storeStops = store?.status === 'DISABLED' || store?.status === 'CLOSED' || store?.status === 'PAUSED'
  /** Ruling 65: debajo de un campo que otra persona cambió mientras se editaba aquí. */
  const avisoOtraPersona = (k: keyof FormValues) =>
    otraPersona.has(k) && (
      <p role="status" className="text-xs font-medium">
        {t('settings.conflict')}
      </p>
    )
  // Ruling 63 + ronda 3: sin una lectura buena reciente, lo que dice «ahora» (la línea de la tarjeta y «Estado de la tienda») se retira:
  // falla → «Visto a las HH:MM; sin conexión»; vieja con otra en camino → «Actualizando…»; vieja y quieta → «Visto a las HH:MM».
  const vistoA = formatTime(new Date(leidoEn).toISOString())
  const lecturaTexto = lecturaFalla
    ? t('settings.read.offline', { time: vistoA })
    : lecturaVieja
      ? settingsQuery.isFetching
        ? t('settings.read.refreshing')
        : t('settings.read.seen', { time: vistoA })
      : null
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
          <span className="font-medium">{lecturaTexto ?? statusText}</span>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && <span className="text-xs font-medium text-muted-foreground">{t('settings.unsaved')}</span>}
          <Button type="submit" className="cursor-pointer" disabled={!hasChanges || hourErrors.length > 0 || mutation.isPending}>
            {t('settings.save')}
          </Button>
        </div>
      </div>

      {sinConfirmar && (
        <Alert role="status">
          <AlertDescription>{t('settings.saveUnconfirmed')}</AlertDescription>
        </Alert>
      )}
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
              {avisoOtraPersona('enabled')}
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
            {avisoOtraPersona('requiresAcceptance')}
            {noOne && (
              <>
                <p className="text-xs text-muted-foreground">{t('settings.confirm.noOneNote')}</p>
                <Alert role="status" data-tour="online-ordering-no-one-checklist">
                  <AlertDescription className="space-y-2">
                    <p className="font-medium">{t('settings.confirm.checklistTitle')}</p>
                    <ul role="list" className="space-y-2">
                      <li className="flex items-start gap-2">
                        {hours ? (
                          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-(--success)" />
                        ) : (
                          <Circle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1">
                          {hours ? (
                            <>
                              {sameAllWeek(hours)
                                ? t('settings.confirm.hoursOk', {
                                    days: t('settings.confirm.allWeek'),
                                    open: Object.values(hours)[0].ranges[0].open,
                                    close: Object.values(hours)[0].ranges[0].close,
                                  })
                                : t('settings.confirm.hoursCustom')}
                            </>
                          ) : (
                            <>
                              {t('settings.confirm.hoursMissing')}{' '}
                              <a href="#oo-hours-card" className="text-primary underline underline-offset-2">
                                {t('settings.confirm.hoursLink')}
                              </a>
                            </>
                          )}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        {deviceLive ? (
                          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-(--success)" />
                        ) : (
                          <Circle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1">
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
              {avisoOtraPersona('acceptsPayAtPickup')}
            </div>
            <div className="space-y-1.5 rounded-lg border border-input p-3">
              <div className="flex items-center justify-between gap-4">
                {/* D661: con «Nadie» es OTRO interruptor, «Pagar en línea» (`cardOnlineNadie`): la tarjeta de «Mi equipo» no se hereda. */}
                <Label htmlFor="oo-card">{t(noOne ? 'settings.confirm.cardNoOneLabel' : 'settings.cardOnline')}</Label>
                {noOne ? (
                  <Controller
                    key="nadie"
                    control={control}
                    name="cardOnlineNadie"
                    render={({ field }) => (
                      // Un SERVIDOR que no manda el campo no lo conoce: no se deja prender. Ruling 62: dice lo GUARDADO aunque Stripe no
                      // cobre (si no, al volver Stripe se ofrecería sola sin verse prendida); apagarla siempre se puede, prenderla espera a Stripe.
                      <Switch
                        id="oo-card"
                        data-tour="online-ordering-card-no-one"
                        aria-label={t('settings.confirm.cardNoOneLabel')}
                        checked={!!field.value}
                        disabled={settings.cardOnlineNadie === undefined || (!field.value && !cardAvailable)}
                        onCheckedChange={on => {
                          setCardAlertMissing(false)
                          field.onChange(on)
                        }}
                      />
                    )}
                  />
                ) : (
                  <Controller
                    key="equipo"
                    control={control}
                    name="acceptsCardOnline"
                    render={({ field }) => (
                      // El valor guardado no se toca: nace prendido de fábrica (paso 5) y, al conectar Stripe, la tarjeta queda lista sola.
                      <Switch
                        id="oo-card"
                        aria-label={t('settings.cardOnline')}
                        checked={cardAvailable && !!field.value}
                        disabled={!cardAvailable}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                )}
              </div>
              {/* Sin Stripe que cobre (los dos modos): la línea dice qué falta y que Mercado Pago viene después. Con Stripe: en «Mi equipo»,
                  el valor VIVO del switch; en «Nadie», cómo funciona «Pagar en línea». */}
              <p className="text-xs text-muted-foreground">
                {!cardAvailable
                  ? t(merchantStatus === 'NOT_CHARGEABLE' ? 'settings.card.notChargeable' : 'settings.card.notConnected')
                  : noOne
                    ? t('settings.confirm.cardNoOne')
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
              {/* D661 · apagado se ve y se explica: prendida (y guardada así en «Nadie»), ¿la tienda la ofrece AHORA? Lo dice el SERVIDOR
                  con la misma regla de la tienda, y «Pagar ahora» sólo con la tienda abierta. Es un estado, nunca un error. Sin el bloque
                  (servidor viejo) no se dice nada. */}
              {noOne && cardAvailable && cardNadieOn && settings.requiresAcceptance === false && settings.cardNadie?.enabled && (
                <div role="status" className="space-y-0.5 text-xs">
                  {lecturaTexto ? (
                    // Ruling 63: sin una lectura buena reciente no se dice «ahora».
                    <p className="text-muted-foreground">{lecturaTexto}</p>
                  ) : storeStops ? (
                    <p className="font-medium">{t(`settings.confirm.cardNoOneStore.${store?.status}`)}</p>
                  ) : !settings.cardNadie.offeredNow ? (
                    <>
                      <p className="font-medium">{t('settings.confirm.cardNoOneNotOffered')}</p>
                      {settings.cardNadie.lastAlertAt && (
                        <p className="text-muted-foreground">
                          {t('settings.confirm.cardNoOneLastAlert', { when: formatDateTime(settings.cardNadie.lastAlertAt) })}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="font-medium">
                      {t(store?.status === 'OPEN' ? 'settings.confirm.cardNoOneOffered' : 'settings.confirm.cardNoOneStore.other')}
                    </p>
                  )}
                </div>
              )}
              {noOne && cardAlertMissing && (
                <p role="alert" className="text-xs text-destructive">
                  {t('settings.confirm.cardNoOneNoDevice')}
                </p>
              )}
              {avisoOtraPersona(noOne ? 'cardOnlineNadie' : 'acceptsCardOnline')}
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
              {avisoOtraPersona('minOrderAmount')}
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
              {avisoOtraPersona('defaultPrepMinutes')}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-input p-3">
            <div>
              <Label htmlFor="oo-pause">{t('settings.manualPause')}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.manualPauseHelp')}</p>
              {avisoOtraPersona('manualPause')}
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
              onCheckedChange={on => editarHorario(on ? defaultWeek() : null)}
            />
            <Label htmlFor="oo-hours">{t('settings.hours.use')}</Label>
          </div>
          {avisoOtraPersona('hours')}
          {hours && (
            <>
              <OperatingHoursEditor value={hours} onChange={editarHorario} />
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
