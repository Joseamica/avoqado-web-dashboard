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
  /**
   * `false` dentro del diálogo del canal: ahí hay UN solo «Guardar» (el de arriba, que manda lo pendiente). Dos botones
   * se estorbaban: guardar aquí refrescaba el canal y borraba el horario que se estaba editando (revisión 07d9d0).
   */
  conBotonGuardar?: boolean
}

export function ImpresionDelCanalEditor({ venueId, channel, canEdit, onPendienteChange, conBotonGuardar = true }: Props) {
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

  // Sin saber las impresoras no se puede avisar nada honesto: se espera a las dos consultas. «Cargado» = YA hay datos,
  // no «la última consulta salió bien»: un refresco que falla después (p. ej. al volver a la pestaña) deja `isSuccess` en
  // false con los datos de antes, y eso borraba lo elegido sin guardar y el «Guardar» de arriba cerraba sin mandarlo
  // (Codex c2 #1). Con datos, se sigue mostrando lo elegido; el error sólo se pinta si nunca hubo datos.
  const cargado = stationsQ.data !== undefined && printersQ.data !== undefined
  const falloCarga = !cargado && (stationsQ.isError || printersQ.isError)
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

  // 🔴 Rediseño (regla de parada tras Codex c1-c3: la familia «lo elegido se pierde o se regresa» reaparecía con cada
  // parche de sincronización). Lo que se ve = el BORRADOR del dueño (sólo lo que tocó) o, si no tocó nada, lo GUARDADO
  // resuelto EN CADA RENDER contra las estaciones vigentes. Nada se copia a un estado que haya que re-sincronizar con
  // efectos, así que ningún refresco (canales cada 30 s, estaciones con su `printer.lastStatus`, impresoras; bien o
  // fallido) borra el borrador, y sin borrador siempre se ve lo guardado (una estación que se reactiva vuelve a verse).
  const [borrador, setBorrador] = useState<{ comanda?: string; empaque?: string }>({})
  // El borrador se descarta sólo cuando cambia lo GUARDADO de impresión (lo guardó esta puerta o la otra): ajuste de
  // estado durante el render, sin esperar a un efecto.
  const llaveGuardado = `${channel.id}|${JSON.stringify(guardado ?? null)}`
  const [borradorDe, setBorradorDe] = useState(llaveGuardado)
  if (borradorDe !== llaveGuardado) {
    setBorradorDe(llaveGuardado)
    setBorrador({})
  }
  // Un borrador que dejó de servir (estación apagada o borrada) no se muestra: se ve lo guardado.
  const comandaValida = (v?: string) => v === SALON || (!!v && v.startsWith('E:') && !!porId(v.slice(2)))
  const empaqueValido = (v?: string) => v === NO || v === NEGOCIO || (!!v && v.startsWith('E:') && !!porId(v.slice(2)))
  const comanda = comandaValida(borrador.comanda) ? borrador.comanda! : comandaGuardada
  const empaque = empaqueValido(borrador.empaque) ? borrador.empaque! : empaqueGuardado
  const setComanda = (v: string) => setBorrador(b => ({ ...b, comanda: v }))
  const setEmpaque = (v: string) => setBorrador(b => ({ ...b, empaque: v }))

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
              {avisos.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
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

      {conBotonGuardar && (
        <Button
          disabled={!canEdit || !cargado || mutation.isPending}
          onClick={() => {
            if (guardando.current) return
            guardando.current = true
            mutation.mutate()
          }}
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('impresion.guardar')}
        </Button>
      )}
    </section>
  )
}
