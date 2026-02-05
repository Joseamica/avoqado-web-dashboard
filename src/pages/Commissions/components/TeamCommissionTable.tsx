import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useCommissionSummaries } from '@/hooks/useCommissions'
import { cn } from '@/lib/utils'
import type { CommissionSummary, CommissionSummaryStatus } from '@/types/commission'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, MoreHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

// Status badge styles
const statusStyles: Record<CommissionSummaryStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  CALCULATED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  DISPUTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
}

export default function TeamCommissionTable() {
  const { t, i18n } = useTranslation('commissions')
  const { t: _tCommon } = useTranslation()
  const navigate = useNavigate()
  const { venueSlug, fullBasePath } = useCurrentVenue()
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  })

  // Fetch summaries
  const { data: summaries, isLoading } = useCommissionSummaries()

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(i18n.language === 'es' ? 'es-MX' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Format period
  const formatPeriod = (start: string, end: string) => {
    const startDate = formatDate(start)
    const endDate = formatDate(end)
    return `${startDate} - ${endDate}`
  }

  // Table columns
  const columns: ColumnDef<CommissionSummary>[] = useMemo(
    () => [
      {
        accessorKey: 'staff',
        header: t('table.staff'),
        cell: ({ row }) => {
          const staff = row.original.staff
          return (
            <div className="font-medium">
              {staff.firstName} {staff.lastName}
            </div>
          )
        },
      },
      {
        accessorKey: 'period',
        header: t('table.period'),
        cell: ({ row }) => formatPeriod(row.original.periodStart, row.original.periodEnd),
      },
      {
        accessorKey: 'totalCommissions',
        header: t('table.commission'),
        cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.totalCommissions)}</span>,
      },
      {
        accessorKey: 'netAmount',
        header: t('summary.netAmount'),
        cell: ({ row }) => <span className="font-semibold text-foreground">{formatCurrency(row.original.netAmount)}</span>,
      },
      {
        accessorKey: 'status',
        header: t('table.status'),
        cell: ({ row }) => {
          const status = row.original.status
          return <Badge className={cn('font-medium', statusStyles[status])}>{t(`status.${status}`)}</Badge>
        },
      },
      {
        id: 'actions',
        header: t('table.actions'),
        cell: ({ row }) => {
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`${fullBasePath}/team/${row.original.staff.staffVenueId}`)}>
                  <Eye className="h-4 w-4 mr-2" />
                  {t('table.viewDetails')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [t, i18n.language, formatCurrency, formatPeriod, navigate, venueSlug, fullBasePath],
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
      <div className="p-4 border-b border-border/50">
        <h3 className="font-semibold">{t('summary.title')}</h3>
      </div>
      <DataTable<CommissionSummary>
        columns={columns}
        data={summaries || []}
        showColumnCustomizer={false}
        pagination={pagination}
        setPagination={setPagination}
        rowCount={summaries?.length || 0}
      />
    </div>
  )
}
