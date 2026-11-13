/**
 * «Impresión de pedidos de <canal>»: a qué estación van la comanda y el ticket de empaque de un pedido de reparto.
 *
 * Sin nada guardado = lo de siempre (comanda «como en el salón» + empaque del negocio): ante la duda, el pedido imprime.
 * Una estación elegida que ya no sirve (borrada, apagada o sin comanda) se avisa y el editor vuelve a «salón»; el
 * SERVIDOR hace lo mismo al resolverla, así que nunca queda un pedido sin papel.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'
import { updateChannel } from '@/services/delivery.service'
import { getPrinters, getPrintStations, type Printer, type PrintStation } from '@/services/printStations.service'
import type { DeliveryChannelLink, ImpresionDelCanal } from '@/types/delivery'
import { providerLabel } from '../providerLabels'

/** Primera versión del POS (ANDROID) que respeta esta configuración. */
export const VERSION_MINIMA_POS_IMPRESION_REPARTO = '2.25.44'

const SALON = 'SALON'
const NEGOCIO = 'NEGOCIO'
const NO = 'NO'
const est = (id: string) => `E:${id}`

type Aviso = 'sinImpresora' | 'integrada' | 'sinDireccion' | null

function avisoDe(station: PrintStation, printers: Printer[]): Aviso {
  const printer = station.printerId ? printers.find(p => p.id === station.printerId) : undefined
  if (!printer) return 'sinImpresora'
  if (printer.connectionType === 'POS_INTERNAL') return 'integrada'
  if (printer.connectionType === 'NETWORK' && !printer.address?.trim()) return 'sinDireccion'
  return null
}

interface Props {
  venueId: string
  channel: DeliveryChannelLink
  canEdit: boolean
  /**
   * Lo elegido y SIN guardar (`null` si coincide con lo guardado). El diálogo del canal lo usa para que su «Guardar»
   * de arriba lo guarde también: si no, cerraba diciendo «Ajustes guardados» y la impresión se perdía (Codex c1 #1).
   */
  onPendienteChange?: (pendiente: ImpresionDelCanal | null) => void
}

