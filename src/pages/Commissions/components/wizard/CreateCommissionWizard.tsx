import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCreateCommissionConfig } from '@/hooks/useCommissions'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { commissionService } from '@/services/commission.service'
import type { CommissionRecipient, CommissionCalcType, TierPeriod, CreateCommissionConfigInput, CreateCommissionTierInput } from '@/types/commission'
import StepAmount from './StepAmount'
import StepConfirm from './StepConfirm'

// Override type for wizard (simplified from CreateCommissionOverrideInput)
export interface WizardOverride {
	staffId: string
	staffName: string // For display purposes
	customRate: number | null // Stored as decimal (0.03 = 3%)
	excludeFromCommissions: boolean
}

// Wizard data structure
export interface WizardData {
	// Recipient is always SERVER (same person takes order and charges via PIN login)
	recipient: CommissionRecipient

	// Step 1: Amount & Advanced
	calcType: CommissionCalcType // 'PERCENTAGE' or 'FIXED'
	defaultRate: number // Stored as decimal (0.03 = 3%) - used for PERCENTAGE
	fixedAmount: number // Fixed amount per transaction - used for FIXED

	// Advanced: Tiers
	tiersEnabled: boolean
	tierPeriod: TierPeriod
	tiers: CreateCommissionTierInput[]

	// Advanced: Role rates
	roleRatesEnabled: boolean
	roleRates: Record<string, number>

	// Advanced: Limits
	limitsEnabled: boolean
	minAmount: number | null
	maxAmount: number | null

	// Advanced: Overrides (exceptions for specific staff)
	overridesEnabled: boolean
	overrides: WizardOverride[]

	// Step 2: Name & Validity
	name: string
	customValidityEnabled: boolean
	effectiveFrom: string // ISO date string
	effectiveTo: string | null // ISO date string or null for no end date
}

// Get today's date in ISO format (YYYY-MM-DD)
const getTodayISO = () => new Date().toISOString().split('T')[0]

const initialData: WizardData = {
	recipient: 'SERVER',
	defaultRate: 0.03, // 3%
	calcType: 'PERCENTAGE',
	fixedAmount: 10, // $10 default for fixed amount
	tiersEnabled: false,
	tierPeriod: 'MONTHLY',
	tiers: [
		{ tierLevel: 1, name: 'Bronce', minThreshold: 0, maxThreshold: 10000, rate: 0.02 },
		{ tierLevel: 2, name: 'Plata', minThreshold: 10000, maxThreshold: 25000, rate: 0.03 },
		{ tierLevel: 3, name: 'Oro', minThreshold: 25000, maxThreshold: null, rate: 0.04 },
	],
	roleRatesEnabled: false,
	roleRates: {
		WAITER: 0.03,
		CASHIER: 0.025,
		MANAGER: 0.015,
	},
	limitsEnabled: false,
	minAmount: null,
	maxAmount: null,
	overridesEnabled: false,
	overrides: [],
	name: '',
	customValidityEnabled: false,
	effectiveFrom: getTodayISO(),
	effectiveTo: null,
}

interface CreateCommissionWizardProps {
	onSuccess: () => void
	onCancel: () => void
}

export default function CreateCommissionWizard({ onSuccess, onCancel }: CreateCommissionWizardProps) {
	const { t } = useTranslation('commissions')
	const { t: tCommon } = useTranslation()
	const { toast } = useToast()
	const { venueId } = useCurrentVenue()
	const [currentStep, setCurrentStep] = useState(1)
	const [data, setData] = useState<WizardData>(initialData)

	const createConfigMutation = useCreateCommissionConfig()

	const updateData = (updates: Partial<WizardData>) => {
		setData(prev => ({ ...prev, ...updates }))
	}

	const handleNext = () => {
		if (currentStep < 2) {
			setCurrentStep(prev => prev + 1)
		}
	}

	const handlePrevious = () => {
		if (currentStep > 1) {
			setCurrentStep(prev => prev - 1)
		}
	}

	const handleSubmit = async () => {
		try {
			// For FIXED type, use fixedAmount; for PERCENTAGE/TIERED, use defaultRate
			const effectiveCalcType = data.tiersEnabled ? 'TIERED' : data.calcType
			const effectiveRate = data.calcType === 'FIXED' ? data.fixedAmount : data.defaultRate

			// Convert date strings to ISO-8601 DateTime format (Prisma requires full DateTime)
			const toISODateTime = (dateStr: string) => new Date(dateStr + 'T00:00:00').toISOString()

			const input: CreateCommissionConfigInput = {
				name: data.name,
				recipient: data.recipient,
				calcType: effectiveCalcType,
				defaultRate: effectiveRate,
				minAmount: data.limitsEnabled ? data.minAmount : null,
				maxAmount: data.limitsEnabled ? data.maxAmount : null,
				// Always use subtotal - these are fixed (as per plan)
				includeTips: false,
				includeDiscount: false,
				includeTax: false,
				roleRates: data.roleRatesEnabled ? data.roleRates : null,
				priority: 1,
				effectiveFrom: toISODateTime(data.effectiveFrom),
				effectiveTo: data.effectiveTo ? toISODateTime(data.effectiveTo) : null,
			}

			const createdConfig = await createConfigMutation.mutateAsync(input)

			// Create overrides after config creation if enabled
			if (data.overridesEnabled && data.overrides.length > 0 && venueId && createdConfig?.id) {
				const overridePromises = data.overrides.map((override) =>
					commissionService.createOverride(venueId, createdConfig.id, {
						staffId: override.staffId,
						customRate: override.excludeFromCommissions ? null : override.customRate,
						excludeFromCommissions: override.excludeFromCommissions,
					})
				)
				await Promise.all(overridePromises)
			}

			// Note: Tiers are created separately after config creation
			// This would need a follow-up API call if tiers are enabled

			toast({
				title: t('success.configCreated'),
			})
			onSuccess()
		} catch (error: any) {
			toast({
				title: t('errors.saveError'),
				description: error.response?.data?.message || tCommon('common.error'),
				variant: 'destructive',
			})
		}
	}

	// Step indicator component (2 steps only)
	const StepIndicator = () => (
		<div className="flex items-center justify-center mb-8">
			{[1, 2].map((step, index) => (
				<div key={step} className="flex items-center">
					<div
						className={cn(
							'flex items-center justify-center w-10 h-10 rounded-full font-medium text-sm transition-all',
							currentStep > step
								? 'bg-primary text-primary-foreground'
								: currentStep === step
									? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
									: 'bg-muted text-muted-foreground'
						)}
					>
						{currentStep > step ? (
							<Check className="w-5 h-5" />
						) : (
							step
						)}
					</div>
					{index < 1 && (
						<div
							className={cn(
								'w-16 h-0.5 mx-2',
								currentStep > step ? 'bg-primary' : 'bg-muted'
							)}
						/>
					)}
				</div>
			))}
		</div>
	)

	return (
		<div className="space-y-6">
			<StepIndicator />

			{currentStep === 1 && (
				<StepAmount
					data={data}
					updateData={updateData}
					onNext={handleNext}
				/>
			)}

			{currentStep === 2 && (
				<StepConfirm
					data={data}
					updateData={updateData}
					onPrevious={handlePrevious}
					onSubmit={handleSubmit}
					isSubmitting={createConfigMutation.isPending}
				/>
			)}
		</div>
	)
}
