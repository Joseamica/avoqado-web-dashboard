import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { AlertTriangle, Loader2, PlayCircle, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { SearchCombobox } from '@/components/search-combobox'
import { useDebounce } from '@/hooks/useDebounce'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useToast } from '@/hooks/use-toast'
import { getRouting, previewRouting, type PreviewResult, type PrintStation } from '@/services/printStations.service'
import { destinoDelPlan } from './kitchenDisplay'

const apiError = (e: any, fallback: string): string => e?.response?.data?.message ?? e?.response?.data?.error ?? fallback

/**
 * Simulador «¿a dónde va este pedido?» (servidor: `previewRouting`). Lo usan la pestaña «Ruteo» y el botón «Probar» de
 * las estaciones (diseño A: «botón Probar con el simulador existente»). Cada estación del resultado dice si su comanda
 * sale en papel, en la pantalla o en las dos.
 */
export function RoutingSimulator({ venueId, stations }: { venueId: string; stations: PrintStation[] }) {
  const { t } = useTranslation('printStations')
  const { toast } = useToast()
  const { hasAccess: tieneAccesoPro } = useTierFeatureAccess('KITCHEN_DISPLAY')
  const [items, setItems] = useState<{ rowId: string; productId: string; label: string; quantity: number }[]>([])
  const [result, setResult] = useState<PreviewResult | null>(null)

  const simMut = useMutation({
    mutationFn: () => previewRouting(venueId, { items: items.map(({ productId, quantity }) => ({ productId, quantity })) }),
    onSuccess: setResult,
    onError: e => toast({ title: t('errors.title'), description: apiError(e, t('errors.generic')), variant: 'destructive' }),
  })

  const addItem = () => setItems(prev => [...prev, { rowId: crypto.randomUUID(), productId: '', label: '', quantity: 1 }])
  const canRun = items.length > 0 && items.every(i => i.productId && (i.quantity ?? 0) >= 1)

  return (
    <Card className="border-input">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PlayCircle className="h-5 w-5" /> {t('routing.simulator.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('routing.simulator.description')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={item.rowId} className="flex flex-wrap items-center gap-2">
              <ProductSelector
                venueId={venueId}
                index={i + 1}
                selectedLabel={item.label}
                onSelect={product =>
                  setItems(prev => prev.map((x, j) => (j === i ? { ...x, productId: product.id, label: product.label } : x)))
                }
              />
              <Input
                type="number"
                min={1}
                className="w-24"
                aria-label={t('routing.simulator.quantity')}
                value={item.quantity ?? ''}
                onChange={e => {
                  const raw = e.target.value
                  setItems(prev =>
                    prev.map((x, j) =>
                      j === i ? { ...x, quantity: raw === '' ? (undefined as unknown as number) : parseInt(raw, 10) } : x,
                    ),
                  )
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="cursor-pointer"
                aria-label={t('routing.lists.removeProduct', { index: i + 1 })}
                onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1 h-3.5 w-3.5" /> {t('routing.simulator.addItem')}
          </Button>
        </div>

        <Button onClick={() => simMut.mutate()} disabled={!canRun || simMut.isPending}>
          {simMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          {t('routing.simulator.run')}
        </Button>

        {items.length === 0 && <p className="text-xs text-muted-foreground">{t('routing.simulator.noItems')}</p>}

        {result && (
          <div className="space-y-3">
            {result.unrouted && (
              <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {t('routing.simulator.unroutedNote')}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {result.plans.map((plan, i) => {
                const destino = destinoDelPlan(plan, stations, tieneAccesoPro)
                return (
                  <div key={plan.stationId ?? `unrouted-${i}`} className="rounded-lg border border-input p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2 font-medium">
                      {plan.unrouted ? (
                        <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                          {t('routing.simulator.unroutedStation')}
                        </Badge>
                      ) : (
                        <span>{plan.stationName}</span>
                      )}
                      {destino && <Badge variant="secondary">{t(`destino.${destino}`)}</Badge>}
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {plan.lines.map((line, j) => (
                        <li key={j}>{t('routing.simulator.lineFormat', { quantity: line.quantity, name: line.productName })}</li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ProductSelector({
  venueId,
  index,
  selectedLabel,
  onSelect,
}: {
  venueId: string
  index: number
  selectedLabel: string
  onSelect: (product: { id: string; label: string }) => void
}) {
  const { t } = useTranslation('printStations')
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const search = useDebounce(searchTerm, 300)
  const query = useInfiniteQuery({
    queryKey: ['printRouting', venueId, 'products', 'selector', search],
    queryFn: ({ pageParam }) => getRouting(venueId, { section: 'products', page: pageParam, search }),
    initialPageParam: 1,
    getNextPageParam: last => (last.pagination && last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    enabled: open && !!venueId,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
  const options = useMemo(
    () => [...new Map(query.data?.pages.flatMap(page => page.products).map(p => [p.id, { id: p.id, label: p.name }])).values()],
    [query.data],
  )
  return (
    <div className="w-64 space-y-1">
      <label htmlFor={`routing-product-${index}`} className="sr-only">
        {t('routing.lists.productLabel', { index })}
      </label>
      <SearchCombobox
        inputId={`routing-product-${index}`}
        placeholder={t('routing.simulator.selectProduct')}
        items={options}
        value={searchTerm}
        onChange={value => setSearchTerm(value.slice(0, 100))}
        onOpenChange={setOpen}
        onSelect={product => {
          onSelect(product)
          setSearchTerm('')
        }}
        isLoading={query.isFetching && !query.isFetchingNextPage}
        isLoadingMore={query.isFetchingNextPage}
        hasMore={query.hasNextPage}
        onLoadMore={() => {
          if (open && !query.isFetching && query.hasNextPage) query.fetchNextPage()
        }}
        footer={
          <div className="space-y-2 border-t border-border p-3 text-sm text-muted-foreground">
            {query.isError ? (
              <div role="alert">
                {t('routing.lists.loadError')}{' '}
                <Button size="sm" variant="outline" onClick={() => query.refetch()}>
                  {t('routing.lists.retry')}
                </Button>
              </div>
            ) : (
              <>
                {query.data && (
                  <span>{t('routing.lists.productsTotal', { count: query.data.pages[0].pagination?.total ?? options.length })}</span>
                )}
                {!query.isFetching && query.data && options.length === 0 && (
                  <p>{t(search ? 'routing.lists.noMatches' : 'routing.lists.emptyProducts')}</p>
                )}
                {query.hasNextPage && (
                  <Button size="sm" variant="outline" disabled={query.isFetching} onClick={() => query.fetchNextPage()}>
                    {t('routing.lists.loadMore')}
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />
      {selectedLabel && <p className="text-xs text-muted-foreground">{t('routing.lists.selected', { name: selectedLabel })}</p>}
    </div>
  )
}

/** Probar comparte el simulador; el catálogo se pide al abrir su selector. */
export function ProbarRuteoModal({ venueId, stations, onClose }: { venueId: string; stations: PrintStation[]; onClose: () => void }) {
  const { t } = useTranslation('printStations')
  return (
    <FullScreenModal open onClose={onClose} title={t('stations.testTitle')} contentClassName="bg-muted/30">
      <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
        <RoutingSimulator key={venueId} venueId={venueId} stations={stations} />
      </div>
    </FullScreenModal>
  )
}
