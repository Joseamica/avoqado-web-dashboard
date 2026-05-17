import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format, type Locale } from 'date-fns'
import { es, enUS, fr } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import googleCalendarService, {
  type DeadLetterRow,
  type DeadLetterSource,
} from '@/services/googleCalendar.service'

// ----------------------------------------------------------------------------
// Dead-letter banner — surfaces outbox rows that failed to push to Google
// Calendar after exhausting their retry budget. Shows ONLY when the count > 0.
//
// Two responsibilities:
//   1. Background poll (every 5 min) for the dead-letter count via the same
//      paginated endpoint (first page only — `rows.length > 0` is the signal).
//   2. Modal interaction for triage: list of failed rows + per-row Reintentar
//      button. Pagination via cursor.
//
// Permission: backend gates the list on `calendar:view_status` and the retry
// on `calendar:manage_venue`. We don't permission-gate the UI here — if the
// user lacks calendar:view_status the count query just 401/403s and the
// banner stays hidden.
// ----------------------------------------------------------------------------

type DeadLetterBannerProps = {
  venueId: string
}

function localeFor(lang: string) {
  if (lang.startsWith('fr')) return fr
  if (lang.startsWith('en')) return enUS
  return es
}

// Short row label: confirmation code + display name for reservations,
// session title for class sessions, the raw id for unknown.
function describeSource(source: DeadLetterSource): string {
  if (source.kind === 'reservation') {
    const name = source.displayName?.trim()
    return name ? `${source.confirmationCode} — ${name}` : source.confirmationCode
  }
  if (source.kind === 'classSession') {
    return source.title
  }
  return source.id
}

function sourceDate(source: DeadLetterSource): string | null {
  if (source.kind === 'reservation' || source.kind === 'classSession') {
    return source.startsAt
  }
  return null
}

export function GoogleCalendarDeadLetterBanner({ venueId }: DeadLetterBannerProps) {
  const { t, i18n } = useTranslation('googleCalendar')
  const [modalOpen, setModalOpen] = useState(false)
  const dateLocale = localeFor(i18n.language)

  // ---------------------------------------------------------------------------
  // Lightweight count probe — first page only, on a 5-minute refetch interval.
  // This is the "is the banner visible at all?" signal. The full paginated
  // list lives inside the modal and only fires when the modal opens.
  // ---------------------------------------------------------------------------
  const { data: probeData } = useQuery({
    queryKey: ['gcal-dead-letter-count', venueId],
    queryFn: () => googleCalendarService.listDeadLetter(venueId, { limit: 50 }),
    enabled: !!venueId,
    refetchInterval: 5 * 60_000,
    // Stale time = poll interval so manual refocus doesn't trigger an extra fetch.
    staleTime: 5 * 60_000,
  })

  const rowCount = probeData?.rows.length ?? 0
  // The probe is capped at 50 rows. If the cursor is present, total is "50+".
  const hasMore = !!probeData?.nextCursor
  if (rowCount === 0) return null

  return (
    <>
      <div
        role="alert"
        className="flex items-start gap-3 rounded-md border border-red-500/40 bg-red-50 p-3 text-sm dark:border-red-500/30 dark:bg-red-950/40"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
        <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
          <p className="text-red-900 dark:text-red-100">
            {rowCount === 1
              ? t('deadLetter.bannerSingular')
              : hasMore
                ? // "50+" beats showing exactly 50 — the user knows there are
                  // more on the next page. We pre-format and substitute into
                  // the plural template by hand so we don't violate i18n's
                  // numeric `count` contract.
                  t('deadLetter.bannerPlural', { count: rowCount }).replace(
                    String(rowCount),
                    `${rowCount}+`,
                  )
                : t('deadLetter.bannerPlural', { count: rowCount })}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-red-500/40 bg-background text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900"
            onClick={() => setModalOpen(true)}
          >
            {t('deadLetter.viewDetails')}
          </Button>
        </div>
      </div>

      <DeadLetterModal
        venueId={venueId}
        open={modalOpen}
        onOpenChange={setModalOpen}
        dateLocale={dateLocale}
        t={t}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Modal — paginated table + per-row retry mutation. Split into its own
// component so React Query's useInfiniteQuery only runs when the modal opens
// (we gate `enabled` on `open`).
// ---------------------------------------------------------------------------
function DeadLetterModal({
  venueId,
  open,
  onOpenChange,
  dateLocale,
  t,
}: {
  venueId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  dateLocale: Locale
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [retryingId, setRetryingId] = useState<string | null>(null)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['gcal-dead-letter-list', venueId],
    queryFn: ({ pageParam }) =>
      googleCalendarService.listDeadLetter(venueId, {
        limit: 50,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    enabled: open && !!venueId,
  })

  const rows: DeadLetterRow[] = data?.pages.flatMap(p => p.rows) ?? []

  const retryMutation = useMutation({
    mutationFn: (rowId: string) => googleCalendarService.retryDeadLetterRow(venueId, rowId),
    onMutate: rowId => {
      setRetryingId(rowId)
    },
    onSuccess: () => {
      toast({ title: t('deadLetter.toast.retrySuccess') })
      // Refresh both the modal list AND the banner count probe so the banner
      // disappears immediately when the last failed row is rescheduled.
      queryClient.invalidateQueries({ queryKey: ['gcal-dead-letter-list', venueId] })
      queryClient.invalidateQueries({ queryKey: ['gcal-dead-letter-count', venueId] })
    },
    onError: (err: any) => {
      const status = err?.response?.status
      if (status === 409) {
        toast({ variant: 'destructive', title: t('deadLetter.toast.retryConflict') })
        // Force refetch to reflect the new state on screen.
        refetch()
        queryClient.invalidateQueries({ queryKey: ['gcal-dead-letter-count', venueId] })
      } else {
        toast({
          variant: 'destructive',
          title: t('deadLetter.toast.retryFailed'),
          description: err?.response?.data?.message,
        })
      }
    },
    onSettled: () => {
      setRetryingId(null)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('deadLetter.modalTitle')}</DialogTitle>
          <DialogDescription>{t('deadLetter.bannerPlural', { count: rows.length })}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('deadLetter.empty')}</p>
        ) : (
          <>
            <div className="max-h-[60vh] overflow-auto rounded-md border border-input">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">{t('deadLetter.colDate')}</TableHead>
                    <TableHead>{t('deadLetter.colReservation')}</TableHead>
                    <TableHead>{t('deadLetter.colError')}</TableHead>
                    <TableHead className="w-28 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => {
                    const date = sourceDate(row.source)
                    const dateStr = date ? format(new Date(date), 'PP p', { locale: dateLocale }) : '—'
                    const isRetrying = retryingId === row.id
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs">{dateStr}</TableCell>
                        <TableCell className="text-sm">{describeSource(row.source)}</TableCell>
                        <TableCell className="max-w-xs text-xs text-muted-foreground">
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block truncate cursor-help">{row.lastError ?? '—'}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="start" className="max-w-md text-xs">
                                {row.lastError ?? '—'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isRetrying || retryMutation.isPending}
                            onClick={() => retryMutation.mutate(row.id)}
                            className="h-8 gap-1"
                          >
                            {isRetrying ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {t('deadLetter.actions.retrying')}
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-3 w-3" />
                                {t('deadLetter.actions.retry')}
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {hasNextPage && (
              <div className="flex justify-center pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                  ) : null}
                  {t('deadLetter.pagination.loadMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default GoogleCalendarDeadLetterBanner
