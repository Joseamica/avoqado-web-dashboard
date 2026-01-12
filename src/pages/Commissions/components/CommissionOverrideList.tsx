import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Users, UserMinus, Ban } from 'lucide-react'
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
import { useDeleteCommissionOverride } from '@/hooks/useCommissions'
import { useToast } from '@/hooks/use-toast'
import type { CommissionOverride } from '@/types/commission'
import { cn } from '@/lib/utils'
import CreateOverrideDialog from './CreateOverrideDialog'

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

interface CommissionOverrideListProps {
	configId: string
	overrides: CommissionOverride[]
	isLoading: boolean
}

export default function CommissionOverrideList({
	configId,
	overrides,
	isLoading,
}: CommissionOverrideListProps) {
	const { t, i18n } = useTranslation('commissions')
	const { t: tCommon } = useTranslation()
	const { toast } = useToast()

	const [showCreateDialog, setShowCreateDialog] = useState(false)
	const [editingOverride, setEditingOverride] = useState<CommissionOverride | null>(null)
	const [deletingOverride, setDeletingOverride] = useState<CommissionOverride | null>(null)

	const deleteOverrideMutation = useDeleteCommissionOverride(configId)
	const safeOverrides = overrides.filter((override): override is CommissionOverride => Boolean(override))

	// Format percentage
	const formatPercent = (value: number | null) => {
		if (value === null) return '-'
		return `${(value * 100).toFixed(2)}%`
	}

	// Format date
	const formatDate = (dateString: string | null) => {
		if (!dateString) return '-'
		return new Date(dateString).toLocaleDateString(
			i18n.language === 'es' ? 'es-MX' : 'en-US',
			{ month: 'short', day: 'numeric', year: 'numeric' }
		)
	}

	const handleDelete = async () => {
		if (!deletingOverride) return
		try {
			await deleteOverrideMutation.mutateAsync(deletingOverride.id)
			toast({
				title: t('success.overrideDeleted'),
			})
			setDeletingOverride(null)
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

	return (
		<>
			<GlassCard className="p-5">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
							<Users className="w-4 h-4 text-orange-600 dark:text-orange-400" />
						</div>
						<div>
							<h3 className="font-semibold">{t('overrides.title')}</h3>
							<p className="text-xs text-muted-foreground">{t('overrides.subtitle')}</p>
						</div>
					</div>

					<PermissionGate permission="commissions:create">
						<Button
							size="sm"
							onClick={() => {
								setEditingOverride(null)
								setShowCreateDialog(true)
							}}
						>
							<Plus className="h-4 w-4 mr-2" />
							{t('overrides.create')}
						</Button>
					</PermissionGate>
				</div>

				{safeOverrides.length === 0 ? (
					<div className="py-8 text-center">
						<p className="text-sm text-muted-foreground">{t('overrides.noOverrides')}</p>
						<p className="text-xs text-muted-foreground mt-1">
							{t('overrides.noOverridesDescription')}
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{safeOverrides.map((override) => (
							<div
								key={override.id}
								className={cn(
									'flex items-center justify-between p-4 rounded-lg border',
									override.active
										? 'bg-muted/30 border-border/50'
										: 'bg-muted/10 border-border/30 opacity-60'
								)}
							>
								<div className="flex items-center gap-4">
									<div className={cn(
										'flex items-center justify-center w-10 h-10 rounded-full',
										override.excludeFromCommissions
											? 'bg-red-100 dark:bg-red-900/30'
											: 'bg-primary/10'
									)}>
										{override.excludeFromCommissions ? (
											<Ban className="w-5 h-5 text-red-600 dark:text-red-400" />
										) : (
											<UserMinus className="w-5 h-5 text-primary" />
										)}
									</div>
									<div>
										<div className="flex items-center gap-2">
											<span className="font-medium">
												{override.staff.firstName} {override.staff.lastName}
											</span>
											{override.excludeFromCommissions && (
												<Badge variant="destructive" className="text-xs">
													{t('overrides.excluded')}
												</Badge>
											)}
											{!override.active && (
												<Badge variant="secondary" className="text-xs">
													{t('config.inactive')}
												</Badge>
											)}
										</div>
										<div className="flex items-center gap-2 mt-1">
											{override.customRate !== null && (
												<span className="text-sm text-muted-foreground">
													{t('overrides.customRate')}: {formatPercent(override.customRate)}
												</span>
											)}
											{override.effectiveFrom && (
												<span className="text-xs text-muted-foreground">
													• {formatDate(override.effectiveFrom)}
													{override.effectiveTo && ` - ${formatDate(override.effectiveTo)}`}
												</span>
											)}
										</div>
										{override.notes && (
											<p className="text-xs text-muted-foreground mt-1 italic">
												{override.notes}
											</p>
										)}
									</div>
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
															setEditingOverride(override)
															setShowCreateDialog(true)
														}}
													>
														<Pencil className="h-4 w-4" />
													</Button>
												</TooltipTrigger>
												<TooltipContent>{t('overrides.edit')}</TooltipContent>
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
														onClick={() => setDeletingOverride(override)}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</TooltipTrigger>
												<TooltipContent>{t('overrides.delete')}</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</PermissionGate>
								</div>
							</div>
						))}
					</div>
				)}
			</GlassCard>

			{/* Create/Edit Override Dialog */}
			<CreateOverrideDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
				configId={configId}
				override={editingOverride}
			/>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={!!deletingOverride} onOpenChange={() => setDeletingOverride(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('overrides.delete')}</AlertDialogTitle>
						<AlertDialogDescription>
							{t('overrides.deleteConfirm')}
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
