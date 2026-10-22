import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { DEFAULT_TPV_SETTINGS, tpvSettingsService, type TpvSettings, type TpvSettingsUpdate } from '@/services/tpv-settings.service'
import { textoDelServidor } from '@/utils/apiError'
import { resultadoIncierto } from './errores'
import {
  agregarPorcentaje,
  cambioDePaso,
  MAX_PORCENTAJES_DE_PROPINA,
  quitarPorcentaje,
  reciboNecesitaActualizar,
  type PasoConInterruptor,
} from './model'
import { clavesDeLaPantalla, usePasosDelCobro } from './queries'

const FILAS: { clave: PasoConInterruptor; etiqueta: string; tour: string }[] = [
  { clave: 'showTipScreen', etiqueta: 'steps.tip', tour: 'customer-display-step-tip' },
  { clave: 'showReviewScreen', etiqueta: 'steps.review', tour: 'customer-display-step-review' },
  { clave: 'showReceiptScreen', etiqueta: 'steps.receipt', tour: 'customer-display-step-receipt' },
]

export interface CheckoutStepsSectionProps {
  tpvId: string
  deviceType: string | undefined
  versionName: string | null
}

/**
 * «Pasos del cobro en este dispositivo» (spec §6.2): propina, estrellas y recibo, más los porcentajes de propina.
 * 🔴 Cada cambio manda SÓLO su llave (lo demás sigue heredado de la organización; el server mezcla bajo candado, S1).
 * Optimista: se ve al instante. Después manda el SERVIDOR (Codex #4): su respuesta es lo que queda; un rechazo CONFIRMADO
 * vuelve a lo de antes; un resultado INCIERTO (sin respuesta, 5xx, o el 409/429 del reintento automático de `src/api.ts`)
 * no se adivina: se olvida lo supuesto, cada paso se ve «sin confirmar» y se relee lo que el server tiene.
 * La clave de caché es A PROPÓSITO la de `TpvSettingsForm` (`['tpvSettings', id]`): las dos pantallas leen la misma ficha.
 */
