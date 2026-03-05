import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Percent, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { WizardData } from './CreateCommissionWizard'
import type { CommissionCalcType } from '@/types/commission'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import LiveExample from './LiveExample'
import CommissionAdvancedConfig from './CommissionAdvancedConfig'
import CategoryFilter from './CategoryFilter'

interface StepAmountProps {
	data: WizardData
	updateData: (updates: Partial<WizardData>) => void
	onNext: () => void
	onPrevious?: () => void
	hideNavigation?: boolean
}

export default function StepAmount({ data, updateData, onNext, onPrevious, hideNavigation }: StepAmountProps) {
	const { t } = useTranslation('commissions')
	const { venue } = useCurrentVenue()
	const isMexico = venue?.country?.toLowerCase() === 'mexico' || venue?.country?.toLowerCase() === 'méxico' || venue?.country === 'MX'
	const [advancedOpen, setAdvancedOpen] = useState(
		data.tiersEnabled || data.roleRatesEnabled || data.limitsEnabled
	)
	const [rateInput, setRateInput] = useState(() => (data.defaultRate * 100).toFixed(2))
	const [fixedAmountInput, setFixedAmountInput] = useState(() => String(data.fixedAmount))
	const [goalBonusRateInput, setGoalBonusRateInput] = useState(() => (data.goalBonusRate * 100).toFixed(2))

	// Handle percentage input change
	const handleRateChange = (value: string) => {
		setRateInput(value)
		if (value === '') return
		const num = Number(value)
		if (Number.isNaN(num) || num < 0 || num > 100) return
		updateData({ defaultRate: num / 100 })
	}

	const handleRateBlur = () => {
		if (rateInput.trim() === '') {
			setRateInput((data.defaultRate * 100).toFixed(2))
			return
		}

		const num = Number(rateInput)
		if (Number.isNaN(num) || num < 0 || num > 100) {
			setRateInput((data.defaultRate * 100).toFixed(2))
			return
		}

		const normalized = Number(num.toFixed(2))
		updateData({ defaultRate: normalized / 100 })
		setRateInput(normalized.toFixed(2))
	}

	// Handle fixed amount change
	const handleFixedAmountChange = (value: string) => {
		setFixedAmountInput(value)
		if (value === '') return
		const num = Number(value)
		if (Number.isNaN(num) || num < 0) return
		updateData({ fixedAmount: num })
	}

	const handleFixedAmountBlur = () => {
		if (fixedAmountInput.trim() === '') {
			setFixedAmountInput(String(data.fixedAmount))
			return
		}

		const num = Number(fixedAmountInput)
		if (Number.isNaN(num) || num < 0) {
			setFixedAmountInput(String(data.fixedAmount))
			return
		}

		updateData({ fixedAmount: num })
		setFixedAmountInput(String(num))
	}

	// Handle goal bonus rate change
	const handleGoalBonusRateChange = (value: string) => {
		setGoalBonusRateInput(value)
		if (value === '') return
		const num = Number(value)
		if (Number.isNaN(num) || num < 0 || num > 100) return
		updateData({ goalBonusRate: num / 100 })
	}

	const handleGoalBonusRateBlur = () => {
		if (goalBonusRateInput.trim() === '') {
			setGoalBonusRateInput((data.goalBonusRate * 100).toFixed(2))
			return
		}
		const num = Number(goalBonusRateInput)
		if (Number.isNaN(num) || num < 0 || num > 100) {
			setGoalBonusRateInput((data.goalBonusRate * 100).toFixed(2))
			return
		}
		const normalized = Number(num.toFixed(2))
		updateData({ goalBonusRate: normalized / 100 })
		setGoalBonusRateInput(normalized.toFixed(2))
	}

	// Handle calc type change
	const handleCalcTypeChange = (type: CommissionCalcType) => {
		updateData({ calcType: type })
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="text-center space-y-2">
				<h2 className="text-xl font-semibold">
					{t('wizard.step2.title')}
				</h2>
			</div>

			{/* Calc Type Toggle */}
			<div className="flex justify-center">
				<div className="inline-flex rounded-full bg-muted/50 p-1">
					<button
						type="button"
						onClick={() => handleCalcTypeChange('PERCENTAGE')}
						className={cn(
							'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
							data.calcType === 'PERCENTAGE'
								? 'bg-foreground text-background shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						<Percent className="w-4 h-4" />
						{t('wizard.step2.percentage')}
					</button>
					<button
						type="button"
						onClick={() => handleCalcTypeChange('FIXED')}
						className={cn(
							'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
							data.calcType === 'FIXED'
								? 'bg-foreground text-background shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						<DollarSign className="w-4 h-4" />
						{t('wizard.step2.fixedAmount')}
					</button>
				</div>
			</div>

			{/* Main Input - Percentage */}
			{data.calcType === 'PERCENTAGE' && (
				<div className="flex flex-col items-center py-6">
					<div className="relative w-40">
						<Input
							type="number"
							step="0.01"
							min="0"
							max="100"
							value={rateInput}
							onChange={(e) => handleRateChange(e.target.value)}
							onBlur={handleRateBlur}
							className="text-center text-3xl font-bold h-16 pr-10"
						/>
						<span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">
							%
						</span>
					</div>
					<p className="text-sm text-muted-foreground mt-2">
						{t('wizard.step2.ofEachSale')}
					</p>
				</div>
			)}

			{/* Main Input - Fixed Amount */}
			{data.calcType === 'FIXED' && (
				<div className="flex flex-col items-center py-6">
					<div className="relative w-40">
						<span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">
							$
						</span>
						<Input
							type="number"
							step="1"
							min="0"
							value={fixedAmountInput}
							onChange={(e) => handleFixedAmountChange(e.target.value)}
							onBlur={handleFixedAmountBlur}
							className="text-center text-3xl font-bold h-16 pl-10"
						/>
					</div>
					<p className="text-sm text-muted-foreground mt-2">
						{t('wizard.step2.perTransaction')}
					</p>
				</div>
			)}

			{/* Live Example */}
			<LiveExample data={data} saleAmount={1000} />

			{/* ─── Base de cálculo ─── */}
			<div className="space-y-3 rounded-xl border border-border/50 p-4">
				<h3 className="text-sm font-medium text-muted-foreground">
					{t('wizard.step2.calculationBase')}
				</h3>
				<div className="space-y-2.5">
					<div className="flex items-center justify-between">
						<div>
							<Label htmlFor="includeTax" className="text-sm">
								{t('wizard.step2.includeTax')}{isMexico ? ' (IVA 16%)' : ''}
							</Label>
							{isMexico && !data.includeTax && (
								<p className="text-xs text-muted-foreground mt-0.5">
									{t('wizard.step2.taxExcludedHint')}
								</p>
							)}
						</div>
						<Switch
							id="includeTax"
							checked={data.includeTax}
							onCheckedChange={(checked) => updateData({ includeTax: checked })}
						/>
					</div>
					<div className="flex items-center justify-between">
						<Label htmlFor="includeTips" className="text-sm">
							{t('wizard.step2.includeTips')}
						</Label>
						<Switch
							id="includeTips"
							checked={data.includeTips}
							onCheckedChange={(checked) => updateData({ includeTips: checked })}
						/>
					</div>
					<div className="flex items-center justify-between">
						<Label htmlFor="includeDiscount" className="text-sm">
							{t('wizard.step2.includeDiscount')}
						</Label>
						<Switch
							id="includeDiscount"
							checked={data.includeDiscount}
							onCheckedChange={(checked) => updateData({ includeDiscount: checked })}
						/>
					</div>
				</div>
			</div>

			{/* ─── Categorías ─── */}
			<div className="space-y-3 rounded-xl border border-border/50 p-4">
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-medium text-muted-foreground">
						{t('wizard.step2.categories')}
					</h3>
					<Switch
						checked={data.filterByCategories}
						onCheckedChange={(checked) => {
							updateData({ filterByCategories: checked })
							if (!checked) updateData({ categoryIds: [] })
						}}
					/>
				</div>
				{data.filterByCategories && (
					<div className="pt-1">
						<p className="text-xs text-muted-foreground mb-2">
							{t('wizard.step2.onlySpecificCategories')}
						</p>
						<CategoryFilter
							categoryIds={data.categoryIds}
							onChange={(ids) => updateData({ categoryIds: ids })}
						/>
					</div>
				)}
			</div>

			{/* ─── Meta como escalón ─── */}
			{data.calcType === 'PERCENTAGE' && (
				<div className="space-y-3 rounded-xl border border-border/50 p-4">
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-sm font-medium text-muted-foreground">
								{t('wizard.step2.goalTier')}
							</h3>
							<p className="text-xs text-muted-foreground mt-0.5">
								{t('wizard.step2.goalTierDescription')}
							</p>
						</div>
						<Switch
							checked={data.useGoalAsTier}
							onCheckedChange={(checked) => {
								updateData({ useGoalAsTier: checked })
								// Disable manual tiers when goal-based is enabled
								if (checked) updateData({ tiersEnabled: false })
							}}
						/>
					</div>
					{data.useGoalAsTier && (
						<div className="grid grid-cols-2 gap-3 pt-1">
							<div>
								<Label className="text-xs text-muted-foreground">
									{t('wizard.step2.baseRate')}
								</Label>
								<div className="relative mt-1">
									<Input
										type="number"
										step="0.01"
										min="0"
										max="100"
										value={rateInput}
										onChange={(e) => handleRateChange(e.target.value)}
										onBlur={handleRateBlur}
										className="pr-8 text-center"
									/>
									<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
								</div>
							</div>
							<div>
								<Label className="text-xs text-muted-foreground">
									{t('wizard.step2.bonusRate')}
								</Label>
								<div className="relative mt-1">
									<Input
										type="number"
										step="0.01"
										min="0"
										max="100"
										value={goalBonusRateInput}
										onChange={(e) => handleGoalBonusRateChange(e.target.value)}
										onBlur={handleGoalBonusRateBlur}
										className="pr-8 text-center"
									/>
									<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Advanced Config */}
			<CommissionAdvancedConfig
				data={data}
				updateData={updateData}
				isOpen={advancedOpen}
				onOpenChange={setAdvancedOpen}
			/>

			{/* Navigation */}
			{!hideNavigation && (
				<div className={`flex pt-4 ${onPrevious ? 'justify-between' : 'justify-end'}`}>
					{onPrevious && (
						<Button variant="outline" onClick={onPrevious}>
							← {t('wizard.buttons.previous')}
						</Button>
					)}
					<Button onClick={onNext}>
						{t('wizard.buttons.next')} →
					</Button>
				</div>
			)}
		</div>
	)
}
