import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
	Pencil,
	Trash2,
	ChevronRight,
	Percent,
	DollarSign,
	TrendingUp,
	Target,
	Hand,
	Building2,
	Store,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useRoleConfig } from '@/hooks/use-role-config'
import { useDeleteCommissionConfig } from '@/hooks/useCommissions'
import { useToast } from '@/hooks/use-toast'
import type { CommissionConfig, CommissionCalcType, CommissionConfigSource } from '@/types/commission'
import { cn } from '@/lib/utils'

// GlassCard with hover effect
const GlassCard: React.FC<{
	children: React.ReactNode
	className?: string
	hover?: boolean
	onClick?: () => void
}> = ({ children, className, hover = false, onClick }) => (
	<div
		onClick={onClick}
		className={cn(
			'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
			'shadow-sm transition-all duration-300',
			hover && 'cursor-pointer hover:shadow-md hover:border-border hover:bg-card/90 hover:-translate-y-0.5',
			onClick && 'cursor-pointer',
			className
		)}
	>
		{children}
	</div>
)

// Icons for calculation types
const calcTypeIcons: Record<CommissionCalcType, React.ReactNode> = {
	PERCENTAGE: <Percent className="w-4 h-4" />,
	FIXED: <DollarSign className="w-4 h-4" />,
	TIERED: <TrendingUp className="w-4 h-4" />,
	MILESTONE: <Target className="w-4 h-4" />,
	MANUAL: <Hand className="w-4 h-4" />,
}

interface CommissionConfigCardProps {
	config: CommissionConfig
	source?: CommissionConfigSource
	onRevertToOrg?: () => void
}

