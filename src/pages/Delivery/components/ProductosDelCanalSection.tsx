/**
 * «Productos en <canal>» (D1): qué productos suben a Rappi/Uber y con qué precio. Controlada por `ChannelSettingsDialog`, que
 * congela la lista y los precios al abrir y los manda con su único «Guardar». Aquí sólo vive lo de la vista: búsqueda, grupos
 * abiertos y el filtro de «Revisarlos».
 */
import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ChevronDown, Loader2, Package, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { cn, includesNormalized } from '@/lib/utils'
import type { DeliveryProvider } from '@/types/delivery'
import { erroresDePrecios, precioGuia, precioQueSePublica, type ProductoDelCanal } from '../productosDelCanal'

/** Tope de la lista en el SERVIDOR: con un catálogo más grande, «Elegir cuáles» arranca vacío. */
export const MAX_LISTA = 5000
/** Con más productos, los grupos arrancan cerrados (pintar miles de filas traba la pantalla). */
const CERRADOS_DESDE = 300

const pesos = (provider: DeliveryProvider, n: number) => (provider === 'RAPPI' ? String(n) : n.toFixed(2))

interface Props {
  provider: DeliveryProvider
  /** Nombre del canal para los textos («Rappi», «Uber Eats»). */
  canal: string
  productos: ProductoDelCanal[]
  cargando: boolean
  error: boolean
  onReintentar(): void
  /** `null` = todo el catálogo. */
  lista: string[] | null
  onListaChange(l: string[] | null): void
  precios: Record<string, number | undefined>
  onPreciosChange(p: Record<string, number | undefined>): void
  markupPercent?: number
  nuevos: ProductoDelCanal[]
  yaNoExisten: { ids: string[]; codigos: string[] }
  onQuitarQueYaNoExisten(): void
  onYaRevisados(): void
  revisando: boolean
}

