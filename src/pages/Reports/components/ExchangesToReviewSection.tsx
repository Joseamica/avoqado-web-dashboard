import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import DataTable from '@/components/data-table'
import { PermissionGate } from '@/components/PermissionGate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { exchangeReviewReasonLabel, exchangeStatusLabel } from '@/lib/exchangeStatus'
import { exchangesKeys, listExchangesForReview, type ExchangeReviewRow } from '@/services/exchanges.service'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { ReviewExchangeDialog } from './ReviewExchangeDialog'

export function ExchangesToReviewSection(props: { pendingReview?: boolean; originalOrderId?: string } = {}) {
  const { venueId } = useCurrentVenue()
  return (
    <PermissionGate permission="payments:read">
      <ExchangeList key={venueId} {...props} />
    </PermissionGate>
  )
}

function ExchangeList({ pendingReview = true, originalOrderId }: { pendingReview?: boolean; originalOrderId?: string }) {
  const { t } = useTranslation('reports')
  const { t: paymentT } = useTranslation('payment')
  const { venueId, fullBasePath } = useCurrentVenue()
  const { formatDateTime } = useVenueDateTime()
  const [selected, setSelected] = useState<ExchangeReviewRow | null>(null)
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 })
  const filters = useMemo(() => ({ pendingReview, ...(originalOrderId ? { originalOrderId } : {}) }), [pendingReview, originalOrderId])
  const query = useInfiniteQuery({
    queryKey: exchangesKeys.review(venueId, filters),
    queryFn: ({ pageParam }) => listExchangesForReview(venueId, filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    enabled: !!venueId,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
  const rows = useMemo(
    () => [...new Map((query.data?.pages ?? []).flatMap(page => page.items).map(row => [row.id, row])).values()],
    [query.data],
  )
  const total = query.data?.pages[query.data.pages.length - 1]?.total ?? 0
  const columns = useMemo<ColumnDef<ExchangeReviewRow>[]>(
    () => [
      { id: 'date', header: t('refunds.columns.date'), cell: ({ row }) => formatDateTime(row.original.createdAt) },
      {
        id: 'orders',
        header: t('refunds.columns.order'),
        cell: ({ row: { original: row } }) => (
          <Link className="underline underline-offset-4" to={`${fullBasePath}/orders/${row.originalOrderId}`}>
            {t('refunds.exchangesToReview.orders', { original: row.originalOrderNumber ?? '—', next: row.newOrderNumber ?? '—' })}
          </Link>
        ),
      },
      {
        id: 'difference',
        header: t('refunds.exchangesToReview.difference'),
        cell: ({ row }) => Currency(row.original.differenceCents / 100),
      },
      {
        id: 'reason',
        header: t('refunds.columns.reason'),
        cell: ({ row }) => (row.original.reviewReason ? exchangeReviewReasonLabel(row.original.reviewReason, paymentT) : '—'),
      },
      { id: 'staff', header: t('refunds.exchangesToReview.staff'), cell: ({ row }) => row.original.staffName ?? '—' },
      {
        id: 'status',
        header: t('refunds.exchangesToReview.status'),
        cell: ({ row }) => (
          <div className="space-y-1">
            <Badge variant="outline">{exchangeStatusLabel(row.original.status, paymentT)}</Badge>
            {row.original.status === 'NEEDS_REVIEW' && row.original.reviewedAt && (
              <Badge variant="secondary">{paymentT('exchange.reviewed')}</Badge>
            )}
          </div>
        ),
      },
      {
        id: 'review',
        cell: ({ row }) =>
          row.original.status === 'NEEDS_REVIEW' &&
          !row.original.reviewedAt && (
            <PermissionGate permission="payments:refund">
              <Button
                variant="outline"
                size="sm"
                data-tour="exchange-mark-reviewed"
                disabled={query.isPlaceholderData}
                onClick={() => setSelected(row.original)}
              >
                {t('refunds.exchangesToReview.markReviewed')}
              </Button>
            </PermissionGate>
          ),
      },
    ],
    [t, paymentT, formatDateTime, fullBasePath, query.isPlaceholderData],
  )

  return (
    <section
      className="rounded-2xl border border-input bg-card p-4 space-y-4"
      data-tour="exchanges-to-review"
      aria-label={t(pendingReview ? 'refunds.exchangesToReview.title' : 'refunds.exchangesToReview.all')}
    >
      <h2 className="text-lg font-semibold">{t(pendingReview ? 'refunds.exchangesToReview.title' : 'refunds.exchangesToReview.all')}</h2>
      {query.isPending && <p role="status">{t('refunds.exchangesToReview.loading')}</p>}
      {query.isPlaceholderData && <p role="status">{t('refunds.exchangesToReview.updating')}</p>}
      {query.isError && (
        <div role="alert" className="space-y-2">
          <p>{t('refunds.exchangesToReview.loadError')}</p>
          <Button
            variant="outline"
            onClick={() => {
              void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())
            }}
            disabled={query.isFetching}
          >
            {t('refunds.exchangesToReview.retry')}
          </Button>
        </div>
      )}
      {!query.isPending && !query.isError && !query.isPlaceholderData && rows.length === 0 && (
        <p>{t(pendingReview ? 'refunds.exchangesToReview.empty' : 'refunds.exchangesToReview.noMatches')}</p>
      )}
      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          rowCount={total}
          getRowId={row => row.id}
          pagination={pagination}
          setPagination={setPagination}
          hidePagination
          showColumnCustomizer={false}
        />
      )}
      {query.data && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{t('refunds.exchangesToReview.showing', { shown: rows.length, total })}</p>
          {query.hasNextPage && (
            <Button
              variant="outline"
              data-tour="exchanges-load-more"
              disabled={query.isFetching || query.isPlaceholderData}
              onClick={() => {
                void query.fetchNextPage()
              }}
            >
              {t(query.isFetchingNextPage ? 'refunds.exchangesToReview.loading' : 'refunds.exchangesToReview.loadMore')}
            </Button>
          )}
        </div>
      )}
      {selected && (
        <PermissionGate permission="payments:refund">
          <ReviewExchangeDialog key={`${venueId}:${selected.id}`} venueId={venueId} exchange={selected} onClose={() => setSelected(null)} />
        </PermissionGate>
      )}
    </section>
  )
}
