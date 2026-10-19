import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { mensajeDeVariantes } from '@/features/product-variants/errors'
import type { EstadoAgrupar } from '@/features/product-variants/groupExisting'
import { unirPaginas, useGroupSuggestions, useInvalidarCatalogo, useShopifyProposals } from '@/features/product-variants/hooks'
import { applyShopifyProposalsBatch, previewAllShopifyProposals, shopifyFileProposals } from '@/services/productGroups.service'
import type { GroupSuggestion, ShopifyBatchResult, ShopifyFileProposal, ShopifyPreviewAllPage, ShopifyProposal } from '@/types/productGroup'
import { GroupExistingDialog, type OrigenShopify } from './GroupExistingDialog'

interface Props {
  open: boolean
  onClose: () => void
  venueId: string
  /** El producto con variantes recién creado (el padre abre su ficha). */
  onDone: (groupId: string) => void
}

type Pestana = 'sugerencias' | 'archivo' | 'shopify'
/** Lo que se está revisando en «Agrupar como variantes»; `handle` (sólo si viene del archivo) identifica la tarjeta para ponerle «Agrupada». */
interface Revision {
  handle?: string
  inicial: EstadoAgrupar
  avisos?: string[]
  /** «Desde Shopify»: el diálogo abre en sólo lectura y llama las rutas de propuestas. */
  shopify?: OrigenShopify
}

/** Contrato §3.5: el server rechaza más de 900 KiB y el cuerpo JSON global se queda en 1 MB: no se manda lo que no va a caber. */
const MAX_BYTES = 900 * 1024
const MUESTRA = 4
/** Un archivo de 5,000 renglones da ~2,500 propuestas: se pintan de 50 en 50. */
const TANDA = 50
/** «Agrupar todas»: el server acepta hasta 25 pares por llamada. */
const LOTE = 25
/** El server manda «Opción 1», «Opción 2»… como relleno cuando no sabe cómo se llama el eje: se muestran vacías para que el dueño las escriba. */
const esRelleno = (nombre: string) => /^Opci[oó]n \d+$/i.test(nombre.trim())

function desdeSugerencia(s: GroupSuggestion): EstadoAgrupar {
  const optionNames = s.optionNames.map(n => (esRelleno(n) ? '' : n))
  return {
    name: s.parentName,
    optionNames,
    // Los valores de un producto pueden venir de menos que las opciones: se rellenan con '' para que el dueño los complete.
    members: s.members.map(m => ({
      productId: m.productId,
      name: m.name,
      sku: m.sku || undefined,
      values: optionNames.map((_, i) => m.values[i] ?? ''),
    })),
  }
}

function desdePropuesta(p: ShopifyFileProposal): EstadoAgrupar {
  return {
    name: p.parentName,
    optionNames: p.options.map(o => o.name),
    members: p.members.map(m => ({ productId: m.productId, name: m.name, values: p.options.map((_, i) => m.values[i] ?? '') })),
  }
}

/** Sólo para abrir el diálogo: nombre, opciones y valores los arma el server con lo que dijo Shopify (el diálogo los muestra en sólo lectura). */
function desdeShopify(p: ShopifyProposal): EstadoAgrupar {
  return {
    name: p.title ?? '',
    optionNames: [],
    members: p.members.map(m => ({ productId: m.productId, name: m.name, sku: m.sku || undefined, values: [] })),
  }
}
const nombreDePropuesta = (p: ShopifyProposal) => p.title || p.members[0]?.name || p.shopifyProductId

/** «Agrupar productos que ya tengo»: las sugerencias del server, el archivo de Shopify y lo ligado a Shopify. Se monta al abrir (cada apertura arranca limpia). */
export function GroupFromSourcesDialog(p: Props) {
  return p.open ? <DialogoAbierto {...p} /> : null
}