export function ProductosDelCanalSection(props: Props) {
  const { provider, canal, productos, lista, precios } = props
  const { t } = useTranslation('delivery')

  const [busqueda, setBusqueda] = useState('')
  const q = useDeferredValue(busqueda.trim())
  /** Ids que dejó «Revisarlos» (los nuevos de ese momento: marcar uno no lo saca de la vista). */
  const [soloIds, setSoloIds] = useState<Set<string> | null>(null)
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})

  const enLista = useMemo(() => new Set(lista ?? []), [lista])
  const conError = useMemo(() => new Set(erroresDePrecios(precios)), [precios])

  // Grupos por categoría (por nombre), «Sin categoría» al final; dentro, el orden del servidor (por nombre).
  const { grupos, visibles } = useMemo(() => {
    const visibles = productos.filter(
      p => (!soloIds || soloIds.has(p.id)) && (!q || includesNormalized(p.name, q) || includesNormalized(p.sku ?? '', q)),
    )
    const porClave = new Map<string, { clave: string; nombre: string | null; productos: ProductoDelCanal[] }>()
    for (const p of visibles) {
      const nombre = p.category?.name ?? null
      const clave = nombre === null ? '' : p.categoryId || nombre
      const g = porClave.get(clave) ?? { clave, nombre, productos: [] }
      g.productos.push(p)
      porClave.set(clave, g)
    }
    const grupos = [...porClave.values()].sort((a, b) =>
      a.nombre === null ? 1 : b.nombre === null ? -1 : a.nombre.localeCompare(b.nombre, 'es'),
    )
    return { grupos, visibles: visibles.length }
  }, [productos, q, soloIds])

  if (props.cargando) {
    return (
      <Marco {...props}>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('settings.productos.cargando')}
        </p>
      </Marco>
    )
  }
  if (props.error) {
    return (
      <Marco {...props}>
        <div className="space-y-2 text-sm">
          <p className="text-destructive">{t('settings.productos.errorCarga')}</p>
          <Button variant="outline" size="sm" onClick={props.onReintentar}>
            {t('settings.productos.reintentar')}
          </Button>
        </div>
      </Marco>
    )
  }

  if (lista === null) {
    return (
      <Marco {...props}>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input p-4">
          <div>
            <p className="text-sm font-medium">{t('settings.productos.todoElCatalogo', { count: productos.length })}</p>
            <p className="text-sm text-muted-foreground">{t('settings.productos.todoElCatalogoHelp')}</p>
          </div>
          <Button
            data-tour="delivery-settings-productos-elegir"
            variant="outline"
            onClick={() => props.onListaChange(productos.length <= MAX_LISTA ? productos.map(p => p.id) : [])}
          >
            {t('settings.productos.elegir')}
          </Button>
        </div>
      </Marco>
    )
  }

  const marcados = productos.filter(p => enLista.has(p.id)).length
  const cuantosYaNoExisten = props.yaNoExisten.ids.length + props.yaNoExisten.codigos.length

  const alternar = (id: string) => props.onListaChange(enLista.has(id) ? lista.filter(x => x !== id) : [...lista, id])
  const alternarGrupo = (ps: ProductoDelCanal[]) => {
    const todos = ps.every(p => enLista.has(p.id))
    const ids = new Set(ps.map(p => p.id))
    props.onListaChange(todos ? lista.filter(id => !ids.has(id)) : [...lista, ...ps.filter(p => !enLista.has(p.id)).map(p => p.id)])
  }

  return (
    <Marco {...props}>
      <div className="space-y-4">
        {productos.length > MAX_LISTA && (
          <Aviso>
            <p>{t('settings.productos.masDe5000', { canal })}</p>
          </Aviso>
        )}

        {props.nuevos.length > 0 && (
          <Aviso icono={Sparkles}>
            <p className="font-medium text-foreground">{t('settings.productos.nuevos', { count: props.nuevos.length, canal })}</p>
            <p>{t('settings.productos.nuevosHelp')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setSoloIds(new Set(props.nuevos.map(p => p.id)))}>
                {t('settings.productos.revisarlos')}
              </Button>
              <Button variant="outline" size="sm" disabled={props.revisando} onClick={props.onYaRevisados}>
                {props.revisando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('settings.productos.yaLosRevise')}
              </Button>
            </div>
          </Aviso>
        )}

        {cuantosYaNoExisten > 0 && (
          <Aviso>
            <p className="font-medium text-foreground">{t('settings.productos.yaNoExisten', { count: cuantosYaNoExisten })}</p>
            <p>{t('settings.productos.yaNoExistenHelp')}</p>
            {props.yaNoExisten.codigos.length > 0 && <p>{t('settings.productos.yaNoExistenCodigos')}</p>}
            <Button className="mt-2" variant="outline" size="sm" onClick={props.onQuitarQueYaNoExisten}>
              {t('settings.productos.quitarlos')}
            </Button>
          </Aviso>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Input
            data-tour="delivery-settings-productos-buscar"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder={t('settings.productos.buscar')}
            aria-label={t('settings.productos.buscar')}
            className="h-12 min-w-0 flex-1 text-base"
          />
          <span className="text-sm font-medium tabular-nums">{t('settings.productos.conteo', { marcados, total: productos.length })}</span>
        </div>

        {marcados === 0 && <p className="text-sm text-destructive">{t('settings.productos.listaVacia')}</p>}

        {soloIds && (
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{t('settings.productos.soloNuevos')}</span>
            <Button variant="ghost" size="sm" onClick={() => setSoloIds(null)}>
              {t('settings.productos.verTodos')}
            </Button>
          </div>
        )}

        {grupos.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('settings.productos.sinCoincidencias')}</p>
        ) : (
          <div className="space-y-3">
            {grupos.map(g => {
              // ponytail: un grupo abierto pinta todas sus filas; con miles en UNA categoría, virtualizar la lista.
              // Abiertos sólo si lo visible (con búsqueda o filtro) cabe: una búsqueda amplia no pinta miles de filas.
              const abierto = abiertos[g.clave] ?? visibles <= CERRADOS_DESDE
              const enGrupo = g.productos.filter(p => enLista.has(p.id)).length
              const nombre = g.nombre ?? t('settings.productos.sinCategoria')
              return (
                <div key={g.clave} className="rounded-lg border border-input">
                  <div className="flex items-center gap-3 bg-muted/50 px-3 py-2">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={enGrupo === g.productos.length ? true : enGrupo > 0 ? 'indeterminate' : false}
                        onCheckedChange={() => alternarGrupo(g.productos)}
                        aria-label={t('settings.productos.todosDe', { categoria: nombre })}
                      />
                      {t('settings.productos.todos')}
                    </label>
                    <button
                      type="button"
                      data-testid="grupo-titulo"
                      aria-expanded={abierto}
                      onClick={() => setAbiertos(a => ({ ...a, [g.clave]: !abierto }))}
                      className="flex flex-1 cursor-pointer items-center justify-between gap-2 text-left text-sm font-medium"
                    >
                      <span>
                        {nombre}{' '}
                        <span className="font-normal text-muted-foreground">
                          ({enGrupo}/{g.productos.length})
                        </span>
                      </span>
                      <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', abierto && 'rotate-180')} />
                    </button>
                  </div>
                  {abierto && (
                    <ul className="divide-y divide-input">
                      {g.productos.map(p => (
                        <FilaProducto
                          key={p.id}
                          p={p}
                          marcado={enLista.has(p.id)}
                          precio={precios[p.id]}
                          conError={conError.has(p.id)}
                          onAlternar={() => alternar(p.id)}
                          onPrecio={v => props.onPreciosChange({ ...precios, [p.id]: v })}
                          provider={provider}
                          canal={canal}
                          markupPercent={props.markupPercent}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Marco>
  )
}

function FilaProducto({
  p,
  marcado,
  precio,
  conError,
  onAlternar,
  onPrecio,
  provider,
  canal,
  markupPercent,
}: {
  p: ProductoDelCanal
  marcado: boolean
  precio: number | undefined
  conError: boolean
  onAlternar(): void
  onPrecio(v: number | undefined): void
  provider: DeliveryProvider
  canal: string
  markupPercent?: number
}) {
  const { t } = useTranslation('delivery')
  const conCentavos = provider === 'RAPPI' && precio !== undefined && !conError && precioQueSePublica(provider, precio) !== precio
  return (
    <li className="space-y-1 px-3 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
          <Checkbox checked={marcado} onCheckedChange={onAlternar} aria-label={p.name} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{p.name}</span>
            <span className="block text-xs text-muted-foreground">{t('settings.productos.codigo', { codigo: p.sku })}</span>
          </span>
        </label>
        {marcado && (
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={precio ?? ''}
              placeholder={t('settings.productos.sinPrecioFijo')}
              aria-label={t('settings.productos.precioDe', { canal, producto: p.name })}
              aria-invalid={conError}
              onChange={e => onPrecio(e.target.value === '' ? undefined : parseFloat(e.target.value))}
              className={cn('h-10 w-36 text-base', conError && 'border-destructive')}
            />
          </div>
        )}
      </div>
      {marcado && (
        <div className="space-y-0.5 pl-7 text-xs">
          {conError ? (
            <p className="text-destructive">{t('settings.productos.errorPrecio')}</p>
          ) : conCentavos ? (
            <p className="text-amber-700 dark:text-amber-400">
              {t('settings.productos.rappiRedondea', { precio: pesos(provider, precioQueSePublica(provider, precio!)) })}
            </p>
          ) : (
            precio === undefined && (
              <p className="text-muted-foreground">
                {t('settings.productos.guia', { precio: pesos(provider, precioGuia(provider, Number(p.price), markupPercent)) })}
              </p>
            )
          )}
        </div>
      )}
    </li>
  )
}

function Marco({ canal, children }: Props & { children: ReactNode }) {
  const { t } = useTranslation('delivery')
  return (
    <section data-tour="delivery-settings-productos" className="rounded-2xl border border-input bg-card p-6">
      <div className="mb-1 flex items-center gap-2">
        <Package className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-base font-medium">{t('settings.productos.title', { canal })}</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t('settings.productos.help', { canal })}</p>
      {children}
    </section>
  )
}

function Aviso({ icono: Icono = AlertTriangle, children }: { icono?: typeof AlertTriangle; children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-input bg-muted/50 p-3 text-sm text-muted-foreground">
      <Icono className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </div>
  )
}
