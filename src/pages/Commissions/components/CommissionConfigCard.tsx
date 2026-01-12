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
	User,
	UserCheck,
	CreditCard,
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
import type { CommissionConfig, CommissionCalcType, CommissionRecipient } from '@/types/commission'
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

// Icons for recipients
const recipientIcons: Record<CommissionRecipient, React.ReactNode> = {
	CREATOR: <User className="w-4 h-4" />,
	SERVER: <UserCheck className="w-4 h-4" />,
	PROCESSOR: <CreditCard className="w-4 h-4" />,
}

interface CommissionConfigCardProps {
	config: CommissionConfig
}

export default function CommissionConfigCard({ config }: CommissionConfigCardProps) {
	const { t, i18n } = useTranslation('commissions')
	const { t: tCommon } = useTranslation()
	const navigate = useNavigate()
	const { venueSlug } = useCurrentVenue()
	const { getDisplayName: getRoleDisplayName } = useRoleConfig()
	const { toast } = useToast()
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)

	// Check if role rates are configured
	const hasRoleRates = config.roleRates && Object.keys(config.roleRates).length > 0

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
		navigate(`/venues/${venueSlug}/commissions/config/${config.id}`)
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
								<div className="flex items-center gap-2 mt-1">
									<Badge variant={config.active ? 'default' : 'secondary'}>
										{config.active ? t('config.active') : t('config.inactive')}
									</Badge>
									<span className="text-xs text-muted-foreground">
										{t('calcTypes.' + config.calcType)}
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
							{/* Recipient */}
							<div className="p-3 rounded-lg bg-muted/50">
								<p className="text-xs text-muted-foreground">{t('config.recipient')}</p>
								<div className="flex items-center gap-1.5 mt-1">
									{recipientIcons[config.recipient]}
									<span className="text-sm font-medium">
										{t('recipients.' + config.recipient)}
									</span>
								</div>
							</div>
						</div>
					) : (
						<div className="grid grid-cols-2 gap-4 mb-4">
							<div className="p-3 rounded-lg bg-muted/50">
								<p className="text-xs text-muted-foreground">{t('config.defaultRate')}</p>
								<p className="text-lg font-semibold">{formatPercent(config.defaultRate)}</p>
							</div>
							<div className="p-3 rounded-lg bg-muted/50">
								<p className="text-xs text-muted-foreground">{t('config.recipient')}</p>
								<div className="flex items-center gap-1.5 mt-1">
									{recipientIcons[config.recipient]}
									<span className="text-sm font-medium">
										{t('recipients.' + config.recipient)}
									</span>
								</div>
							</div>
						</div>
					)}

					{/* Meta Info */}
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<span>
							{t('config.effectiveFrom')}: {formatDate(config.effectiveFrom)}
						</span>
						{config._count && (config._count.tiers > 0 || config._count.overrides > 0) && (
							<span>
								{config._count.tiers > 0 && (
									<>{config._count.tiers} {t('tiers.title').toLowerCase()}</>
								)}
								{config._count.tiers > 0 && config._count.overrides > 0 && ' • '}
								{config._count.overrides > 0 && (
									<>{config._count.overrides} {t('overrides.title').toLowerCase()}</>
								)}
							</span>
						)}
					</div>

					{/* Actions */}
					<div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
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
												navigate(`/venues/${venueSlug}/commissions/config/${config.id}`)
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
