import { useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FilterPill, SingleSelectFilterContent } from '@/components/filters'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useVenueDateTime } from '@/utils/datetime'
import {
  getExternalSettlements,
  type ExternalSettlementStatus,
  type FulfillmentArea,
} from '@/services/areaTickets.service'
import { DateRangeFilterContent, type DateRangeValue } from './DateRangeFilterContent'
import { SettlementStatusBadge, VarianceValue } from './externalQueueDisplay'

const apiError = (error: any, fallback: string): string => error?.response?.data?.message ?? error?.response?.data?.error ?? fallback

const SETTLEMENT_STATUSES: ExternalSettlementStatus[] = ['PENDING', 'ASSUMED', 'CONFIRMED', 'DISCREPANCY', 'NOT_CHARGED']

/**
 * Cola "Cobros por confirmar" (§caja externa fase 1, Task 15) — SOLO lectura. El
 * default (`status=PENDING`) es a propósito el mismo criterio que
 * `listPendingExternalConfirmation` en el server: cobros que de verdad les falta
 * una confirmación humana. ASSUMED queda fuera del default porque esa política se
 * eligió PARA no exigir confirmación — el filtro de estado deja verlo si alguien
 * lo pide, nunca lo mete solo.
 */
export function SettlementsQueue({ venueId, areas }: { venueId: string; areas: FulfillmentArea[] }) {
  const { t } = useTranslation('settings')
  const { formatDateTime } = useVenueDateTime()
  const [areaId, setAreaId] = useState<string | null>(null)
  const [status, setStatus] = useState<ExternalSettlementStatus | null>('PENDING')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: null, to: null })

  const query = useInfiniteQuery({
    queryKey: ['area-ticket-external-settlements', venueId, areaId, status, dateRange.from, dateRange.to],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      getExternalSettlements(venueId, { areaId, status, dateFrom: dateRange.from, dateTo: dateRange.to, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => last.nextCursor ?? undefined,
    enabled: Boolean(venueId),
  })

  const items = useMemo(() => query.data?.pages.flatMap(page => page.items) ?? [], [query.data?.pages])
  const isDefaultView = status === 'PENDING' && !areaId && !dateRange.from && !dateRange.to

  const areaOptions = useMemo(() => areas.map(area => ({ value: area.id, label: area.name })), [areas])
  const statusOptions = useMemo(
    () => SETTLEMENT_STATUSES.map(value => ({ value, label: t(`areaTickets.externalSettlements.settlementStatus.${value}`) })),
    [t],
  )
  const areaLabel = areaId ? (areas.find(area => area.id === areaId)?.name ?? null) : null
  const statusLabel = status ? t(`areaTickets.externalSettlements.settlementStatus.${status}`) : null
  const dateLabel = dateRange.from || dateRange.to ? [dateRange.from, dateRange.to].filter(Boolean).join(' – ') : null

  return (
    <div className="space-y-4">
      <Alert className="border-input bg-muted/40">
        <AlertDescription className="text-sm text-muted-foreground">
          {t('areaTickets.externalSettlements.referenceDisclaimer')}
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center gap-2">
        <FilterPill label={t('areaTickets.externalSettlements.filters.area')} activeLabel={areaLabel} onClear={() => setAreaId(null)}>
          <SingleSelectFilterContent
            title={t('areaTickets.externalSettlements.filters.area')}
            options={areaOptions}
            selectedValue={areaId}
            onSelect={setAreaId}
            searchable
            emptyLabel={t('areaTickets.externalSettlements.filters.noAreas')}
          />
        </FilterPill>
        <FilterPill
          label={t('areaTickets.externalSettlements.filters.status')}
          activeLabel={statusLabel}
          onClear={() => setStatus(null)}
        >
          <SingleSelectFilterContent
            title={t('areaTickets.externalSettlements.filters.status')}
            options={statusOptions}
            selectedValue={status}
            onSelect={value => setStatus(value as ExternalSettlementStatus)}
          />
        </FilterPill>
        <FilterPill label={t('areaTickets.externalSettlements.filters.date')} activeLabel={dateLabel} onClear={() => setDateRange({ from: null, to: null })}>
          <DateRangeFilterContent
            title={t('areaTickets.externalSettlements.filters.date')}
            value={dateRange}
            onApply={setDateRange}
            labels={{
              from: t('areaTickets.externalSettlements.filters.dateFrom'),
              to: t('areaTickets.externalSettlements.filters.dateTo'),
              apply: t('areaTickets.externalSettlements.filters.apply'),
              clear: t('areaTickets.externalSettlements.filters.clear'),
            }}
          />
        </FilterPill>
      </div>

      {query.isLoading && (
        <div className="flex min-h-40 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> {t('areaTickets.externalSettlements.loading')}
        </div>
      )}

      {query.isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('areaTickets.externalSettlements.loadError')}</AlertTitle>
          <AlertDescription>{apiError(query.error, t('areaTickets.externalSettlements.loadErrorFallback'))}</AlertDescription>
        </Alert>
      )}

      {!query.isLoading && !query.isError && (
        <Card className="border-input shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-input">
                  <TableHead>{t('areaTickets.externalSettlements.columns.ticket')}</TableHead>
                  <TableHead>{t('areaTickets.externalSettlements.columns.referenceAmount')}</TableHead>
                  <TableHead>{t('areaTickets.externalSettlements.columns.externalAmount')}</TableHead>
                  <TableHead>{t('areaTickets.externalSettlements.columns.variance')}</TableHead>
                  <TableHead>{t('areaTickets.externalSettlements.columns.status')}</TableHead>
                  <TableHead>{t('areaTickets.externalSettlements.columns.confirmedBy')}</TableHead>
                  <TableHead>{t('areaTickets.externalSettlements.columns.issuedAt')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id} className="border-input">
                    <TableCell>
                      <div className="font-mono text-sm">{item.areaTicket.code}</div>
                      <div className="text-xs text-muted-foreground">{item.area?.name ?? t('areaTickets.externalSettlements.noValue')}</div>
                    </TableCell>
                    <TableCell className="tabular-nums">${item.referenceAmount}</TableCell>
                    <TableCell className="tabular-nums">
                      {item.externalAmount ? `$${item.externalAmount}` : t('areaTickets.externalSettlements.noValue')}
                    </TableCell>
                    <TableCell>
                      <VarianceValue variance={item.variance} />
                    </TableCell>
                    <TableCell>
                      <SettlementStatusBadge
                        status={item.status}
                        label={t(`areaTickets.externalSettlements.settlementStatus.${item.status}`)}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.confirmedBy ?? t('areaTickets.externalSettlements.noValue')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(item.areaTicket.issuedAt)}</TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      {isDefaultView
                        ? t('areaTickets.externalSettlements.emptyDefault')
                        : t('areaTickets.externalSettlements.emptyFiltered')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {query.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('areaTickets.externalSettlements.loadMore')}
          </Button>
        </div>
      )}
    </div>
  )
}
