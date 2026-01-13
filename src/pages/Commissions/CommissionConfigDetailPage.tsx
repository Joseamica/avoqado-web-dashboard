import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
	ArrowLeft,
	Pencil,
	Trash2,
	Percent,
	DollarSign,
	TrendingUp,
	Target,
	Hand,
	User,
	UserCheck,
	CreditCard,
	Settings2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { PermissionGate } from '@/components/PermissionGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useRoleConfig } from '@/hooks/use-role-config'
import {
	useCommissionConfig,
	useCommissionTiers,
	useCommissionOverrides,
	useDeleteCommissionConfig,
} from '@/hooks/useCommissions'
import { useToast } from '@/hooks/use-toast'
import type { CommissionCalcType, CommissionRecipient } from '@/types/commission'
import { cn } from '@/lib/utils'
import CommissionTierList from './components/CommissionTierList'
import CommissionOverrideList from './components/CommissionOverrideList'
import EditConfigDialog from './components/EditConfigDialog'

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

// Icons for calculation types
const calcTypeIcons: Record<CommissionCalcType, React.ReactNode> = {
	PERCENTAGE: <Percent className="w-5 h-5" />,
	FIXED: <DollarSign className="w-5 h-5" />,
	TIERED: <TrendingUp className="w-5 h-5" />,
	MILESTONE: <Target className="w-5 h-5" />,
	MANUAL: <Hand className="w-5 h-5" />,
}

// Icons for recipients
const recipientIcons: Record<CommissionRecipient, React.ReactNode> = {
	CREATOR: <User className="w-4 h-4" />,
	SERVER: <UserCheck className="w-4 h-4" />,
	PROCESSOR: <CreditCard className="w-4 h-4" />,
}

