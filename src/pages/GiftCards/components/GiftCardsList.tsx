import { useCallback, useMemo, useState } from 'react'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Search, WalletCards, X } from 'lucide-react'
import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterPill } from '@/components/filters/FilterPill'
import { CheckboxFilterContent } from '@/components/filters/CheckboxFilterContent'
import { useDebounce } from '@/hooks/useDebounce'
import { GIFT_CARDS_PAGE_SIZE, useGiftCardList, type GiftCardListFilters } from '@/hooks/use-gift-cards'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { GIFT_CARD_FILTER_STATUSES, type GiftCardListStatus, type GiftCardRow } from '@/types/giftCard'
import { estadoVisible, textoDelServidorConCodigo, ultimos4, varianteDeEstado } from '../giftCardText'
import { GiftCardDetailSheet } from './GiftCardDetailSheet'

/**
 * La lista de tarjetas: paginada, buscada y filtrada EN EL SERVER (bounded-data-and-query-load.md). Nunca baja todas.
 * Las filas son las de C4 tal cual (F3): `last4`, `order`, montos en pesos.
 * - Totales del agregado del server para el filtro actual (`total` y `totalBalance`), nunca la suma de lo cargado.
 * - `keepPreviousData` en el hook + `isPlaceholderData` aquí: mientras llega la respuesta de una búsqueda nueva se ve la
 *   anterior con «Actualizando…», sin concluir «sin resultados» ni desmontar el buscador (foco y teclado se quedan).
 * - Cargando ≠ vacío ≠ sin resultados ≠ error: cuatro estados distintos, cada uno con su texto. Con filas ya cargadas, un
 *   fallo (TanStack v5 conserva `data` y prende `isError`) NO las tapa: se avisa en el pie. Con un filtro puesto, el buscador
 *   y los filtros se quedan aunque falle (si no, la persona no podría cambiar lo que falló).
 * - Errores sin `code` ⇒ el texto genérico (notas 10 y 12 del coordinador), nunca el `message` crudo.
 * - Clic en una fila ⇒ la hoja de detalle (sólo lectura + acciones del gerente).
 */
