/**
 * BankAccountMovementsSheet — estado de cuenta de una cuenta bancaria conectada.
 * 4 tarjetas de totales por categoría (SPEI in/out, transferencias, dispersiones)
 * + tabla paginada de movimientos, con rango de fechas preseleccionable.
 * Solo lectura. Montos honestos: null → '—', jamás $0.
 */
import { useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowDownLeft, ArrowUpRight, Landmark, Loader2, Repeat, Send } from 'lucide-react'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Currency } from '@/utils/currency'
import {
  financialConnectionAPI,
  type FinancialAccountSummary,
  type MovementCategoryStats,
} from '@/services/financialConnection.service'

const PAGE_SIZE = 10
const RANGE_PRESETS = [7, 30, 90] as const
type RangePreset = (typeof RANGE_PRESETS)[number]

function rangeToIso(days: RangePreset): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  return { from: from.toISOString(), to: to.toISOString() }
}

function StatCard({ label, icon, stats }: { label: string; icon: React.ReactNode; stats: MovementCategoryStats | undefined }) {
  const { t } = useTranslation('financialConnections')
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <span className="text-lg font-semibold tabular-nums">{stats?.amount != null ? Currency(stats.amount) : '—'}</span>
      <span className="text-xs text-muted-foreground">{t('movements.stats.operations', { count: stats?.count ?? 0 })}</span>
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  venueId: string
  account: FinancialAccountSummary
}

export function BankAccountMovementsSheet({ open, onClose, venueId, account }: Props) {
  const { t } = useTranslation('financialConnections')
  const [rangeDays, setRangeDays] = useState<RangePreset>(30)
  const [page, setPage] = useState(0)
  const range = useMemo(() => rangeToIso(rangeDays), [rangeDays])

  const stats = useQuery({
    queryKey: ['financial-account-movement-stats', account.id, rangeDays],
    queryFn: () => financialConnectionAPI.getMovementStats(venueId, account.id, range),
    enabled: open,
  })

  const movs = useQuery({
    queryKey: ['financial-account-movements', account.id, rangeDays, page],
    queryFn: () => financialConnectionAPI.getMovements(venueId, account.id, { page, size: PAGE_SIZE, ...range }),
    enabled: open,
    placeholderData: keepPreviousData,
  })

  const totalPages = Math.max(1, Math.ceil((movs.data?.total ?? 0) / PAGE_SIZE))

  const selectRange = (d: RangePreset) => {
    setRangeDays(d)
    setPage(0)
  }

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" aria-hidden />
            {t('movements.title')}
          </SheetTitle>
          <SheetDescription>
            {t('movements.subtitle', { label: account.label ?? account.externalId })}
            {account.clabe && <span className="ml-2 text-xs">CLABE {account.clabe}</span>}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex gap-2">
            {RANGE_PRESETS.map(d => (
              <Button key={d} size="sm" variant={rangeDays === d ? 'default' : 'outline'} onClick={() => selectRange(d)}>
                {t(`movements.range.${d}`)}
              </Button>
            ))}
          </div>

          {stats.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label={t('movements.stats.speiIn')} icon={<ArrowDownLeft className="h-4 w-4" aria-hidden />} stats={stats.data?.speiIn} />
              <StatCard label={t('movements.stats.speiOut')} icon={<ArrowUpRight className="h-4 w-4" aria-hidden />} stats={stats.data?.speiOut} />
              <StatCard
                label={t('movements.stats.internalTransfers')}
                icon={<Repeat className="h-4 w-4" aria-hidden />}
                stats={stats.data?.internalTransfers}
              />
              <StatCard label={t('movements.stats.dispersions')} icon={<Send className="h-4 w-4" aria-hidden />} stats={stats.data?.dispersions} />
            </div>
          )}

          {movs.isLoading && <Skeleton className="h-48 w-full" />}
          {movs.isError && <p className="text-sm text-destructive">{t('movements.table.loadError')}</p>}
          {movs.data && movs.data.movements.length === 0 && !movs.isLoading && (
            <p className="text-sm text-muted-foreground">{t('movements.table.empty')}</p>
          )}

          {movs.data && movs.data.movements.length > 0 && (
            <div className="flex flex-col gap-2">
              {movs.data.movements.map((m, i) => (
                <div key={m.id ?? i} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{m.concept ?? m.type ?? '—'}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[m.type, m.beneficiary ?? m.originator, m.reference].filter(Boolean).join(' · ')}
                    </span>
                    <span className="text-xs text-muted-foreground">{m.date ? new Date(m.date).toLocaleString() : '—'}</span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums">{m.amount != null ? Currency(m.amount) : '—'}</span>
                    {m.status && <Badge variant="outline">{m.status}</Badge>}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <Button size="sm" variant="outline" disabled={page === 0 || movs.isFetching} onClick={() => setPage(p => p - 1)}>
                  {t('movements.table.previous')}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {movs.isFetching && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" aria-hidden />}
                  {t('movements.table.pageOf', { page: page + 1, pages: totalPages })}
                </span>
                <Button size="sm" variant="outline" disabled={page + 1 >= totalPages || movs.isFetching} onClick={() => setPage(p => p + 1)}>
                  {t('movements.table.next')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
