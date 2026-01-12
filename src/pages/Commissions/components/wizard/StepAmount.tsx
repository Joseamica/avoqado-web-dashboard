import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Percent, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { WizardData } from './CreateCommissionWizard'
import type { CommissionCalcType } from '@/types/commission'
import LiveExample from './LiveExample'
import AdvancedConfig from './AdvancedConfig'

interface StepAmountProps {
	data: WizardData
	updateData: (updates: Partial<WizardData>) => void
	onNext: () => void
	onPrevious?: () => void
}

export default function StepAmount({ data, updateData, onNext, onPrevious }: StepAmountProps) {
	const { t } = useTranslation('commissions')
	const [advancedOpen, setAdvancedOpen] = useState(
		data.tiersEnabled || data.roleRatesEnabled || data.limitsEnabled
	)

	// Convert decimal to percentage for display
	const ratePercentage = (data.defaultRate * 100).toFixed(2)

	// Handle percentage input change
	const handleRateChange = (value: string) => {
		const num = parseFloat(value)
		if (!isNaN(num) && num >= 0 && num <= 100) {
			updateData({ defaultRate: num / 100 })
		}
	}

	// Handle fixed amount change
	const handleFixedAmountChange = (value: string) => {
		const num = parseFloat(value)
		if (!isNaN(num) && num >= 0) {
			updateData({ fixedAmount: num })
		}
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
				<div className="inline-flex rounded-lg bg-muted p-1">
					<button
						type="button"
						onClick={() => handleCalcTypeChange('PERCENTAGE')}
						className={cn(
							'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
							data.calcType === 'PERCENTAGE'
								? 'bg-background text-foreground shadow-sm'
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
							'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
							data.calcType === 'FIXED'
								? 'bg-background text-foreground shadow-sm'
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
							value={ratePercentage}
							onChange={(e) => handleRateChange(e.target.value)}
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
							value={data.fixedAmount}
							onChange={(e) => handleFixedAmountChange(e.target.value)}
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

			{/* Separator */}
			<div className="relative">
				<div className="absolute inset-0 flex items-center">
					<div className="w-full border-t border-border/50"></div>
				</div>
			</div>

			{/* Advanced Config */}
			<AdvancedConfig
				data={data}
				updateData={updateData}
				isOpen={advancedOpen}
				onOpenChange={setAdvancedOpen}
			/>

			{/* Navigation */}
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
		</div>
	)
}
