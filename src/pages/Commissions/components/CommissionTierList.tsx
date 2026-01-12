import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip'
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
import { PermissionGate } from '@/components/PermissionGate'
import { useDeleteCommissionTier } from '@/hooks/useCommissions'
import { useToast } from '@/hooks/use-toast'
import type { CommissionTier } from '@/types/commission'
import { cn } from '@/lib/utils'
import CreateTierDialog from './CreateTierDialog'

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

interface CommissionTierListProps {
	configId: string
	tiers: CommissionTier[]
	isLoading: boolean
}

export default function CommissionTierList({
	configId,
	tiers,
	isLoading,
}: CommissionTierListProps) {
	const { t, i18n } = useTranslation('commissions')
	const { t: tCommon } = useTranslation()
	const { toast } = useToast()

	const [showCreateDialog, setShowCreateDialog] = useState(false)
	const [editingTier, setEditingTier] = useState<CommissionTier | null>(null)
	const [deletingTier, setDeletingTier] = useState<CommissionTier | null>(null)

	const deleteTierMutation = useDeleteCommissionTier(configId)

	// Format percentage
	const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`

	// Format currency
	const formatCurrency = (amount: number | null) => {
		if (amount === null) return '-'
		return new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
			style: 'currency',
			currency: 'MXN',
			minimumFractionDigits: 0,
		}).format(amount)
	}

	// Format threshold display
	const formatThreshold = (tier: CommissionTier) => {
		const isAmount = tier.tierType === 'BY_AMOUNT'
		const min = isAmount ? formatCurrency(tier.minThreshold) : tier.minThreshold
		const max = tier.maxThreshold === null
			? '+'
			: isAmount
				? formatCurrency(tier.maxThreshold)
				: tier.maxThreshold

		return tier.maxThreshold === null
			? `${min}+`
			: `${min} - ${max}`
	}

	const handleDelete = async () => {
		if (!deletingTier) return
		try {
			await deleteTierMutation.mutateAsync(deletingTier.id)
			toast({
				title: t('success.tierDeleted'),
			})
			setDeletingTier(null)
		} catch (error: any) {
			toast({
				title: t('errors.deleteError'),
				description: error.response?.data?.message || tCommon('common.error'),
				variant: 'destructive',
			})
		}
	}

	if (isLoading) {
		return (
			<GlassCard className="p-5">
				<Skeleton className="h-6 w-32 mb-4" />
				<div className="space-y-3">
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
				</div>
			</GlassCard>
		)
	}

	// Sort tiers by level
	const sortedTiers = [...tiers].sort((a, b) => a.tierLevel - b.tierLevel)

	return (
		<>
			<GlassCard className="p-5">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
							<TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
						</div>
						<div>
							<h3 className="font-semibold">{t('tiers.title')}</h3>
							<p className="text-xs text-muted-foreground">{t('tiers.subtitle')}</p>
						</div>
					</div>

					<PermissionGate permission="commissions:create">
						<Button
							size="sm"
							onClick={() => {
								setEditingTier(null)
								setShowCreateDialog(true)
							}}
						>
							<Plus className="h-4 w-4 mr-2" />
							{t('tiers.create')}
						</Button>
					</PermissionGate>
				</div>

				{sortedTiers.length === 0 ? (
					<div className="py-8 text-center">
						<p className="text-sm text-muted-foreground">{t('tiers.noTiers')}</p>
						<p className="text-xs text-muted-foreground mt-1">
							{t('tiers.noTiersDescription')}
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{sortedTiers.map((tier) => (
							<div
								key={tier.id}
								className={cn(
									'flex items-center justify-between p-4 rounded-lg border',
									tier.active
										? 'bg-muted/30 border-border/50'
										: 'bg-muted/10 border-border/30 opacity-60'
								)}
							>
								<div className="flex items-center gap-4">
									<div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
										{tier.tierLevel}
									</div>
									<div>
										<div className="flex items-center gap-2">
											<span className="font-medium">{tier.tierName}</span>
											{!tier.active && (
												<Badge variant="secondary" className="text-xs">
													{t('config.inactive')}
												</Badge>
											)}
										</div>
										<p className="text-sm text-muted-foreground">
											{formatThreshold(tier)} • {t(`tierPeriods.${tier.tierPeriod}`)}
										</p>
									</div>
								</div>

								<div className="flex items-center gap-4">
									<div className="text-right">
										<p className="text-lg font-bold">{formatPercent(tier.rate)}</p>
										<p className="text-xs text-muted-foreground">
											{t(`tierTypes.${tier.tierType}`)}
										</p>
									</div>

									<div className="flex items-center gap-1">
										<PermissionGate permission="commissions:update">
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8 cursor-pointer"
															onClick={() => {
																setEditingTier(tier)
																setShowCreateDialog(true)
															}}
														>
															<Pencil className="h-4 w-4" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>{t('tiers.edit')}</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</PermissionGate>

										<PermissionGate permission="commissions:delete">
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8 text-destructive hover:text-destructive cursor-pointer"
															onClick={() => setDeletingTier(tier)}
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>{t('tiers.delete')}</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</PermissionGate>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</GlassCard>

			{/* Create/Edit Tier Dialog */}
			<CreateTierDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
				configId={configId}
				tier={editingTier}
				nextLevel={sortedTiers.length + 1}
			/>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={!!deletingTier} onOpenChange={() => setDeletingTier(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('tiers.delete')}</AlertDialogTitle>
						<AlertDialogDescription>
							{t('tiers.deleteConfirm')}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{t('actions.delete')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