export default function CommissionConfigCard({ config, source, onRevertToOrg }: CommissionConfigCardProps) {
	const { t, i18n } = useTranslation('commissions')
	const { t: tCommon } = useTranslation()
	const navigate = useNavigate()
	const { fullBasePath } = useCurrentVenue()
	const { getDisplayName: getRoleDisplayName } = useRoleConfig()
	const { toast } = useToast()
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)

	// Check if role rates are configured
	const hasRoleRates = config.roleRates && Object.keys(config.roleRates).length > 0
	const hasAmountLimits = config.minAmount !== null || config.maxAmount !== null

	const deleteConfigMutation = useDeleteCommissionConfig()

	// Format percentage
	const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`

	// Format currency
	const formatCurrency = (amount: number | null) => {
		if (amount === null) return null
		return new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
			style: 'currency',
			currency: 'MXN',
			minimumFractionDigits: 0,
		}).format(amount)
	}

	const minAmountLabel = config.minAmount !== null ? formatCurrency(config.minAmount) : tCommon('common.na')
	const maxAmountLabel = config.maxAmount !== null ? formatCurrency(config.maxAmount) : tCommon('common.na')

	// Format date
	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString(
			i18n.language === 'es' ? 'es-MX' : 'en-US',
			{ month: 'short', day: 'numeric', year: 'numeric' }
		)
	}

	const handleDelete = async () => {
		try {
			await deleteConfigMutation.mutateAsync(config.id)
			toast({
				title: t('success.configDeleted'),
			})
			setShowDeleteDialog(false)
		} catch (error: any) {
			toast({
				title: t('errors.deleteError'),
				description: error.response?.data?.message || tCommon('common.error'),
				variant: 'destructive',
			})
		}
	}

	const handleCardClick = () => {
		navigate(`${fullBasePath}/commissions/config/${config.id}`)
	}

	return (
		<>
			<GlassCard hover onClick={handleCardClick}>
				<div className="p-5">
					{/* Header */}
					<div className="flex items-start justify-between mb-4">
						<div className="flex items-center gap-3">
							<div className={cn(
								'p-2 rounded-xl',
								'bg-gradient-to-br from-purple-500/20 to-purple-500/5'
							)}>
								{calcTypeIcons[config.calcType]}
							</div>
							<div>
								<h3 className="font-semibold">{config.name}</h3>
								<div className="flex items-center gap-2 mt-1 flex-wrap">
									<Badge variant={config.active ? 'default' : 'secondary'}>
										{config.active ? t('config.active') : t('config.inactive')}
									</Badge>
									{source && (
										<Badge
											variant="outline"
											className={cn(
												'text-xs',
												source === 'organization'
													? 'border-purple-500/50 text-purple-600 dark:text-purple-400'
													: 'border-blue-500/50 text-blue-600 dark:text-blue-400'
											)}
										>
											{source === 'organization' ? (
												<><Building2 className="w-3 h-3 mr-1" />{t('orgConfig.source.organization')}</>
											) : (
												<><Store className="w-3 h-3 mr-1" />{t('orgConfig.source.venue')}</>
											)}
										</Badge>
									)}
									<span className="text-xs text-muted-foreground">
										{t('calcTypes.' + config.calcType)}
									</span>
									<span className="text-xs text-muted-foreground">
										• {t('config.priority')}: {config.priority}
									</span>
								</div>
							</div>
						</div>
						<ChevronRight className="w-5 h-5 text-muted-foreground" />
					</div>

					{/* Stats Grid */}
					{hasRoleRates ? (
						<div className="space-y-3 mb-4">
							{/* Role Rates */}
							<div className="p-3 rounded-lg bg-muted/50">
								<p className="text-xs text-muted-foreground mb-2">{t('config.roleRates')}</p>
								<div className="grid grid-cols-3 gap-2">
									{Object.entries(config.roleRates!).map(([role, rate]) => (
										<div key={role} className="text-center">
											<p className="text-lg font-semibold">{formatPercent(rate)}</p>
											<p className="text-xs text-muted-foreground">{getRoleDisplayName(role)}</p>
										</div>
									))}
								</div>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div className="p-3 rounded-lg bg-muted/50">
									<p className="text-xs text-muted-foreground">{t('config.effectiveFrom')}</p>
									<p className="text-sm font-medium">{formatDate(config.effectiveFrom)}</p>
									{config.effectiveTo && (
										<p className="text-xs text-muted-foreground mt-1">
											{t('config.effectiveTo')}: {formatDate(config.effectiveTo)}
										</p>
									)}
								</div>
								<div className="p-3 rounded-lg bg-muted/50">
									<p className="text-xs text-muted-foreground">{t('wizard.advanced.limits.title')}</p>
									{hasAmountLimits ? (
										<div className="mt-1 space-y-1 text-xs">
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">{t('config.minAmount')}</span>
												<span className="font-medium">{minAmountLabel}</span>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">{t('config.maxAmount')}</span>
												<span className="font-medium">{maxAmountLabel}</span>
											</div>
										</div>
									) : (
										<p className="text-sm font-medium mt-1">
											{t('wizard.advanced.limits.disabled')}
										</p>
									)}
								</div>
							</div>
						</div>
					) : (
						<div className="space-y-3 mb-4">
							<div className="grid grid-cols-2 gap-3">
								<div className="p-3 rounded-lg bg-muted/50">
									<p className="text-xs text-muted-foreground">{t('config.defaultRate')}</p>
									<p className="text-lg font-semibold">{formatPercent(config.defaultRate)}</p>
								</div>
								<div className="p-3 rounded-lg bg-muted/50">
									<p className="text-xs text-muted-foreground">{t('config.effectiveFrom')}</p>
									<p className="text-sm font-medium">{formatDate(config.effectiveFrom)}</p>
									{config.effectiveTo && (
										<p className="text-xs text-muted-foreground mt-1">
											{t('config.effectiveTo')}: {formatDate(config.effectiveTo)}
										</p>
									)}
								</div>
							</div>
							<div className="p-3 rounded-lg bg-muted/50">
								<p className="text-xs text-muted-foreground">{t('wizard.advanced.limits.title')}</p>
								{hasAmountLimits ? (
									<div className="mt-1 space-y-1 text-xs">
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground">{t('config.minAmount')}</span>
											<span className="font-medium">{minAmountLabel}</span>
										</div>
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground">{t('config.maxAmount')}</span>
											<span className="font-medium">{maxAmountLabel}</span>
										</div>
									</div>
								) : (
									<p className="text-sm font-medium mt-1">
										{t('wizard.advanced.limits.disabled')}
									</p>
								)}
							</div>
						</div>
					)}

					{/* Meta Info */}
					{config._count && (config._count.tiers > 0 || config._count.overrides > 0) && (
						<div className="flex items-center justify-end text-xs text-muted-foreground">
							<span>
								{config._count.tiers > 0 && (
									<>{config._count.tiers} {t('tiers.title').toLowerCase()}</>
								)}
								{config._count.tiers > 0 && config._count.overrides > 0 && ' • '}
								{config._count.overrides > 0 && (
									<>{config._count.overrides} {t('overrides.title').toLowerCase()}</>
								)}
							</span>
						</div>
					)}

					{/* Inherited notice */}
					{source === 'organization' && (
						<div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 bg-purple-500/10 rounded-lg px-3 py-2">
							<Building2 className="w-3.5 h-3.5 shrink-0" />
							<span>{t('orgConfig.inherited')}</span>
						</div>
					)}

					{/* Actions */}
					<div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
						{source !== 'organization' && (
							<>
								<PermissionGate permission="commissions:update">
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 cursor-pointer"
													onClick={(e) => {
														e.stopPropagation()
														navigate(`${fullBasePath}/commissions/config/${config.id}?edit=true`)
													}}
												>
													<Pencil className="h-4 w-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>{t('config.edit')}</TooltipContent>
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
													onClick={(e) => {
														e.stopPropagation()
														setShowDeleteDialog(true)
													}}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>{t('config.delete')}</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</PermissionGate>
							</>
						)}

						{source === 'venue' && onRevertToOrg && (
							<PermissionGate permission="commissions:delete">
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="sm"
												className="text-xs text-purple-600 dark:text-purple-400 cursor-pointer"
												onClick={(e) => {
													e.stopPropagation()
													onRevertToOrg()
												}}
											>
												<Building2 className="w-3.5 h-3.5 mr-1" />
												{t('orgConfig.revertToOrg')}
											</Button>
										</TooltipTrigger>
										<TooltipContent>{t('orgConfig.revertConfirm')}</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							</PermissionGate>
						)}

						<div className="flex-1" />

						<Button
							variant="outline"
							size="sm"
							className="cursor-pointer"
							onClick={(e) => {
								e.stopPropagation()
								handleCardClick()
							}}
						>
							{t('config.viewDetails')}
						</Button>
					</div>
				</div>
			</GlassCard>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('config.delete')}</AlertDialogTitle>
						<AlertDialogDescription>
							{t('config.deleteConfirm')}
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
