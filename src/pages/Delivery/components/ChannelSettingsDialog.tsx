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
 *
 * D1: también los productos del canal, su precio y «agotar según inventario». 🔴 TODO lo editable se CONGELA al abrir
 * (`canalAlAbrir`, Codex plan r2 #5): el listado de canales se refresca solo (cada 10-30 s con Rappi) y un refresco no puede
 * borrar el borrador. El «Guardar» manda la huella de al abrir (`seleccionEsperada`); si alguien guardó en medio, el SERVIDOR
 * responde 409 y aquí sale «Recargar», que vuelve a congelar desde el canal nuevo.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Clock, Loader2, PackageX, Tag } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useAccess } from '@/hooks/use-access'
import { updateChannel } from '@/services/delivery.service'
import { getProducts } from '@/services/menu.service'
import type {
  DeliveryChannelConfig,
  DeliveryChannelLink,
  DeliveryDayHours,
  DeliveryWeekday,
  DeliveryWeeklyHours,
  ImpresionDelCanal,
} from '@/types/delivery'
import { providerLabel } from '../providerLabels'
import { erroresDePrecios, idsQueYaNoExisten, productosNuevos, seleccionAlAbrir, type ProductoDelCanal } from '../productosDelCanal'
import { ImpresionDelCanalEditor } from './ImpresionDelCanalEditor'
import { ProductosDelCanalSection } from './ProductosDelCanalSection'

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

/** Tope de `marcarRevisados` en el SERVIDOR. */
const MAX_REVISADOS = 10000

/** Los más recientes primero, hasta el tope: el resto sigue saliendo como nuevo, a la vista. */
const idsRecientes = (ps: ProductoDelCanal[]) =>
  [...ps]
    .sort((a, b) => Date.parse(String(b.createdAt)) - Date.parse(String(a.createdAt)))
    .slice(0, MAX_REVISADOS)
    .map(p => p.id)

const mismaLista = (a: string[] | null, b: string[] | null) =>
  a === null || b === null ? a === b : a.length === b.length && new Set([...a, ...b]).size === a.length

/** La lista y los precios de al abrir, armados cuando llegan los productos. */
interface Seleccion {
  lista: string[] | null
  precios: Record<string, number | undefined>
  listaAlAbrir: string[] | null
  /** Códigos de la lista vieja que ya no son de ningún producto: no se pueden guardar como id. */
  codigos: string[]
  /** El canal tenía la lista vieja por código: el primer «Guardar» la manda ya por id. */
  porCodigo: boolean
}

