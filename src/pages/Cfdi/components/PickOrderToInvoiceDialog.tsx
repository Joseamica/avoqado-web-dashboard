import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Search, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { getOrders } from '@/services/order.service'
import type { Order } from '@/types'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'

const PAGE_SIZE = 20

/**
 * Sólo ventas CERRADAS. Una venta pagada que sigue abierta (o que alguien reabrió desde Pedidos) se factura desde Pedidos → ⋯ →
 * Facturar, como hoy (Codex plan r1 #1: el servidor no exige este estado para facturar; aquí es para que la lista no se llene de
 * cuentas abiertas).
 */
const ESTATUS_DE_VENTA_CERRADA = ['COMPLETED']

interface PickOrderToInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** La venta elegida; quien abre este buscador abre después la ventana de «Facturar» con ella. */
  onSelect: (orderId: string) => void
}

interface PaginaDeVentas {
  data: Order[]
  meta?: { total?: number }
}

function nombreDelCliente(order: Order): string {
  const cliente = order.orderCustomers?.[0]?.customer
  const nombre = [cliente?.firstName, cliente?.lastName]
    .filter(parte => typeof parte === 'string' && parte.trim().length > 0)
    .join(' ')
    .trim()
  return nombre || order.customerName || ''
}

/**
 * «Nueva factura» (Facturas): el buscador de la venta a facturar, las más recientes primero.
 *
 * - `facturada` (lo dice el servidor con `conFactura`): «Ya facturada» y no se puede elegir. El candado de verdad sigue en el servidor.
 * - `facturaEnCancelacion`: se avisa pero SÍ se puede elegir. Sólo el servidor, preguntándole al PAC, sabe si la cancelación ya pasó
 *   y se puede volver a facturar (Codex plan r1 #2: bloquearla quitaba esa salida).
 * - Sin selector de fechas a propósito (Codex plan r1 #6): el selector compartido corre el día cuando el navegador y el negocio están
 *   en zonas distintas. Para ventas viejas se busca por folio, cliente o monto.
 *
 * 🔴 La consulta cuelga de `['cfdis', venueId]`: `useIssueCfdi` invalida esa llave al timbrar, así que la marca se refresca sola.
 */
export function PickOrderToInvoiceDialog({ open, onOpenChange, onSelect }: PickOrderToInvoiceDialogProps) {
  const { t } = useTranslation('cfdi')
  const { venueId } = useCurrentVenue()
  const { formatDate } = useVenueDateTime()

  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const search = useDebounce(searchTerm, 300).trim()

  const { data, isLoading, isError, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['cfdis', venueId, 'ventas-por-facturar', search],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      (await getOrders(
        venueId!,
        { pageIndex: (pageParam as number) - 1, pageSize: PAGE_SIZE },
        { statuses: ESTATUS_DE_VENTA_CERRADA, search: search || undefined, conFactura: true },
      )) as PaginaDeVentas,
    getNextPageParam: (lastPage, allPages) => {
      const cargadas = allPages.reduce((suma, p) => suma + (p.data?.length ?? 0), 0)
      const total = lastPage.meta?.total
      if (total !== undefined && cargadas >= total) return undefined
      if (!lastPage.data || lastPage.data.length < PAGE_SIZE) return undefined
      return allPages.length + 1
    },
    enabled: open && !!venueId,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  // Sin repetidos al juntar páginas: una venta que cambió entre una página y otra puede salir dos veces.
  const ventas = useMemo(() => {
    const vistas = new Set<string>()
    return (data?.pages ?? []).flatMap(p => p.data ?? []).filter(o => (vistas.has(o.id) ? false : (vistas.add(o.id), true)))
  }, [data])
  const total = data?.pages[0]?.meta?.total ?? ventas.length

  const cerrar = () => onOpenChange(false)

  const contenido = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('pickOrder.loading')}
        </div>
      )
    }
    if (isError) {
      return (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center text-destructive" role="alert">
          <div className="flex items-center justify-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            {t('pickOrder.error')}
          </div>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()} disabled={isRefetching}>
            {t('pickOrder.retry')}
          </Button>
        </div>
      )
    }
    if (ventas.length === 0) {
      return (
        <div className="rounded-2xl border border-input bg-card p-10 text-center text-muted-foreground" data-testid="pick-order-empty">
          {search ? t('pickOrder.noMatches', { search }) : t('pickOrder.empty')}
        </div>
      )
    }
    return (
      <>
        <p className="text-sm text-muted-foreground">{t('pickOrder.count', { count: total })}</p>
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-input bg-card">
          {ventas.map(venta => {
            const cliente = nombreDelCliente(venta)
            return (
              <li key={venta.id} className="flex items-center gap-4 px-4 py-3" data-tour="cfdi-pick-order-row">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{venta.orderNumber}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {cliente || '—'} · {formatDate(venta.completedAt ?? venta.createdAt)}
                  </div>
                  {venta.facturaEnCancelacion && (
                    <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">{t('pickOrder.cancellationPending')}</div>
                  )}
                </div>
                <span className="tabular-nums">{Currency(Number(venta.total))}</span>
                {venta.facturada ? (
                  <Badge variant="secondary" className="whitespace-nowrap">
                    {t('pickOrder.alreadyInvoiced')}
                  </Badge>
                ) : (
                  <Button size="sm" onClick={() => onSelect(venta.id)} aria-label={t('pickOrder.selectAria', { folio: venta.orderNumber })}>
                    {t('pickOrder.select')}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
        {hasNextPage && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
              {isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('pickOrder.loadMore')}
            </Button>
          </div>
        )}
      </>
    )
  }

  return (
    <FullScreenModal
      open={open}
      onClose={cerrar}
      title={t('pickOrder.title')}
      subtitle={t('pickOrder.subtitle')}
      contentClassName="bg-muted/30"
    >
      <div className="mx-auto max-w-2xl space-y-4 p-6" data-tour="cfdi-pick-order-dialog">
        {/* Lupa expandible, como en Pedidos y en Facturas (ui-patterns.md). */}
        <div className="relative flex items-center">
          {isSearchOpen ? (
            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape' && !searchTerm) setIsSearchOpen(false)
                  }}
                  placeholder={t('pickOrder.searchPlaceholder')}
                  aria-label={t('pickOrder.search')}
                  className="h-8 w-[280px] max-w-full rounded-full pl-8 pr-7 text-sm"
                  autoFocus
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label={t('pickOrder.clearSearch')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <Button
              variant={searchTerm ? 'secondary' : 'outline'}
              size="sm"
              className="h-8 cursor-pointer rounded-full"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="mr-1.5 h-3.5 w-3.5" />
              {t('pickOrder.search')}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t('pickOrder.searchHint')}</p>
        {contenido()}
      </div>
    </FullScreenModal>
  )
}
