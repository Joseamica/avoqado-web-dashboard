import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { mensajeDeVariantes } from '@/features/product-variants/errors'
import { cambiosDeVariante, edicionDe, type EdicionVariante } from '@/features/product-variants/familyEdits'
import { useInvalidarCatalogo } from '@/features/product-variants/hooks'
import { useMasterCatalogError } from '@/features/master-catalog/use-master-catalog-error'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { updateProduct } from '@/services/menu.service'
import type { ProductGroupDetail } from '@/types/productGroup'
import { VariantRowActions } from './VariantRowActions'

type Ediciones = Record<string, EdicionVariante>
type Campo = keyof EdicionVariante
/** Por renglón, los campos que el dueño tocó. */
type Tocadas = Record<string, ReadonlySet<Campo>>

/** El detalle del server con lo que el dueño tocó encima (campo por campo, como el padre: Codex N1). */
function mezclar(v: ProductGroupDetail['variants'][number], previa: EdicionVariante | undefined, campos: ReadonlySet<Campo> | undefined) {
  const r = edicionDe(v)
  if (previa && campos) for (const k of campos) Object.assign(r, { [k]: previa[k] })
  return r
}

const numero = (raw: string) => (raw === '' ? undefined : Number(raw))

/** Precio, costo, SKU, código y activa de cada variante: son de la variante, así que NO llevan el candado de plan. */
export function GroupVariantsTable({
  venueId,
  familia,
  disabled,
  onCambios,
}: {
  venueId: string
  familia: ProductGroupDetail
  disabled: boolean
  /** Avisa al diálogo si queda algo sin guardar (para preguntar antes de cerrar). */
  onCambios?: (sucio: boolean) => void
}) {
  const { t } = useTranslation('variants')
  const { toast } = useToast()
  const { venue } = useCurrentVenue()
  const handleMasterCatalogError = useMasterCatalogError(venue?.organizationId)
  const invalidar = useInvalidarCatalogo()
  const [ed, setEd] = useState<Ediciones>(() => Object.fromEntries(familia.variants.map(v => [v.id, edicionDe(v)])))
  const [tocadas, setTocadas] = useState<Tocadas>({})
  const [fallas, setFallas] = useState<Record<string, string>>({})
  // Codex R2 + N1: un detalle nuevo reemplaza todo lo que el dueño NO tocó, campo por campo; lo tecleado (y lo que falló) se conserva.
  // Así un precio que cambió otra persona no se revierte al guardar el SKU del mismo renglón.
  useEffect(() => setEd(prev => Object.fromEntries(familia.variants.map(v => [v.id, mezclar(v, prev[v.id], tocadas[v.id])]))), [familia, tocadas])
  const cambiar = (id: string, c: Partial<EdicionVariante>) => {
    setTocadas(prev => {
      const campos = Object.keys(c) as Campo[]
      if (campos.every(k => prev[id]?.has(k))) return prev
      return { ...prev, [id]: new Set([...(prev[id] ?? []), ...campos]) }
    })
    setEd(prev => ({ ...prev, [id]: { ...prev[id], ...c } }))
  }
  // Sólo renglones y campos tocados: lo que nadie tocó no se valida ni se manda (un precio 0 heredado no estorba).
  const pendientes = familia.variants.flatMap(v => {
    const campos = tocadas[v.id]
    if (!campos?.size) return []
    const r = cambiosDeVariante(v, ed[v.id] ?? edicionDe(v), campos)
    return r.ok && Object.keys(r.cambios).length === 0 ? [] : [{ v, r }]
  })
  const hayPendientes = pendientes.length > 0
  useEffect(() => {
    onCambios?.(hayPendientes)
    return () => onCambios?.(false)
  }, [hayPendientes, onCambios])

  const guardar = useMutation({
    mutationFn: async () => {
      const nuevasFallas: Record<string, string> = {}
      const guardadas: string[] = []
      for (const { v, r } of pendientes) {
        if ('problema' in r) {
          // `in` y no `!r.ok`: con `strict: false` TS no estrecha la unión por veracidad de `ok`.
          nuevasFallas[v.id] = t(`variantesTabla.problema.${r.problema}`)
          continue
        }
        try {
          await updateProduct(venueId, v.id, r.cambios) // en serie: el server serializa por negocio; en paralelo sólo esperarían
          guardadas.push(v.id)
        } catch (error) {
          // El catálogo maestro ya mostró su aviso: se detiene aquí y NO se felicita (Codex R2).
          if (handleMasterCatalogError(error)) return { nuevasFallas, guardadas, detenido: true }
          nuevasFallas[v.id] = mensajeDeVariantes(error, t)
        }
      }
      return { nuevasFallas, guardadas, detenido: false }
    },
    onSuccess: async ({ nuevasFallas, guardadas, detenido }) => {
      // Primero el detalle nuevo y DESPUÉS se sueltan los renglones guardados: así adoptan lo guardado sin parpadear al valor viejo.
      await invalidar(venueId)
      setFallas(nuevasFallas)
      setTocadas(prev => {
        const siguen = { ...prev }
        for (const id of guardadas) delete siguen[id]
        return siguen
      })
      if (detenido) return
      const n = Object.keys(nuevasFallas).length
      toast(n ? { variant: 'destructive', title: t('variantesTabla.algunasFallaron', { count: n }) } : { title: t('variantesTabla.guardadas') })
    },
  })

  const bloqueado = disabled || guardar.isPending // Codex R2: lo que se teclea mientras guarda se perdería al limpiar el renglón

  return (
    <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-6" data-tour="product-group-variants">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{t('variantesTabla.titulo', { count: familia.variants.length })}</h3>
        {!familia.archived && (
          <Button disabled={bloqueado || pendientes.length === 0} onClick={() => guardar.mutate()} data-tour="product-group-variants-save">
            {t('variantesTabla.guardar')}
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-input">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('variantesTabla.variante')}</TableHead>
              <TableHead>{t('variantesTabla.precioCol')}</TableHead>
              <TableHead>{t('variantesTabla.costoCol')}</TableHead>
              <TableHead>{t('variantesTabla.skuCol')}</TableHead>
              <TableHead>{t('variantesTabla.codigoCol')}</TableHead>
              <TableHead>{t('variantesTabla.activaCol')}</TableHead>
              <TableHead>{t('variantesTabla.existenciasCol')}</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">{t('variantesTabla.accionesCol')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {familia.variants.map(v => {
              const x = ed[v.id] ?? edicionDe(v)
              return (
                <TableRow key={v.id}>
                  <TableCell className="min-w-48">
                    <span className="block font-medium">{v.values.join(' · ')}</span>
                    {fallas[v.id] && (
                      <span className="block text-xs text-destructive" role="alert">
                        {fallas[v.id]}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      className="h-10 min-w-24 bg-transparent"
                      aria-label={t('variantesTabla.precio', { name: v.name })}
                      data-tour="product-group-variant-price"
                      value={x.price ?? ''}
                      disabled={bloqueado}
                      onChange={e => cambiar(v.id, { price: numero(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      className="h-10 min-w-24 bg-transparent"
                      aria-label={t('variantesTabla.costo', { name: v.name })}
                      data-tour="product-group-variant-cost"
                      value={x.cost ?? ''}
                      disabled={bloqueado}
                      onChange={e => cambiar(v.id, { cost: numero(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-10 min-w-40 bg-transparent"
                      aria-label={t('variantesTabla.sku', { name: v.name })}
                      data-tour="product-group-variant-sku"
                      value={x.sku}
                      disabled={bloqueado}
                      onChange={e => cambiar(v.id, { sku: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-10 min-w-36 bg-transparent"
                      inputMode="numeric"
                      aria-label={t('variantesTabla.codigo', { name: v.name })}
                      data-tour="product-group-variant-gtin"
                      value={x.gtin}
                      disabled={bloqueado}
                      onChange={e => cambiar(v.id, { gtin: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      aria-label={t('variantesTabla.activa', { name: v.name })}
                      data-tour="product-group-variant-active"
                      checked={x.active}
                      disabled={bloqueado}
                      onCheckedChange={active => cambiar(v.id, { active })}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{v.stock === null ? t('variantesTabla.sinInventario') : v.stock}</TableCell>
                  <TableCell>
                    {/* Sus permisos los decide cada acción (archivar es menu:delete, no menu:update); aquí sólo archivada o guardando. */}
                    <VariantRowActions venueId={venueId} familia={familia} variante={v} disabled={familia.archived || guardar.isPending} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{t('variantesTabla.ayudaPrecio')}</p>
    </section>
  )
}