export default function CommissionConfigDetailPage() {
	const { configId } = useParams<{ configId: string }>()
	const navigate = useNavigate()
	const [searchParams, setSearchParams] = useSearchParams()
	const { venueSlug } = useCurrentVenue()
	const { t, i18n } = useTranslation('commissions')
	const { t: tCommon } = useTranslation()
	const { toast } = useToast()
	const { getDisplayName: getRoleDisplayName } = useRoleConfig()

	const [showEditDialog, setShowEditDialog] = useState(false)
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)

	// Open edit dialog if ?edit=true is in the URL
	useEffect(() => {
		if (searchParams.get('edit') === 'true') {
			setShowEditDialog(true)
			// Clean up the URL
			searchParams.delete('edit')
			setSearchParams(searchParams, { replace: true })
		}
	}, [searchParams, setSearchParams])

	// Fetch data
	const { data: config, isLoading: isLoadingConfig } = useCommissionConfig(configId!)
	const { data: tiers, isLoading: isLoadingTiers } = useCommissionTiers(configId!)
	const { data: overrides, isLoading: isLoadingOverrides } = useCommissionOverrides(configId!)

	const deleteConfigMutation = useDeleteCommissionConfig()

	// Format percentage
	const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`

	// Format currency
	const formatCurrency = (amount: number | null) => {
		if (amount === null) return '-'
		return new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
			style: 'currency',
			currency: 'MXN',
			minimumFractionDigits: 2,
		}).format(amount)
	}

	// Format date
	const formatDate = (dateString: string | null) => {
		if (!dateString) return '-'
		return new Date(dateString).toLocaleDateString(
			i18n.language === 'es' ? 'es-MX' : 'en-US',
			{ month: 'long', day: 'numeric', year: 'numeric' }
		)
	}

	const handleDelete = async () => {
		if (!configId) return
		try {
			await deleteConfigMutation.mutateAsync(configId)
			toast({
				title: t('success.configDeleted'),
			})
			navigate(`/venues/${venueSlug}/commissions`)
		} catch (error: any) {
			toast({
				title: t('errors.deleteError'),
				description: error.response?.data?.message || tCommon('common.error'),
				variant: 'destructive',
			})
		}
	}

	const handleBack = () => {
		navigate(`/venues/${venueSlug}/commissions`)
	}

	if (isLoadingConfig) {
		return (
			<div className="p-4 bg-background text-foreground space-y-6">
				<Skeleton className="h-10 w-48" />
				<Skeleton className="h-64 w-full rounded-2xl" />
				<Skeleton className="h-48 w-full rounded-2xl" />
			</div>
		)
	}

	if (!config) {
		return (
			<div className="p-4 bg-background text-foreground">
				<GlassCard className="p-12">
					<div className="flex flex-col items-center justify-center text-center space-y-4">
						<div className="p-4 rounded-full bg-muted">
							<Settings2 className="h-8 w-8 text-muted-foreground" />
						</div>
						<div className="space-y-2">
							<h3 className="text-lg font-semibold">{t('config.noConfigs')}</h3>
							<p className="text-sm text-muted-foreground">
								{tCommon('common.notFound')}
							</p>
						</div>
						<Button onClick={handleBack}>
							<ArrowLeft className="h-4 w-4 mr-2" />
							{t('actions.back')}
						</Button>
					</div>
				</GlassCard>
			</div>
		)
	}

	return (
		<div className="p-4 bg-background text-foreground">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="icon" onClick={handleBack}>
						<ArrowLeft className="h-5 w-5" />
					</Button>
					<div>
						<div className="flex items-center gap-3">
							<div className={cn(
								'p-2 rounded-xl',
								'bg-gradient-to-br from-purple-500/20 to-purple-500/5'
							)}>
								{calcTypeIcons[config.calcType]}
							</div>
							<div>
								<h1 className="text-2xl font-bold">{config.name}</h1>
								<div className="flex items-center gap-2 mt-1">
									<Badge variant={config.active ? 'default' : 'secondary'}>
										{config.active ? t('config.active') : t('config.inactive')}
									</Badge>
									<span className="text-sm text-muted-foreground">
										{t('calcTypes.' + config.calcType)}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<PermissionGate permission="commissions:update">
						<Button variant="outline" onClick={() => setShowEditDialog(true)}>
							<Pencil className="h-4 w-4 mr-2" />
							{t('config.edit')}
						</Button>
					</PermissionGate>
					<PermissionGate permission="commissions:delete">
						<Button
							variant="outline"
							className="text-destructive hover:text-destructive"
							onClick={() => setShowDeleteDialog(true)}
						>
							<Trash2 className="h-4 w-4 mr-2" />
							{t('config.delete')}
						</Button>
					</PermissionGate>
				</div>
			</div>

			{/* Main Content Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left Column - Config Details */}
				<div className="lg:col-span-1 space-y-6">
					<GlassCard className="p-5">
						<h3 className="font-semibold mb-4">{t('config.title')}</h3>

						{/* Default Rate */}
						<div className="p-4 rounded-lg bg-muted/50 mb-4">
							<p className="text-xs text-muted-foreground mb-1">{t('config.defaultRate')}</p>
							<p className="text-3xl font-bold">{formatPercent(config.defaultRate)}</p>
						</div>

						{/* Key Info */}
						<div className="space-y-3">
							<div className="flex items-center justify-between py-2 border-b border-border/50">
								<span className="text-sm text-muted-foreground">{t('config.recipient')}</span>
								<div className="flex items-center gap-2">
									{recipientIcons[config.recipient]}
									<span className="text-sm font-medium">{t('recipients.' + config.recipient)}</span>
								</div>
							</div>

							<div className="flex items-center justify-between py-2 border-b border-border/50">
								<span className="text-sm text-muted-foreground">{t('config.effectiveFrom')}</span>
								<span className="text-sm font-medium">{formatDate(config.effectiveFrom)}</span>
							</div>

							{config.effectiveTo && (
								<div className="flex items-center justify-between py-2 border-b border-border/50">
									<span className="text-sm text-muted-foreground">{t('config.effectiveTo')}</span>
									<span className="text-sm font-medium">{formatDate(config.effectiveTo)}</span>
								</div>
							)}

							{/* Show limits only if configured */}
							{(config.minAmount !== null || config.maxAmount !== null) && (
								<>
									{config.minAmount !== null && (
										<div className="flex items-center justify-between py-2 border-b border-border/50">
											<span className="text-sm text-muted-foreground">{t('config.minAmount')}</span>
											<span className="text-sm font-medium">{formatCurrency(config.minAmount)}</span>
										</div>
									)}
									{config.maxAmount !== null && (
										<div className="flex items-center justify-between py-2 border-b border-border/50">
											<span className="text-sm text-muted-foreground">{t('config.maxAmount')}</span>
											<span className="text-sm font-medium">{formatCurrency(config.maxAmount)}</span>
										</div>
									)}
								</>
							)}
						</div>


						{/* Role Rates */}
						{config.roleRates && Object.keys(config.roleRates).length > 0 && (
							<div className="mt-4 pt-4 border-t border-border/50">
								<h4 className="text-sm font-medium mb-3">{t('config.roleRates')}</h4>
								<div className="grid grid-cols-2 gap-2">
									{Object.entries(config.roleRates).map(([role, rate]) => (
										<div key={role} className="p-2 rounded-lg bg-muted/50">
											<p className="text-xs text-muted-foreground">{getRoleDisplayName(role)}</p>
											<p className="text-sm font-semibold">{formatPercent(rate)}</p>
										</div>
									))}
								</div>
							</div>
						)}
					</GlassCard>
				</div>

				{/* Right Column - Tiers and Overrides */}
				<div className="lg:col-span-2 space-y-6">
					{/* Tiers Section */}
					{config.calcType === 'TIERED' && (
						<CommissionTierList
							configId={configId!}
							tiers={tiers || []}
							isLoading={isLoadingTiers}
						/>
					)}

					{/* Overrides Section */}
					<CommissionOverrideList
						configId={configId!}
						overrides={overrides || []}
						isLoading={isLoadingOverrides}
					/>
				</div>
			</div>

			{/* Edit Dialog */}
			{showEditDialog && (
				<EditConfigDialog
					open={showEditDialog}
					onOpenChange={setShowEditDialog}
					config={config}
				/>
			)}

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
		</div>
	)
}
