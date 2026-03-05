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
	Calendar,
	ShieldCheck,
	Receipt,
	Tag,
	Goal,
	CheckCircle2,
	XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
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

// Toggle indicator component
function ToggleIndicator({ enabled, label }: { enabled: boolean; label: string }) {
	return (
		<div className="flex items-center gap-2">
			{enabled ? (
				<CheckCircle2 className="w-4 h-4 text-emerald-500" />
			) : (
				<XCircle className="w-4 h-4 text-muted-foreground/50" />
			)}
			<span className={cn('text-sm', enabled ? 'text-foreground' : 'text-muted-foreground')}>
				{label}
			</span>
		</div>
	)
}

export default function CommissionConfigDetailPage() {
	const { configId } = useParams<{ configId: string }>()
	const navigate = useNavigate()
	const [searchParams, setSearchParams] = useSearchParams()
	const { fullBasePath, venue } = useCurrentVenue()
	const { t, i18n } = useTranslation('commissions')
	const { t: tCommon } = useTranslation()
	const { toast } = useToast()
	const { getDisplayName: getRoleDisplayName } = useRoleConfig()

	const isMexico = venue?.country?.toLowerCase() === 'mexico' || venue?.country?.toLowerCase() === 'méxico' || venue?.country === 'MX'

	const [showEditDialog, setShowEditDialog] = useState(false)
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)

	// Open edit dialog if ?edit=true is in the URL
	useEffect(() => {
		if (searchParams.get('edit') === 'true') {
			setShowEditDialog(true)
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
			navigate(`${fullBasePath}/commissions`)
		} catch (error: any) {
			toast({
				title: t('errors.deleteError'),
				description: error.response?.data?.message || tCommon('common.error'),
				variant: 'destructive',
			})
		}
	}

	const handleBack = () => {
		navigate(`${fullBasePath}/commissions`)
	}

	if (isLoadingConfig) {
		return (
			<div className="p-4 bg-background text-foreground space-y-6">
				<Skeleton className="h-10 w-48" />
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					<Skeleton className="h-96 rounded-2xl" />
					<Skeleton className="h-96 rounded-2xl lg:col-span-2" />
				</div>
			</div>
		)
	}

	if (!config) {
		return (
			<div className="p-4 bg-background text-foreground">
				<div className="rounded-2xl border border-border/50 p-12">
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
				</div>
			</div>
		)
	}

	const hasLimits = config.minAmount !== null || config.maxAmount !== null
	const hasRoleRates = config.roleRates && Object.keys(config.roleRates).length > 0
	const hasCategories = config.filterByCategories && config.categoryIds && config.categoryIds.length > 0

	return (
		<div className="p-4 bg-background text-foreground">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
						<ArrowLeft className="h-5 w-5" />
					</Button>
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
							{calcTypeIcons[config.calcType]}
						</div>
						<div>
							<h1 className="text-2xl font-bold">{config.name}</h1>
							<div className="flex items-center gap-2 mt-0.5">
								<Badge variant={config.active ? 'default' : 'secondary'} className="text-xs">
									{config.active ? t('config.active') : t('config.inactive')}
								</Badge>
								<span className="text-sm text-muted-foreground">
									{t('calcTypes.' + config.calcType)}
								</span>
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
							variant="ghost"
							size="icon"
							className="text-destructive hover:text-destructive hover:bg-destructive/10"
							onClick={() => setShowDeleteDialog(true)}
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</PermissionGate>
				</div>
			</div>

			{/* Main Content Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left Column - Config Details */}
				<div className="lg:col-span-1 space-y-4">
					{/* Rate Card */}
					<div className="rounded-2xl border border-border/50 p-5 space-y-4">
						{/* Primary Rate Display */}
						<div className="text-center py-4">
							{config.calcType === 'FIXED' ? (
								<>
									<p className="text-xs text-muted-foreground mb-1">{t('config.defaultRate')}</p>
									<p className="text-4xl font-bold tracking-tight">{formatCurrency(config.defaultRate)}</p>
									<p className="text-sm text-muted-foreground mt-1">{t('wizard.step2.perTransaction')}</p>
								</>
							) : (
								<>
									<p className="text-xs text-muted-foreground mb-1">{t('config.defaultRate')}</p>
									<p className="text-4xl font-bold tracking-tight">{formatPercent(config.defaultRate)}</p>
									<p className="text-sm text-muted-foreground mt-1">{t('wizard.step2.ofEachSale')}</p>
								</>
							)}
						</div>

						{/* Goal Tier Bonus */}
						{config.useGoalAsTier && config.goalBonusRate !== null && (
							<div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
								<Goal className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
								<div className="text-sm">
									<span className="font-medium text-emerald-700 dark:text-emerald-300">
										{t('wizard.step2.goalTier')}
									</span>
									<p className="text-emerald-600/80 dark:text-emerald-400/80 text-xs mt-0.5">
										{formatPercent(config.defaultRate)} → {formatPercent(config.goalBonusRate)} {t('wizard.step2.goalTierDescription').toLowerCase()}
									</p>
								</div>
							</div>
						)}

						<Separator />

						{/* Key Details */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-sm text-muted-foreground">{t('config.recipient')}</span>
								<div className="flex items-center gap-1.5">
									{recipientIcons[config.recipient]}
									<span className="text-sm font-medium">{t('recipients.' + config.recipient)}</span>
								</div>
							</div>

							<div className="flex items-center justify-between">
								<span className="text-sm text-muted-foreground">{t('config.effectiveFrom')}</span>
								<div className="flex items-center gap-1.5">
									<Calendar className="w-3.5 h-3.5 text-muted-foreground" />
									<span className="text-sm font-medium">{formatDate(config.effectiveFrom)}</span>
								</div>
							</div>

							{config.effectiveTo && (
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground">{t('config.effectiveTo')}</span>
									<span className="text-sm font-medium">{formatDate(config.effectiveTo)}</span>
								</div>
							)}
						</div>

						{/* Limits */}
						{hasLimits && (
							<>
								<Separator />
								<div className="space-y-2">
									{config.minAmount !== null && (
										<div className="flex items-center justify-between">
											<span className="text-sm text-muted-foreground">{t('config.minAmount')}</span>
											<span className="text-sm font-medium">{formatCurrency(config.minAmount)}</span>
										</div>
									)}
									{config.maxAmount !== null && (
										<div className="flex items-center justify-between">
											<span className="text-sm text-muted-foreground">{t('config.maxAmount')}</span>
											<span className="text-sm font-medium">{formatCurrency(config.maxAmount)}</span>
										</div>
									)}
								</div>
							</>
						)}
					</div>

					{/* Calculation Base */}
					<div className="rounded-2xl border border-border/50 p-5 space-y-3">
						<div className="flex items-center gap-2">
							<Receipt className="w-4 h-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold">{t('wizard.step2.calculationBase')}</h3>
						</div>
						<div className="space-y-2">
							<ToggleIndicator
								enabled={config.includeTax ?? false}
								label={t('wizard.step2.includeTax') + (isMexico ? ' (IVA 16%)' : '')}
							/>
							<ToggleIndicator
								enabled={config.includeTips ?? false}
								label={t('wizard.step2.includeTips')}
							/>
							<ToggleIndicator
								enabled={config.includeDiscount ?? false}
								label={t('wizard.step2.includeDiscount')}
							/>
						</div>
					</div>

					{/* Categories */}
					{hasCategories && (
						<div className="rounded-2xl border border-border/50 p-5 space-y-3">
							<div className="flex items-center gap-2">
								<Tag className="w-4 h-4 text-muted-foreground" />
								<h3 className="text-sm font-semibold">{t('wizard.step2.categories')}</h3>
							</div>
							<p className="text-xs text-muted-foreground">
								{t('wizard.step2.onlySpecificCategories')}
							</p>
							<div className="flex flex-wrap gap-1.5">
								{config.categoryIds!.map((id) => (
									<Badge key={id} variant="secondary" className="text-xs">
										{id}
									</Badge>
								))}
							</div>
						</div>
					)}

					{/* Role Rates */}
					{hasRoleRates && (
						<div className="rounded-2xl border border-border/50 p-5 space-y-3">
							<div className="flex items-center gap-2">
								<ShieldCheck className="w-4 h-4 text-muted-foreground" />
								<h3 className="text-sm font-semibold">{t('config.roleRates')}</h3>
							</div>
							<div className="grid grid-cols-2 gap-2">
								{Object.entries(config.roleRates!).map(([role, rate]) => (
									<div key={role} className="p-3 rounded-xl bg-muted/30 border border-border/30">
										<p className="text-xs text-muted-foreground">{getRoleDisplayName(role)}</p>
										<p className="text-lg font-semibold mt-0.5">{formatPercent(rate)}</p>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Right Column - Tiers and Overrides */}
				<div className="lg:col-span-2 space-y-6">
					{/* Tiers Section */}
					{config.calcType === 'TIERED' && !config.useGoalAsTier && (
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

			{/* Edit Dialog (now FullScreenModal) */}
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
