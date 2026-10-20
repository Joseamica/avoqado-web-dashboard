import { useMutation, useQuery } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SearchCombobox } from '@/components/search-combobox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MAX_OPCIONES, MAX_TEXTO_OPCION } from '@/features/product-variants/combinations'
import { codigoDelError, mensajeDeVariantes } from '@/features/product-variants/errors'
import { cuerpoDeAgrupar, partirEnOpciones, type EstadoAgrupar } from '@/features/product-variants/groupExisting'
import { useInvalidarCatalogo } from '@/features/product-variants/hooks'
import { useErrorDeEscritura } from '@/features/product-variants/useErrorDeEscritura'
import { usePrintStations } from '@/hooks/use-print-stations'
import { useToast } from '@/hooks/use-toast'
import { includesNormalized } from '@/lib/utils'
import { getMenuCategories, getModifierGroups } from '@/services/menu.service'
import { applyGroupExisting, applyShopifyProposal, previewGroupExisting, previewShopifyProposal } from '@/services/productGroups.service'
import type { GroupExistingBody, GroupExistingPreview, ShopifyChoices, ShopifySkippedMember } from '@/types/productGroup'

/** «Desde Shopify» (bloque 5): de qué producto de Shopify sale la propuesta. Nombre, opciones y miembros los arma el server. */
export interface OrigenShopify {
  shopifyProductId: string
  mode: 'CREATE' | 'ADD'
  groupName: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  venueId: string
  inicial: EstadoAgrupar
  /** Avisos de quien abre el diálogo (p. ej. renglones de Shopify que no se encontraron). */
  avisos?: string[]
  /** Modo «Desde Shopify»: nombre, opciones y miembros de sólo lectura; en ADD sólo se ven los cambios de cada talla. */
  shopify?: OrigenShopify
  onDone: (groupId: string) => void
}

/** La vista previa y el body EXACTO que la generó: «Confirmar» manda ese body con su huella (contrato §5). */
interface Vista {
  preview: GroupExistingPreview
  body: GroupExistingBody
}

const PRIMERA = '__primera__'
const VENCIDA = 'PRODUCT_GROUP_PREVIEW_STALE'

/** Convertir productos sueltos en variantes de uno nuevo. Se monta al abrir: cada apertura arranca de `inicial`. */
export function GroupExistingDialog(p: Props) {
  if (!p.open) return null
  return p.shopify ? <DialogoShopify {...p} shopify={p.shopify} /> : <DialogoAbierto {...p} />
}

const useCategorias = (venueId: string) =>
  useQuery({ queryKey: ['menu-categories', venueId], queryFn: () => getMenuCategories(venueId), staleTime: 30_000 })

/** Vacío = «La del primer producto» (el server toma la del primer miembro); esa opción también la quita. Si la lista falla, se reintenta. */
function SelectorDeCategoria(p: { venueId: string; value?: string; onChange: (id: string | undefined) => void; disabled: boolean }) {
  const { t } = useTranslation('variants')
  const categorias = useCategorias(p.venueId)
  const [busca, setBusca] = useState('')
  const opciones = useMemo(
    () => [
      { id: PRIMERA, label: t('agrupar.categoriaPrimera') },
      ...(categorias.data ?? [])
        .filter(c => !busca.trim() || includesNormalized(c.name ?? '', busca))
        .map(c => ({ id: c.id, label: c.name })),
    ],
    [categorias.data, busca, t],
  )
  const nombre = (p.value && categorias.data?.find(c => c.id === p.value)?.name) || ''
  if (categorias.isError && !categorias.data)
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-input p-3">
        <p className="text-sm text-destructive">{t('agrupar.errorCategorias')}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void categorias.refetch()}>
          {t('familia.reintentar')}
        </Button>
      </div>
    )
  return (
    <div data-tour="group-existing-category">
      <SearchCombobox
        inputId="agrupar-categoria"
        items={opciones}
        value={busca || nombre}
        onChange={setBusca}
        onSelect={item => {
          p.onChange(item.id === PRIMERA ? undefined : item.id)
          setBusca('')
        }}
        placeholder={t('agrupar.categoriaPrimera')}
        isLoading={categorias.isLoading}
        disabled={p.disabled}
      />
    </div>
  )
}

