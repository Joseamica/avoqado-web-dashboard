import { useTranslation } from 'react-i18next'
import { Settings2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { CommissionConfig } from '@/types/commission'
import CommissionConfigCard from './CommissionConfigCard'
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

interface CommissionConfigListProps {
	configs: CommissionConfig[]
	isLoading: boolean
}

export default function CommissionConfigList({
	configs,
	isLoading,
}: CommissionConfigListProps) {
	const { t } = useTranslation('commissions')

	if (isLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-48 w-full rounded-2xl" />
				<Skeleton className="h-48 w-full rounded-2xl" />
			</div>
		)
	}

	if (configs.length === 0) {
		return (
			<GlassCard className="p-12">
				<div className="flex flex-col items-center justify-center text-center space-y-4">
					<div className="p-4 rounded-full bg-muted">
						<Settings2 className="h-8 w-8 text-muted-foreground" />
					</div>
					<div className="space-y-2">
						<h3 className="text-lg font-semibold">{t('config.noConfigs')}</h3>
						<p className="text-sm text-muted-foreground max-w-md">
							{t('config.noConfigsDescription')}
						</p>
					</div>
				</div>
			</GlassCard>
		)
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold">{t('config.title')}</h2>
					<p className="text-sm text-muted-foreground">{t('config.subtitle')}</p>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
				{configs.map((config) => (
					<CommissionConfigCard key={config.id} config={config} />
				))}
			</div>
		</div>
	)
}
