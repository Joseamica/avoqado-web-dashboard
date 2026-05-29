import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Table as TableIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useVenueDateTime } from '@/utils/datetime'
import referralsService from '@/services/referrals.service'
import type { ReferralStatus } from '@/types/referrals'

interface RecentReferralsTableProps {
  venueId: string
  pageSize?: number
}

const PAGE_SIZE_DEFAULT = 25

const STATUS_BADGE_CLASS: Record<ReferralStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  QUALIFIED: 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200',
  VOID: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200',
}

function fullName(firstName: string | null, lastName: string | null, fallback: string): string {
  const combined = [firstName, lastName].filter(Boolean).join(' ').trim()
  return combined || fallback
}

export function RecentReferralsTable({
  venueId,
  pageSize = PAGE_SIZE_DEFAULT,
}: RecentReferralsTableProps) {
  const { t } = useTranslation('referrals')
  const { formatDate } = useVenueDateTime()

  const [statusFilter, setStatusFilter] = useState<ReferralStatus | 'all'>('all')
  const [page, setPage] = useState(1)

  // ─── Query ─────────────────────────────────────────────────────────
  const queryParams = useMemo(
    () => ({
      page,
      pageSize,
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    }),
    [page, pageSize, statusFilter],
  )

  const { data, isLoading } = useQuery({
    queryKey: ['referrals', 'list', venueId, queryParams],
    queryFn: () => referralsService.listReferrals(venueId, queryParams),
    enabled: !!venueId,
  })

  // ─── Memoized rows / pagination ────────────────────────────────────
  const items = useMemo(() => data?.items ?? [], [data?.items])
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleFilterChange = (value: string) => {
    setStatusFilter(value as ReferralStatus | 'all')
    setPage(1)
  }

  const unknownLabel = t('hallOfFame.unknown')

  return (
    <div className="space-y-3" data-testid="recent-referrals-section">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <TableIcon className="h-4 w-4" />
          <h3 className="text-sm font-semibold">{t('table.title')}</h3>
        </div>

        <Select value={statusFilter} onValueChange={handleFilterChange}>
          <SelectTrigger
            className="w-[180px] h-9"
            aria-label={t('table.columnStatus')}
            data-testid="recent-referrals-status-filter"
          >
            <SelectValue placeholder={t('table.filterStatusAll')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('table.filterStatusAll')}</SelectItem>
            <SelectItem value="PENDING">{t('table.statusPending')}</SelectItem>
            <SelectItem value="QUALIFIED">{t('table.statusQualified')}</SelectItem>
            <SelectItem value="VOID">{t('table.statusVoid')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <GlassCard className="border-input overflow-hidden">
        <Table data-testid="recent-referrals-table">
          <TableHeader>
            <TableRow>
              <TableHead>{t('table.columnDate')}</TableHead>
              <TableHead>{t('table.columnReferrer')}</TableHead>
              <TableHead>{t('table.columnReferred')}</TableHead>
              <TableHead>{t('table.columnStatus')}</TableHead>
              <TableHead className="text-right">{t('table.columnReward')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                  {t('table.loading')}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-6 text-muted-foreground"
                  data-testid="recent-referrals-empty"
                >
                  {t('table.empty')}
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              items.map(item => {
                const referrerName = fullName(
                  item.referrerCustomer.firstName,
                  item.referrerCustomer.lastName,
                  unknownLabel,
                )
                const referredName = fullName(
                  item.referredCustomer.firstName,
                  item.referredCustomer.lastName,
                  unknownLabel,
                )
                const statusLabel =
                  item.status === 'QUALIFIED'
                    ? t('table.statusQualified')
                    : item.status === 'VOID'
                      ? t('table.statusVoid')
                      : t('table.statusPending')
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(item.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">{referrerName}</TableCell>
                    <TableCell className="text-sm">{referredName}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_BADGE_CLASS[item.status]}>{statusLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {item.rewardDiscount && item.status === 'QUALIFIED'
                        ? `${item.rewardDiscount.value}%`
                        : t('table.noRewardYet')}
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
      </GlassCard>

      {total > 0 && (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {t('table.pageInfo', { page, total: totalPages })}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              data-testid="recent-referrals-prev-page"
              className="cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              {t('table.previousPage')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              data-testid="recent-referrals-next-page"
              className="cursor-pointer"
            >
              {t('table.nextPage')}
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecentReferralsTable
