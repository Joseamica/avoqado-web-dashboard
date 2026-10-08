import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Save } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/use-toast'
import { useTerminology } from '@/hooks/use-terminology'
import { getPrintStations, getRouting, updateRouting, type PrintStation, type RoutingPagination } from '@/services/printStations.service'
import { RoutingSimulator } from './RoutingSimulator'

const NULL_OPT = '__null__'
type Draft = Record<string, { original: string | null; value: string | null }>
const changes = (draft: Draft) =>
  Object.entries(draft)
    .filter(([, entry]) => entry.original !== entry.value)
    .map(([id, entry]) => ({ id, printStationId: entry.value }))
const edit = (draft: Draft, id: string, original: string | null, value: string | null): Draft => ({
  ...draft,
  [id]: { original: id in draft ? draft[id].original : original, value },
})
const queryOptions = { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false }

function PageControls({
  pagination,
  section,
  onPage,
  busy,
}: {
  pagination?: RoutingPagination
  section: 'categories' | 'products'
  onPage: (page: number) => void
  busy: boolean
}) {
  const { t } = useTranslation('printStations')
  if (!pagination) return null
  const suffix = section === 'categories' ? 'Categories' : 'Products'
  return (
    <div className="flex flex-wrap items-center gap-3 py-3 text-sm text-muted-foreground">
      <span>{t(`routing.lists.${section}Total`, { count: pagination.total })}</span>
      <Button
        variant="outline"
        size="sm"
        disabled={busy || pagination.page <= 1}
        onClick={() => onPage(pagination.page - 1)}
        aria-label={t(`routing.lists.previous${suffix}`)}
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
      </Button>
      <span>{t('routing.lists.page', { page: pagination.page, totalPages: Math.max(1, pagination.totalPages) })}</span>
      <Button
        variant="outline"
        size="sm"
        disabled={busy || pagination.page >= pagination.totalPages}
        onClick={() => onPage(pagination.page + 1)}
        aria-label={t(`routing.lists.next${suffix}`)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
function StationSelect({
  value,
  onChange,
  stations,
  inherit = false,
}: {
  value: string | null
  onChange: (value: string | null) => void
  stations: PrintStation[]
  inherit?: boolean
}) {
  const { t } = useTranslation('printStations')
  return (
    <Select value={value ?? NULL_OPT} onValueChange={v => onChange(v === NULL_OPT ? null : v)}>
      <SelectTrigger className="w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NULL_OPT}>{t(inherit ? 'routing.inherit' : 'routing.unassigned')}</SelectItem>
        {stations.map(st => (
          <SelectItem key={st.id} value={st.id}>
            {st.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
function CategoryProducts({
  venueId,
  categoryId,
  stations,
  draft,
  onEdit,
}: {
  venueId: string
  categoryId: string
  stations: PrintStation[]
  draft: Draft
  onEdit: (id: string, original: string | null, value: string | null) => void
}) {
  const { t } = useTranslation('printStations')
  const [filter, setFilter] = useState({ search: '', page: 1 })
  const search = useDebounce(filter.search, 300)
  // The page resets in the same interaction as search; a pending debounce never sends the old page.
  const page = filter.search === search ? filter.page : 1
  const query = useQuery({
    queryKey: ['printRouting', venueId, 'products', categoryId, search, page],
    queryFn: () => getRouting(venueId, { section: 'products', categoryId, page, search }),
    enabled: !!venueId,
    placeholderData: keepPreviousData,
    ...queryOptions,
  })
  return (
    <div className="mt-3 space-y-2 pl-9">
      <Input
        value={filter.search}
        maxLength={100}
        aria-label={t('routing.lists.searchProducts')}
        placeholder={t('routing.lists.searchProducts')}
        onChange={e => setFilter({ search: e.target.value, page: 1 })}
      />
      {query.isLoading && <p role="status">{t('loading')}</p>}
      {query.isError ? (
        <div role="alert">
          {t('routing.lists.loadError')}{' '}
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            {t('routing.lists.retry')}
          </Button>
        </div>
      ) : query.data?.products.length === 0 ? (
        <p>{t(search ? 'routing.lists.noMatches' : 'routing.lists.emptyProducts')}</p>
      ) : (
        query.data?.products.map(product => (
          <div key={product.id} data-testid={`routing-product-${product.id}`} className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{product.name}</span>
            <StationSelect
              stations={stations}
              inherit
              value={product.id in draft ? draft[product.id].value : product.printStationId}
              onChange={value => onEdit(product.id, product.printStationId, value)}
            />
          </div>
        ))
      )}
      <PageControls
        pagination={query.data?.pagination}
        section="products"
        busy={query.isFetching}
        onPage={page => setFilter(s => ({ ...s, page }))}
      />
    </div>
  )
}
export function RoutingTab({ venueId }: { venueId: string }) {
  return <RoutingEditor key={venueId} venueId={venueId} />
}
function RoutingEditor({ venueId }: { venueId: string }) {
  const { t } = useTranslation('printStations')
  const { term } = useTerminology()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [filter, setFilter] = useState({ search: '', page: 1 })
  const search = useDebounce(filter.search, 300)
  const page = filter.search === search ? filter.page : 1
  const [catDraft, setCatDraft] = useState<Draft>({})
  const [prodDraft, setProdDraft] = useState<Draft>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ['printRouting', venueId, 'categories', search, page],
    queryFn: () => getRouting(venueId, { section: 'categories', page, search }),
    enabled: !!venueId,
    placeholderData: keepPreviousData,
    ...queryOptions,
  })
  const stationQuery = useQuery({
    queryKey: ['printStations', venueId],
    queryFn: () => getPrintStations(venueId),
    enabled: !!venueId,
    ...queryOptions,
  })
  const stations = stationQuery.data ?? []
  const changedCategories = useMemo(() => changes(catDraft), [catDraft])
  const changedProducts = useMemo(() => changes(prodDraft), [prodDraft])
  const hasChanges = changedCategories.length > 0 || changedProducts.length > 0
  const saveMut = useMutation({
    mutationFn: () =>
      updateRouting(venueId, {
        categories: changedCategories.length ? changedCategories : undefined,
        products: changedProducts.length ? changedProducts : undefined,
      }),
    onSuccess: () => {
      toast({ title: t('routing.saved') })
      setCatDraft({})
      setProdDraft({})
      qc.invalidateQueries({ queryKey: ['printRouting', venueId] })
    },
    onError: (e: any) =>
      toast({ title: t('errors.title'), description: e?.response?.data?.message ?? t('errors.generic'), variant: 'destructive' }),
  })
  const data = query.data
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('routing.intro', { menu: term('menu') })}</p>
      <Input
        value={filter.search}
        maxLength={100}
        className="rounded-full"
        aria-label={t('routing.lists.searchCategories')}
        placeholder={t('routing.lists.searchCategories')}
        onChange={e => {
          setFilter({ search: e.target.value, page: 1 })
          setExpanded(null)
        }}
      />
      {data && (
        <>
          <Badge variant={data.unroutedCategories > 0 ? 'outline' : 'secondary'}>
            {data.unroutedCategories > 0 ? t('routing.unroutedBadge', { count: data.unroutedCategories }) : t('routing.allRouted')}
          </Badge>
          {!data.hasDefault && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-300">{t('routing.noDefaultTitle')}</p>
                <p className="text-muted-foreground">{t('routing.noDefaultWarning')}</p>
              </div>
            </div>
          )}
        </>
      )}
      {query.isLoading && <p role="status">{t('loading')}</p>}
      {query.isError && (
        <div role="alert">
          {t('routing.lists.loadError')}{' '}
          <Button variant="outline" onClick={() => query.refetch()}>
            {t('routing.lists.retry')}
          </Button>
        </div>
      )}
      {stationQuery.isError && (
        <div role="alert">
          {t('stations.loadError')}{' '}
          <Button variant="outline" onClick={() => stationQuery.refetch()}>
            {t('stations.retry')}
          </Button>
        </div>
      )}
      {!query.isError && data && (
        <Card className="border-input">
          <CardContent className="divide-y divide-border p-0">
            {data.categories.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">
                {search ? t('routing.lists.noMatches') : t('routing.empty', { menu: term('menu') })}
              </p>
            ) : (
              data.categories.map(category => (
                <div key={category.id} className="p-4">
                  <div data-testid={`routing-category-${category.id}`} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        onClick={() => setExpanded(expanded === category.id ? null : category.id)}
                        aria-expanded={expanded === category.id}
                        aria-label={t(expanded === category.id ? 'routing.collapseProducts' : 'routing.expandProducts')}
                      >
                        {expanded === category.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                      <span className="font-medium">{category.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {t('routing.lists.productsTotal', { count: category.productCount ?? 0 })}
                      </span>
                    </div>
                    <StationSelect
                      stations={stations}
                      value={category.id in catDraft ? catDraft[category.id].value : category.printStationId}
                      onChange={value => setCatDraft(s => edit(s, category.id, category.printStationId, value))}
                    />
                  </div>
                  {expanded === category.id && (
                    <CategoryProducts
                      key={category.id}
                      venueId={venueId}
                      categoryId={category.id}
                      stations={stations}
                      draft={prodDraft}
                      onEdit={(id, original, value) => setProdDraft(s => edit(s, id, original, value))}
                    />
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
      <PageControls
        pagination={data?.pagination}
        section="categories"
        busy={query.isFetching}
        onPage={page => {
          setFilter(s => ({ ...s, page }))
          setExpanded(null)
        }}
      />
      <div className="flex justify-end">
        <Button onClick={() => saveMut.mutate()} disabled={!hasChanges || saveMut.isPending} data-tour="print-routing-save">
          {saveMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {t('routing.save')}
        </Button>
      </div>
      <RoutingSimulator venueId={venueId} stations={stations} />
    </div>
  )
}
