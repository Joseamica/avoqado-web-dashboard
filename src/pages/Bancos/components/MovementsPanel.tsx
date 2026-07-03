/**
 * MovementsPanel — estado de cuenta reusable de una cuenta bancaria conectada.
 * 4 tarjetas de totales por categoría (SPEI in/out, transferencias, dispersiones)
 * + tabla paginada de movimientos, con rango de fechas preseleccionable.
 * Solo lectura. Montos honestos: null → '—', jamás $0.
 *
 * Extraído del BankAccountMovementsSheet para reusarse como página del hub Bancos
 * (bancos/movimientos) y dentro del Sheet. El Sheet queda como wrapper delgado.
 */
import { useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowDownLeft, ArrowUpRight, Loader2, Repeat, Send } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Currency } from '@/utils/currency'
import { financialConnectionAPI, type FinancialAccountSummary, type MovementCategoryStats } from '@/services/financialConnection.service'

const PAGE_SIZE = 10
const RANGE_PRESETS = [7, 30, 90] as const
type RangePreset = (typeof RANGE_PRESETS)[number]

function rangeToIso(days: RangePreset): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  return { from: from.toISOString(), to: to.toISOString() }
}

/** Paleta por categoría — chip tenue (10% de opacidad) que da identidad sin gritar. */
const STAT_TONE = {
  in: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  out: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  transfer: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  dispersion: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
} as const

function StatCard({
  label,
  icon,
  tone,
  stats,
}: {
  label: string
  icon: React.ReactNode
  tone: keyof typeof STAT_TONE
  stats: MovementCategoryStats | undefined
}) {
  const { t } = useTranslation('financialConnections')
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-muted/50 p-4">
      <div className="flex items-center gap-2">
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', STAT_TONE[tone])}>{icon}</span>
        <span className="text-xs font-medium leading-tight text-muted-foreground">{label}</span>
      </div>
      <span className="text-xl font-semibold tracking-tight tabular-nums">{stats?.amount != null ? Currency(stats.amount) : '—'}</span>
      <span className="text-xs text-muted-foreground">{t('movements.stats.operations', { count: stats?.count ?? 0 })}</span>
    </div>
  )
}

/**
 * Panel de movimientos. `enabled` controla el disparo de las queries (para el Sheet,
 * que solo consulta cuando está abierto; en una página siempre es true).
 */
export function MovementsPanel({
  venueId,
  account,
  enabled = true,
}: {
  venueId: string
  account: FinancialAccountSummary
  enabled?: boolean
}) {
  const { t } = useTranslation('financialConnections')
  const [rangeDays, setRangeDays] = useState<RangePreset>(30)
  const [page, setPage] = useState(0)
  const range = useMemo(() => rangeToIso(rangeDays), [rangeDays])

  const stats = useQuery({
    queryKey: ['financial-account-movement-stats', account.id, rangeDays],
    queryFn: () => financialConnectionAPI.getMovementStats(venueId, account.id, range),
    enabled,
  })

  const movs = useQuery({
    queryKey: ['financial-account-movements', account.id, rangeDays, page],
    queryFn: () => financialConnectionAPI.getMovements(venueId, account.id, { page, size: PAGE_SIZE, ...range }),
    enabled,
    placeholderData: keepPreviousData,
  })

  const totalPages = Math.max(1, Math.ceil((movs.data?.total ?? 0) / PAGE_SIZE))

  const selectRange = (d: RangePreset) => {
    setRangeDays(d)
    setPage(0)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Rango — pills al estilo del dashboard */}
      <div className="flex gap-1.5">
        {RANGE_PRESETS.map(d => (
          <button
            key={d}
            type="button"
            onClick={() => selectRange(d)}
            className={cn(
              'cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              rangeDays === d ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t(`movements.range.${d}`)}
          </button>
        ))}
      </div>

      {/* Totales entra/sale */}
      {stats.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={t('movements.stats.speiIn')} tone="in" icon={<ArrowDownLeft className="h-4 w-4" aria-hidden />} stats={stats.data?.speiIn} />
          <StatCard label={t('movements.stats.speiOut')} tone="out" icon={<ArrowUpRight className="h-4 w-4" aria-hidden />} stats={stats.data?.speiOut} />
          <StatCard
            label={t('movements.stats.internalTransfers')}
            tone="transfer"
            icon={<Repeat className="h-4 w-4" aria-hidden />}
            stats={stats.data?.internalTransfers}
          />
          <StatCard label={t('movements.stats.dispersions')} tone="dispersion" icon={<Send className="h-4 w-4" aria-hidden />} stats={stats.data?.dispersions} />
        </div>
      )}

      {/* Estado de cuenta */}
      {movs.isLoading && <Skeleton className="h-64 rounded-xl" />}
      {movs.isError && (
        <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{t('movements.table.loadError')}</div>
      )}
      {movs.data && movs.data.movements.length === 0 && !movs.isLoading && (
        <div className="rounded-xl bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">{t('movements.table.empty')}</div>
      )}

      {movs.data && movs.data.movements.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl bg-muted/30 divide-y divide-border/40">
            {movs.data.movements.map((m, i) => {
              const outgoing = /egreso|out|env|cargo|salida/i.test(`${m.type ?? ''} ${m.operationType ?? ''}`)
              return (
                <div key={m.id ?? i} className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', outgoing ? STAT_TONE.out : STAT_TONE.in)}
                      aria-hidden
                    >
                      {outgoing ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{m.concept ?? m.type ?? '—'}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {[m.beneficiary ?? m.originator, m.reference].filter(Boolean).join(' · ') || m.type || '—'}
                      </span>
                      <span className="text-xs text-muted-foreground/70">{m.date ? new Date(m.date).toLocaleString() : '—'}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={cn('text-sm font-semibold tabular-nums', outgoing ? 'text-foreground' : 'text-emerald-600 dark:text-emerald-400')}>
                      {m.amount != null ? `${outgoing ? '−' : '+'}${Currency(m.amount)}` : '—'}
                    </span>
                    {m.status && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{m.status}</span>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={page === 0 || movs.isFetching}
              onClick={() => setPage(p => p - 1)}
              className="cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              {t('movements.table.previous')}
            </button>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {movs.isFetching && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              {t('movements.table.pageOf', { page: page + 1, pages: totalPages })}
            </span>
            <button
              type="button"
              disabled={page + 1 >= totalPages || movs.isFetching}
              onClick={() => setPage(p => p + 1)}
              className="cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              {t('movements.table.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