function DialogoAbierto({ onClose, venueId, inicial, avisos, onDone }: Props) {
  const { t } = useTranslation('variants')
  const { toast } = useToast()
  const invalidar = useInvalidarCatalogo()
  const alFallar = useErrorDeEscritura(venueId)
  const [inicio] = useState(() => partirEnOpciones(inicial))
  const [estado, setEstado] = useState(inicio)
  const [vista, setVista] = useState<Vista | null>(null)
  const [intento, setIntento] = useState(false)
  const [vencida, setVencida] = useState(false)
  const [preguntarCierre, setPreguntarCierre] = useState(false)
  const enviando = useRef(false)

  const categorias = useCategorias(venueId)
  const extras = useQuery({
    queryKey: ['modifier-groups', venueId],
    queryFn: () => getModifierGroups(venueId),
    staleTime: 30_000,
    enabled: !!vista,
  })
  const estaciones = usePrintStations(vista ? venueId : null)

  const resultado = useMemo(() => cuerpoDeAgrupar(estado), [estado])
  const desactualizada = !!vista && (!resultado.ok || JSON.stringify(resultado.body) !== JSON.stringify(vista.body))

  const verCambios = useMutation({
    mutationFn: (body: GroupExistingBody) => previewGroupExisting(venueId, body),
    onSuccess: (preview, body) => setVista({ preview, body }),
    onError: alFallar(t('agrupar.sinVistaPrevia')),
  })
  const pedirVistaPrevia = (e: EstadoAgrupar) => {
    setIntento(true)
    const r = cuerpoDeAgrupar(e)
    if (r.ok) verCambios.mutate(r.body)
  }

  const aplicar = useMutation({
    mutationFn: (v: Vista) => applyGroupExisting(venueId, v.body, v.preview.fingerprint),
    onSuccess: async (r, v) => {
      await invalidar(venueId)
      toast({ title: t('agrupar.listo', { count: r.productIds.length, name: v.body.name }) })
      onDone(r.groupId)
    },
    onError: (error: unknown) => {
      if (codigoDelError(error) !== VENCIDA) return alFallar(t('agrupar.noAgrupado'))(error)
      // Mientras se aplica no se teclea (Codex C5), así que `estado` es justo lo que se confirmó: se vuelve a pedir con eso.
      void invalidar(venueId)
      setVista(null)
      setVencida(true)
      pedirVistaPrevia(estado)
    },
    onSettled: () => {
      enviando.current = false
    },
  })
  const confirmar = () => {
    if (enviando.current || !vista || desactualizada) return
    enviando.current = true
    setVencida(false)
    aplicar.mutate(vista)
  }

  const ocupado = verCambios.isPending || aplicar.isPending
  // Codex C5: lo tecleado durante «Confirmar» se perdía al cerrar con el éxito. Mientras se aplica, nada se edita (en la vista previa sí).
  const bloqueado = aplicar.isPending
  const editar = (f: (e: EstadoAgrupar) => EstadoAgrupar) => setEstado(f)
  const conValores = (e: EstadoAgrupar, f: (values: string[]) => string[]) => ({
    ...e,
    members: e.members.map(m => ({ ...m, values: f(e.optionNames.map((_, i) => m.values[i] ?? '')) })),
  })
  const ponerValor = (k: number, i: number, v: string) =>
    editar(e => ({ ...e, members: e.members.map((m, j) => (j === k ? { ...m, values: Object.assign([...m.values], { [i]: v }) } : m)) }))
  const nombreDeOpcion = (i: number) => estado.optionNames[i]?.trim() || t('agrupar.opcion', { n: i + 1 })
  // `in` y no `!resultado.ok`: con `strict: false` TS no estrecha la unión por veracidad de `ok`.
  const problema = 'problema' in resultado && intento ? resultado.problema : null
  // Lo tecleado no se pierde sin querer: con cambios (o un envío en curso) Esc no cierra y la X pregunta.
  const conCambios = aplicar.isPending || JSON.stringify(estado) !== JSON.stringify(inicio)
  const pedirCerrar = () => (conCambios ? setPreguntarCierre(true) : onClose())

  return (
    <FullScreenModal
      open
      onClose={pedirCerrar}
      onEscapeKeyDown={e => {
        if (conCambios) e.preventDefault()
      }}
      closeButtonTestId="cerrar-agrupar"
      title={t('agrupar.titulo')}
      contentClassName="bg-muted/30"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={ocupado}
            onClick={() => {
              setVencida(false)
              pedirVistaPrevia(estado)
            }}
            data-tour="group-existing-preview"
          >
            {t('agrupar.verCambios')}
          </Button>
          <Button disabled={!vista || desactualizada || ocupado} onClick={confirmar} data-tour="group-existing-confirm">
            {t('agrupar.confirmar')}
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6" data-tour="group-existing-dialog">
        {avisos && avisos.length > 0 && (
          <ul className="list-disc space-y-1 rounded-xl border border-input bg-muted p-4 pl-8 text-sm">
            {avisos.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        )}

        <section className="grid gap-4 rounded-2xl border border-border/50 bg-card p-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="agrupar-nombre">{t('agrupar.nombre')}</Label>
            <Input
              id="agrupar-nombre"
              className="h-12 text-base"
              maxLength={120}
              value={estado.name}
              disabled={bloqueado}
              onChange={ev => editar(e => ({ ...e, name: ev.target.value }))}
              data-tour="group-existing-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agrupar-categoria">{t('agrupar.categoria')}</Label>
            <SelectorDeCategoria
              venueId={venueId}
              value={estado.categoryId}
              onChange={categoryId => editar(e => ({ ...e, categoryId }))}
              disabled={bloqueado}
            />
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-border/50 bg-card p-6" data-tour="group-existing-table">
          <div>
            <h3 className="font-semibold">{t('agrupar.tabla')}</h3>
            <p className="text-sm text-muted-foreground">{t('agrupar.tablaAyuda')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left align-bottom text-muted-foreground">
                  <th className="p-2 font-medium">{t('agrupar.producto')}</th>
                  <th className="p-2 font-medium">{t('agrupar.sku')}</th>
                  {estado.optionNames.map((n, i) => (
                    <th key={i} className="min-w-40 p-2">
                      <div className="flex items-center gap-1">
                        <Input
                          aria-label={t('agrupar.opcion', { n: i + 1 })}
                          placeholder={t('agrupar.opcion', { n: i + 1 })}
                          maxLength={MAX_TEXTO_OPCION}
                          value={n}
                          disabled={bloqueado}
                          onChange={ev =>
                            editar(e => ({ ...e, optionNames: e.optionNames.map((x, j) => (j === i ? ev.target.value : x)) }))
                          }
                          data-tour="group-existing-option-name"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 cursor-pointer"
                          aria-label={t('agrupar.quitarOpcion')}
                          data-tour="group-existing-remove-option"
                          disabled={bloqueado || estado.optionNames.length === 1}
                          onClick={() =>
                            editar(e => ({
                              ...conValores(e, v => v.filter((_, j) => j !== i)),
                              optionNames: e.optionNames.filter((_, j) => j !== i),
                            }))
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </th>
                  ))}
                  <th className="p-2">
                    {estado.optionNames.length < MAX_OPCIONES && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer whitespace-nowrap"
                        disabled={bloqueado}
                        onClick={() => editar(e => ({ ...conValores(e, v => [...v, '']), optionNames: [...e.optionNames, ''] }))}
                        data-tour="group-existing-add-option"
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        {t('agrupar.agregarOpcion')}
                      </Button>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {estado.members.map((m, k) => (
                  <tr key={m.productId} className="border-t border-border/50">
                    <td className="p-2">{m.name}</td>
                    <td className="p-2 text-muted-foreground">{m.sku || '—'}</td>
                    {estado.optionNames.map((_, i) => (
                      <td key={i} className="p-2">
                        <Input
                          aria-label={t('agrupar.valorDe', { option: nombreDeOpcion(i), name: m.name })}
                          data-tour="group-existing-value"
                          maxLength={MAX_TEXTO_OPCION}
                          value={m.values[i] ?? ''}
                          disabled={bloqueado}
                          onChange={ev => ponerValor(k, i, ev.target.value)}
                        />
                      </td>
                    ))}
                    <td className="p-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 cursor-pointer"
                        aria-label={t('agrupar.quitarProducto', { name: m.name })}
                        data-tour="group-existing-remove-product"
                        disabled={bloqueado}
                        onClick={() => editar(e => ({ ...e, members: e.members.filter((_, j) => j !== k) }))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {problema && (
          <p role="alert" className="text-sm text-destructive">
            {(({ code, ...datos }) => t(`agrupar.problema.${code}`, datos))(problema)}
          </p>
        )}
        {vencida && (
          <p role="status" className="rounded-xl border border-input bg-muted p-4 text-sm">
            {t('agrupar.stale')}
          </p>
        )}
        {vista && (
          <ResumenDeVistaPrevia
            preview={vista.preview}
            desactualizada={desactualizada}
            categoria={categorias.data?.find(c => c.id === vista.preview.parent.categoryId)?.name}
            impresora={estaciones.data?.find(s => s.id === vista.preview.parent.printStationId)?.name}
            extras={vista.preview.parent.modifierGroupIds
              .map(id => extras.data?.find(g => g.id === id)?.name)
              .filter((x): x is string => !!x)}
          />
        )}
      </div>
      <ConfirmarDescartar open={preguntarCierre} onOpenChange={setPreguntarCierre} onDescartar={onClose} />
    </FullScreenModal>
  )
}

/**
 * La X de un diálogo con algo sin guardar: «¿Descartar lo que escribiste?». Junto con un `onEscapeKeyDown` que no cierra si hay cambios,
 * lo tecleado nunca se pierde sin querer. Lo usan «Agrupar productos» y el editor de la familia.
 */
export function ConfirmarDescartar(p: { open: boolean; onOpenChange: (open: boolean) => void; onDescartar: () => void }) {
  const { t } = useTranslation('variants')
  return (
    <AlertDialog open={p.open} onOpenChange={p.onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('agrupar.descartar.titulo')}</AlertDialogTitle>
          <AlertDialogDescription>{t('agrupar.descartar.texto')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-tour="discard-changes-keep">{t('agrupar.descartar.seguir')}</AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: 'destructive' })} onClick={p.onDescartar} data-tour="discard-changes-confirm">
            {t('agrupar.descartar.si')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ResumenDeVistaPrevia(p: {
  preview: GroupExistingPreview
  desactualizada: boolean
  categoria?: string
  impresora?: string
  extras: string[]
  /** «Agregar a X» desde Shopify: la familia no cambia; se ven todas las tallas que se suman (con sus cambios) y las que se saltan. */
  soloCambios?: boolean
  saltadas?: ShopifySkippedMember[]
}) {
  const { t } = useTranslation('variants')
  const padre = p.preview.parent
  const filas: Array<[string, string | null | undefined]> = [
    ['nombre', padre.name],
    ['categoria', p.categoria ?? '—'],
    ['iva', t(`menu:iva.opciones.${padre.ivaTratamiento}`, { defaultValue: padre.ivaTratamiento })],
    ['impresora', padre.printStationId ? (p.impresora ?? '—') : null],
    ['extras', padre.modifierGroupIds.length ? p.extras.join(', ') || '—' : null],
    ['satProducto', padre.satProductKey],
    ['satUnidad', padre.satUnitKey],
    ['descripcion', padre.description],
  ]
  return (
    <section className="space-y-5 rounded-2xl border border-border/50 bg-card p-6" data-tour="group-existing-result">
      {p.desactualizada && (
        <p role="status" className="rounded-xl border border-input bg-muted p-3 text-sm font-medium">
          {t('agrupar.desactualizada')}
        </p>
      )}
      <div className={p.desactualizada ? 'space-y-5 opacity-60' : 'space-y-5'}>
        {p.preview.warnings.length > 0 && (
          <div className="space-y-1">
            <h3 className="font-semibold">{t('agrupar.avisos')}</h3>
            <ul className="list-disc pl-5 text-sm">
              {p.preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        {!p.soloCambios && (
          <div className="space-y-2">
            <h3 className="font-semibold">{t('agrupar.padreQueda')}</h3>
            <dl className="grid gap-1 text-sm">
              {filas
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="text-muted-foreground">{t(`agrupar.resumen.${k}`)}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
          </div>
        )}
        <div className="space-y-2">
          <h3 className="font-semibold">{t('agrupar.cadaProducto')}</h3>
          <ul className="space-y-2 text-sm">
            {p.preview.members.map(m =>
              p.soloCambios && m.changes.length === 0 ? (
                // «Agregar a X»: una talla que no cambia nada también se suma, y se dice.
                <li key={m.productId}>
                  <p className="font-medium">{m.newName}</p>
                  <p className="text-muted-foreground">{t('shopify.seSumaSinCambios')}</p>
                </li>
              ) : (
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
              ),
            )}
          </ul>
        </div>
        {p.saltadas && p.saltadas.length > 0 && (
          <div className="space-y-2" data-tour="group-existing-skipped">
            <h3 className="font-semibold">{t('shopify.saltadas', { count: p.saltadas.length })}</h3>
            <ul className="space-y-2 text-sm">
              {p.saltadas.map(m => (
                <li key={m.productId}>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-muted-foreground">{m.motivo}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * «Desde Shopify»: el server arma nombre, opciones y miembros con lo que guardó cada pareja (el dueño no los teclea). La vista previa se
 * pide sola y se vuelve a pedir al cambiar la categoría (lo único de Avoqado que se elige aquí, sólo al crear); «Confirmar» manda la MISMA
 * elección que la generó, con su huella (la llave de la consulta es la elección: los datos en pantalla siempre son de ella).
 */
function DialogoShopify({ onClose, venueId, inicial, shopify, onDone }: Props & { shopify: OrigenShopify }) {
  const { t } = useTranslation('variants')
  const { toast } = useToast()
  const invalidar = useInvalidarCatalogo()
  const alFallar = useErrorDeEscritura(venueId)
  const crear = shopify.mode === 'CREATE'
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [vencida, setVencida] = useState(false)
  const enviando = useRef(false)
  const choices = useMemo<ShopifyChoices>(() => (crear && categoryId ? { categoryId } : {}), [crear, categoryId])

  // Fuera de ['products', venueId]: aplicar invalida el catálogo y no debe volver a pedir la vista previa de lo que ya se agrupó.
  const vista = useQuery({
    queryKey: ['shopify-proposal-preview', venueId, shopify.shopifyProductId, choices],
    queryFn: () => previewShopifyProposal(venueId, shopify.shopifyProductId, choices),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const categorias = useCategorias(venueId)
  const extras = useQuery({
    queryKey: ['modifier-groups', venueId],
    queryFn: () => getModifierGroups(venueId),
    staleTime: 30_000,
    enabled: !!vista.data,
  })
  const estaciones = usePrintStations(vista.data ? venueId : null)

  const aplicar = useMutation({
    mutationFn: (v: { choices: ShopifyChoices; fingerprint: string }) =>
      applyShopifyProposal(venueId, shopify.shopifyProductId, v.choices, v.fingerprint),
    onSuccess: async r => {
      await invalidar(venueId)
      toast({ title: t('agrupar.listo', { count: r.productIds.length, name: vista.data?.parent.name ?? inicial.name }) })
      onDone(r.groupId)
    },
    onError: (error: unknown) => {
      if (codigoDelError(error) !== VENCIDA) return alFallar(t('agrupar.noAgrupado'))(error)
      void invalidar(venueId)
      setVencida(true)
      void vista.refetch()
    },
    onSettled: () => {
      enviando.current = false
    },
  })
  // Tras un 409 de vista vencida se vuelve a pedir: si ESE reintento falla, `data` sigue siendo la vieja y no se debe confirmar.
  const lista = !!vista.data && !vista.isFetching && !vista.isError
  const confirmar = () => {
    if (enviando.current || !lista || !vista.data) return
    enviando.current = true
    setVencida(false)
    aplicar.mutate({ choices, fingerprint: vista.data.fingerprint })
  }
  const preview = vista.data

  return (
    <FullScreenModal
      open
      onClose={() => {
        if (!aplicar.isPending) onClose()
      }}
      onEscapeKeyDown={e => {
        if (aplicar.isPending) e.preventDefault()
      }}
      closeButtonTestId="cerrar-agrupar"
      title={t('agrupar.titulo')}
      contentClassName="bg-muted/30"
      actions={
        <Button disabled={!lista || aplicar.isPending} onClick={confirmar} data-tour="group-existing-confirm">
          {t('agrupar.confirmar')}
        </Button>
      }
    >
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6" data-tour="group-existing-dialog">
        <section className="grid gap-4 rounded-2xl border border-border/50 bg-card p-6 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="agrupar-nombre">{t('agrupar.nombre')}</Label>
              <Badge variant="secondary">{crear ? t('shopify.crear') : t('shopify.agregarA', { name: shopify.groupName ?? '' })}</Badge>
            </div>
            <Input
              id="agrupar-nombre"
              className="h-12 text-base"
              readOnly
              value={preview?.parent.name ?? inicial.name}
              data-tour="group-existing-name"
            />
            <p className="text-xs text-muted-foreground">{t(crear ? 'shopify.nombreDeShopify' : 'shopify.familiaNoCambia')}</p>
          </div>
          {crear && (
            <div className="space-y-2">
              <Label htmlFor="agrupar-categoria">{t('agrupar.categoria')}</Label>
              <SelectorDeCategoria venueId={venueId} value={categoryId} onChange={setCategoryId} disabled={aplicar.isPending} />
            </div>
          )}
        </section>

        {crear && preview && preview.options.length > 0 && (
          <section className="space-y-2 rounded-2xl border border-border/50 bg-card p-6" data-tour="group-existing-options">
            <h3 className="font-semibold">{t('shopify.opciones')}</h3>
            <ul className="space-y-1 text-sm">
              {preview.options.map(o => (
                <li key={o.name}>{`${o.name}: ${o.values.join(', ')}`}</li>
              ))}
            </ul>
          </section>
        )}

        {vista.isLoading && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('shopify.cargandoVista')}
          </p>
        )}
        {vista.isError && !vista.isFetching && (
          <div role="alert" className="space-y-2 rounded-xl border border-input bg-card p-4 text-sm">
            <p className="text-destructive">{mensajeDeVariantes(vista.error, t)}</p>
            <Button variant="outline" size="sm" onClick={() => void vista.refetch()} data-tour="group-existing-retry">
              {t('fuentes.reintentar')}
            </Button>
          </div>
        )}
        {vencida && (
          <p role="status" className="rounded-xl border border-input bg-muted p-4 text-sm">
            {t('agrupar.stale')}
          </p>
        )}
        {preview && (
          <ResumenDeVistaPrevia
            preview={preview}
            desactualizada={false}
            soloCambios={!crear}
            saltadas={preview.skipped}
            categoria={categorias.data?.find(c => c.id === preview.parent.categoryId)?.name}
            impresora={estaciones.data?.find(s => s.id === preview.parent.printStationId)?.name}
            extras={preview.parent.modifierGroupIds.map(id => extras.data?.find(g => g.id === id)?.name).filter((x): x is string => !!x)}
          />
        )}
      </div>
    </FullScreenModal>
  )
}