function armarSeleccion(config: DeliveryChannelConfig | null | undefined, productos: ProductoDelCanal[]): Seleccion {
  const s = seleccionAlAbrir(config, productos)
  return {
    lista: s.lista,
    precios: s.precios,
    listaAlAbrir: s.lista,
    codigos: s.codigosSinProducto,
    porCodigo: !config?.productoIds && !!config?.productos,
  }
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
  const { can } = useAccess()

  // 🔴 La copia del canal al abrir (y al «Recargar»): de ELLA sale todo lo editable y la huella. El `channel` vivo sólo sirve
  // para «Recargar»; un refresco no toca nada de lo que se está editando.
  const [canalAlAbrir, setCanalAlAbrir] = useState(channel)
  const [horario, setHorario] = useState<DeliveryWeeklyHours>(channel.config?.deliveryHours ?? HORARIO_DEFAULT)
  // `number | undefined` a propósito: un input numérico que colapsa el vacío a 0 atrapa el
  // campo — el usuario borra y el valor rebota. Regla `ui-patterns.md`.
  const [markup, setMarkup] = useState<number | undefined>(channel.config?.precios?.markupPercent)
  const [agotar, setAgotar] = useState(channel.config?.agotarPorInventario !== false)
  // La impresión elegida y sin guardar en su cuadro: el «Guardar» de arriba la guarda junto con lo demás.
  const [impresionPendiente, setImpresionPendiente] = useState<ImpresionDelCanal | null>(null)
  /** `null` hasta que llegan los productos (sin ellos no se puede resolver la lista vieja por código). */
  const [sel, setSel] = useState<Seleccion | null>(null)
  /** Ids que «Ya los revisé» marcó en esta apertura (el canal congelado no los trae). */
  const [revisadosAqui, setRevisadosAqui] = useState<string[]>([])
  const [conflicto, setConflicto] = useState(false)
  const [recargando, setRecargando] = useState(false)
  /** Cambia con cada «Recargar»: el editor de impresión se monta de nuevo y suelta su borrador. */
  const [recargas, setRecargas] = useState(0)

  const reiniciar = (c: DeliveryChannelLink) => {
    setCanalAlAbrir(c)
    setHorario(c.config?.deliveryHours ?? HORARIO_DEFAULT)
    setMarkup(c.config?.precios?.markupPercent)
    setAgotar(c.config?.agotarPorInventario !== false)
    setImpresionPendiente(null)
    setSel(null)
    setRevisadosAqui([])
    setConflicto(false)
    setRecargas(r => r + 1)
  }
  // Si el modal se reusa para OTRO canal, se congela ése: si no, se guardaría el horario de otra tienda encima del suyo.
  if (channel.id !== canalAlAbrir.id) reiniciar(channel)

  const productosQ = useQuery({
    queryKey: ['products', venueId, 'canalDelivery'],
    queryFn: () => getProducts(venueId, { includeRecipe: false, includeModifiers: false, orderBy: 'name' }),
    enabled: open,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
  const productos: ProductoDelCanal[] | undefined = productosQ.data
  if (productos && sel === null) setSel(armarSeleccion(canalAlAbrir.config, productos))

  const revisados = useMemo(() => [...(canalAlAbrir.config?.productosRevisados ?? []), ...revisadosAqui], [canalAlAbrir, revisadosAqui])
  const nuevos = useMemo(
    () => (productos && sel ? productosNuevos(productos, sel.lista, revisados, canalAlAbrir.createdAt ?? null) : []),
    [productos, sel, revisados, canalAlAbrir],
  )
  const yaNoExisten = useMemo(
    () => ({ ids: productos && sel ? idsQueYaNoExisten(sel.lista, productos) : [], codigos: sel?.codigos ?? [] }),
    [productos, sel],
  )
  /**
   * Precios = dinero: se mandan TODOS los que se cargaron o se editaron, marcados o no (un producto que sale por temporada y
   * vuelve no debe publicarse al precio guía sin que nadie lo note; desmarcado no se publica porque no va en `productoIds`).
   * Sólo se valida lo que el dueño ve y edita (los marcados); un precio escondido inválido no se manda.
   */
  const { preciosAMandar, hayPreciosInvalidos } = useMemo(() => {
    if (!sel) return { preciosAMandar: {} as Record<string, number>, hayPreciosInvalidos: false }
    const malos = new Set(erroresDePrecios(sel.precios))
    const enLista = new Set(sel.lista ?? [])
    return {
      preciosAMandar: Object.fromEntries(Object.entries(sel.precios).filter(([id, v]) => v !== undefined && !malos.has(id))) as Record<
        string,
        number
      >,
      hayPreciosInvalidos: [...malos].some(id => enLista.has(id)),
    }
  }, [sel])
  // Vacía = ningún producto VIVO marcado (una lista con sólo ids que ya no existen dejaría el menú en blanco).
  const listaVacia = useMemo(() => {
    if (!productos || !sel?.lista) return false
    const enLista = new Set(sel.lista)
    return !productos.some(p => enLista.has(p.id))
  }, [productos, sel])

  /** Nunca se configuró: se está mostrando el estimado, y eso hay que decirlo. */
  const usandoEstimado = !canalAlAbrir.config?.deliveryHours

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
    if (hayPreciosInvalidos) out.push(t('settings.productos.errorPrecios'))
    return out
  }, [horario, markup, hayPreciosInvalidos, t])

  const cuerpo = () => {
    // Sin margen se manda el bloque vacío, no se omite: omitirlo dejaría el markup
    // anterior vivo (el backend mezcla), y el usuario acaba de dejar el campo en blanco.
    const margen = markup === undefined ? {} : { markupPercent: markup }
    const config: DeliveryChannelConfig = {
      deliveryHours: horario,
      // Sin `porProducto`, el SERVIDOR conserva los precios por producto (y los de modificadores por código) que había.
      precios: margen,
      agotarPorInventario: agotar,
      // Sólo si cambió: mandarla siempre pisaría lo que otra persona guardó desde Impresoras → Delivery.
      ...(impresionPendiente ? { impresion: impresionPendiente } : {}),
    }
    let marcarRevisados: string[] = []
    // Sin productos (cargando o falló) no se toca la selección: se guarda como antes de D1.
    if (sel && productos) {
      if (sel.lista !== null || Object.keys(preciosAMandar).length > 0) config.precios = { ...margen, porProducto: preciosAMandar }
      const cambio = !mismaLista(sel.lista, sel.listaAlAbrir)
      // La lista vieja por código se manda ya por id; la copia por código la arma el SERVIDOR.
      if (sel.lista !== null && (cambio || sel.porCodigo)) config.productoIds = sel.lista
      // Los nuevos que tenía en pantalla y dejó fuera cuentan como revisados (los creados antes de conectar nunca son nuevos).
      if (cambio) marcarRevisados = idsRecientes(nuevos)
    }
    return {
      config,
      ...(canalAlAbrir.seleccionHuella ? { seleccionEsperada: canalAlAbrir.seleccionHuella } : {}),
      ...(marcarRevisados.length > 0 ? { marcarRevisados } : {}),
    }
  }

  const mutation = useMutation({
    mutationFn: () => updateChannel(venueId, channel.id, cuerpo()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryChannels', venueId] })
      toast({ title: t('settings.saveSuccess') })
      onClose()
    },
    onError: (error: unknown) => {
      const r = (error as { response?: { status?: number; data?: { message?: string; code?: string } } })?.response
      if (r?.data?.code === 'CHANNEL_CHANGED' || r?.status === 409) {
        setConflicto(true)
        return
      }
      const mensaje = r?.data?.message ?? t('settings.saveErrorFallback')
      toast({ title: t('settings.saveError'), description: mensaje, variant: 'destructive' })
    },
  })

  const revisar = useMutation({
    mutationFn: (ids: string[]) => updateChannel(venueId, channel.id, { marcarRevisados: ids }),
    onSuccess: (_link, ids) => {
      setRevisadosAqui(prev => [...prev, ...ids])
      queryClient.invalidateQueries({ queryKey: ['deliveryChannels', venueId] })
    },
    onError: (error: unknown) => {
      const mensaje = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('settings.saveErrorFallback')
      toast({ title: t('settings.productos.revisadosError'), description: mensaje, variant: 'destructive' })
    },
  })

  /** «Recargar» tras un 409: trae el canal y el catálogo de nuevo y vuelve a congelar TODO desde ahí. */
  const recargar = async () => {
    setRecargando(true)
    try {
      await Promise.all([queryClient.refetchQueries({ queryKey: ['deliveryChannels', venueId] }), productosQ.refetch()])
    } finally {
      setRecargando(false)
    }
    const fresco = queryClient.getQueryData<DeliveryChannelLink[]>(['deliveryChannels', venueId])?.find(c => c.id === channel.id)
    reiniciar(fresco ?? channel)
  }

  const setDia = (dia: DeliveryWeekday, patch: Partial<DeliveryDayHours>) =>
    setHorario(prev => ({ ...prev, [dia]: { ...prev[dia], ...patch } }))

  const setRango = (dia: DeliveryWeekday, campo: 'open' | 'close', valor: string) =>
    setHorario(prev => {
      const ranges = prev[dia].ranges.length > 0 ? [...prev[dia].ranges] : [{ open: '09:00', close: '22:00' }]
      ranges[0] = { ...ranges[0], [campo]: valor }
      return { ...prev, [dia]: { ...prev[dia], ranges } }
    })

  const puedeGuardar = errores.length === 0 && !listaVacia && !conflicto && !recargando && !mutation.isPending
  const canal = providerLabel(channel.provider)

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={t('settings.title')}
      subtitle={canal}
      contentClassName="bg-muted/30"
      actions={
        <Button data-tour="delivery-settings-save" disabled={!puedeGuardar} onClick={() => mutation.mutate()}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('settings.save')}
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl space-y-6 py-6">
        {conflicto && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="flex-1 text-sm text-destructive">{t('settings.conflicto')}</p>
            <Button variant="outline" size="sm" disabled={recargando} onClick={recargar}>
              {recargando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('settings.recargar')}
            </Button>
          </div>
        )}

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

        {/* ── Productos del canal (D1) ─────────────────────────────────────────────── */}
        <ProductosDelCanalSection
          provider={channel.provider}
          canal={canal}
          productos={productos ?? []}
          cargando={productosQ.isLoading}
          error={!productos && productosQ.isError}
          onReintentar={() => productosQ.refetch()}
          lista={sel?.lista ?? null}
          onListaChange={lista => setSel(s => s && { ...s, lista })}
          precios={sel?.precios ?? {}}
          onPreciosChange={precios => setSel(s => s && { ...s, precios })}
          markupPercent={markup !== undefined && Number.isFinite(markup) ? markup : undefined}
          nuevos={nuevos}
          yaNoExisten={yaNoExisten}
          onQuitarQueYaNoExisten={() => {
            const fuera = new Set(yaNoExisten.ids)
            setSel(s => s && { ...s, lista: s.lista && s.lista.filter(id => !fuera.has(id)), codigos: [] })
          }}
          onYaRevisados={() => revisar.mutate(idsRecientes(nuevos))}
          revisando={revisar.isPending}
        />

        {/* ── Agotar según inventario ─────────────────────────────────────────────── */}
        <section data-tour="delivery-settings-agotar" className="rounded-2xl border border-input bg-card p-6">
          <div className="flex items-start gap-3">
            <PackageX className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <h3 className="text-base font-medium" id="delivery-settings-agotar-title">
                {t('settings.agotar.title', { canal })}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('settings.agotar.help', { canal })}</p>
            </div>
            <Switch checked={agotar} onCheckedChange={setAgotar} aria-labelledby="delivery-settings-agotar-title" />
          </div>
        </section>

        {/* ── Impresión (misma pieza que la pestaña «Delivery» de Impresoras; guarda por su cuenta) ───────── */}
        {/* El canal congelado: el borrador del editor se descarta sólo cuando cambia lo guardado que le pasamos (al «Recargar»). */}
        <section className="rounded-2xl border border-input bg-card p-6">
          <ImpresionDelCanalEditor
            key={recargas}
            venueId={venueId}
            channel={canalAlAbrir}
            canEdit={can('delivery-channels:manage')}
            onPendienteChange={setImpresionPendiente}
            conBotonGuardar={false}
          />
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
