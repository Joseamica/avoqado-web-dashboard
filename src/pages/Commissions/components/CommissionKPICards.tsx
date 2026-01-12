import { useTranslation } from 'react-i18next'
import { DollarSign, Clock, CheckCircle2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CommissionStats } from '@/types/commission'
import { Skeleton } from '@/components/ui/skeleton'

// GlassCard component following the modern design system
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

// MetricCard for individual KPIs
const MetricCard: React.FC<{
	icon: React.ReactNode
	label: string
	value: string | number
	trend?: string
	iconColorClass: string
	isLoading?: boolean
}> = ({ icon, label, value, trend, iconColorClass, isLoading }) => (
	<GlassCard className="p-4">
		<div className="flex items-start justify-between">
			<div className={cn('p-2 rounded-xl', iconColorClass)}>
				{icon}
			</div>
			{trend && (
				<span className="text-xs text-muted-foreground">{trend}</span>
			)}
		</div>
		<div className="mt-3">
			{isLoading ? (
				<>
					<Skeleton className="h-8 w-24 mb-1" />
					<Skeleton className="h-4 w-16" />
				</>
			) : (
				<>
					<p className="text-2xl font-bold tracking-tight">{value}</p>
					<p className="text-sm text-muted-foreground">{label}</p>
				</>
			)}
		</div>
	</GlassCard>
)

interface CommissionKPICardsProps {
	stats: CommissionStats | undefined
	isLoading: boolean
}

export default function CommissionKPICards({ stats, isLoading }: CommissionKPICardsProps) {
	const { t, i18n } = useTranslation('commissions')

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
			style: 'currency',
			currency: 'MXN',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount)
	}

	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			<MetricCard
				icon={<DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />}
				iconColorClass="bg-gradient-to-br from-green-500/20 to-green-500/5"
				label={t('stats.paid')}
				value={formatCurrency(stats?.totalPaid || 0)}
				isLoading={isLoading}
			/>
			<MetricCard
				icon={<Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />}
				iconColorClass="bg-gradient-to-br from-yellow-500/20 to-yellow-500/5"
				label={t('stats.pending')}
				value={formatCurrency(stats?.totalPending || 0)}
				isLoading={isLoading}
			/>
			<MetricCard
				icon={<CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
				iconColorClass="bg-gradient-to-br from-blue-500/20 to-blue-500/5"
				label={t('stats.approved')}
				value={formatCurrency(stats?.totalApproved || 0)}
				isLoading={isLoading}
			/>
			<MetricCard
				icon={<Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
				iconColorClass="bg-gradient-to-br from-purple-500/20 to-purple-500/5"
				label={t('stats.staffWithCommissions')}
				value={stats?.staffWithCommissions || 0}
				isLoading={isLoading}
			/>
		</div>
	)
}
