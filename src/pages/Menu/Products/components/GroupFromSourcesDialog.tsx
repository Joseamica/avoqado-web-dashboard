import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, Loader2 } from 'lucide-react'
import { useState, type ChangeEvent, type ReactNode } from 'react'
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
import { unirPaginas, useGroupSuggestions } from '@/features/product-variants/hooks'
import { shopifyFileProposals } from '@/services/productGroups.service'
import type { GroupSuggestion, ShopifyFileProposal } from '@/types/productGroup'
import { GroupExistingDialog } from './GroupExistingDialog'

interface Props {
  open: boolean
  onClose: () => void
  venueId: string
  /** El producto con variantes recién creado (el padre abre su ficha). */
  onDone: (groupId: string) => void
}

type Pestana = 'sugerencias' | 'archivo'
/** Lo que se está revisando en «Agrupar como variantes»; `handle` (sólo si viene del archivo) identifica la tarjeta para ponerle «Agrupada». */
interface Revision {
  handle?: string
  inicial: EstadoAgrupar
  avisos?: string[]
}

/** Contrato §3.5: el server rechaza más de 900 KiB y el cuerpo JSON global se queda en 1 MB: no se manda lo que no va a caber. */
const MAX_BYTES = 900 * 1024
const MUESTRA = 4
/** Un archivo de 5,000 renglones da ~2,500 propuestas: se pintan de 50 en 50. */
const TANDA = 50
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

/** «Agrupar productos que ya tengo»: las sugerencias del server y el archivo de Shopify. Se monta al abrir (cada apertura arranca limpia). */
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
            {(['sugerencias', 'archivo'] as const).map(clave => (
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
        </Tabs>
      </div>
      {revisando && (
        <GroupExistingDialog
          open
          onClose={() => setRevisando(null)}
          venueId={venueId}
          inicial={revisando.inicial}
          avisos={revisando.avisos}
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
        {p.agrupada ? (
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
function PorTandas<T>(p: { items: T[]; render: (item: T) => ReactNode; className: string }) {
  const { t } = useTranslation('variants')
  const [visibles, setVisibles] = useState(TANDA)
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
