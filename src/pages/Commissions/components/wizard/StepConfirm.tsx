import { useTranslation } from 'react-i18next'
import { TrendingUp, Calculator, DollarSign, Percent, Calendar, ChevronDown, Clock, ArrowUpNarrowWide } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useRoleConfig } from '@/hooks/use-role-config'
import type { WizardData } from './CreateCommissionWizard'
import type { TierPeriod } from '@/types/commission'

interface StepConfirmProps {
	data: WizardData
	updateData: (updates: Partial<WizardData>) => void
	onPrevious: () => void
	onSubmit: () => void
	isSubmitting: boolean
}

export default function StepConfirm({
	data,
	updateData,
	onPrevious,
	onSubmit,
	isSubmitting,
}: StepConfirmProps) {
	const { t, i18n } = useTranslation('commissions')
	const { t: tCommon } = useTranslation()
	const { getDisplayName: getRoleDisplayName } = useRoleConfig()

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
			style: 'currency',
			currency: 'MXN',
			minimumFractionDigits: 2,
		}).format(amount)
	}

	const formatDate = (dateStr: string) => {
		return new Date(dateStr + 'T00:00:00').toLocaleDateString(i18n.language === 'es' ? 'es-MX' : 'en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		})
	}

	// Calculate example commission - consistent $1,000 across all steps
	const exampleSale = 1000
	const isFixed = data.calcType === 'FIXED'
	let exampleCommission = isFixed ? data.fixedAmount : exampleSale * data.defaultRate
	if (data.limitsEnabled && !isFixed) {
		if (data.minAmount !== null && exampleCommission < data.minAmount) {
			exampleCommission = data.minAmount
		}
		if (data.maxAmount !== null && exampleCommission > data.maxAmount) {
			exampleCommission = data.maxAmount
		}
	}

	// Get commission type display
	const getCommissionTypeDisplay = () => {
		if (data.tiersEnabled) {
			return t('wizard.step3.typeTiered', { period: t(`wizard.advanced.tiers.periodOptions.${data.tierPeriod}`) })
		}
		if (isFixed) {
			return `${formatCurrency(data.fixedAmount)} ${t('wizard.step3.perSaleFixed')}`
		}
		return `${(data.defaultRate * 100).toFixed(2)}% ${t('wizard.step3.perSale')}`
	}

	// Get icon for commission type
	const getCommissionIcon = () => {
		if (data.tiersEnabled) {
			return <TrendingUp className="w-4 h-4 text-purple-500" />
		}
		if (isFixed) {
			return <DollarSign className="w-4 h-4 text-green-500" />
		}
		return <Percent className="w-4 h-4 text-blue-500" />
	}

	// Get validity display text
	const getValidityDisplay = () => {
		if (!data.customValidityEnabled) {
			return t('wizard.step3.validityValue')
		}
		const fromDate = formatDate(data.effectiveFrom)
		if (data.effectiveTo) {
			const toDate = formatDate(data.effectiveTo)
			return t('wizard.step3.validityCustomRange', { from: fromDate, to: toDate })
		}
		return t('wizard.step3.validityCustomFrom', { from: fromDate })
	}

	const canSubmit = data.name.trim().length > 0

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="text-center space-y-2">
				<h2 className="text-xl font-semibold">
					{t('wizard.step3.title')}
				</h2>
			</div>

			{/* Name Input */}
			<div>
				<Input
					value={data.name}
					onChange={(e) => updateData({ name: e.target.value })}
					placeholder={t('wizard.step3.namePlaceholder')}
					className="text-lg h-12"
					autoFocus
				/>
				<p className="text-sm text-muted-foreground mt-1.5">
					{t('wizard.step3.nameHint')}
				</p>
			</div>

			{/* Summary Card */}
			<div className="p-4 rounded-xl border border-border/50 bg-muted/30 space-y-4">
				<h3 className="font-medium text-sm text-muted-foreground">
					{t('wizard.step3.summaryTitle')}
				</h3>

				<div className="space-y-3">
					{/* Commission Type */}
					<div className="flex items-center justify-between py-2 border-b border-border/30">
						<span className="text-sm text-muted-foreground">{t('wizard.step3.commission')}</span>
						<div className="flex items-center gap-2">
							{getCommissionIcon()}
							<span className="text-sm font-medium">{getCommissionTypeDisplay()}</span>
						</div>
					</div>

					{/* Show tiers if enabled */}
					{data.tiersEnabled && (
						<div className="py-2 border-b border-border/30">
							<span className="text-sm text-muted-foreground">{t('wizard.step3.tiers')}</span>
							<div className="mt-2 space-y-1">
								{data.tiers.map((tier, index) => (
									<div key={index} className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">
											{['🥉', '🥈', '🥇', '💎', '👑'][index] || '•'} {tier.name}
										</span>
										<span>
											{formatCurrency(tier.minThreshold)} - {tier.maxThreshold ? formatCurrency(tier.maxThreshold) : '∞'} → {(tier.rate * 100).toFixed(0)}%
										</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Limits if enabled */}
					{data.limitsEnabled && (data.minAmount || data.maxAmount) && (
						<div className="flex items-center justify-between py-2 border-b border-border/30">
							<span className="text-sm text-muted-foreground">{t('wizard.step3.limits')}</span>
							<span className="text-sm">
								{data.minAmount ? `${t('wizard.step3.min')}: ${formatCurrency(data.minAmount)}` : ''}
								{data.minAmount && data.maxAmount ? ' | ' : ''}
								{data.maxAmount ? `${t('wizard.step3.max')}: ${formatCurrency(data.maxAmount)}` : ''}
							</span>
						</div>
					)}

					{/* Role rates if enabled */}
					{data.roleRatesEnabled && (
						<div className="py-2 border-b border-border/30">
							<span className="text-sm text-muted-foreground">{t('wizard.step3.roleRates')}</span>
							<div className="mt-2 grid grid-cols-3 gap-2">
								{Object.entries(data.roleRates).map(([role, rate]) => (
									<div key={role} className="text-center p-2 rounded-lg bg-muted/50">
										<span className="text-xs text-muted-foreground block">
											{getRoleDisplayName(role)}
										</span>
										<span className="text-sm font-medium">{(rate * 100).toFixed(1)}%</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Validity - Collapsible */}
					<Collapsible
						open={data.customValidityEnabled}
						onOpenChange={(open) => updateData({ customValidityEnabled: open })}
					>
						<div className="py-2 border-b border-border/30">
							<CollapsibleTrigger asChild>
								<button
									type="button"
									className="w-full flex items-center justify-between hover:bg-muted/50 rounded-lg transition-colors py-1 -mx-1 px-1"
								>
									<div className="flex items-center gap-2">
										<Calendar className="w-4 h-4 text-muted-foreground" />
										<span className="text-sm text-muted-foreground">{t('wizard.step3.validity')}</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-sm font-medium">{getValidityDisplay()}</span>
										<ChevronDown className={cn(
											'w-4 h-4 text-muted-foreground transition-transform',
											data.customValidityEnabled && 'rotate-180'
										)} />
									</div>
								</button>
							</CollapsibleTrigger>

							<CollapsibleContent>
								<div className="mt-3 pt-3 border-t border-border/30 space-y-3">
									<div className="grid grid-cols-2 gap-3">
										<div>
											<label className="text-xs text-muted-foreground block mb-1">
												{t('wizard.step3.effectiveFrom')}
											</label>
											<Input
												type="date"
												value={data.effectiveFrom}
												onChange={(e) => updateData({ effectiveFrom: e.target.value })}
												className="h-9"
											/>
										</div>
										<div>
											<label className="text-xs text-muted-foreground block mb-1">
												{t('wizard.step3.effectiveTo')}
											</label>
											<Input
												type="date"
												value={data.effectiveTo || ''}
												onChange={(e) => updateData({ effectiveTo: e.target.value || null })}
												className="h-9"
												placeholder={t('wizard.step3.noEndDate')}
											/>
										</div>
									</div>
									<p className="text-xs text-muted-foreground">
										{t('wizard.step3.effectiveToHint')}
									</p>
								</div>
							</CollapsibleContent>
						</div>
					</Collapsible>

					{/* Aggregation Period - How often to group commissions for payroll */}
					<div className="flex items-center justify-between py-2 border-b border-border/30">
						<div className="flex items-center gap-2">
							<Clock className="w-4 h-4 text-muted-foreground" />
							<div>
								<span className="text-sm text-muted-foreground">{t('wizard.step3.aggregationPeriod')}</span>
								<p className="text-xs text-muted-foreground">{t('wizard.step3.aggregationPeriodHint')}</p>
							</div>
						</div>
						<Select
							value={data.aggregationPeriod}
							onValueChange={(value) => updateData({ aggregationPeriod: value as TierPeriod })}
						>
							<SelectTrigger className="w-[140px] h-9">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="WEEKLY">{t('wizard.step3.periodOptions.WEEKLY')}</SelectItem>
								<SelectItem value="BIWEEKLY">{t('wizard.step3.periodOptions.BIWEEKLY')}</SelectItem>
								<SelectItem value="MONTHLY">{t('wizard.step3.periodOptions.MONTHLY')}</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Priority - Which config takes precedence when multiple exist */}
					<div className="flex items-center justify-between py-2">
						<div className="flex items-center gap-2">
							<ArrowUpNarrowWide className="w-4 h-4 text-muted-foreground" />
							<div>
								<span className="text-sm text-muted-foreground">{t('wizard.step3.priority')}</span>
								<p className="text-xs text-muted-foreground">{t('wizard.step3.priorityHint')}</p>
							</div>
						</div>
						<Input
							type="number"
							min={1}
							max={100}
							value={data.priority}
							onChange={(e) => updateData({ priority: Math.max(1, Math.min(100, parseInt(e.target.value) || 1)) })}
							className="w-[80px] h-9 text-center"
						/>
					</div>
				</div>
			</div>

			{/* Example Calculation */}
			<div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30">
				<div className="flex items-center gap-2 mb-2">
					<Calculator className="w-4 h-4 text-green-600 dark:text-green-400" />
					<span className="text-sm font-medium text-green-800 dark:text-green-300">
						{t('wizard.step3.exampleTitle', { amount: formatCurrency(exampleSale) })}
					</span>
				</div>
				<div className="space-y-1 text-sm text-green-700 dark:text-green-400">
					<div className="flex justify-between">
						<span>{t('wizard.step3.subtotal')}</span>
						<span>{formatCurrency(exampleSale)}</span>
					</div>
					<div className="flex justify-between">
						<span>
							{isFixed
								? t('wizard.step3.commissionFixed')
								: t('wizard.step3.commissionAmount', { rate: (data.defaultRate * 100).toFixed(0) })
							}
						</span>
						<span className="font-medium">{formatCurrency(exampleCommission)}</span>
					</div>
				</div>
				<p className="text-sm text-green-600 dark:text-green-400 mt-2">
					{t('wizard.step3.resultText', { amount: formatCurrency(exampleCommission) })}
				</p>
			</div>

			{/* Navigation */}
			<div className="flex justify-between pt-4">
				<Button variant="outline" onClick={onPrevious}>
					← {t('wizard.buttons.previous')}
				</Button>
				<Button onClick={onSubmit} disabled={!canSubmit || isSubmitting}>
					{isSubmitting ? tCommon('loading') : `✓ ${t('wizard.buttons.create')}`}
				</Button>
			</div>
		</div>
	)
}