export function GiftCardsList({ venueId }: { venueId: string }) {
  const { t } = useTranslation('giftCards')
  const { formatDate } = useVenueDateTime()
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [statuses, setStatuses] = useState<GiftCardListStatus[]>([])
  const [abierta, setAbierta] = useState<string | null>(null)
  const debouncedSearch = useDebounce(searchTerm.trim(), 300)
  // Estados ordenados: el mismo filtro en otro orden es la MISMA clave (no una consulta de más).
  const filters = useMemo<GiftCardListFilters>(() => ({ search: debouncedSearch, status: [...statuses].sort() }), [debouncedSearch, statuses])
  const query = useGiftCardList(venueId, filters)
  const stale = query.isPlaceholderData

  /** El server pagina por desplazamiento: una venta nueva entre páginas repite una fila; se deduplica por id. */
  const cards = useMemo<GiftCardRow[]>(() => {
    const vistos = new Set<string>()
    const filas: GiftCardRow[] = []
    for (const p of query.data?.pages ?? []) {
      for (const c of p.items) {
        if (vistos.has(c.id)) continue
        vistos.add(c.id)
        filas.push(c)
      }
    }
    return filas
  }, [query.data])
  const paginas = query.data?.pages
  const ultima = paginas && paginas.length > 0 ? paginas[paginas.length - 1] : undefined
  const total = ultima?.total ?? 0

  // Paginación manual: la manda el server; DataTable no debe volver a rebanar las filas.
  const [tablePagination, setTablePagination] = useState<PaginationState>({ pageIndex: 0, pageSize: GIFT_CARDS_PAGE_SIZE })

  const statusOptions = useMemo(() => GIFT_CARD_FILTER_STATUSES.map(s => ({ value: s, label: t(`status.${s}`) })), [t])
  const statusLabel = statuses.length > 0 ? statuses.map(s => t(`status.${s}`)).join(', ') : null

  const columns = useMemo<ColumnDef<GiftCardRow>[]>(
    () => [
      {
        id: 'code',
        header: t('list.columns.code'),
        cell: ({ row }) => <span className="font-mono text-sm">{ultimos4(row.original.last4)}</span>,
      },
      {
        id: 'status',
        header: t('list.columns.status'),
        cell: ({ row }) => {
          const estado = estadoVisible(row.original)
          return (
            <div className="space-y-1">
              {/* El motivo del bloqueo sólo se ve en el detalle (la lista del server no lo trae; decisión 1 del coordinador). */}
              <Badge variant={varianteDeEstado(estado)}>{t(`status.${estado}`)}</Badge>
            </div>
          )
        },
      },
      {
        id: 'balance',
        header: t('list.columns.balance'),
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium tabular-nums">{Currency(row.original.balance)}</p>
            <p className="text-xs text-muted-foreground">{t('list.balanceOf', { amount: Currency(row.original.initialAmount) })}</p>
          </div>
        ),
      },
      {
        id: 'recipient',
        header: t('list.columns.recipient'),
        cell: ({ row }) => {
          const r = row.original
          return <span className="text-sm">{r.customer?.name ?? r.recipientName ?? r.purchaserName ?? t('list.noName')}</span>
        },
      },
      {
        id: 'soldAt',
        header: t('list.columns.soldAt'),
        cell: ({ row }) => <span className="text-sm">{formatDate(row.original.activatedAt ?? row.original.createdAt)}</span>,
      },
      {
        id: 'expiresAt',
        header: t('list.columns.expiresAt'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.expiresAt ? formatDate(row.original.expiresAt) : t('list.noExpiry')}</span>
        ),
      },
      {
        id: 'folio',
        header: t('list.columns.folio'),
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.order?.orderNumber ?? t('list.noName')}</span>,
      },
    ],
    [t, formatDate],
  )

  const abrir = useCallback((row: GiftCardRow) => setAbierta(row.id), [])
  const hasFilters = !!debouncedSearch || statuses.length > 0
  const clearAll = () => {
    setSearchTerm('')
    setIsSearchOpen(false)
    setStatuses([])
  }

  // Un fallo NO es «no hay tarjetas»: se dice y se ofrece reintentar. Con filas ya cargadas, se avisa en el pie.
  const loadFailed = query.isError && cards.length === 0
  const isEmpty = !query.isLoading && !loadFailed && !stale && cards.length === 0
  const errorText = textoDelServidorConCodigo(query.error) ?? t('errors.generic')

  return (
    <div className="space-y-3">
      {(hasFilters || (!loadFailed && !isEmpty)) && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex items-center">
            {isSearchOpen ? (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('list.searchPlaceholder')}
                    aria-label={t('list.searchPlaceholder')}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Escape' && !searchTerm) setIsSearchOpen(false)
                    }}
                    className="h-8 w-[280px] rounded-full pl-8 pr-8 text-sm"
                    data-tour="gift-cards-search"
                    autoFocus
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 cursor-pointer rounded-full"
                  aria-label={t('list.clearSearch')}
                  onClick={() => {
                    setSearchTerm('')
                    setIsSearchOpen(false)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant={searchTerm ? 'secondary' : 'ghost'}
                size="icon"
                className="relative h-8 w-8 cursor-pointer rounded-full"
                aria-label={t('list.searchPlaceholder')}
                onClick={() => setIsSearchOpen(true)}
                data-tour="gift-cards-search-open"
              >
                <Search className="h-4 w-4" />
                {searchTerm && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />}
              </Button>
            )}
          </div>

          <FilterPill label={t('list.statusFilter')} activeValue={statusLabel} isActive={statuses.length > 0} onClear={() => setStatuses([])}>
            <CheckboxFilterContent
              title={t('list.statusFilterTitle')}
              options={statusOptions}
              selectedValues={statuses}
              onApply={v => setStatuses(v as GiftCardListStatus[])}
              applyLabel={t('list.apply')}
              clearLabel={t('list.clear')}
            />
          </FilterPill>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="cursor-pointer" onClick={clearAll}>
              {t('list.clearFilters')}
            </Button>
          )}

          <span className="ml-auto text-sm text-muted-foreground" data-tour="gift-cards-totals">
            {stale
              ? t('list.updating')
              : ultima
                ? t('list.totals', { count: ultima.total, amount: Currency(ultima.totalBalance) })
                : null}
          </span>
        </div>
      )}

      {loadFailed ? (
        <div
          role="alert"
          className="flex flex-col items-center justify-center rounded-lg border border-dashed border-destructive/40 bg-muted/30 px-6 py-16 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-destructive">{t('list.loadError')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{errorText}</p>
          <Button variant="outline" size="sm" className="mt-4 cursor-pointer" onClick={() => void query.refetch()} data-tour="gift-cards-retry">
            {t('list.retry')}
          </Button>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-input bg-muted/30 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <WalletCards className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">{hasFilters ? t('list.noResults') : t('list.emptyTitle')}</h3>
          {hasFilters ? (
            <Button variant="ghost" size="sm" className="mt-2 cursor-pointer" onClick={clearAll}>
              {t('list.clearFilters')}
            </Button>
          ) : (
            <p className="mt-2 max-w-md text-sm text-muted-foreground">{t('list.emptyBody')}</p>
          )}
        </div>
      ) : (
        <DataTable<GiftCardRow>
          columns={columns}
          data={cards}
          rowCount={cards.length}
          isLoading={query.isLoading}
          pagination={tablePagination}
          setPagination={setTablePagination}
          onRowClick={abrir}
          showColumnCustomizer={false}
          hidePagination
          tableId="gift-cards"
          footer={
            // Ni con el esqueleto de la primera carga (lote ⭐): hoy DataTable no pinta el pie mientras carga; esto no depende de eso.
            !stale &&
            !query.isLoading && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
                <div className="space-y-0.5">
                  <span>{t('list.showing', { shown: cards.length, total })}</span>
                  {query.isError && (
                    <p role="alert" className="text-destructive">
                      {errorText}
                    </p>
                  )}
                </div>
                {query.hasNextPage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => void query.fetchNextPage()}
                    disabled={query.isFetchingNextPage}
                  >
                    {query.isFetchingNextPage && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    {t('list.loadMore')}
                  </Button>
                ) : (
                  // Se acabaron las páginas pero faltan filas (una venta nueva desplazó la lista) o la relectura falló:
                  // volver a empezar sí las trae.
                  (cards.length < total || query.isError) && (
                    <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => void query.refetch()} disabled={query.isFetching}>
                      {t('list.refresh')}
                    </Button>
                  )
                )}
              </div>
            )
          }
        />
      )}

      {abierta && <GiftCardDetailSheet venueId={venueId} giftCardId={abierta} onClose={() => setAbierta(null)} />}
    </div>
  )
}
