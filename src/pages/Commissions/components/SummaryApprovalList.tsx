import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertCircle, Clock, CheckCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { PermissionGate } from '@/components/PermissionGate'
import { useApproveSummary, useDisputeSummary, useApproveSummariesBatch } from '@/hooks/useCommissions'
import { useToast } from '@/hooks/use-toast'
import type { CommissionSummary } from '@/types/commission'
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

interface SummaryApprovalListProps {
	summaries: CommissionSummary[]
	isLoading: boolean
}

export default function SummaryApprovalList({
	summaries,
	isLoading,
}: SummaryApprovalListProps) {
	const { t, i18n } = useTranslation('commissions')
	const { t: tCommon } = useTranslation()
	const { toast } = useToast()

	const [showDisputeDialog, setShowDisputeDialog] = useState(false)
	const [selectedSummary, setSelectedSummary] = useState<CommissionSummary | null>(null)
	const [disputeReason, setDisputeReason] = useState('')

	const approveSummaryMutation = useApproveSummary()
	const disputeSummaryMutation = useDisputeSummary()
	const approveBatchMutation = useApproveSummariesBatch()

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
			style: 'currency',
			currency: 'MXN',
			minimumFractionDigits: 2,
		}).format(amount)
	}

	// Format period
	const formatPeriod = (start: string, end: string) => {
		const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
		const startDate = new Date(start).toLocaleDateString(
			i18n.language === 'es' ? 'es-MX' : 'en-US',
			options
		)
		const endDate = new Date(end).toLocaleDateString(
			i18n.language === 'es' ? 'es-MX' : 'en-US',
			options
		)
		return `${startDate} - ${endDate}`
	}

	const handleApprove = async (summaryId: string) => {
		try {
			await approveSummaryMutation.mutateAsync(summaryId)
			toast({
				title: t('success.summaryApproved'),
			})
		} catch (error: any) {
			toast({
				title: t('errors.approveError'),
				description: error.response?.data?.message || tCommon('common.error'),
				variant: 'destructive',
			})
		}
	}

	const handleApproveAll = async () => {
		const summaryIds = summaries.map((s) => s.id)
		try {
			const result = await approveBatchMutation.mutateAsync(summaryIds)
			toast({
				title: t('success.summariesApproved', { count: result.approved }),
			})
		} catch (error: any) {
			toast({
				title: t('errors.approveError'),
				description: error.response?.data?.message || tCommon('common.error'),
				variant: 'destructive',
			})
		}
	}

	const handleDispute = async () => {
		if (!selectedSummary || !disputeReason.trim()) return

		try {
			await disputeSummaryMutation.mutateAsync({
				summaryId: selectedSummary.id,
				reason: disputeReason,
			})
			toast({
				title: t('success.summaryDisputed'),
			})
			setShowDisputeDialog(false)
			setSelectedSummary(null)
			setDisputeReason('')
		} catch (error: any) {
			toast({
				title: t('errors.disputeError'),
				description: error.response?.data?.message || tCommon('common.error'),
				variant: 'destructive',
			})
		}
	}

	if (isLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-32 w-full rounded-2xl" />
				<Skeleton className="h-32 w-full rounded-2xl" />
			</div>
		)
	}

	if (summaries.length === 0) {
		return (
			<GlassCard className="p-12">
				<div className="flex flex-col items-center justify-center text-center space-y-4">
					<div className="p-4 rounded-full bg-green-500/10">
						<CheckCircle2 className="h-8 w-8 text-green-500" />
					</div>
					<div className="space-y-2">
						<h3 className="text-lg font-semibold">{t('summary.noSummaries')}</h3>
						<p className="text-sm text-muted-foreground max-w-md">
							{t('summary.noSummariesDescription')}
						</p>
					</div>
				</div>
			</GlassCard>
		)
	}

	return (
		<div className="space-y-6">
			{/* Header with Approve All */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold">{t('summary.title')}</h2>
					<p className="text-sm text-muted-foreground">
						{summaries.length} {t('summary.title').toLowerCase()} {t('status.PENDING_APPROVAL').toLowerCase()}
					</p>
				</div>
				<PermissionGate permission="commissions:approve">
					<Button
						onClick={handleApproveAll}
						disabled={approveBatchMutation.isPending}
					>
						<CheckCheck className="h-4 w-4 mr-2" />
						{t('summary.approveAll')}
					</Button>
				</PermissionGate>
			</div>

			{/* Summary Cards */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
				{summaries.map((summary) => (
					<GlassCard key={summary.id} className="p-5">
						{/* Header */}
						<div className="flex items-start justify-between mb-4">
							<div>
								<h3 className="font-semibold">
									{summary.staff.firstName} {summary.staff.lastName}
								</h3>
								<p className="text-sm text-muted-foreground">
									{formatPeriod(summary.periodStart, summary.periodEnd)}
								</p>
							</div>
							<Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
								<Clock className="h-3 w-3 mr-1" />
								{t('status.PENDING_APPROVAL')}
							</Badge>
						</div>

						{/* Amounts */}
						<div className="grid grid-cols-3 gap-3 mb-4">
							<div className="p-3 rounded-lg bg-muted/50">
								<p className="text-xs text-muted-foreground">{t('summary.commission')}</p>
								<p className="text-sm font-semibold">{formatCurrency(summary.totalCommissions)}</p>
							</div>
							<div className="p-3 rounded-lg bg-muted/50">
								<p className="text-xs text-muted-foreground">{t('summary.bonuses')}</p>
								<p className="text-sm font-semibold">{formatCurrency(summary.totalBonuses)}</p>
							</div>
							<div className="p-3 rounded-lg bg-muted/50">
								<p className="text-xs text-muted-foreground">{t('summary.netAmount')}</p>
								<p className="text-sm font-bold text-foreground">{formatCurrency(summary.netAmount)}</p>
							</div>
						</div>

						{/* Actions */}
						<div className="flex items-center gap-2 pt-4 border-t border-border/50">
							<PermissionGate permission="commissions:approve">
								<Button
									size="sm"
									onClick={() => handleApprove(summary.id)}
									disabled={approveSummaryMutation.isPending}
								>
									<CheckCircle2 className="h-4 w-4 mr-2" />
									{t('summary.approve')}
								</Button>
							</PermissionGate>

							<Button
								size="sm"
								variant="outline"
								onClick={() => {
									setSelectedSummary(summary)
									setShowDisputeDialog(true)
								}}
							>
								<AlertCircle className="h-4 w-4 mr-2" />
								{t('summary.dispute')}
							</Button>
						</div>
					</GlassCard>
				))}
			</div>

			{/* Dispute Dialog */}
			<Dialog open={showDisputeDialog} onOpenChange={setShowDisputeDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('summary.dispute')}</DialogTitle>
						<DialogDescription>
							{selectedSummary && (
								<>
									{selectedSummary.staff.firstName} {selectedSummary.staff.lastName} -{' '}
									{formatCurrency(selectedSummary.netAmount)}
								</>
							)}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div>
							<label className="text-sm font-medium">
								{t('summary.disputeReason')}
							</label>
							<Textarea
								placeholder={t('summary.disputeReasonPlaceholder')}
								value={disputeReason}
								onChange={(e) => setDisputeReason(e.target.value)}
								className="mt-2"
								rows={4}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setShowDisputeDialog(false)
								setSelectedSummary(null)
								setDisputeReason('')
							}}
						>
							{t('actions.cancel')}
						</Button>
						<Button
							variant="destructive"
							onClick={handleDispute}
							disabled={!disputeReason.trim() || disputeSummaryMutation.isPending}
						>
							{t('summary.dispute')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
