import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Calculator } from 'lucide-react'
import type { WizardData } from './CreateCommissionWizard'

interface LiveExampleProps {
	data: WizardData
	saleAmount?: number
}

export default function LiveExample({ data, saleAmount = 1000 }: LiveExampleProps) {
	const { t, i18n } = useTranslation('commissions')

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
			style: 'currency',
			currency: 'MXN',
			minimumFractionDigits: 2,
		}).format(amount)
	}

	const calculation = useMemo(() => {
		// Calculate raw commission based on calc type
		const isFixed = data.calcType === 'FIXED'
		const rawCommission = isFixed ? data.fixedAmount : saleAmount * data.defaultRate
		let commission = rawCommission

		// Apply limits if enabled (only for percentage mode)
		if (data.limitsEnabled && !isFixed) {
			if (data.minAmount !== null && commission < data.minAmount) {
				commission = data.minAmount
			}
			if (data.maxAmount !== null && commission > data.maxAmount) {
				commission = data.maxAmount
			}
		}

		return {
			saleAmount,
			rate: data.defaultRate * 100,
			fixedAmount: data.fixedAmount,
			isFixed,
			rawCommission,
			finalCommission: commission,
			hasLimit: !isFixed && data.limitsEnabled && (
				(data.minAmount !== null && rawCommission < data.minAmount) ||
				(data.maxAmount !== null && rawCommission > data.maxAmount)
			),
		}
	}, [saleAmount, data.defaultRate, data.fixedAmount, data.calcType, data.limitsEnabled, data.minAmount, data.maxAmount])

	return (
		<div className="p-4 rounded-xl bg-muted/50 border border-border/50">
			<div className="flex items-center gap-2 mb-3">
				<Calculator className="w-4 h-4 text-muted-foreground" />
				<span className="text-sm font-medium">
					{t('wizard.step2.exampleTitle', { amount: formatCurrency(saleAmount) })}
				</span>
			</div>

			<div className="space-y-2 text-sm">
				<div className="flex justify-between">
					<span className="text-muted-foreground">{t('wizard.step2.exampleSale')}</span>
					<span className="font-medium">{formatCurrency(calculation.saleAmount)}</span>
				</div>
				<div className="flex justify-between">
					<span className="text-muted-foreground">
						{t('wizard.step2.exampleCommission')}
					</span>
					<span className="font-medium">
						{calculation.isFixed ? (
							<>{t('wizard.step2.fixedLabel')}: {formatCurrency(calculation.fixedAmount)}</>
						) : (
							<>{formatCurrency(calculation.saleAmount)} × {calculation.rate.toFixed(2)}% = {formatCurrency(calculation.rawCommission)}</>
						)}
					</span>
				</div>

				{calculation.hasLimit && (
					<div className="flex justify-between text-orange-600 dark:text-orange-400">
						<span>{t('wizard.advanced.limits.limitApplied')}</span>
						<span className="font-medium">{formatCurrency(calculation.finalCommission)}</span>
					</div>
				)}
			</div>

			<div className="mt-3 pt-3 border-t border-border/50">
				<p className="text-sm text-muted-foreground">
					{t('wizard.step2.exampleResult', {
						commission: formatCurrency(calculation.finalCommission),
					})}
				</p>
			</div>
		</div>
	)
}

// Tiered example calculation for advanced mode
interface TieredExampleProps {
	data: WizardData
	totalSales?: number
}

export function TieredExample({ data, totalSales = 15000 }: TieredExampleProps) {
	const { t, i18n } = useTranslation('commissions')

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
			style: 'currency',
			currency: 'MXN',
			minimumFractionDigits: 0,
		}).format(amount)
	}

	const calculation = useMemo(() => {
		if (!data.tiersEnabled || data.tiers.length === 0) {
			return null
		}

		const sortedTiers = [...data.tiers].sort((a, b) => a.minThreshold - b.minThreshold)
		let remainingSales = totalSales
		let totalCommission = 0
		const breakdown: { tier: string; amount: number; rate: number; commission: number }[] = []

		for (const tier of sortedTiers) {
			if (remainingSales <= 0) break

			const tierMin = tier.minThreshold
			const tierMax = tier.maxThreshold ?? Infinity
			const tierAmount = Math.min(remainingSales, tierMax - tierMin)

			if (tierAmount > 0) {
				const tierCommission = tierAmount * tier.rate
				totalCommission += tierCommission
				breakdown.push({
					tier: tier.name,
					amount: tierAmount,
					rate: tier.rate * 100,
					commission: tierCommission,
				})
				remainingSales -= tierAmount
			}
		}

		return { breakdown, totalCommission, totalSales }
	}, [data.tiersEnabled, data.tiers, totalSales])

	if (!calculation) return null

	return (
		<div className="p-4 rounded-xl bg-muted/50 border border-border/50">
			<div className="flex items-center gap-2 mb-3">
				<Calculator className="w-4 h-4 text-muted-foreground" />
				<span className="text-sm font-medium">
					{t('wizard.advanced.tiers.exampleTitle')}
				</span>
			</div>

			<p className="text-sm text-muted-foreground mb-3">
				{t('wizard.advanced.tiers.exampleText', {
					name: 'María',
					amount: formatCurrency(totalSales),
				})}
			</p>

			<div className="space-y-2 text-sm">
				{calculation.breakdown.map((item, index) => (
					<div key={index} className="flex justify-between">
						<span className="text-muted-foreground">
							{item.tier}: {formatCurrency(item.amount)} × {item.rate.toFixed(0)}%
						</span>
						<span className="font-medium">{formatCurrency(item.commission)}</span>
					</div>
				))}

				<div className="flex justify-between pt-2 border-t border-border/50 font-medium">
					<span>{t('wizard.advanced.tiers.totalCommission')}</span>
					<span>{formatCurrency(calculation.totalCommission)}</span>
				</div>
			</div>
		</div>
	)
}
