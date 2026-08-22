/**
 * Horario y precios de UN canal de delivery.
 *
 * 🔴 POR QUÉ EXISTE: hasta hoy estos dos ajustes SÓLO se podían poner con un UPDATE en
 * Postgres. La regla del workspace lo dice sin rodeos — «un feature cuyo único switch es un
 * UPDATE en Postgres está incompleto y deja al founder de switch humano». Y aquí cuesta
 * dinero de verdad:
 *
 *  · Sin horario, el canal se publica de 9 a 22 (un estimado) o peor, y entran pedidos que
 *    nadie va a cocinar. Cada rechazo cuenta contra la tasa de inyección que el marketplace
 *    exige para no revocar el acceso.
 *  · Sin margen, se publica el precio de mostrador — y como el marketplace se queda ~30%,
 *    el comercio PIERDE en cada pedido de delivery.
 *
 * El backend MEZCLA `config` (no la reemplaza), así que guardar el horario ya no borra el
 * margen. Aun así este formulario manda las dos llaves juntas: lo que el usuario ve en
 * pantalla es lo que queda guardado, sin sorpresas.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Clock, Loader2, Tag } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { updateChannel } from '@/services/delivery.service'
import type { DeliveryChannelLink, DeliveryDayHours, DeliveryWeekday, DeliveryWeeklyHours } from '@/types/delivery'
import { providerLabel } from '../providerLabels'

const DIAS: DeliveryWeekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

/**
 * El mismo default que el backend usa cuando nadie configuró nada (`deliveryHours.service.ts`).
 * Se elige a propósito en vez de 24/7: equivocarse hacia MENOS horas pierde ventas y se nota
 * rápido; equivocarse hacia 24/7 mete pedidos de madrugada y se paga con la tasa de inyección.
 */
const HORARIO_DEFAULT: DeliveryWeeklyHours = DIAS.reduce((acc, dia) => {
  acc[dia] = dia === 'sunday' ? { enabled: false, ranges: [] } : { enabled: true, ranges: [{ open: '09:00', close: '22:00' }] }
  return acc
}, {} as DeliveryWeeklyHours)

/** Tope del backend (`MARKUP_MAX` en deliveryChannelLink.service.ts). Se espeja por nombre exacto. */
const MARKUP_MAX = 200

/** "HH:MM" de verdad, no sólo con forma de. `25:00` pasaba el regex sola y llegaba al proveedor. */
function esHora(v: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(v)) return false
  const [h, m] = v.split(':').map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

interface ChannelSettingsDialogProps {
  open: boolean
  onClose: () => void
  venueId: string
  channel: DeliveryChannelLink
}

