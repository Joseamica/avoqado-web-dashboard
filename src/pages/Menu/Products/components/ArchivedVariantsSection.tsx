import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { unirPaginas, useArchivedVariants } from '@/features/product-variants/hooks'
import { cn } from '@/lib/utils'
import type { ProductGroupDetail } from '@/types/productGroup'
import { useVenueDateTime } from '@/utils/datetime'

/** Las variantes archivadas, plegadas: se piden al server sólo al abrir, por páginas de 25 con «Cargar más». */
export function ArchivedVariantsSection({ venueId, familia }: { venueId: string; familia: ProductGroupDetail }) {
  const { t } = useTranslation('variants')
  const { formatDate } = useVenueDateTime()
  const [abierta, setAbierta] = useState(!!familia.archived) // de una familia archivada, sus variantes archivadas son lo que hay que ver
  const q = useArchivedVariants(venueId, familia.id, abierta)
  const { items, total } = useMemo(() => unirPaginas(q.data, a => a.id), [q.data])

  return (
    <Collapsible open={abierta} onOpenChange={setAbierta} className="rounded-2xl border border-border/50 bg-card p-6" data-tour="product-group-archived">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full cursor-pointer justify-between px-0 text-lg font-semibold hover:bg-transparent"
          data-tour="product-group-archived-toggle"
        >
          {t('archivadas.titulo', { count: familia.archivedCount })}
          <ChevronDown className={cn('h-4 w-4 transition-transform', abierta && 'rotate-180')} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">
        <p className="text-sm text-muted-foreground">{t('archivadas.ayuda')}</p>
        {q.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('archivadas.cargando')}
          </p>
        ) : q.isError && !q.data ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-destructive">{t('archivadas.error')}</p>
            <Button variant="outline" size="sm" onClick={() => void q.refetch()} data-tour="product-group-archived-retry">
              {t('familia.reintentar')}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('archivadas.vacio')}</p>
        ) : (
          <>
            <ul className="divide-y divide-border rounded-xl border border-input">
              {items.map(a => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-muted-foreground">
                    {a.sku} · {formatDate(a.archivedAt)}
                  </span>
                </li>
              ))}
            </ul>
            {q.isFetchNextPageError && <p className="text-sm text-destructive">{t('archivadas.error')}</p>}
            {q.hasNextPage && (
              <Button variant="outline" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} data-tour="product-group-archived-more">
                {t('archivadas.cargarMas', { count: total - items.length })}
              </Button>
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
