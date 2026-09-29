import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Save } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useTerminology } from '@/hooks/use-terminology'
import { getPrintStations, getRouting, updateRouting } from '@/services/printStations.service'
import { RoutingSimulator } from './RoutingSimulator'

const NULL_OPT = '__null__'

const apiError = (e: any, fallback: string): string =>
  e?.response?.data?.message ?? e?.response?.data?.error ?? fallback

export function RoutingTab({ venueId }: { venueId: string }) {
  const { t } = useTranslation('printStations')
  const { term } = useTerminology()
  const { toast } = useToast()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['printRouting', venueId],
    queryFn: () => getRouting(venueId),
    enabled: !!venueId,
  })

  const { data: stations } = useQuery({
    queryKey: ['printStations', venueId],
    queryFn: () => getPrintStations(venueId),
    enabled: !!venueId,
  })

  // Override maps keep the draft; the effective value falls back to the loaded data.
  const [catOverrides, setCatOverrides] = useState<Record<string, string | null>>({})
  const [prodOverrides, setProdOverrides] = useState<Record<string, string | null>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const productsByCategory = useMemo(() => {
    const map: Record<string, typeof data.products> = {}
    data?.products.forEach(p => {
      if (!p.categoryId) return
      ;(map[p.categoryId] ??= []).push(p)
    })
    return map
  }, [data])

  const effectiveCat = (id: string, original: string | null) => (id in catOverrides ? catOverrides[id] : original)
  const effectiveProd = (id: string, original: string | null) => (id in prodOverrides ? prodOverrides[id] : original)

  const changedCategories = useMemo(() => {
    if (!data) return []
    return data.categories
      .filter(c => c.id in catOverrides && catOverrides[c.id] !== c.printStationId)
      .map(c => ({ id: c.id, printStationId: catOverrides[c.id] }))
  }, [data, catOverrides])

  const changedProducts = useMemo(() => {
    if (!data) return []
    return data.products
      .filter(p => p.id in prodOverrides && prodOverrides[p.id] !== p.printStationId)
      .map(p => ({ id: p.id, printStationId: prodOverrides[p.id] }))
  }, [data, prodOverrides])

  const hasChanges = changedCategories.length > 0 || changedProducts.length > 0

  const saveMut = useMutation({
    mutationFn: () =>
      updateRouting(venueId, {
        categories: changedCategories.length ? changedCategories : undefined,
        products: changedProducts.length ? changedProducts : undefined,
      }),
    onSuccess: () => {
      toast({ title: t('routing.saved') })
      setCatOverrides({})
      setProdOverrides({})
      qc.invalidateQueries({ queryKey: ['printRouting', venueId] })
    },
    onError: e => toast({ title: t('errors.title'), description: apiError(e, t('errors.generic')), variant: 'destructive' }),
  })

  const stationOptions = stations ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}
      </div>
    )
  }

  if (!data || data.categories.length === 0) {
    return (
      <Card className="border-input">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t('routing.empty', { menu: term('menu') })}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('routing.intro', { menu: term('menu') })}</p>

      <div className="flex flex-wrap items-center gap-2">
        {data.unroutedCategories > 0 ? (
          <Badge variant="outline">{t('routing.unroutedBadge', { count: data.unroutedCategories })}</Badge>
        ) : (
          <Badge variant="secondary">{t('routing.allRouted')}</Badge>
        )}
      </div>

      {!data.hasDefault && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-medium text-amber-700 dark:text-amber-300">{t('routing.noDefaultTitle')}</p>
            <p className="text-muted-foreground">{t('routing.noDefaultWarning')}</p>
          </div>
        </div>
      )}

      <Card className="border-input">
        <CardContent className="divide-y divide-border p-0">
          {data.categories.map(category => {
            const products = productsByCategory[category.id] ?? []
            const isOpen = !!expanded[category.id]
            return (
              <div key={category.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {products.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        onClick={() => setExpanded(s => ({ ...s, [category.id]: !isOpen }))}
                        aria-label={isOpen ? t('routing.collapseProducts') : t('routing.expandProducts')}
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    ) : (
                      <span className="inline-block w-7" />
                    )}
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <Select
                    value={effectiveCat(category.id, category.printStationId) ?? NULL_OPT}
                    onValueChange={v =>
                      setCatOverrides(s => ({ ...s, [category.id]: v === NULL_OPT ? null : v }))
                    }
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NULL_OPT}>{t('routing.unassigned')}</SelectItem>
                      {stationOptions.map(st => (
                        <SelectItem key={st.id} value={st.id}>
                          {st.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isOpen && products.length > 0 && (
                  <div className="mt-3 space-y-2 pl-9">
                    {products.map(product => (
                      <div key={product.id} className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">{product.name}</span>
                        <Select
                          value={effectiveProd(product.id, product.printStationId) ?? NULL_OPT}
                          onValueChange={v =>
                            setProdOverrides(s => ({ ...s, [product.id]: v === NULL_OPT ? null : v }))
                          }
                        >
                          <SelectTrigger className="w-56">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NULL_OPT}>{t('routing.inherit')}</SelectItem>
                            {stationOptions.map(st => (
                              <SelectItem key={st.id} value={st.id}>
                                {st.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMut.mutate()} disabled={!hasChanges || saveMut.isPending} data-tour="print-routing-save">
          {saveMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {t('routing.save')}
        </Button>
      </div>

      <RoutingSimulator venueId={venueId} products={data.products} stations={stations ?? []} />
    </div>
  )
}
