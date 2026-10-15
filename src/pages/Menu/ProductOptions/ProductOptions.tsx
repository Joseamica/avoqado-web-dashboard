import { ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { unirPaginas, useOptionLibrary } from '@/features/product-variants/hooks'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import type { OptionLibraryListItem } from '@/types/productGroup'
import { OptionEditorDialog } from './OptionEditorDialog'

/**
 * Menú › Opciones: la biblioteca de plantillas («Talla: S, M, L», «Color») que el dueño reutiliza al crear productos con variantes.
 * Paginada en el server (25 por página, «Cargar más» con el total). Pro y Premium: en Gratis se ve borrosa con la tarjeta del plan,
 * porque guardar una plantilla sin poder crear familias no sirve.
 */
export default function ProductOptions() {
  const { t } = useTranslation('variants')
  const { venueId } = useCurrentVenue()
  const { can } = useAccess()
  const puedeEscribir = can('menu:create')
  const q = useOptionLibrary(venueId, true)
  const { items, total } = unirPaginas(q.data, o => o.id)
  const [editor, setEditor] = useState<{ option: OptionLibraryListItem | null } | null>(null)

  const nueva = (dataTour: string) =>
    puedeEscribir && (
      <Button type="button" data-tour={dataTour} onClick={() => setEditor({ option: null })}>
        <Plus className="mr-2 h-4 w-4" />
        {t('biblioteca.nueva')}
      </Button>
    )

  return (
    <FeatureGate feature="PRODUCT_VARIANTS">
      <div className="space-y-6 bg-background p-4 text-foreground sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{t('biblioteca.titulo')}</h1>
            <p className="max-w-2xl text-muted-foreground">{t('biblioteca.ayuda')}</p>
          </div>
          {nueva('product-options-new')}
        </div>

        <section data-tour="product-options-list" className="rounded-2xl border border-border/50 bg-card p-6">
          {q.isLoading || !venueId ? (
            <div data-testid="biblioteca-cargando" aria-busy="true" className="space-y-3">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : q.isError && items.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-destructive">{t('biblioteca.error')}</p>
              <Button type="button" variant="outline" onClick={() => q.refetch()}>
                {t('biblioteca.reintentar')}
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-start gap-4">
              <p className="max-w-xl text-muted-foreground">{t(puedeEscribir ? 'biblioteca.vacia' : 'biblioteca.vaciaSoloLectura')}</p>
              {nueva('product-options-new-empty')}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('biblioteca.total', { count: total })}</p>
              <ul className="space-y-2">
                {items.map(o => (
                  <li key={o.id}>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-input px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setEditor({ option: o })}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{o.name}</span>
                        <span className="block truncate text-sm text-muted-foreground">
                          <span>{o.values.map(v => v.value).join(', ')}</span>
                          {(o.valuesTruncated || o.valuesTotal > o.values.length) && <span className="ml-1">{t('biblioteca.masValores', { count: o.valuesTotal - o.values.length })}</span>}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              {q.isError && (
                <div className="flex flex-col items-start gap-2 text-sm">
                  <p className="text-destructive">{t('biblioteca.errorMas')}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={q.isFetching}
                    onClick={() => (q.isFetchNextPageError ? q.fetchNextPage() : q.refetch())}
                  >
                    {t('biblioteca.reintentar')}
                  </Button>
                </div>
              )}
              {q.hasNextPage && !q.isError && (
                <Button type="button" variant="outline" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
                  {t('biblioteca.cargarMas', { count: total - items.length })}
                </Button>
              )}
            </div>
          )}
        </section>

        {editor && venueId && (
          <OptionEditorDialog
            key={editor.option?.id ?? 'nueva'}
            venueId={venueId}
            option={editor.option}
            puedeEscribir={puedeEscribir}
            onClose={() => setEditor(null)}
          />
        )}
      </div>
    </FeatureGate>
  )
}
