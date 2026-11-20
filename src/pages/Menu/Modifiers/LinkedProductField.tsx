import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, Loader2, Search, UtensilsCrossed, X } from 'lucide-react'

import { FeatureGate } from '@/components/billing/FeatureGate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { useDebounce } from '@/hooks/useDebounce'
import { searchLinkableProducts, type LinkableProduct } from '@/services/menu.service'
import type { ModifierLinkedProduct } from '@/types'

interface LinkedProductFieldProps {
  venueId: string
  /** ¿Está prendido «Este extra es un platillo del menú»? */
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  /** El platillo elegido (o el que ya tenía el extra). */
  value: ModifierLinkedProduct | null
  onChange: (product: ModifierLinkedProduct | null) => void
  /** Con el switch prendido y sin platillo: el aviso de que falta elegirlo. */
  showRequired?: boolean
}

/**
 * Plan para ligar (founder, 20-nov-2026, opción A): Pro y Premium, el mismo que el reporte «Ventas por artículo». Espejo VISUAL del
 * candado del servidor, que es quien manda: `LIGA_DE_EXTRA_PLAN` en avoqado-server/src/services/dashboard/menu.dashboard.service.ts.
 * `null` = todos los planes (sin candado).
 */
const LINKED_PRODUCT_FEATURE: string | null = 'ADVANCED_REPORTS'

function CandadoDePlan({ children }: { children: React.ReactNode }) {
  return LINKED_PRODUCT_FEATURE ? <FeatureGate feature={LINKED_PRODUCT_FEATURE}>{children}</FeatureGate> : <>{children}</>
}

/**
 * ¿El extra descuenta el platillo? Sólo si el platillo lleva inventario (y no se volvió por kilo ni se borró). Si no, la liga sólo
 * cuenta sus unidades en «Ventas por artículo» › «Dentro de paquete» (founder «B», 20-nov).
 */
function stillDeducts(product: ModifierLinkedProduct): boolean {
  if (product.trackInventory === undefined) return !!product.inventoryMethod // recién elegido del buscador
  return !!product.trackInventory && !!product.inventoryMethod && !product.soldByWeight && !product.deletedAt
}

/**
 * «Este extra es un platillo del menú» (encargo 27771e; founder, 16-nov-2026: como Fudo y Toast). Al venderse el extra, sus unidades
 * salen en «Ventas por artículo» como «Dentro de paquete» (no como venta suelta) y, si el platillo lleva inventario, el SERVIDOR
 * descuenta 1 porción (sus piezas o su receta). Sin inventario también se liga (founder «B», 20-nov): sólo cuenta. Plan: Pro y
 * Premium (`LINKED_PRODUCT_FEATURE`). El buscador es una página acotada del servidor (20 por página, «Cargar más», total visible).
 *
 * El interruptor siempre se ve. Al prenderlo sin el plan, el buscador sale borroso con su candado y la explicación (FeatureGate). Si
 * el extra YA estaba ligado, se ve y se puede quitar aunque el negocio ya no tenga el plan (el servidor nunca lo pide para quitar).
 */