export function CheckoutStepsSection({ tpvId, deviceType, versionName }: CheckoutStepsSectionProps) {
  const { t } = useTranslation('customerDisplay')
  const { can } = useAccess()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const puedeVer = can('tpv-settings:read')
  const puedeCambiar = can('tpv-settings:update')
  const pasos = usePasosDelCobro(tpvId, puedeVer)
  const [nuevo, setNuevo] = useState('')
  const [nuevoInvalido, setNuevoInvalido] = useState(false)
  const clave = clavesDeLaPantalla.pasos(tpvId)

  const guardar = useMutation({
    mutationFn: (cambio: TpvSettingsUpdate) => tpvSettingsService.updateSettings(tpvId, cambio),
    onMutate: async cambio => {
      await queryClient.cancelQueries({ queryKey: clave })
      const antes = queryClient.getQueryData<TpvSettings>(clave)
      if (antes) queryClient.setQueryData<TpvSettings>(clave, { ...antes, ...cambio } as TpvSettings)
      return { antes }
    },
    onSuccess: (respuesta, cambio) => {
      // Lo CONFIRMADO: el server devuelve todos los ajustes ya mezclados bajo su candado (también lo que otra pestaña
      // cambió). Lo único que el PUT no devuelve es el override tri-estado `trackPromoterLocationOverride` (sólo lo arma el
      // GET, y este guardado no lo toca): se conserva el de la caché, que es la misma de TpvSettingsForm.
      const actual = queryClient.getQueryData<TpvSettings>(clave)
      queryClient.setQueryData<TpvSettings>(clave, {
        ...DEFAULT_TPV_SETTINGS,
        trackPromoterLocationOverride: actual?.trackPromoterLocationOverride ?? DEFAULT_TPV_SETTINGS.trackPromoterLocationOverride,
        ...respuesta,
      })
      const fila = FILAS.find(f => typeof cambio[f.clave] === 'boolean')
      toast({
        title: fila
          ? t(cambio[fila.clave] ? 'steps.savedOn' : 'steps.savedOff', { step: t(`steps.names.${fila.clave}`) })
          : t('steps.savedTips'),
      })
    },
    onError: (error, _cambio, contexto) => {
      // 🔴 PRIMERO lo incierto (mismo orden que el editor y la copia): pudo guardarse y perderse la respuesta, así que ni lo
      // de antes ni lo supuesto son ciertos. Se borra lo que había y se relee; la mutación sigue «en curso» hasta que la
      // relectura termina (TanStack espera esta promesa), y mientras tanto cada paso se ve «sin confirmar». Si la relectura
      // también falla, se dice que no se pudieron cargar. Nunca se reenvía solo.
      if (resultadoIncierto(error)) {
        // Tono de AVISO (como el editor y copiar), no rojo: no es un error confirmado, es «no sabemos todavía».
        toast({ variant: 'warning', title: t('steps.uncertainTitle'), description: t('steps.uncertain') })
        return queryClient.resetQueries({ queryKey: clave, exact: true })
      }
      // Rechazo CONFIRMADO (400/401/403/404/409/422/429 que no vienen del reintento): el server no cambió nada ⇒ vuelve lo
      // de antes al instante, y se relee por si otra pestaña cambió algo.
      if (contexto?.antes) queryClient.setQueryData(clave, contexto.antes)
      void queryClient.invalidateQueries({ queryKey: clave, exact: true })
      toast({ variant: 'destructive', title: t('steps.saveError'), description: textoDelServidor(error) })
    },
  })

  const ajustes = pasos.data
  // El tope del POS (6): con la lista llena no se agrega; se quita uno para cambiarlo.
  const listaLlena = (ajustes?.tipSuggestions.length ?? 0) >= MAX_PORCENTAJES_DE_PROPINA
  // Sólo un guardado INCIERTO borra la ficha mientras la mutación sigue en curso: eso es «revisando lo que quedó».
  const sinConfirmar = guardar.isPending && pasos.isLoading
  const agregar = () => {
    if (!ajustes) return
    const lista = agregarPorcentaje(ajustes.tipSuggestions, nuevo)
    if (!lista) {
      setNuevoInvalido(true)
      return
    }
    guardar.mutate({ tipSuggestions: lista })
    setNuevo('')
  }
  const quitar = (porcentaje: number) => {
    if (!ajustes) return
    const lista = quitarPorcentaje(ajustes.tipSuggestions, porcentaje)
    if (!lista) return
    guardar.mutate({ tipSuggestions: lista, ...(ajustes.defaultTipPercentage === porcentaje ? { defaultTipPercentage: null } : {}) })
  }

  return (
    <div data-tour="customer-display-steps" className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('steps.title')}</h3>
      {!puedeVer ? (
        <p className="text-sm text-muted-foreground">{t('steps.noReadPermission')}</p>
      ) : sinConfirmar ? (
        // Ni el valor de antes ni el supuesto: cada paso dice que no está confirmado, sin interruptor que lo afirme.
        <div role="status" aria-busy="true" className="space-y-3">
          {FILAS.map(fila => (
            <div key={fila.clave} className="flex items-center justify-between gap-3 rounded-lg border border-input px-3 py-2.5">
              <span className="text-sm font-medium">{t(fila.etiqueta)}</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                {t('steps.unconfirmed')}
              </span>
            </div>
          ))}
        </div>
      ) : pasos.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : pasos.isError || !ajustes ? (
        // Con error NO se enseñan interruptores, aunque haya datos viejos: un valor sin confirmar no se presenta como cierto.
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-input p-3 text-sm">
          <span>{t('steps.loadError')}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => void pasos.refetch()}
            disabled={pasos.isFetching}
            data-tour="customer-display-steps-retry"
          >
            {t('card.retry')}
          </Button>
        </div>
      ) : (
        <>
          {FILAS.map(fila => (
            <div key={fila.clave} className="rounded-lg border border-input px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{t(fila.etiqueta)}</span>
                <Switch
                  checked={ajustes[fila.clave]}
                  onCheckedChange={valor => guardar.mutate(cambioDePaso(fila.clave, valor))}
                  disabled={!puedeCambiar || guardar.isPending}
                  aria-label={t(fila.etiqueta)}
                  data-tour={fila.tour}
                />
              </div>

              {fila.clave === 'showTipScreen' && ajustes.showTipScreen && (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {ajustes.tipSuggestions.map(p => (
                      <Badge key={p} variant="secondary" className="gap-1 font-mono text-xs">
                        {p} %
                        {puedeCambiar && ajustes.tipSuggestions.length > 1 && (
                          <button
                            type="button"
                            // 24 px de toque alrededor del ícono de 12; los márgenes negativos dejan la ficha del mismo tamaño.
                            className="-my-1.5 -ml-1 -mr-2 grid h-6 w-6 cursor-pointer place-items-center rounded-full hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={t('steps.tipRemove', { percent: p })}
                            disabled={guardar.isPending}
                            onClick={() => quitar(p)}
                            data-tour="customer-display-steps-tip-remove"
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
                      </Badge>
                    ))}
                    {puedeCambiar && (
                      <span className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={100}
                          value={nuevo}
                          placeholder={t('steps.tipAddPlaceholder')}
                          aria-label={t('steps.tipAddLabel')}
                          onChange={e => {
                            setNuevo(e.target.value)
                            setNuevoInvalido(false)
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              agregar()
                            }
                          }}
                          className="h-8 w-20 text-sm"
                          disabled={guardar.isPending || listaLlena}
                          data-tour="customer-display-tip-add-input"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 cursor-pointer"
                          onClick={agregar}
                          disabled={nuevo === '' || guardar.isPending || listaLlena}
                          data-tour="customer-display-tip-add-btn"
                        >
                          <Plus aria-hidden="true" />
                          {t('steps.tipAdd')}
                        </Button>
                      </span>
                    )}
                  </div>
                  {puedeCambiar && listaLlena && (
                    <p className="mt-1 text-xs text-muted-foreground">{t('steps.tipMax', { max: MAX_PORCENTAJES_DE_PROPINA })}</p>
                  )}
                  {nuevoInvalido && <p className="mt-1 text-xs text-destructive">{t('steps.tipInvalid')}</p>}
                </>
              )}

              {fila.clave === 'showReceiptScreen' && reciboNecesitaActualizar(deviceType, versionName) && (
                // Mismo texto de aviso que la tarjeta: tokens semánticos (en oscuro, el ámbar; `warning-foreground` es casi blanco).
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-warning-foreground dark:text-warning">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t('steps.receiptNeedsUpdate')}
                </p>
              )}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{t(puedeCambiar ? 'steps.footer' : 'steps.readOnly')}</p>
        </>
      )}
    </div>
  )
}
