import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { useAccess } from '@/hooks/use-access'
import {
	useOrgPayoutConfig,
	useUpsertOrgPayoutConfig,
} from '@/hooks/useCommissions'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const PERIODS = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY'] as const
const METHODS = ['CASH', 'BANK_TRANSFER'] as const

export default function OrgPayoutConfigSection() {
	const { t } = useTranslation('commissions')
	const { can } = useAccess()
	const { toast } = useToast()

	const { data: orgPayoutConfig, isLoading } = useOrgPayoutConfig()
	const upsertMutation = useUpsertOrgPayoutConfig()

	const [aggregationPeriod, setAggregationPeriod] = useState<string>(
		orgPayoutConfig?.aggregationPeriod ?? 'MONTHLY'
	)
	const [requireApproval, setRequireApproval] = useState(
		orgPayoutConfig?.requireApproval ?? true
	)
	const [paymentMethods, setPaymentMethods] = useState<string[]>(
		orgPayoutConfig?.paymentMethods ?? ['CASH', 'BANK_TRANSFER']
	)
	const [hasChanges, setHasChanges] = useState(false)

	// Sync state when data loads
	const initializedRef = useState(false)
	if (!initializedRef[0] && orgPayoutConfig) {
		setAggregationPeriod(orgPayoutConfig.aggregationPeriod)
		setRequireApproval(orgPayoutConfig.requireApproval)
		setPaymentMethods(orgPayoutConfig.paymentMethods)
		initializedRef[1](true)
	}

	if (!can('commissions:org-manage')) return null

	const togglePaymentMethod = (method: string) => {
		setPaymentMethods(prev => {
			const next = prev.includes(method)
				? prev.filter(m => m !== method)
				: [...prev, method]
			// Must have at least one method
			return next.length > 0 ? next : prev
		})
		setHasChanges(true)
	}

	const handleSave = async () => {
		try {
			await upsertMutation.mutateAsync({
				aggregationPeriod,
				requireApproval,
				paymentMethods,
			})
			toast({ title: t('orgPayout.saveSuccess') })
			setHasChanges(false)
		} catch {
			toast({ title: t('orgPayout.error'), variant: 'destructive' })
		}
	}

	return (
		<div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6 space-y-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="p-2 rounded-xl bg-purple-500/10">
						<CreditCard className="h-5 w-5 text-purple-600 dark:text-purple-400" />
					</div>
					<div>
						<h3 className="font-semibold">{t('orgPayout.title')}</h3>
						<p className="text-sm text-muted-foreground">{t('orgPayout.description')}</p>
					</div>
				</div>
				{hasChanges && (
					<Button
						size="sm"
						onClick={handleSave}
						disabled={upsertMutation.isPending}
						className="cursor-pointer"
					>
						<Check className="h-4 w-4 mr-1" />
						{t('orgPayout.save')}
					</Button>
				)}
			</div>

			{isLoading ? (
				<Skeleton className="h-28 w-full rounded-xl" />
			) : (
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{/* Aggregation Period */}
					<div className="space-y-2">
						<Label className="text-sm font-medium">{t('orgPayout.aggregationPeriod')}</Label>
						<Select
							value={aggregationPeriod}
							onValueChange={(v) => {
								setAggregationPeriod(v)
								setHasChanges(true)
							}}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PERIODS.map(p => (
									<SelectItem key={p} value={p}>
										{t(`orgPayout.periods.${p}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Require Approval */}
					<div className="space-y-2">
						<Label className="text-sm font-medium">{t('orgPayout.requireApproval')}</Label>
						<div className="flex items-center gap-2 mt-2">
							<Switch
								checked={requireApproval}
								onCheckedChange={(v) => {
									setRequireApproval(v)
									setHasChanges(true)
								}}
							/>
							<span className="text-sm text-muted-foreground">
								{requireApproval ? t('config.active') : t('config.inactive')}
							</span>
						</div>
					</div>

					{/* Payment Methods */}
					<div className="space-y-2">
						<Label className="text-sm font-medium">{t('orgPayout.paymentMethods')}</Label>
						<div className="flex flex-wrap gap-2 mt-1">
							{METHODS.map(method => (
								<Badge
									key={method}
									variant={paymentMethods.includes(method) ? 'default' : 'outline'}
									className={cn(
										'cursor-pointer transition-colors',
										paymentMethods.includes(method) && 'bg-primary text-primary-foreground'
									)}
									onClick={() => togglePaymentMethod(method)}
								>
									{t(`orgPayout.methods.${method}`)}
								</Badge>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
