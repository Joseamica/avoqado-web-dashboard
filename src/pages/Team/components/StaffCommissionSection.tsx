import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { type ColumnDef } from '@tanstack/react-table'
import {
	DollarSign,
	TrendingUp,
	Calendar,
	CheckCircle2,
	Clock,
	AlertCircle,
	Settings2,
} from 'lucide-react'
import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useStaffCommissions, useCommissionStats } from '@/hooks/useCommissions'
import type { CommissionSummary, CommissionSummaryStatus } from '@/types/commission'
import { cn } from '@/lib/utils'

// GlassCard component
const GlassCard: React.FC<{
	children: React.ReactNode
	className?: string
}> = ({ children, className }) => (
	<div
		className={cn(
			'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
			'shadow-sm transition-all duration-300',
			className
		)}
	>
		{children}
	</div>
)

// Status styles
const statusStyles: Record<CommissionSummaryStatus, { bg: string; icon: React.ReactNode }> = {
	DRAFT: { bg: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', icon: <Settings2 className="h-3 w-3" /> },
	CALCULATED: { bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: <TrendingUp className="h-3 w-3" /> },
	PENDING_APPROVAL: { bg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <Clock className="h-3 w-3" /> },
	APPROVED: { bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="h-3 w-3" /> },
	DISPUTED: { bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <AlertCircle className="h-3 w-3" /> },
	PAID: { bg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: <DollarSign className="h-3 w-3" /> },
}

interface StaffCommissionSectionProps {
	staffId: string
}

export default function StaffCommissionSection({ staffId }: StaffCommissionSectionProps) {
	const { t, i18n } = useTranslation('commissions')

	// Fetch staff commissions
	const { data: commissions, isLoading: isLoadingCommissions } = useStaffCommissions(staffId)

	// Fetch stats for this staff
	const { data: stats, isLoading: isLoadingStats } = useCommissionStats()

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
			style: 'currency',
			currency: 'MXN',
			minimumFractionDigits: 2,
		}).format(amount)
	}

	// Format period
	const formatPeriod = (start: string, end: string) => {
		const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
		const startDate = new Date(start).toLocaleDateString(
			i18n.language === 'es' ? 'es-MX' : 'en-US',
			options
		)
		const endDate = new Date(end).toLocaleDateString(
			i18n.language === 'es' ? 'es-MX' : 'en-US',
			options
		)
		return `${startDate} - ${endDate}`
	}

	// Calculate staff-specific stats
	const staffStats = useMemo(() => {
		if (!commissions?.summaries) return { thisMonth: 0, lastMonth: 0, total: 0 }

		const now = new Date()
		const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
		const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
		const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

		let thisMonth = 0
		let lastMonth = 0
		let total = 0

		commissions.summaries.forEach((summary: CommissionSummary) => {
			const periodStart = new Date(summary.periodStart)
			total += summary.netAmount

			if (periodStart >= thisMonthStart) {
				thisMonth += summary.netAmount
			} else if (periodStart >= lastMonthStart && periodStart <= lastMonthEnd) {
				lastMonth += summary.netAmount
			}
		})

		return { thisMonth, lastMonth, total }
	}, [commissions?.summaries])

	// Table columns
	const columns: ColumnDef<CommissionSummary>[] = useMemo(
		() => [
			{
				accessorKey: 'period',
				header: t('summary.period'),
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<Calendar className="h-4 w-4 text-muted-foreground" />
						<span>{formatPeriod(row.original.periodStart, row.original.periodEnd)}</span>
					</div>
				),
			},
			{
				accessorKey: 'totalCommissions',
				header: t('summary.commission'),
				cell: ({ row }) => (
					<span className="font-medium">
						{formatCurrency(row.original.totalCommissions)}
					</span>
				),
			},
			{
				accessorKey: 'totalBonuses',
				header: t('summary.bonuses'),
				cell: ({ row }) => formatCurrency(row.original.totalBonuses),
			},
			{
				accessorKey: 'netAmount',
				header: t('summary.netAmount'),
				cell: ({ row }) => (
					<span className="font-semibold text-foreground">
						{formatCurrency(row.original.netAmount)}
					</span>
				),
			},
			{
				accessorKey: 'status',
				header: t('table.status'),
				cell: ({ row }) => {
					const status = row.original.status
					const style = statusStyles[status]
					return (
						<Badge className={cn('font-medium gap-1', style.bg)}>
							{style.icon}
							{t(`status.${status}`)}
						</Badge>
					)
				},
			},
		],
		[t, i18n.language]
	)

	const isLoading = isLoadingCommissions || isLoadingStats

	if (isLoading) {
		return (
			<GlassCard className="p-6">
				<Skeleton className="h-6 w-48 mb-6" />
				<div className="grid grid-cols-3 gap-4 mb-6">
					<Skeleton className="h-24 w-full rounded-xl" />
					<Skeleton className="h-24 w-full rounded-xl" />
					<Skeleton className="h-24 w-full rounded-xl" />
				</div>
				<Skeleton className="h-64 w-full" />
			</GlassCard>
		)
	}

	return (
		<GlassCard className="p-6">
			<div className="flex items-center gap-3 mb-6">
				<div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
					<DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
				</div>
				<div>
					<h3 className="text-lg font-semibold">{t('staff.commissions')}</h3>
					<p className="text-sm text-muted-foreground">{t('staff.commissionsSubtitle')}</p>
				</div>
			</div>

			{/* KPI Cards */}
			<div className="grid grid-cols-3 gap-4 mb-6">
				<div className="p-4 rounded-xl bg-muted/50">
					<div className="flex items-center gap-2 mb-2">
						<Calendar className="h-4 w-4 text-blue-500" />
						<p className="text-xs text-muted-foreground">{t('staff.thisMonth')}</p>
					</div>
					<p className="text-2xl font-bold">{formatCurrency(staffStats.thisMonth)}</p>
				</div>

				<div className="p-4 rounded-xl bg-muted/50">
					<div className="flex items-center gap-2 mb-2">
						<Calendar className="h-4 w-4 text-purple-500" />
						<p className="text-xs text-muted-foreground">{t('staff.lastMonth')}</p>
					</div>
					<p className="text-2xl font-bold">{formatCurrency(staffStats.lastMonth)}</p>
				</div>

				<div className="p-4 rounded-xl bg-muted/50">
					<div className="flex items-center gap-2 mb-2">
						<TrendingUp className="h-4 w-4 text-green-500" />
						<p className="text-xs text-muted-foreground">{t('staff.total')}</p>
					</div>
					<p className="text-2xl font-bold">{formatCurrency(staffStats.total)}</p>
				</div>
			</div>

			{/* Commission History Table */}
			{commissions?.summaries && commissions.summaries.length > 0 ? (
				<>
					<h4 className="text-sm font-medium mb-4">{t('staff.history')}</h4>
					<div className="relative rounded-xl border border-border/50 overflow-hidden">
						<DataTable<CommissionSummary>
							columns={columns}
							data={commissions.summaries}
							pagination={{ pageIndex: 0, pageSize: 5 }}
							rowCount={commissions.summaries.length}
						/>
					</div>
				</>
			) : (
				<div className="py-12 text-center">
					<div className="p-4 rounded-full bg-muted inline-block mb-4">
						<DollarSign className="h-8 w-8 text-muted-foreground" />
					</div>
					<p className="text-sm text-muted-foreground">{t('staff.noCommissions')}</p>
					<p className="text-xs text-muted-foreground mt-1">
						{t('staff.noCommissionsDescription')}
					</p>
				</div>
			)}
		</GlassCard>
	)
}
