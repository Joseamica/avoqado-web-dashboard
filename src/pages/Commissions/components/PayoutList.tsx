import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { type ColumnDef } from '@tanstack/react-table'
import {
	DollarSign,
	Plus,
	MoreHorizontal,
	CheckCircle2,
	XCircle,
	Clock,
	CreditCard,
	Banknote,
	FileText,
	HelpCircle,
} from 'lucide-react'
import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PermissionGate } from '@/components/PermissionGate'
import {
	useProcessPayout,
	useCompletePayout,
	useCancelPayout,
} from '@/hooks/useCommissions'
import { useToast } from '@/hooks/use-toast'
import type { CommissionPayout, CommissionPayoutStatus } from '@/types/commission'
import { cn } from '@/lib/utils'

// Status badge styles
const statusStyles: Record<CommissionPayoutStatus, string> = {
	PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
	APPROVED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
	PROCESSING: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
	PAID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
	FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
	CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}

// Payment method icons
const paymentMethodIcons: Record<string, React.ReactNode> = {
	BANK_TRANSFER: <CreditCard className="h-4 w-4" />,
	CASH: <Banknote className="h-4 w-4" />,
	CHECK: <FileText className="h-4 w-4" />,
	OTHER: <HelpCircle className="h-4 w-4" />,
}

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

interface PayoutListProps {
	payouts: CommissionPayout[]
	isLoading: boolean
}

export default function PayoutList({ payouts, isLoading }: PayoutListProps) {
	const { t, i18n } = useTranslation('commissions')
	const { t: tCommon } = useTranslation()
	const { toast } = useToast()

	const [pagination, setPagination] = useState({
		pageIndex: 0,
		pageSize: 10,
	})

	const processPayoutMutation = useProcessPayout()
	const completePayoutMutation = useCompletePayout()
	const cancelPayoutMutation = useCancelPayout()

	// Format currency
	const formatCurrency = (amount: number) => {
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
			{ month: 'short', day: 'numeric', year: 'numeric' }
		)
	}

	const handleProcess = async (payoutId: string) => {
		try {
			await processPayoutMutation.mutateAsync(payoutId)
			toast({
				title: t('success.payoutProcessed'),
			})
		} catch (error: any) {
			toast({
				title: tCommon('common.error'),
				description: error.response?.data?.message,
				variant: 'destructive',
			})
		}
	}

	const handleComplete = async (payoutId: string) => {
		try {
			await completePayoutMutation.mutateAsync({ payoutId })
			toast({
				title: t('success.payoutCompleted'),
			})
		} catch (error: any) {
			toast({
				title: tCommon('common.error'),
				description: error.response?.data?.message,
				variant: 'destructive',
			})
		}
	}

	const handleCancel = async (payoutId: string) => {
		try {
			await cancelPayoutMutation.mutateAsync({ payoutId })
			toast({
				title: t('success.payoutCancelled'),
			})
		} catch (error: any) {
			toast({
				title: tCommon('common.error'),
				description: error.response?.data?.message,
				variant: 'destructive',
			})
		}
	}

	// Table columns
	const columns: ColumnDef<CommissionPayout>[] = useMemo(
		() => [
			{
				accessorKey: 'staff',
				header: t('table.staff'),
				cell: ({ row }) => {
					const staff = row.original.staff
					return (
						<div className="font-medium">
							{staff.firstName} {staff.lastName}
						</div>
					)
				},
			},
			{
				accessorKey: 'amount',
				header: t('payout.amount'),
				cell: ({ row }) => (
					<span className="font-semibold">
						{formatCurrency(row.original.amount)}
					</span>
				),
			},
			{
				accessorKey: 'paymentMethod',
				header: t('payout.paymentMethod'),
				cell: ({ row }) => {
					const method = row.original.paymentMethod
					return (
						<div className="flex items-center gap-2">
							{paymentMethodIcons[method] || paymentMethodIcons.OTHER}
							<span>{t(`payout.paymentMethods.${method}`)}</span>
						</div>
					)
				},
			},
			{
				accessorKey: 'status',
				header: t('table.status'),
				cell: ({ row }) => {
					const status = row.original.status
					return (
						<Badge className={cn('font-medium', statusStyles[status])}>
							{t(`status.${status}`)}
						</Badge>
					)
				},
			},
			{
				accessorKey: 'paidAt',
				header: t('payout.paidAt'),
				cell: ({ row }) => formatDate(row.original.paidAt),
			},
			{
				id: 'actions',
				header: t('table.actions'),
				cell: ({ row }) => {
					const payout = row.original
					const canProcess = payout.status === 'APPROVED'
					const canComplete = payout.status === 'PROCESSING'
					const canCancel = ['PENDING', 'APPROVED'].includes(payout.status)

					return (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" className="h-8 w-8">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{canProcess && (
									<PermissionGate permission="commissions:process_payout">
										<DropdownMenuItem onClick={() => handleProcess(payout.id)}>
											<Clock className="h-4 w-4 mr-2" />
											{t('payout.process')}
										</DropdownMenuItem>
									</PermissionGate>
								)}
								{canComplete && (
									<PermissionGate permission="commissions:process_payout">
										<DropdownMenuItem onClick={() => handleComplete(payout.id)}>
											<CheckCircle2 className="h-4 w-4 mr-2" />
											{t('payout.complete')}
										</DropdownMenuItem>
									</PermissionGate>
								)}
								{canCancel && (
									<>
										<DropdownMenuSeparator />
										<PermissionGate permission="commissions:process_payout">
											<DropdownMenuItem
												onClick={() => handleCancel(payout.id)}
												className="text-destructive"
											>
												<XCircle className="h-4 w-4 mr-2" />
												{t('payout.cancel')}
											</DropdownMenuItem>
										</PermissionGate>
									</>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					)
				},
			},
		],
		[t, i18n.language, formatCurrency, formatDate, handleProcess, handleComplete, handleCancel]
	)

	if (isLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
			</div>
		)
	}

	if (payouts.length === 0) {
		return (
			<GlassCard className="p-12">
				<div className="flex flex-col items-center justify-center text-center space-y-4">
					<div className="p-4 rounded-full bg-muted">
						<DollarSign className="h-8 w-8 text-muted-foreground" />
					</div>
					<div className="space-y-2">
						<h3 className="text-lg font-semibold">{t('payout.noPayouts')}</h3>
						<p className="text-sm text-muted-foreground max-w-md">
							{t('payout.noPayoutsDescription')}
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
					<h2 className="text-lg font-semibold">{t('payout.title')}</h2>
					<p className="text-sm text-muted-foreground">{t('payout.subtitle')}</p>
				</div>
			</div>

			<div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
				<DataTable<CommissionPayout>
					columns={columns}
					data={payouts}
					pagination={pagination}
					setPagination={setPagination}
					rowCount={payouts.length}
				/>
			</div>
		</div>
	)
}
