import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useDeleteCommissionConfig } from '@/hooks/useCommissions'
import { useToast } from '@/hooks/use-toast'
import type { CommissionConfigSource, EffectiveCommissionConfig } from '@/types/commission'
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
	effectiveConfigs?: EffectiveCommissionConfig[]
	isLoading: boolean
	hasOrgConfigs?: boolean
}

export default function CommissionConfigList({
	effectiveConfigs,
	isLoading,
	hasOrgConfigs = false,
}: CommissionConfigListProps) {
	const { t } = useTranslation('commissions')
	const { toast } = useToast()
	const [revertConfigId, setRevertConfigId] = useState<string | null>(null)

	const deleteConfigMutation = useDeleteCommissionConfig()

	const configs = effectiveConfigs || []

	const handleRevertToOrg = async () => {
		if (!revertConfigId) return
		try {
			await deleteConfigMutation.mutateAsync(revertConfigId)
			toast({ title: t('orgConfig.deleteSuccess') })
		} catch {
			toast({
				title: t('orgConfig.error'),
				variant: 'destructive',
			})
		} finally {
			setRevertConfigId(null)
		}
	}

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
				{configs.map(({ config, source }: { config: EffectiveCommissionConfig['config']; source: CommissionConfigSource }) => (
					<CommissionConfigCard
						key={config.id}
						config={config}
						source={source}
						onRevertToOrg={
							source === 'venue' && hasOrgConfigs
								? () => setRevertConfigId(config.id)
								: undefined
						}
					/>
				))}
			</div>

			{/* Revert Confirmation Dialog */}
			<AlertDialog open={!!revertConfigId} onOpenChange={(open) => !open && setRevertConfigId(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('orgConfig.revertToOrg')}</AlertDialogTitle>
						<AlertDialogDescription>
							{t('orgConfig.revertConfirm')}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleRevertToOrg}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{t('orgConfig.revertToOrg')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
