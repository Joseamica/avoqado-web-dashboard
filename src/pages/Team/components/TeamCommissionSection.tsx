import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { type ColumnDef } from '@tanstack/react-table'
import { DollarSign, TrendingUp, Calendar } from 'lucide-react'
import DataTable from '@/components/data-table'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/use-access'
import { useCommissionStats, useStaffCommissions } from '@/hooks/useCommissions'
import { NotaDeLoCalculado } from '@/pages/Commissions/components/AvisosDeResumen'
import type { CommissionSummary } from '@/types/commission'
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

// Sin el estado del resumen (E6a-fix F9, QA H4): es del flujo viejo de pagos y contradecía al recibo de Pago al personal.

interface TeamCommissionSectionProps {
	staffId: string
}

export default function TeamCommissionSection({ staffId }: TeamCommissionSectionProps) {
	const { t, i18n } = useTranslation('commissions')

	// Fetch staff commissions (includes calculations, summaries, stats, and tierProgress)
	const { data: commissions, isLoading: isLoadingCommissions } = useStaffCommissions(staffId)

	// Con Pago al personal activo, este historial es lo CALCULADO (E6a-fix3, hermano de «Resumen de Comisiones»): misma consulta de
	// estadísticas de la sede que la pantalla de Comisiones (en caché), y el enlace al recibo sólo para quien puede verlo.
	const { can } = useAccess()
	const { data: stats } = useCommissionStats()
	const nota = <NotaDeLoCalculado staffPayActive={stats?.staffPayActive === true} puedeVerRecibos={can('staffpay:read')} />

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

	// Staff stats come directly from the API (calculated from CommissionCalculation records)
	const staffStats = useMemo(() => {
		if (!commissions?.stats) return { thisMonth: 0, lastMonth: 0, total: 0 }

		return {
			thisMonth: commissions.stats.thisMonth ?? 0,
			lastMonth: commissions.stats.lastMonth ?? 0,
			total: commissions.stats.total ?? 0,
		}
	}, [commissions?.stats])

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
		],
		[t, i18n.language]
	)

	const isLoading = isLoadingCommissions

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
					<h4 className="text-sm font-medium mb-1">{t('staff.history')}</h4>
					<div className="mb-4 space-y-1">
						{nota}
					</div>
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
					<div className="mt-3">{nota}</div>
				</div>
			)}
		</GlassCard>
	)
}