export function ImpresionDelCanalEditor({ venueId, channel, canEdit, onPendienteChange }: Props) {
  const { t } = useTranslation('delivery')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const stationsQ = useQuery({ queryKey: ['printStations', venueId], queryFn: () => getPrintStations(venueId) })
  const printersQ = useQuery({ queryKey: ['printStations', venueId, 'printers'], queryFn: () => getPrinters(venueId) })
  const printers = printersQ.data ?? []

  // Elegible = activa y con comanda (un SERVIDOR viejo no manda sendsComanda ⇒ se lee como true).
  const elegibles = useMemo(() => (stationsQ.data ?? []).filter(s => s.active && s.sendsComanda !== false), [stationsQ.data])
  const porId = (id?: string) => elegibles.find(s => s.id === id)
  const empaqueNegocio = (stationsQ.data ?? []).find(s => s.isPacking && s.active)

  const guardado = channel.config?.impresion
  const [comanda, setComanda] = useState<string>(SALON)
  const [empaque, setEmpaque] = useState<string>(NEGOCIO)

  // Sin saber las impresoras no se puede avisar nada honesto: se espera a las dos consultas.
  const cargado = stationsQ.isSuccess && printersQ.isSuccess
  const falloCarga = stationsQ.isError || printersQ.isError
  const comandaPerdida = !!guardado && guardado.comanda === 'UNA_ESTACION' && cargado && !porId(guardado.estacionId)
  const empaquePerdido = !!guardado && guardado.empaque === 'ESTACION' && cargado && !porId(guardado.empaqueEstacionId)

  // Lo guardado, ya resuelto contra las estaciones: un valor que ya no sirve cae al default, no se queda fantasma.
  const comandaGuardada = guardado?.comanda === 'UNA_ESTACION' && porId(guardado.estacionId) ? est(guardado.estacionId!) : SALON
  const empaqueGuardado =
    guardado?.empaque === 'NO'
      ? NO
      : guardado?.empaque === 'ESTACION' && porId(guardado.empaqueEstacionId)
        ? est(guardado.empaqueEstacionId!)
        : NEGOCIO

  // Se relee del canal y de las estaciones (React Query conserva la identidad si el refresco trae lo mismo, así que
  // sólo un cambio de verdad, p. ej. guardado desde la otra puerta, reemplaza lo que se ve).
  useEffect(() => {
    if (!cargado) return
    setComanda(comandaGuardada)
    setEmpaque(empaqueGuardado)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargado, elegibles, channel.id, channel.config])

  const impresion: ImpresionDelCanal = {
    comanda: comanda === SALON ? 'SALON' : 'UNA_ESTACION',
    ...(comanda !== SALON ? { estacionId: comanda.slice(2) } : {}),
    empaque: empaque === NO ? 'NO' : empaque === NEGOCIO ? 'NEGOCIO' : 'ESTACION',
    ...(empaque !== NO && empaque !== NEGOCIO ? { empaqueEstacionId: empaque.slice(2) } : {}),
  }

  const pendiente = cargado && (comanda !== comandaGuardada || empaque !== empaqueGuardado)
  const pendienteKey = pendiente ? JSON.stringify(impresion) : null
  useEffect(() => {
    onPendienteChange?.(pendienteKey ? (JSON.parse(pendienteKey) as ImpresionDelCanal) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendienteKey])

  // `isPending` se pinta un instante tarde: dos clics seguidos pasarían los dos. El candado va en un ref.
  const guardando = useRef(false)
  const mutation = useMutation({
    // Sólo la llave `impresion`: el SERVIDOR mezcla `config`, horario y precios quedan intactos.
    mutationFn: () => updateChannel(venueId, channel.id, { config: { impresion } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryChannels', venueId] })
      toast({ title: t('impresion.guardado') })
    },
    onSettled: () => {
      guardando.current = false
    },
    onError: (error: unknown) => {
      const mensaje =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('impresion.errorFallback')
      toast({ title: t('impresion.errorGuardar'), description: mensaje, variant: 'destructive' })
    },
  })

  const idComanda = comanda === SALON ? undefined : comanda.slice(2)
  const idEmpaque = empaque === NEGOCIO ? empaqueNegocio?.id : empaque === NO ? undefined : empaque.slice(2)
  const unSoloPapel = !!idComanda && idComanda === idEmpaque

  const hint = (s: PrintStation) => {
    const a = avisoDe(s, printers)
    return a ? t(`impresion.${a}`) : null
  }
  const opcion = (value: string, label: string, ayuda?: string | null) => (
    <label key={value} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:disabled]:cursor-not-allowed">
      <RadioGroupItem value={value} disabled={!canEdit} className="mt-0.5" />
      <span className="space-y-0.5 text-sm">
        <span className="block font-medium">{label}</span>
        {ayuda && <span className="block text-muted-foreground">{ayuda}</span>}
      </span>
    </label>
  )
  const resumen = (id?: string) => {
    const s = porId(id)
    return s ? hint(s) : null
  }
  const avisos = [
    comandaPerdida && t('impresion.estacionDesaparecida'),
    empaquePerdido && t('impresion.empaqueDesaparecida'),
    resumen(idComanda),
    idEmpaque !== idComanda ? resumen(idEmpaque) : null,
    unSoloPapel && t('impresion.mismoPapel'),
  ].filter(Boolean) as string[]

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold">{t('impresion.title', { canal: providerLabel(channel.provider) })}</h3>
        <p className="text-sm text-muted-foreground">{t('impresion.description')}</p>
      </div>

      {falloCarga ? (
        <div className="space-y-2 text-sm">
          <p className="text-destructive">{t('impresion.errorCarga')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              stationsQ.refetch()
              printersQ.refetch()
            }}
          >
            {t('impresion.reintentar')}
          </Button>
        </div>
      ) : !cargado ? (
        <p className="text-sm text-muted-foreground">{t('impresion.cargando')}</p>
      ) : (
        <>
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t('impresion.comandaTitle')}</h4>
            <RadioGroup value={comanda} onValueChange={setComanda} disabled={!canEdit}>
              {opcion(SALON, t('impresion.salon'), t('impresion.salonHelp'))}
              {elegibles.map(s => opcion(est(s.id), t('impresion.todoJunto', { estacion: s.name }), hint(s)))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t('impresion.empaqueTitle')}</h4>
            <RadioGroup value={empaque} onValueChange={setEmpaque} disabled={!canEdit}>
              {opcion(
                NEGOCIO,
                empaqueNegocio
                  ? t('impresion.empaqueNegocio', { estacion: empaqueNegocio.name })
                  : t('impresion.empaqueNegocioSinEstacion'),
              )}
              {opcion(NO, t('impresion.empaqueNo'))}
              {elegibles.map(s => opcion(est(s.id), t('impresion.empaqueEn', { estacion: s.name }), hint(s)))}
            </RadioGroup>
          </div>

          {avisos.length > 0 && (
            <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-400">
              {avisos.map(a => (
                <li key={a} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">{t('impresion.versionMinima', { version: VERSION_MINIMA_POS_IMPRESION_REPARTO })}</p>
      {/* iOS va después (docs/proyectos/ios-por-hacer.md, «Mientras iOS espera» 6): la pantalla dice que ahí no aplica. */}
      <p className="text-xs text-muted-foreground">{t('impresion.iosTodaviaNo')}</p>

      <Button disabled={!canEdit || !cargado || mutation.isPending} onClick={() => {
          if (guardando.current) return
          guardando.current = true
          mutation.mutate()
        }}>
        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('impresion.guardar')}
      </Button>
    </section>
  )
}
