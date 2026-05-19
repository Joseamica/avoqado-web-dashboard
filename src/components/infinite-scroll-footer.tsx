import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Download, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface InfiniteScrollFooterProps {
  /** Total rows currently loaded in the table */
  loadedCount: number
  /** Total rows the server reports match the current filters (may be undefined while first fetch is in-flight) */
  totalCount?: number
  /** Whether the server has more pages */
  hasMore: boolean
  /** Whether a page fetch is currently in flight */
  isFetching: boolean
  /** Trigger a fetch for the next page */
  onLoadMore: () => void
  /** Optional callback exposed when the hard cap is reached. If provided, the "Para más resultados, usa Exportar" hint becomes a button. */
  onExportClick?: () => void
  /** Soft cap — auto-fetch on scroll stops here; user must click "Cargar más" to keep going */
  softCap?: number
  /** Hard cap — no more loading; user is pointed to export instead */
  hardCap?: number
  /** Hide the footer entirely while empty/initial loading is rendered by the table itself */
  hidden?: boolean
}

/**
 * Footer for infinite-scroll listings.
 *
 * Behavior:
 * 1. Below `softCap` rows: an IntersectionObserver sentinel auto-fetches the next page as the user scrolls.
 * 2. At `softCap`: a "Cargar más" button replaces auto-fetch — user must opt in to load more.
 * 3. At `hardCap`: a hint message points the user to export instead.
 *
 * Pattern follows Stripe/Linear — protects the DOM from runaway row counts and steers bulk needs to export.
 */
export function InfiniteScrollFooter({
  loadedCount,
  totalCount,
  hasMore,
  isFetching,
  onLoadMore,
  onExportClick,
  softCap = 500,
  hardCap = 1000,
  hidden = false,
}: InfiniteScrollFooterProps) {
  const { t } = useTranslation()
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Auto-fetch via IntersectionObserver only while we're under the soft cap.
  const autoFetchActive = hasMore && !isFetching && loadedCount < softCap

  useEffect(() => {
    if (!autoFetchActive) return
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) onLoadMore()
      },
      { rootMargin: '200px 0px' }, // start fetching ~200px before the sentinel enters the viewport
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [autoFetchActive, onLoadMore])

  if (hidden) return null

  // Helpful counter shown in every state. Uses totalCount when known.
  const counter =
    totalCount !== undefined
      ? t('infiniteScroll.showingOf', { loaded: loadedCount, total: totalCount, defaultValue: 'Mostrando {{loaded}} de {{total}}' })
      : t('infiniteScroll.showing', { loaded: loadedCount, defaultValue: 'Mostrando {{loaded}}' })

  // 1. No more rows to load — terminal state.
  if (!hasMore) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
        <span>{counter}</span>
      </div>
    )
  }

  // 2. Hard cap reached — stop loading, point to export.
  if (loadedCount >= hardCap) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <span>{counter}</span>
        {onExportClick ? (
          <Button variant="outline" size="sm" onClick={onExportClick} className="gap-2">
            <Download className="h-4 w-4" />
            {t('infiniteScroll.exportForMore', { defaultValue: 'Para más resultados, usa Exportar' })}
          </Button>
        ) : (
          <span>{t('infiniteScroll.exportForMore', { defaultValue: 'Para más resultados, usa Exportar' })}</span>
        )}
      </div>
    )
  }

  // 3. Loading state (auto-fetch or button click) — show spinner.
  if (isFetching) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground" ref={sentinelRef}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{t('loading')}</span>
      </div>
    )
  }

  // 4. Soft cap reached — manual "Cargar más" to extend to hard cap.
  if (loadedCount >= softCap) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
        <span>{counter}</span>
        <Button variant="outline" size="sm" onClick={onLoadMore} className="gap-2" data-tour="listings-load-more-btn">
          <ChevronDown className="h-4 w-4" />
          {t('infiniteScroll.loadMore', { defaultValue: 'Cargar más' })}
        </Button>
      </div>
    )
  }

  // 5. Default — sentinel for auto-fetch, plus a manual fallback for keyboard / no-scroll users.
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-4 text-sm text-muted-foreground" ref={sentinelRef}>
      <span>{counter}</span>
      <Button variant="ghost" size="sm" onClick={onLoadMore} className="gap-2">
        <ChevronDown className="h-4 w-4" />
        {t('infiniteScroll.loadMore', { defaultValue: 'Cargar más' })}
      </Button>
    </div>
  )
}