export function ChannelSettingsDialog({ open, onClose, venueId, channel }: ChannelSettingsDialogProps) {
  const { t } = useTranslation('delivery')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [horario, setHorario] = useState<DeliveryWeeklyHours>(HORARIO_DEFAULT)
  // `number | undefined` a propósito: un input numérico que colapsa el vacío a 0 atrapa el
  // campo — el usuario borra y el valor rebota. Regla `ui-patterns.md`.
  const [markup, setMarkup] = useState<number | undefined>(undefined)

  // Al abrir, se relee del canal: si el modal se reusa para otro canal (o el de antes cambió
  // en el servidor) sin esto quedaría el estado del anterior y el usuario guardaría el
  // horario de OTRA tienda encima del suyo.
  useEffect(() => {
    if (!open) return
    setHorario(channel.config?.deliveryHours ?? HORARIO_DEFAULT)
    setMarkup(channel.config?.precios?.markupPercent)
  }, [open, channel.id, channel.config])

  /** Nunca se configuró: se está mostrando el estimado, y eso hay que decirlo. */
  const usandoEstimado = !channel.config?.deliveryHours

  const errores = useMemo(() => {
    const out: string[] = []
    for (const dia of DIAS) {
      const d = horario[dia]
      if (!d.enabled) continue
      if (d.ranges.length === 0) {
        out.push(t('settings.errorDayNoRange', { day: t(`settings.day.${dia}`) }))
        continue
      }
      for (const r of d.ranges) {
        if (!esHora(r.open) || !esHora(r.close)) {
          out.push(t('settings.errorBadTime', { day: t(`settings.day.${dia}`) }))
        } else if (r.close <= r.open) {
          out.push(t('settings.errorCloseBeforeOpen', { day: t(`settings.day.${dia}`) }))
        }
      }
    }
    if (markup !== undefined && (!Number.isFinite(markup) || markup < 0 || markup > MARKUP_MAX)) {
      out.push(t('settings.errorMarkupRange', { max: MARKUP_MAX }))
    }
    return out
  }, [horario, markup, t])

  const mutation = useMutation({
    mutationFn: () =>
      updateChannel(venueId, channel.id, {
        config: {
          deliveryHours: horario,
          // Sin margen se manda el bloque vacío, no se omite: omitirlo dejaría el markup
          // anterior vivo (el backend mezcla), y el usuario acaba de dejar el campo en blanco.
          precios: markup === undefined ? {} : { markupPercent: markup },
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-channels', venueId] })
      toast({ title: t('settings.saveSuccess') })
      onClose()
    },
    onError: (error: unknown) => {
      const mensaje =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('settings.saveErrorFallback')
      toast({ title: t('settings.saveError'), description: mensaje, variant: 'destructive' })
    },
  })

  const setDia = (dia: DeliveryWeekday, patch: Partial<DeliveryDayHours>) =>
    setHorario(prev => ({ ...prev, [dia]: { ...prev[dia], ...patch } }))

  const setRango = (dia: DeliveryWeekday, campo: 'open' | 'close', valor: string) =>
    setHorario(prev => {
      const ranges = prev[dia].ranges.length > 0 ? [...prev[dia].ranges] : [{ open: '09:00', close: '22:00' }]
      ranges[0] = { ...ranges[0], [campo]: valor }
      return { ...prev, [dia]: { ...prev[dia], ranges } }
    })

  const puedeGuardar = errores.length === 0 && !mutation.isPending

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={t('settings.title')}
      subtitle={providerLabel(channel.provider)}
      contentClassName="bg-muted/30"
      actions={
        <Button data-tour="delivery-settings-save" disabled={!puedeGuardar} onClick={() => mutation.mutate()}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('settings.save')}
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl space-y-6 py-6">
        {/* ── Horario ─────────────────────────────────────────────────────────────── */}
        <section data-tour="delivery-settings-hours" className="rounded-2xl border border-input bg-card p-6">
          <div className="mb-1 flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-medium">{t('settings.hoursTitle')}</h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{t('settings.hoursHelp')}</p>

          {/* Un estimado presentado como certeza es peor que no tenerlo: nadie lo revisa. */}
          {usandoEstimado && (
            <div className="mb-4 flex gap-2 rounded-lg border border-input bg-muted/50 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">{t('settings.hoursEstimated')}</span>
            </div>
          )}

          <div className="space-y-2">
            {DIAS.map(dia => {
              const d = horario[dia]
              const rango = d.ranges[0] ?? { open: '09:00', close: '22:00' }
              return (
                <div key={dia} className="flex flex-wrap items-center gap-3 rounded-lg border border-input p-3">
                  <Switch
                    checked={d.enabled}
                    onCheckedChange={enabled => setDia(dia, { enabled, ranges: enabled && d.ranges.length === 0 ? [rango] : d.ranges })}
                    aria-label={t(`settings.day.${dia}`)}
                  />
                  <span className="w-24 text-sm font-medium">{t(`settings.day.${dia}`)}</span>
                  {d.enabled ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={rango.open}
                        onChange={e => setRango(dia, 'open', e.target.value)}
                        className="h-10 w-32 text-base"
                        aria-label={t('settings.opensAt', { day: t(`settings.day.${dia}`) })}
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={rango.close}
                        onChange={e => setRango(dia, 'close', e.target.value)}
                        className="h-10 w-32 text-base"
                        aria-label={t('settings.closesAt', { day: t(`settings.day.${dia}`) })}
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">{t('settings.closed')}</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Margen de precios ───────────────────────────────────────────────────── */}
        <section data-tour="delivery-settings-markup" className="rounded-2xl border border-input bg-card p-6">
          <div className="mb-1 flex items-center gap-2">
            <Tag className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-medium">{t('settings.markupTitle')}</h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{t('settings.markupHelp')}</p>

          <div className="flex items-center gap-3">
            <Input
              data-tour="delivery-settings-markup-input"
              type="number"
              min={0}
              max={MARKUP_MAX}
              step={1}
              inputMode="decimal"
              placeholder="0"
              value={markup ?? ''}
              onChange={e => {
                const raw = e.target.value
                setMarkup(raw === '' ? undefined : parseFloat(raw))
              }}
              className="h-12 w-32 text-base"
              aria-label={t('settings.markupTitle')}
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>

          {/* Un porcentaje abstracto no dice nada. Un precio sí. */}
          <p className="mt-3 text-sm text-muted-foreground">
            {t('settings.markupExample', {
              base: '100',
              resultado: markup !== undefined && Number.isFinite(markup) ? (100 * (1 + markup / 100)).toFixed(2) : '100.00',
            })}
          </p>
        </section>

        {errores.length > 0 && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <ul className="space-y-1 text-sm text-destructive">
              {errores.map(e => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </FullScreenModal>
  )
}
