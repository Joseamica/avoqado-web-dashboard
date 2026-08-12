import { useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FilterPill, SingleSelectFilterContent } from '@/components/filters'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useVenueDateTime } from '@/utils/datetime'
import {
  getExternalIncidents,
  type ExternalIncidentKind,
  type ExternalIncidentStatus,
  type FulfillmentArea,
} from '@/services/areaTickets.service'
import { DateRangeFilterContent, type DateRangeValue } from './DateRangeFilterContent'
import { IncidentDetailSummary, IncidentStatusBadge } from './externalQueueDisplay'

const apiError = (error: any, fallback: string): string => error?.response?.data?.message ?? error?.response?.data?.error ?? fallback

const INCIDENT_KINDS: ExternalIncidentKind[] = ['UNCONFIRMED_CHARGE', 'AMOUNT_VARIANCE', 'NEGATIVE_STOCK', 'CODE_MISMATCH', 'REPRINT_RISK']
const INCIDENT_STATUSES: ExternalIncidentStatus[] = ['OPEN', 'RESOLVED', 'DISMISSED']

/**
 * Cola "Incidencias" (§caja externa fase 1, Task 15) — SOLO lectura. El default
 * (`status=OPEN`) es el trabajo pendiente de verdad; RESOLVED/DISMISSED sólo se ven
 * si alguien los pide con el filtro (historial, no la cola del día a día). Una
 * incidencia abierta NUNCA bloquea el piso — esta pantalla sólo la hace visible.
 */
export function IncidentsQueue({ venueId, areas }: { venueId: string; areas: FulfillmentArea[] }) {
  const { t } = useTranslation('settings')
  const { formatDateTime } = useVenueDateTime()
  const [areaId, setAreaId] = useState<string | null>(null)
  const [kind, setKind] = useState<ExternalIncidentKind | null>(null)
  const [status, setStatus] = useState<ExternalIncidentStatus | null>('OPEN')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: null, to: null })

  const query = useInfiniteQuery({
    queryKey: ['area-ticket-external-incidents', venueId, areaId, kind, status, dateRange.from, dateRange.to],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      getExternalIncidents(venueId, { areaId, kind, status, dateFrom: dateRange.from, dateTo: dateRange.to, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => last.nextCursor ?? undefined,
    enabled: Boolean(venueId),
  })

  const items = useMemo(() => query.data?.pages.flatMap(page => page.items) ?? [], [query.data?.pages])
  const isDefaultView = status === 'OPEN' && !areaId && !kind && !dateRange.from && !dateRange.to

  const areaOptions = useMemo(() => areas.map(area => ({ value: area.id, label: area.name })), [areas])
  const kindOptions = useMemo(
    () => INCIDENT_KINDS.map(value => ({ value, label: t(`areaTickets.externalSettlements.incidentKind.${value}`) })),
    [t],
  )
  const statusOptions = useMemo(
    () => INCIDENT_STATUSES.map(value => ({ value, label: t(`areaTickets.externalSettlements.incidentStatus.${value}`) })),
    [t],
  )
  const areaLabel = areaId ? (areas.find(area => area.id === areaId)?.name ?? null) : null
  const kindLabel = kind ? t(`areaTickets.externalSettlements.incidentKind.${kind}`) : null
  const statusLabel = status ? t(`areaTickets.externalSettlements.incidentStatus.${status}`) : null
  const dateLabel = dateRange.from || dateRange.to ? [dateRange.from, dateRange.to].filter(Boolean).join(' – ') : null

  return (
    <div className="space-y-4">
      <Alert className="border-input bg-muted/40">
        <AlertDescription className="text-sm text-muted-foreground">
          {t('areaTickets.externalSettlements.incidentDisclaimer')}
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
        <FilterPill label={t('areaTickets.externalSettlements.filters.kind')} activeLabel={kindLabel} onClear={() => setKind(null)}>
          <SingleSelectFilterContent
            title={t('areaTickets.externalSettlements.filters.kind')}
            options={kindOptions}
            selectedValue={kind}
            onSelect={value => setKind(value as ExternalIncidentKind)}
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
            onSelect={value => setStatus(value as ExternalIncidentStatus)}
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
                  <TableHead>{t('areaTickets.externalSettlements.incidentColumns.ticket')}</TableHead>
                  <TableHead>{t('areaTickets.externalSettlements.incidentColumns.kind')}</TableHead>
                  <TableHead>{t('areaTickets.externalSettlements.incidentColumns.detail')}</TableHead>
                  <TableHead>{t('areaTickets.externalSettlements.incidentColumns.status')}</TableHead>
                  <TableHead>{t('areaTickets.externalSettlements.incidentColumns.openedAt')}</TableHead>
                  <TableHead>{t('areaTickets.externalSettlements.incidentColumns.resolvedBy')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id} className="border-input">
                    <TableCell>
                      <div className="font-mono text-sm">{item.areaTicket?.code ?? t('areaTickets.externalSettlements.noValue')}</div>
                      <div className="text-xs text-muted-foreground">{item.area?.name ?? t('areaTickets.externalSettlements.noValue')}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{t(`areaTickets.externalSettlements.incidentKind.${item.kind}`)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <IncidentDetailSummary kind={item.kind} detail={item.detail} />
                      {item.occurrenceCount > 1 && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {t('areaTickets.externalSettlements.reopenedCount', { count: item.occurrenceCount })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <IncidentStatusBadge status={item.status} label={t(`areaTickets.externalSettlements.incidentStatus.${item.status}`)} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(item.openedAt)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.resolvedBy ?? t('areaTickets.externalSettlements.noValue')}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      {isDefaultView
                        ? t('areaTickets.externalSettlements.incidentEmptyDefault')
                        : t('areaTickets.externalSettlements.incidentEmptyFiltered')}
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
