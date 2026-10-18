import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

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
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import {
  getMenuCategories,
  getMenuProducts,
  onlineOrderingKeys,
  serverMessage,
  setMenuAvailability,
} from '@/services/onlineOrdering.service'
import { Currency } from '@/utils/currency'

const PAGE_SIZE = 50
type Bulk = 'showAll' | 'hideAll' | null

/**
 * Menú en línea: qué productos ve el comensal. Totales y listas vienen del servidor (agregados exactos, búsqueda y
 * paginación por cursor); sin actualización optimista: tras cada cambio se re-leen categorías y productos.
 */
export function MenuTab() {
  const { t } = useTranslation('onlineOrdering')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const search = useDebounce(searchTerm.trim(), 300)
  const [bulk, setBulk] = useState<Bulk>(null)
  const vid = venueId ?? ''

  const categories = useQuery({ queryKey: onlineOrderingKeys.categories(vid), queryFn: () => getMenuCategories(vid), enabled: !!venueId })

  const filter = { categoryId: categoryId ?? undefined, search: search || undefined }
  const products = useInfiniteQuery({
    queryKey: onlineOrderingKeys.products(vid, filter),
    queryFn: ({ pageParam }) => getMenuProducts(vid, { ...filter, limit: PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => last.nextCursor ?? undefined,
    enabled: !!venueId && !!categoryId,
  })

  const mutation = useMutation({
    mutationFn: (body: Parameters<typeof setMenuAvailability>[1]) => setMenuAvailability(vid, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: onlineOrderingKeys.categories(vid) })
      qc.invalidateQueries({ queryKey: onlineOrderingKeys.products(vid, {}) })
    },
    onError: (error: unknown) => toast({ title: serverMessage(error, t('menu.saveFailed')), variant: 'destructive' }),
  })

  const data = categories.data
  const items = products.data?.pages.flatMap(p => p.items) ?? []
  const total = products.data?.pages[0]?.total ?? 0

  return (
    <div className="space-y-4" data-tour="online-ordering-menu">
      {categories.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {categories.isError && <p className="text-sm text-destructive">{serverMessage(categories.error, t('menu.loadFailed'))}</p>}

      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-input p-4">
            <div className="space-y-1">
              <p className="font-medium">{t('menu.summary.online', { online: data.totals.online, total: data.totals.total })}</p>
              {data.totals.onlineWithoutPhoto > 0 && (
                <p className="text-sm text-muted-foreground">{t('menu.summary.noPhoto', { count: data.totals.onlineWithoutPhoto })}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                data-tour="online-ordering-show-all"
                onClick={() => setBulk('showAll')}
              >
                {t('menu.bulk.showAll')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                data-tour="online-ordering-hide-all"
                onClick={() => setBulk('hideAll')}
              >
                {t('menu.bulk.hideAll')}
              </Button>
            </div>
          </div>

          {data.truncated && <p className="text-sm text-muted-foreground">{t('menu.truncated')}</p>}

          <ul className="space-y-2">
            {data.categories.map(c => (
              <li
                key={c.id}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl border border-input p-3',
                  categoryId === c.id && 'bg-muted/60',
                )}
              >
                <button
                  type="button"
                  className="flex-1 cursor-pointer text-left"
                  onClick={() => {
                    setCategoryId(categoryId === c.id ? null : c.id)
                    setSearchTerm('')
                  }}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {t('menu.category.count', { online: c.online, total: c.total })}
                  </span>
                  {!c.active && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{t('menu.category.inactive')}</span>}
                </button>
                {c.online > 0 && (
                  <button
                    type="button"
                    className="cursor-pointer text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ availableOnline: false, categoryIds: [c.id] })}
                  >
                    {t('menu.category.removeFromOnline')}
                  </button>
                )}
                <Switch
                  aria-label={t('menu.category.toggle', { name: c.name })}
                  checked={c.total > 0 && c.online === c.total}
                  disabled={mutation.isPending || c.total === 0}
                  onCheckedChange={v => mutation.mutate({ availableOnline: v, categoryIds: [c.id] })}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {categoryId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t('menu.product.total', { count: total })}</p>
            {searchOpen ? (
              <div className="relative animate-in fade-in slide-in-from-left-2 duration-200">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  data-tour="online-ordering-menu-search"
                  value={searchTerm}
                  maxLength={80}
                  placeholder={t('menu.product.searchPlaceholder')}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape' && !searchTerm) setSearchOpen(false)
                  }}
                  className="h-8 w-[260px] rounded-full pl-8 pr-8 text-sm"
                />
                {searchTerm && (
                  <button
                    type="button"
                    aria-label={t('menu.product.searchClear')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={() => setSearchTerm('')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <Button
                  variant="outline"
                  size="icon"
                  className="cursor-pointer rounded-full"
                  aria-label={t('menu.product.searchToggle')}
                  onClick={() => setSearchOpen(true)}
                >
                  <Search className="h-4 w-4" />
                </Button>
                {searchTerm && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
              </div>
            )}
          </div>

          {products.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          {products.isError && <p className="text-sm text-destructive">{serverMessage(products.error, t('menu.loadFailed'))}</p>}
          {products.isSuccess && items.length === 0 && (
            <p className="rounded-xl border border-input p-4 text-sm text-muted-foreground">
              {search ? t('menu.product.noResults') : t('menu.product.empty')}
            </p>
          )}

          <ul className="space-y-2">
            {items.map(p => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-input p-3">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" loading="lazy" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-lg bg-muted text-center text-[10px] text-muted-foreground">
                    {t('menu.product.noPhoto')}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {Currency(p.price)}
                    {!p.active && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{t('menu.product.inactive')}</span>}
                  </p>
                </div>
                <Switch
                  aria-label={t('menu.product.toggle', { name: p.name })}
                  checked={p.availableOnline}
                  disabled={mutation.isPending}
                  onCheckedChange={v => mutation.mutate({ availableOnline: v, productIds: [p.id] })}
                />
              </li>
            ))}
          </ul>

          {products.hasNextPage && (
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={products.isFetchingNextPage}
              onClick={() => products.fetchNextPage()}
            >
              {products.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('menu.product.loadMore')}
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={bulk !== null} onOpenChange={o => !o && setBulk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bulk && t(`menu.bulk.${bulk}`)}</AlertDialogTitle>
            <AlertDialogDescription>{bulk && t(`menu.bulk.${bulk}Confirm`)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">{t('menu.bulk.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={cn('cursor-pointer', bulk === 'hideAll' && buttonVariants({ variant: 'destructive' }))}
              onClick={() => {
                if (bulk) mutation.mutate({ availableOnline: bulk === 'showAll', allProducts: true })
                setBulk(null)
              }}
            >
              {t('menu.bulk.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