export function LinkedProductField({ venueId, enabled, onEnabledChange, value, onChange, showRequired }: LinkedProductFieldProps) {
  const { t } = useTranslation('menu')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const query = useInfiniteQuery({
    queryKey: ['modifier-linkable-products', venueId, debouncedSearch],
    queryFn: ({ pageParam }) => searchLinkableProducts(venueId, { search: debouncedSearch || undefined, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: last => (last.hasMore ? last.nextCursor : undefined),
    enabled: !!venueId && enabled && !value,
    placeholderData: keepPreviousData,
    // Sin vigencia: la fila «en gris por Premium» depende del plan de HOY; tras subir de plan no se reusa la respuesta vieja
    // (Codex r2 #2). Es una página acotada de 20, barata de volver a pedir.
    staleTime: 0,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const items = useMemo(() => {
    const seen = new Set<string>()
    return (query.data?.pages ?? []).flatMap(p => p.data).filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)))
  }, [query.data])
  const total = query.data?.pages[0]?.total ?? 0

  const methodLabel = (method: ModifierLinkedProduct['inventoryMethod']) =>
    method === 'RECIPE'
      ? t('modifiers.inventory.linked.methodRecipe')
      : method === 'QUANTITY'
        ? t('modifiers.inventory.linked.methodQuantity')
        : null

  const pick = (p: LinkableProduct) => {
    if (!p.linkable) return
    onChange({ id: p.id, name: p.name, inventoryMethod: p.inventoryMethod, active: p.active, categoryName: p.categoryName })
    setSearch('')
  }

  return (
    <div className="space-y-3 rounded-lg border border-input p-3" data-tour="modifier-linked-product">
      <div className="flex flex-row items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium leading-none">{t('modifiers.inventory.linked.title')}</p>
          <p className="text-sm text-muted-foreground">{t('modifiers.inventory.linked.desc')}</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          aria-label={t('modifiers.inventory.linked.title')}
          data-tour="modifier-linked-product-switch"
        />
      </div>

      {enabled && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('modifiers.inventory.linked.pick')} *</p>
          {value ? (
            <div className="rounded-lg border border-input bg-primary/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <UtensilsCrossed className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{value.name}</p>
                    {methodLabel(value.inventoryMethod ?? null) && (
                      <p className="text-xs text-muted-foreground">{methodLabel(value.inventoryMethod ?? null)}</p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => onChange(null)}
                  aria-label={t('modifiers.inventory.linked.remove')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {!stillDeducts(value) && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground" role="status">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t('modifiers.inventory.linked.noInventory')}
                </p>
              )}
            </div>
          ) : (
            <CandadoDePlan>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('modifiers.inventory.linked.search')}
                    aria-label={t('modifiers.inventory.linked.search')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10"
                  />
                  {(search !== debouncedSearch || query.isFetching) && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
                <ScrollArea className="h-[220px] rounded-lg border border-input">
                  {query.isError ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8">
                      <p className="text-sm text-muted-foreground">{t('modifiers.inventory.linked.error')}</p>
                      <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => query.refetch()}>
                        {t('modifiers.inventory.linked.retry')}
                      </Button>
                    </div>
                  ) : query.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : items.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-sm text-muted-foreground">{t('modifiers.inventory.linked.empty')}</p>
                    </div>
                  ) : (
                    <div className="space-y-1 p-2">
                      {items.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          disabled={!p.linkable}
                          onClick={() => pick(p)}
                          className="w-full rounded-lg border border-transparent p-3 text-left transition-colors enabled:cursor-pointer enabled:hover:border-input enabled:hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                              {p.categoryName && <p className="truncate text-xs text-muted-foreground">{p.categoryName}</p>}
                              {p.blockedReason ? (
                                <p className="text-xs text-muted-foreground">
                                  {t(`modifiers.inventory.linked.blocked.${p.blockedReason}`)}
                                </p>
                              ) : (
                                !p.inventoryMethod && (
                                  <p className="text-xs text-muted-foreground">{t('modifiers.inventory.linked.countOnly')}</p>
                                )
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {!p.active && (
                                <Badge variant="outline" className="text-[10px]">
                                  {t('modifiers.inventory.linked.inactive')}
                                </Badge>
                              )}
                              {methodLabel(p.inventoryMethod) && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {methodLabel(p.inventoryMethod)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                {items.length > 0 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t('modifiers.inventory.linked.showing', { shown: items.length, total })}</span>
                    {query.hasNextPage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer"
                        disabled={query.isFetchingNextPage}
                        onClick={() => query.fetchNextPage()}
                      >
                        {query.isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : t('modifiers.inventory.linked.loadMore')}
                      </Button>
                    )}
                  </div>
                )}
                {showRequired && <p className="text-sm font-medium text-destructive">{t('modifiers.inventory.linked.required')}</p>}
              </div>
            </CandadoDePlan>
          )}
        </div>
      )}
    </div>
  )
}
