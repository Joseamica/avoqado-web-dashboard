import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreateCommissionConfig, useCreateOrgCommissionConfig } from '@/hooks/useCommissions'
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

	// Base de cálculo
	includeTax: boolean
	includeTips: boolean
	includeDiscount: boolean

	// Category filtering
	filterByCategories: boolean
	categoryIds: string[]

	// Goal-based tier (use staff's monthly goal as tier threshold)
	useGoalAsTier: boolean
	goalBonusRate: number // decimal, e.g. 0.06 for 6%

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

	// Aggregation period for payroll alignment
	aggregationPeriod: TierPeriod // WEEKLY, BIWEEKLY, MONTHLY - how often to group commissions for payout

	// Priority for config selection (higher = takes precedence)
	priority: number
}

// Get today's date in ISO format (YYYY-MM-DD)
const getTodayISO = () => new Date().toISOString().split('T')[0]

const initialData: WizardData = {
	recipient: 'SERVER',
	defaultRate: 0.03, // 3%
	calcType: 'PERCENTAGE',
	fixedAmount: 10, // $10 default for fixed amount
	includeTax: false,
	includeTips: false,
	includeDiscount: false,
	filterByCategories: false,
	categoryIds: [],
	useGoalAsTier: false,
	goalBonusRate: 0.06, // 6% default bonus rate
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
	aggregationPeriod: 'MONTHLY', // Default to monthly (most common payroll alignment)
	priority: 1, // Default priority (higher = takes precedence when multiple configs exist)
}

export interface WizardHandle {
	goNext: () => void
	goPrevious: () => void
	submit: () => Promise<void>
}

export interface WizardStepInfo {
	currentStep: number
	totalSteps: number
	canSubmit: boolean
	isSubmitting: boolean
}

interface CreateCommissionWizardProps {
	onSuccess: () => void
	onCancel?: () => void
	isOrgLevel?: boolean
	/** Called whenever wizard step or submit-readiness changes */
	onStepChange?: (info: WizardStepInfo) => void
	/** When true, steps won't render their own bottom navigation buttons */
	hideNavigation?: boolean
}

const CreateCommissionWizard = forwardRef<WizardHandle, CreateCommissionWizardProps>(
	({ onSuccess, isOrgLevel = false, onStepChange, hideNavigation = false }, ref) => {
	const { t } = useTranslation('commissions')
	const { t: tCommon } = useTranslation()
	const { toast } = useToast()
	const { venueId } = useCurrentVenue()
	const [currentStep, setCurrentStep] = useState(1)
	const [data, setData] = useState<WizardData>(initialData)

	const createConfigMutation = useCreateCommissionConfig()
	const createOrgConfigMutation = useCreateOrgCommissionConfig()
	const activeMutation = isOrgLevel ? createOrgConfigMutation : createConfigMutation

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

			// When goal-based tier is enabled, set calcType to TIERED internally
			const finalCalcType = data.useGoalAsTier ? 'TIERED' : effectiveCalcType

			// Convert date strings to ISO-8601 DateTime format (Prisma requires full DateTime)
			const toISODateTime = (dateStr: string) => new Date(dateStr + 'T00:00:00').toISOString()

			const input: CreateCommissionConfigInput = {
				name: data.name,
				recipient: data.recipient,
				calcType: finalCalcType,
				defaultRate: effectiveRate,
				minAmount: data.limitsEnabled ? data.minAmount : null,
				maxAmount: data.limitsEnabled ? data.maxAmount : null,
				includeTips: data.includeTips,
				includeDiscount: data.includeDiscount,
				includeTax: data.includeTax,
				roleRates: data.roleRatesEnabled ? data.roleRates : null,
				filterByCategories: data.filterByCategories,
				categoryIds: data.filterByCategories ? data.categoryIds : [],
				useGoalAsTier: data.useGoalAsTier,
				goalBonusRate: data.useGoalAsTier ? data.goalBonusRate : null,
				priority: data.priority,
				effectiveFrom: toISODateTime(data.effectiveFrom),
				effectiveTo: data.effectiveTo ? toISODateTime(data.effectiveTo) : null,
				aggregationPeriod: data.aggregationPeriod,
			}

			const createdConfig = await activeMutation.mutateAsync(input)

			// Create tiers after config creation if enabled
			if (data.tiersEnabled && data.tiers.length > 0 && venueId && createdConfig?.id) {
				const tiersWithPeriod = data.tiers.map((tier) => ({
					...tier,
					tierPeriod: data.tierPeriod,
				}))
				await commissionService.createTiersBatch(venueId, createdConfig.id, tiersWithPeriod)
			}

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

	// Expose navigation methods to parent via ref
	useImperativeHandle(ref, () => ({
		goNext: handleNext,
		goPrevious: handlePrevious,
		submit: handleSubmit,
	}))

	// Notify parent of step changes
	useEffect(() => {
		onStepChange?.({
			currentStep,
			totalSteps: 2,
			canSubmit: data.name.trim().length > 0,
			isSubmitting: activeMutation.isPending,
		})
	}, [currentStep, data.name, activeMutation.isPending])

	return (
		<div className="space-y-6">
			{currentStep === 1 && (
				<StepAmount
					data={data}
					updateData={updateData}
					onNext={handleNext}
					hideNavigation={hideNavigation}
				/>
			)}

			{currentStep === 2 && (
				<StepConfirm
					data={data}
					updateData={updateData}
					onPrevious={handlePrevious}
					onSubmit={handleSubmit}
					isSubmitting={activeMutation.isPending}
					hideNavigation={hideNavigation}
				/>
			)}
		</div>
	)
})

CreateCommissionWizard.displayName = 'CreateCommissionWizard'
export default CreateCommissionWizard
