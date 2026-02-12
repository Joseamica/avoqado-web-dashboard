import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Plus, Settings2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAccess } from '@/hooks/use-access'
import {
	useOrgCommissionConfigs,
	useDeleteOrgCommissionConfig,
} from '@/hooks/useCommissions'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { CommissionConfig, CommissionCalcType } from '@/types/commission'
import { CreateCommissionWizard } from './wizard'

// Calc type labels
const calcTypeLabels: Record<CommissionCalcType, string> = {
	PERCENTAGE: '%',
	FIXED: '$',
	TIERED: 'T',
	MILESTONE: 'M',
	MANUAL: 'H',
}

export default function OrgCommissionConfigSection() {
	const { t, i18n } = useTranslation('commissions')
	const { can } = useAccess()
	const { toast } = useToast()
	const { fullBasePath } = useCurrentVenue()
	const navigate = useNavigate()
	const [showCreateDialog, setShowCreateDialog] = useState(false)
	const [deleteConfigId, setDeleteConfigId] = useState<string | null>(null)

	const { data: orgConfigs, isLoading } = useOrgCommissionConfigs()
	const deleteOrgConfigMutation = useDeleteOrgCommissionConfig()

	if (!can('commissions:org-manage')) return null

	const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`

	const formatCurrency = (amount: number | null) => {
		if (amount === null) return null
		return new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
			style: 'currency',
			currency: 'MXN',
			minimumFractionDigits: 0,
		}).format(amount)
	}

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString(
			i18n.language === 'es' ? 'es-MX' : 'en-US',
			{ month: 'short', day: 'numeric', year: 'numeric' }
		)
	}

	const handleDelete = async () => {
		if (!deleteConfigId) return
		try {
			await deleteOrgConfigMutation.mutateAsync(deleteConfigId)
			toast({ title: t('orgConfig.deleteSuccess') })
		} catch {
			toast({ title: t('orgConfig.error'), variant: 'destructive' })
		} finally {
			setDeleteConfigId(null)
		}
	}

	return (
		<>
			<div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6 space-y-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-xl bg-purple-500/10">
							<Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
						</div>
						<div>
							<h3 className="font-semibold">{t('orgConfig.title')}</h3>
							<p className="text-sm text-muted-foreground">{t('orgConfig.description')}</p>
						</div>
					</div>
					<Button
						size="sm"
						onClick={() => setShowCreateDialog(true)}
						className="cursor-pointer"
					>
						<Plus className="h-4 w-4 mr-1" />
						{t('config.create')}
					</Button>
				</div>

				{isLoading ? (
					<div className="space-y-3">
						<Skeleton className="h-20 w-full rounded-xl" />
						<Skeleton className="h-20 w-full rounded-xl" />
					</div>
				) : !orgConfigs?.length ? (
					<div className="flex flex-col items-center justify-center text-center py-8 space-y-3">
						<div className="p-3 rounded-full bg-muted/50">
							<Settings2 className="h-6 w-6 text-muted-foreground" />
						</div>
						<div className="space-y-1">
							<p className="text-sm font-medium text-muted-foreground">{t('orgConfig.empty')}</p>
							<p className="text-xs text-muted-foreground max-w-sm">{t('orgConfig.emptyDescription')}</p>
						</div>
					</div>
				) : (
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
						{orgConfigs.map((config: CommissionConfig) => (
							<div
								key={config.id}
								className={cn(
									'rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4',
									'hover:shadow-sm hover:border-border transition-all duration-200 cursor-pointer'
								)}
								onClick={() => navigate(`${fullBasePath}/commissions/config/${config.id}`)}
							>
								<div className="flex items-start justify-between mb-2">
									<div>
										<div className="flex items-center gap-2">
											<h4 className="font-medium text-sm">{config.name}</h4>
											<Badge variant="outline" className="text-xs border-purple-500/50 text-purple-600 dark:text-purple-400">
												{t('orgConfig.source.organization')}
											</Badge>
										</div>
										<div className="flex items-center gap-2 mt-1">
											<Badge variant={config.active ? 'default' : 'secondary'} className="text-xs">
												{config.active ? t('config.active') : t('config.inactive')}
											</Badge>
											<span className="text-xs text-muted-foreground">
												{t('calcTypes.' + config.calcType)}
											</span>
										</div>
									</div>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7 text-destructive hover:text-destructive cursor-pointer"
													onClick={(e) => {
														e.stopPropagation()
														setDeleteConfigId(config.id)
													}}
												>
													<Trash2 className="h-3.5 w-3.5" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>{t('config.delete')}</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>

								<div className="grid grid-cols-2 gap-2 text-xs">
									<div className="p-2 rounded-lg bg-muted/50">
										<span className="text-muted-foreground">{t('config.defaultRate')}</span>
										<p className="font-semibold mt-0.5">
											{config.calcType === 'FIXED'
												? formatCurrency(config.defaultRate)
												: formatPercent(config.defaultRate)}
										</p>
									</div>
									<div className="p-2 rounded-lg bg-muted/50">
										<span className="text-muted-foreground">{t('config.effectiveFrom')}</span>
										<p className="font-medium mt-0.5">{formatDate(config.effectiveFrom)}</p>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Create Org Config Dialog — reuses the commission wizard */}
			<Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
				<DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{t('config.create')} — {t('orgConfig.source.organization')}
						</DialogTitle>
					</DialogHeader>
					<CreateCommissionWizard
						onSuccess={() => setShowCreateDialog(false)}
						isOrgLevel
					/>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation */}
			<AlertDialog open={!!deleteConfigId} onOpenChange={(open) => !open && setDeleteConfigId(null)}>
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