function DialogoAbierto({ onClose, venueId, onDone }: Props) {
  const { t } = useTranslation('variants')
  const [pestana, setPestana] = useState<Pestana>('sugerencias')
  const [revisando, setRevisando] = useState<Revision | null>(null)
  // «Agrupada» es de la respuesta de ESTE archivo (por handle). Las sugerencias no la necesitan: `GroupExistingDialog` invalida el catálogo
  // y espera la recarga antes de avisar, así que la sugerencia ya agrupada desaparece sola.
  const [agrupadas, setAgrupadas] = useState<ReadonlySet<string>>(() => new Set())
  const revisar = (inicial: EstadoAgrupar, avisos?: string[], handle?: string) => setRevisando({ handle, inicial, avisos })

  return (
    <FullScreenModal open onClose={onClose} title={t('fuentes.titulo')} contentClassName="bg-muted/30" closeButtonTestId="cerrar-fuentes">
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6" data-tour="group-sources-dialog">
        <Tabs value={pestana} onValueChange={v => setPestana(v as Pestana)}>
          <TabsList className="rounded-full bg-muted/60 px-1 py-1 border border-border">
            {(['sugerencias', 'archivo', 'shopify'] as const).map(clave => (
              <TabsTrigger
                key={clave}
                value={clave}
                className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background"
                data-tour={`group-sources-tab-${clave}`}
              >
                {t(`fuentes.${clave}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          {/* `forceMount`: cambiar de pestaña no pierde el archivo ya leído ni las sugerencias cargadas. Radix pone `hidden: !present` y con
              forceMount `present` siempre es true, así que la que no está activa se oculta con `hidden` propio (gana: va después). */}
          <TabsContent value="sugerencias" forceMount hidden={pestana !== 'sugerencias'} className="mt-6">
            <PanelDeSugerencias venueId={venueId} onRevisar={s => revisar(desdeSugerencia(s))} />
          </TabsContent>
          <TabsContent value="archivo" forceMount hidden={pestana !== 'archivo'} className="mt-6">
            <PanelDeArchivo
              venueId={venueId}
              agrupadas={agrupadas}
              onArchivoNuevo={() => setAgrupadas(new Set())}
              onRevisar={(p, avisos) => revisar(desdePropuesta(p), avisos, p.handle)}
            />
          </TabsContent>
          <TabsContent value="shopify" forceMount hidden={pestana !== 'shopify'} className="mt-6">
            <PanelDeShopify
              venueId={venueId}
              activa={pestana === 'shopify'}
              onRevisar={x =>
                setRevisando({
                  inicial: desdeShopify(x),
                  shopify: { shopifyProductId: x.shopifyProductId, mode: x.mode, groupName: x.groupName },
                })
              }
            />
          </TabsContent>
        </Tabs>
      </div>
      {revisando && (
        <GroupExistingDialog
          open
          onClose={() => setRevisando(null)}
          venueId={venueId}
          inicial={revisando.inicial}
          avisos={revisando.avisos}
          shopify={revisando.shopify}
          onDone={groupId => {
            if (revisando.handle) setAgrupadas(prev => new Set(prev).add(revisando.handle!))
            setRevisando(null)
            onDone(groupId)
          }}
        />
      )}
    </FullScreenModal>
  )
}

/** Una sugerencia o una propuesta: nombre, cuántos productos, detalle y el botón (o «Agrupada» si ya se hizo en esta sesión). */
function Tarjeta(p: {
  titulo: string
  productos: number
  detalle?: string
  agrupada: boolean
  onRevisar: () => void
  tour: string
  /** Sin botón: la propuesta todavía no se puede agrupar (lo explica su contenido). */
  sinBoton?: boolean
  children?: ReactNode
}) {
  const { t } = useTranslation('variants')
  return (
    <li className="space-y-3 rounded-2xl border border-border/50 bg-card p-4" data-tour={p.tour}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{p.titulo}</p>
          <p className="text-sm text-muted-foreground">{t('fuentes.productos', { count: p.productos })}</p>
          {p.detalle && <p className="truncate text-xs text-muted-foreground">{p.detalle}</p>}
        </div>
        {p.sinBoton ? null : p.agrupada ? (
          <Badge variant="secondary">{t('fuentes.agrupada')}</Badge>
        ) : (
          <Button size="sm" className="cursor-pointer" onClick={p.onRevisar} data-tour={`${p.tour}-review`}>
            {t('fuentes.revisar')}
          </Button>
        )}
      </div>
      {p.children}
    </li>
  )
}

function PanelDeSugerencias(p: { venueId: string; onRevisar: (s: GroupSuggestion) => void }) {
  const { t } = useTranslation('variants')
  const q = useGroupSuggestions(p.venueId, true)
  const { items, total } = unirPaginas(q.data, s => s.key)

  if (q.isLoading)
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('fuentes.cargando')}
      </p>
    )
  if (q.isError && items.length === 0)
    return (
      <div role="alert" className="space-y-2 rounded-xl border border-input bg-card p-4 text-sm">
        <p className="font-medium text-destructive">{t('fuentes.error')}</p>
        <p className="text-muted-foreground">{mensajeDeVariantes(q.error, t)}</p>
        <Button variant="outline" size="sm" onClick={() => void q.refetch()} data-tour="group-sources-retry">
          {t('fuentes.reintentar')}
        </Button>
      </div>
    )
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{t('fuentes.vacio')}</p>

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('fuentes.totalSugerencias', { count: total })}</p>
      <ul className="space-y-3">
        {items.map(s => (
          <Tarjeta
            key={s.key}
            titulo={s.parentName}
            productos={s.memberCount}
            detalle={s.members
              .slice(0, MUESTRA)
              .map(m => m.name)
              .join(' · ')}
            agrupada={false}
            onRevisar={() => p.onRevisar(s)}
            tour="group-sources-suggestion"
          >
            {s.memberCount > s.members.length && (
              <p className="text-xs text-muted-foreground">{t('fuentes.primeros250', { count: s.memberCount })}</p>
            )}
          </Tarjeta>
        ))}
      </ul>
      {q.isFetchNextPageError && <p role="alert" className="text-sm text-destructive">{t('fuentes.errorMas')}</p>}
      {q.hasNextPage && (
        <Button
          variant="outline"
          className="w-full cursor-pointer"
          disabled={q.isFetchingNextPage}
          onClick={() => void q.fetchNextPage()}
          data-tour="group-sources-load-more"
        >
          {t('fuentes.cargarMas', { count: Math.max(0, total - items.length) })}
        </Button>
      )}
    </div>
  )
}

function PanelDeArchivo(p: {
  venueId: string
  agrupadas: ReadonlySet<string>
  /** Llegó la respuesta de un archivo nuevo: las marcas «Agrupada» del anterior ya no valen (la familia pudo deshacerse). */
  onArchivoNuevo: () => void
  onRevisar: (propuesta: ShopifyFileProposal, avisos: string[]) => void
}) {
  const { t } = useTranslation('variants')
  const [aviso, setAviso] = useState<'muyGrande' | 'archivoVacio' | 'noLeido' | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const proponer = useMutation({ mutationFn: (csv: string) => shopifyFileProposals(p.venueId, csv), onSuccess: p.onArchivoNuevo })
  const ocupado = leyendo || proponer.isPending

  const alElegir = async (ev: ChangeEvent<HTMLInputElement>) => {
    const archivo = ev.target.files?.[0]
    ev.target.value = '' // el mismo archivo se puede volver a elegir después de corregirlo
    proponer.reset()
    setAviso(null)
    if (!archivo) return
    if (archivo.size === 0) return setAviso('archivoVacio')
    if (archivo.size > MAX_BYTES) return setAviso('muyGrande')
    setLeyendo(true)
    try {
      proponer.mutate(await archivo.text())
    } catch {
      setAviso('noLeido')
    } finally {
      setLeyendo(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-2xl border border-border/50 bg-card p-6">
        <p className="text-sm text-muted-foreground">{t('fuentes.archivoAyuda')}</p>
        <Label htmlFor="fuentes-archivo">{t('fuentes.elegirArchivo')}</Label>
        <Input
          id="fuentes-archivo"
          type="file"
          accept=".csv,text/csv"
          disabled={ocupado}
          onChange={ev => void alElegir(ev)}
          data-tour="group-sources-file"
        />
      </div>
      {ocupado && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('fuentes.leyendo')}
        </p>
      )}
      {aviso && (
        <p role="alert" className="text-sm text-destructive">
          {t(`fuentes.${aviso}`)}
        </p>
      )}
      {proponer.isError && (
        <p role="alert" className="text-sm text-destructive">
          {/* 413: el cuerpo no cupo en el límite JSON del server; para el dueño es lo mismo que «pasa de 900 KB». */}
          {(proponer.error as { response?: { status?: number } } | null)?.response?.status === 413
            ? t('fuentes.muyGrande')
            : mensajeDeVariantes(proponer.error, t)}
        </p>
      )}
      {proponer.data && <Resultado respuesta={proponer.data} agrupadas={p.agrupadas} onRevisar={p.onRevisar} />}
    </div>
  )
}

/** Lista local de `<li>` de 50 en 50 (todo está en memoria; sólo se acota lo que se pinta). El total ya lo dice el título de quien la usa. */
function PorTandas<T>(p: {
  items: T[]
  render: (item: T) => ReactNode
  className: string
  /** Opcional: quien la usa necesita saber cuántas se pintaron («Agrupar todas» avisa las que no se abrieron). */
  visibles?: number
  onMostrarMas?: () => void
}) {
  const { t } = useTranslation('variants')
  const [propias, setPropias] = useState(TANDA)
  const visibles = p.visibles ?? propias
  const setVisibles = (f: (v: number) => number) => (p.onMostrarMas ? p.onMostrarMas() : setPropias(f))
  const faltan = p.items.length - visibles
  return (
    <>
      <ul className={p.className}>{p.items.slice(0, visibles).map(p.render)}</ul>
      {faltan > 0 && (
        <Button
          variant="outline"
          className="mt-3 w-full cursor-pointer"
          onClick={() => setVisibles(v => v + TANDA)}
          data-tour="group-sources-show-more"
        >
          {t('fuentes.mostrarMas', { count: faltan })}
        </Button>
      )}
    </>
  )
}

function Resultado(p: {
  respuesta: { proposals: ShopifyFileProposal[]; skipped: Array<{ handle: string; conflicts: string[]; unmatched: string[] }> }
  agrupadas: ReadonlySet<string>
  onRevisar: (propuesta: ShopifyFileProposal, avisos: string[]) => void
}) {
  const { t } = useTranslation('variants')
  // Codex C6: una respuesta sin alguna de las dos listas (server viejo, proxy) no tumba la vista; un auxiliar nunca rompe la pantalla.
  const proposals = p.respuesta.proposals ?? []
  const skipped = p.respuesta.skipped ?? []
  if (proposals.length === 0 && skipped.length === 0) return <p className="text-sm text-muted-foreground">{t('fuentes.sinPropuestas')}</p>
  return (
    <div className="space-y-4">
      {proposals.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">{t('fuentes.propuestas', { count: proposals.length })}</p>
          <PorTandas
            items={proposals}
            className="space-y-3"
            render={propuesta => (
              <Propuesta
                key={propuesta.handle}
                propuesta={propuesta}
                agrupada={p.agrupadas.has(propuesta.handle)}
                onRevisar={p.onRevisar}
              />
            )}
          />
        </div>
      )}
      {skipped.length > 0 && (
        <Collapsible className="rounded-2xl border border-border/50 bg-card p-4">
          <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-2 text-sm font-medium" data-tour="group-sources-skipped">
            {t('fuentes.omitidos', { count: skipped.length })}
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <PorTandas
              items={skipped}
              className="mt-3 space-y-2 text-sm"
              render={s => (
                <li key={s.handle}>
                  <p className="font-medium">{s.handle}</p>
                  {s.conflicts.map((c, i) => (
                    <p key={i} className="text-muted-foreground">
                      {c}
                    </p>
                  ))}
                  {s.unmatched.length > 0 && <p className="break-words text-muted-foreground">{s.unmatched.join(', ')}</p>}
                </li>
              )}
            />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

function Propuesta(p: {
  propuesta: ShopifyFileProposal
  agrupada: boolean
  onRevisar: (propuesta: ShopifyFileProposal, avisos: string[]) => void
}) {
  const { t } = useTranslation('variants')
  const { propuesta } = p
  const sinEncontrar = t('fuentes.noEncontrados', { count: propuesta.unmatched.length })
  // Lo que el dueño debe ver también DENTRO de «Agrupar como variantes»: los conflictos y lo que no se encontró.
  const avisos = [...propuesta.conflicts, ...(propuesta.unmatched.length ? [`${sinEncontrar}: ${propuesta.unmatched.join(', ')}`] : [])]
  return (
    <Tarjeta
      titulo={propuesta.parentName || propuesta.handle}
      productos={propuesta.members.length}
      detalle={propuesta.options.map(o => `${o.name}: ${o.values.join(', ')}`).join(' · ')}
      agrupada={p.agrupada}
      onRevisar={() => p.onRevisar(propuesta, avisos)}
      tour="group-sources-proposal"
    >
      {propuesta.conflicts.length > 0 && (
        <div className="space-y-1 rounded-xl border border-input bg-muted p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            {t('fuentes.conflictos')}
          </p>
          <ul className="list-disc space-y-1 pl-6">
            {propuesta.conflicts.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      {propuesta.unmatched.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex cursor-pointer items-center gap-1 text-sm text-muted-foreground" data-tour="group-sources-unmatched">
            <ChevronDown className="h-4 w-4" aria-hidden />
            {sinEncontrar}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="mt-2 break-words text-sm text-muted-foreground">{propuesta.unmatched.join(', ')}</p>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Tarjeta>
  )
}

/**
 * «Desde Shopify» (bloque 5, spec §0 V3/V6): un renglón por producto de Shopify con tallas sueltas ligadas. Se pide al abrir la pestaña
 * (no antes) y por cursor de 20 en 20. Cada tarjeta dice si crea familia o agrega a una, o por qué todavía no se puede.
 */
function PanelDeShopify(p: { venueId: string; activa: boolean; onRevisar: (x: ShopifyProposal) => void }) {
  const { t } = useTranslation('variants')
  const q = useShopifyProposals(p.venueId, p.activa)
  const { items, total } = unirPaginas(q.data, x => x.shopifyProductId)
  const [todas, setTodas] = useState(false)
  const nombres = useMemo(() => new Map(items.map(x => [x.shopifyProductId, nombreDePropuesta(x)])), [items])

  // «Agrupar todas» queda montado pase lo que pase con la lista: al terminar, la lista se relee y puede quedar vacía, y el resumen
  // (aplicadas, saltadas, bloqueadas) no debe desaparecer con ella. Va SIEMPRE en el mismo lugar del árbol: en otro lugar React lo
  // desmontaría al cambiar de estado (y volvería a pedir todas las vistas previas).
  let contenido: ReactNode
  if (q.isLoading)
    contenido = (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('shopify.cargando')}
      </p>
    )
  else if (q.isError && items.length === 0)
    contenido = (
      <div role="alert" className="space-y-2 rounded-xl border border-input bg-card p-4 text-sm">
        <p className="font-medium text-destructive">{t('shopify.error')}</p>
        <p className="text-muted-foreground">{mensajeDeVariantes(q.error, t)}</p>
        <Button variant="outline" size="sm" onClick={() => void q.refetch()} data-tour="group-sources-shopify-retry">
          {t('fuentes.reintentar')}
        </Button>
      </div>
    )
  else if (items.length === 0) contenido = <p className="text-sm text-muted-foreground">{t('shopify.vacio')}</p>
  else
    contenido = (
      <>
        <ul className="space-y-3">
          {items.map(x => (
            <Tarjeta
              key={x.shopifyProductId}
              titulo={nombreDePropuesta(x)}
              productos={x.members.length}
              detalle={x.members
                .slice(0, MUESTRA)
                .map(m => m.name)
                .join(' · ')}
              agrupada={false}
              sinBoton={!x.ready || !!x.blockedReason}
              onRevisar={() => p.onRevisar(x)}
              tour="group-sources-shopify-proposal"
            >
              <Badge variant="outline">{x.mode === 'ADD' ? t('shopify.agregarA', { name: x.groupName ?? '' }) : t('shopify.crear')}</Badge>
              {!x.ready ? (
                <p className="text-sm text-muted-foreground">{t('shopify.pendiente')}</p>
              ) : (
                x.blockedReason && <p className="text-sm text-muted-foreground">{x.blockedReason}</p>
              )}
            </Tarjeta>
          ))}
        </ul>
        {q.isFetchNextPageError && (
          <p role="alert" className="text-sm text-destructive">
            {t('shopify.errorMas')}
          </p>
        )}
        {q.hasNextPage && (
          <Button
            variant="outline"
            className="w-full cursor-pointer"
            disabled={q.isFetchingNextPage}
            onClick={() => void q.fetchNextPage()}
            data-tour="group-sources-shopify-more"
          >
            {t('shopify.verMas', { count: Math.max(0, total - items.length) })}
          </Button>
        )}
      </>
    )

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t('shopify.total', { count: total })}</p>
          <Button className="cursor-pointer" disabled={todas} onClick={() => setTodas(true)} data-tour="group-sources-shopify-all">
            {t('shopify.agruparTodas', { count: total })}
          </Button>
        </div>
      )}
      {todas && <AgruparTodas venueId={p.venueId} nombres={nombres} onCerrar={() => setTodas(false)} />}
      {contenido}
    </div>
  )
}

type Vistas = ShopifyPreviewAllPage['items']
type Bloqueadas = ShopifyPreviewAllPage['blocked']
type Fase =
  | { paso: 'revisando'; vistas: number; total: number }
  | { paso: 'revisar'; items: Vistas; blocked: Bloqueadas }
  | { paso: 'aplicando'; hechos: number; de: number }
  | {
      paso: 'listo'
      applied: ShopifyBatchResult['applied']
      skipped: ShopifyBatchResult['skipped']
      /** Lotes que no respondieron: no se sabe si entraron (la lista releída dice la verdad). */
      sinRespuesta: string[]
      blocked: Bloqueadas
      vistas: Vistas
    }

/**
 * «Agrupar todas» (Codex r4 H1: se confirma lo que se vio). Paso 1, tras el clic: recorre `preview-all` página por página y enseña, por
 * propuesta, qué cambia en cada talla (IVA, categoría, extras…) y las bloqueadas con su motivo. Paso 2: manda EXACTAMENTE esos pares
 * `{shopifyProductId, fingerprint}` en lotes de 25 (cada uno se aplica en su transacción; una huella vieja sale como «Cambió desde que lo
 * viste»). Al final, aplicadas, saltadas y bloqueadas.
 */
function AgruparTodas(p: { venueId: string; nombres: ReadonlyMap<string, string>; onCerrar: () => void }) {
  const { t } = useTranslation('variants')
  const invalidar = useInvalidarCatalogo()
  const [fase, setFase] = useState<Fase>({ paso: 'revisando', vistas: 0, total: 0 })
  // Los nombres de la lista al abrir: al terminar la lista se relee (sin lo agrupado) y las bloqueadas perderían su nombre.
  const [nombres] = useState(p.nombres)
  const [pintadas, setPintadas] = useState(TANDA)
  const [error, setError] = useState<unknown>(null)
  const enviando = useRef(false)

  useEffect(() => {
    let vivo = true
    void (async () => {
      const items: Vistas = []
      const blocked: Bloqueadas = []
      const vistos = new Set<string>()
      let cursor: string | undefined
      try {
        do {
          const pag = await previewAllShopifyProposals(p.venueId, cursor)
          if (!vivo) return
          for (const x of pag.items ?? []) if (!vistos.has(x.shopifyProductId) && vistos.add(x.shopifyProductId)) items.push(x)
          for (const x of pag.blocked ?? []) if (!vistos.has(x.shopifyProductId) && vistos.add(x.shopifyProductId)) blocked.push(x)
          // Un cursor que no avanza (server viejo, proxy) no se queda dando vueltas.
          const siguiente = pag.nextCursor && pag.nextCursor !== cursor ? pag.nextCursor : undefined
          cursor = siguiente
          setFase({ paso: 'revisando', vistas: vistos.size, total: pag.total })
        } while (cursor)
        setFase({ paso: 'revisar', items, blocked })
      } catch (e) {
        if (vivo) setError(e)
      }
    })()
    return () => {
      vivo = false
    }
  }, [p.venueId])

  const nombre = (shopifyProductId: string, vistas: Vistas = []) =>
    vistas.find(x => x.shopifyProductId === shopifyProductId)?.groupName ||
    nombres.get(shopifyProductId) ||
    t('shopify.sinNombre', { id: shopifyProductId.split('/').pop() })

  const aplicar = async (items: Vistas, blocked: Bloqueadas) => {
    if (enviando.current) return
    enviando.current = true
    const pares = items.map(x => ({ shopifyProductId: x.shopifyProductId, fingerprint: x.preview.fingerprint }))
    const applied: ShopifyBatchResult['applied'] = []
    const skipped: ShopifyBatchResult['skipped'] = []
    const sinRespuesta: string[] = []
    setFase({ paso: 'aplicando', hechos: 0, de: pares.length })
    for (let i = 0; i < pares.length; i += LOTE) {
      const lote = pares.slice(i, i + LOTE)
      try {
        const r = await applyShopifyProposalsBatch(p.venueId, lote)
        applied.push(...(r.applied ?? []))
        skipped.push(...(r.skipped ?? []))
      } catch {
        // Un lote sin respuesta NO es «saltado»: pudo haber entrado. Va aparte; la lista se relee abajo y enseña la verdad
        // (repetirlo es seguro: lo ya agrupado responde «Ya estaba agrupada»).
        sinRespuesta.push(...lote.map(x => x.shopifyProductId))
      }
      setFase({ paso: 'aplicando', hechos: Math.min(i + LOTE, pares.length), de: pares.length })
    }
    await invalidar(p.venueId)
    setFase({ paso: 'listo', applied, skipped, sinRespuesta, blocked, vistas: items })
  }

  const listaDeBloqueadas = (blocked: Bloqueadas, vistas: Vistas = []) =>
    blocked.length > 0 && (
      <section className="space-y-2 rounded-xl border border-input p-3" data-tour="group-sources-shopify-blocked">
        <p className="text-sm font-medium">{t('shopify.todas.bloqueadas', { count: blocked.length })}</p>
        <ul className="space-y-2 text-sm">
          {blocked.map(b => (
            <li key={b.shopifyProductId}>
              <p className="font-medium">{nombre(b.shopifyProductId, vistas)}</p>
              <p className="text-muted-foreground">{b.motivo}</p>
            </li>
          ))}
        </ul>
      </section>
    )

  return (
    <div className="space-y-4 rounded-2xl border border-input bg-card p-4" data-tour="group-sources-shopify-all-panel">
      {error ? (
        <div role="alert" className="space-y-2 text-sm">
          <p className="font-medium text-destructive">{t('shopify.todas.error')}</p>
          <p className="text-muted-foreground">{mensajeDeVariantes(error, t)}</p>
        </div>
      ) : fase.paso === 'revisando' ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('shopify.todas.revisando', { count: fase.vistas, total: fase.total })}
        </p>
      ) : fase.paso === 'aplicando' ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('shopify.todas.aplicando', { count: fase.hechos, total: fase.de })}
        </p>
      ) : fase.paso === 'revisar' ? (
        <>
          <p className="font-medium">{t('shopify.todas.listas', { count: fase.items.length })}</p>
          {fase.items.length > 0 && (
            <PorTandas
              items={fase.items}
              className="space-y-3"
              visibles={pintadas}
              onMostrarMas={() => setPintadas(v => v + TANDA)}
              render={x => (
                <li key={x.shopifyProductId} className="space-y-2 rounded-xl border border-input p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{x.groupName}</p>
                    <Badge variant="outline">{x.mode === 'ADD' ? t('shopify.agregarA', { name: x.groupName }) : t('shopify.crear')}</Badge>
                  </div>
                  {x.preview.warnings.map((w, i) => (
                    <p key={i} className="text-sm">
                      {w}
                    </p>
                  ))}
                  <ul className="space-y-1 text-sm">
                    {x.preview.members.map(m => (
                      <li key={m.productId}>
                        <p>
                          {m.currentName} → <span className="font-medium">{m.newName}</span>
                        </p>
                        {m.changes.length > 0 && (
                          <ul className="list-disc pl-5 text-muted-foreground">
                            {m.changes.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                  {x.preview.skipped.length > 0 && (
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {x.preview.skipped.map(m => (
                        <li key={m.productId}>{t('shopify.tallaSaltada', { name: m.name, motivo: m.motivo })}</li>
                      ))}
                    </ul>
                  )}
                </li>
              )}
            />
          )}
          {listaDeBloqueadas(fase.blocked, fase.items)}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" className="cursor-pointer" onClick={p.onCerrar} data-tour="group-sources-shopify-all-cancel">
              {t('agrupar.cancelar')}
            </Button>
            {fase.items.length > pintadas && (
              <p className="self-center text-sm text-muted-foreground" data-tour="group-sources-shopify-all-unopened">
                {t('shopify.todas.noAbiertas', { count: fase.items.length - pintadas })}
              </p>
            )}
            {fase.items.length > 0 && (
              <Button
                className="cursor-pointer"
                onClick={() => void aplicar(fase.items, fase.blocked)}
                data-tour="group-sources-shopify-all-confirm"
              >
                {t('shopify.todas.confirmar', { count: fase.items.length })}
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="font-medium">{t('shopify.todas.aplicadas', { count: fase.applied.length })}</p>
          {fase.skipped.length > 0 && (
            <section className="space-y-2 rounded-xl border border-input p-3" data-tour="group-sources-shopify-skipped">
              <p className="text-sm font-medium">{t('shopify.todas.saltadas', { count: fase.skipped.length })}</p>
              <ul className="space-y-2 text-sm">
                {fase.skipped.map(s => (
                  <li key={s.shopifyProductId}>
                    <p className="font-medium">{nombre(s.shopifyProductId, fase.vistas)}</p>
                    <p className="text-muted-foreground">{s.motivo}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {fase.sinRespuesta.length > 0 && (
            <section className="space-y-2 rounded-xl border border-input p-3" data-tour="group-sources-shopify-no-answer">
              <p className="text-sm font-medium">{t('shopify.todas.sinRespuesta', { count: fase.sinRespuesta.length })}</p>
              <ul className="space-y-1 text-sm">
                {fase.sinRespuesta.map(id => (
                  <li key={id}>{nombre(id, fase.vistas)}</li>
                ))}
              </ul>
            </section>
          )}
          {listaDeBloqueadas(fase.blocked, fase.vistas)}
        </>
      )}
      {(error || fase.paso === 'listo') && (
        <div className="flex justify-end">
          <Button variant="outline" className="cursor-pointer" onClick={p.onCerrar} data-tour="group-sources-shopify-all-close">
            {t('shopify.todas.cerrar')}
          </Button>
        </div>
      )}
    </div>
  )
}
