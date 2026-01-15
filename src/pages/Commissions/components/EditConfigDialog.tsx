import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Percent, DollarSign, Clock, ArrowUpNarrowWide, AlertCircle, Lock } from 'lucide-react'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useUpdateCommissionConfig } from '@/hooks/useCommissions'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { CommissionConfig, CommissionCalcType, TierPeriod } from '@/types/commission'
import type { WizardData } from './wizard/CreateCommissionWizard'
import CommissionAdvancedConfig from './wizard/CommissionAdvancedConfig'
import LiveExample from './wizard/LiveExample'

interface EditConfigDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	config: CommissionConfig
}

// Get today's date in ISO format (YYYY-MM-DD)
const getTodayISO = () => new Date().toISOString().split('T')[0]

export default function EditConfigDialog({
	open,
	onOpenChange,
	config,
}: EditConfigDialogProps) {
	const { t } = useTranslation('commissions')
	const { t: tCommon } = useTranslation()
	const { toast } = useToast()

	const updateConfigMutation = useUpdateCommissionConfig()

	// Convert config to WizardData format for reusing wizard components
	const configToWizardData = (cfg: CommissionConfig): WizardData => {
		const isTiered = cfg.calcType === 'TIERED'
		const isFixed = cfg.calcType === 'FIXED'

		return {
			recipient: cfg.recipient,
			calcType: isFixed ? 'FIXED' : 'PERCENTAGE',
			defaultRate: isFixed ? 0.03 : cfg.defaultRate, // For FIXED, defaultRate is the actual amount
			fixedAmount: isFixed ? cfg.defaultRate : 10,
			tiersEnabled: isTiered,
			tierPeriod: (cfg.tiers?.[0]?.tierPeriod as TierPeriod) || 'MONTHLY',
			tiers: cfg.tiers?.map((tier) => ({
				tierLevel: tier.tierLevel,
				name: tier.tierName,
				minThreshold: tier.minThreshold,
				maxThreshold: tier.maxThreshold,
				rate: tier.rate,
			})) || [
				{ tierLevel: 1, name: 'Bronce', minThreshold: 0, maxThreshold: 10000, rate: 0.02 },
				{ tierLevel: 2, name: 'Plata', minThreshold: 10000, maxThreshold: 25000, rate: 0.03 },
				{ tierLevel: 3, name: 'Oro', minThreshold: 25000, maxThreshold: null, rate: 0.04 },
			],
			roleRatesEnabled: cfg.roleRates !== null && Object.keys(cfg.roleRates || {}).length > 0,
			roleRates: cfg.roleRates || { WAITER: 0.03, CASHIER: 0.025, MANAGER: 0.015 },
			limitsEnabled: cfg.minAmount !== null || cfg.maxAmount !== null,
			minAmount: cfg.minAmount,
			maxAmount: cfg.maxAmount,
			overridesEnabled: (cfg.overrides?.length || 0) > 0,
			overrides: cfg.overrides?.map((o) => ({
				staffId: o.staffId,
				staffName: `${o.staff?.firstName || ''} ${o.staff?.lastName || ''}`.trim() || o.staffId,
				customRate: o.customRate,
				excludeFromCommissions: o.excludeFromCommissions,
			})) || [],
			name: cfg.name,
			customValidityEnabled: cfg.effectiveTo !== null,
			effectiveFrom: cfg.effectiveFrom?.split('T')[0] || getTodayISO(),
			effectiveTo: cfg.effectiveTo?.split('T')[0] || null,
			aggregationPeriod: (cfg.aggregationPeriod as TierPeriod) || 'MONTHLY',
			priority: cfg.priority || 1,
		}
	}

	const [data, setData] = useState<WizardData>(() => configToWizardData(config))
	const [advancedOpen, setAdvancedOpen] = useState(false)

	// Check if rate editing is locked due to existing calculations
	const calculationsCount = config._count?.calculations || 0
	const isRateLocked = calculationsCount > 0

	// Reset form when config changes
	useEffect(() => {
		if (open && config) {
			const wizardData = configToWizardData(config)
			setData(wizardData)
			setAdvancedOpen(
				wizardData.tiersEnabled || wizardData.roleRatesEnabled || wizardData.limitsEnabled || wizardData.overridesEnabled
			)
		}
	}, [open, config])

	const updateData = (updates: Partial<WizardData>) => {
		setData((prev) => ({ ...prev, ...updates }))
	}

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

	const handleSubmit = async () => {
		try {
			// For FIXED type, use fixedAmount; for PERCENTAGE/TIERED, use defaultRate
			const effectiveCalcType = data.tiersEnabled ? 'TIERED' : data.calcType
			const effectiveRate = data.calcType === 'FIXED' ? Number(data.fixedAmount) : Number(data.defaultRate)

			// Convert date strings to ISO-8601 DateTime format (Prisma requires full DateTime)
			const toISODateTime = (dateStr: string | null | undefined) => {
				if (!dateStr) return null
				return new Date(dateStr + 'T00:00:00').toISOString()
			}

			// Ensure numeric values are numbers, not strings
			const minAmount = data.limitsEnabled && data.minAmount !== null ? Number(data.minAmount) : null
			const maxAmount = data.limitsEnabled && data.maxAmount !== null ? Number(data.maxAmount) : null

			// Convert roleRates values to numbers
			const roleRates = data.roleRatesEnabled && data.roleRates
				? Object.fromEntries(
					Object.entries(data.roleRates).map(([key, value]) => [key, Number(value)])
				)
				: null

			await updateConfigMutation.mutateAsync({
				configId: config.id,
				data: {
					name: data.name,
					calcType: effectiveCalcType,
					recipient: data.recipient,
					defaultRate: effectiveRate,
					minAmount,
					maxAmount,
					// Always use subtotal (these are fixed as per design)
					includeTips: false,
					includeDiscount: false,
					includeTax: false,
					roleRates,
					effectiveFrom: toISODateTime(data.effectiveFrom),
					effectiveTo: toISODateTime(data.effectiveTo),
					aggregationPeriod: data.aggregationPeriod,
					priority: data.priority,
					active: config.active, // Keep existing active status (edit via detail page)
				},
			})

			toast({
				title: t('success.configUpdated'),
			})

			onOpenChange(false)
		} catch (error: any) {
			toast({
				title: t('errors.updateError'),
				description: error.response?.data?.message || tCommon('common.error'),
				variant: 'destructive',
			})
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{t('config.edit')}</DialogTitle>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Rate Locked Alert */}
					{isRateLocked && (
						<Alert className="border-amber-500/50 bg-amber-500/10">
							<Lock className="h-4 w-4 text-amber-600" />
							<AlertTitle className="text-amber-700 dark:text-amber-400">
								{t('config.rateLockedTitle')}
							</AlertTitle>
							<AlertDescription className="text-amber-600 dark:text-amber-300">
								{t('config.rateLockedDesc', { count: calculationsCount })}
								<br />
								<span className="font-medium">
									{t('config.rateLockedHint')}
								</span>
							</AlertDescription>
						</Alert>
					)}

					{/* Name Input */}
					<div className="space-y-2">
						<Label htmlFor="config-name">{t('config.name')}</Label>
						<Input
							id="config-name"
							value={data.name}
							onChange={(e) => updateData({ name: e.target.value })}
							placeholder={t('config.namePlaceholder')}
						/>
					</div>

					{/* Calc Type Toggle */}
					<div className="flex flex-col items-center gap-2">
						{isRateLocked && (
							<div className="flex items-center gap-1 text-xs text-muted-foreground">
								<Lock className="w-3 h-3" />
								{t('config.fieldLocked')}
							</div>
						)}
						<div className={cn(
							'inline-flex rounded-lg bg-muted p-1',
							isRateLocked && 'opacity-60 cursor-not-allowed'
						)}>
							<button
								type="button"
								onClick={() => !isRateLocked && handleCalcTypeChange('PERCENTAGE')}
								disabled={isRateLocked}
								className={cn(
									'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
									data.calcType === 'PERCENTAGE'
										? 'bg-background text-foreground shadow-sm'
										: 'text-muted-foreground hover:text-foreground',
									isRateLocked && 'cursor-not-allowed'
								)}
							>
								<Percent className="w-4 h-4" />
								{t('wizard.step2.percentage')}
							</button>
							<button
								type="button"
								onClick={() => !isRateLocked && handleCalcTypeChange('FIXED')}
								disabled={isRateLocked}
								className={cn(
									'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
									data.calcType === 'FIXED'
										? 'bg-background text-foreground shadow-sm'
										: 'text-muted-foreground hover:text-foreground',
									isRateLocked && 'cursor-not-allowed'
								)}
							>
								<DollarSign className="w-4 h-4" />
								{t('wizard.step2.fixedAmount')}
							</button>
						</div>
					</div>

					{/* Main Input - Percentage */}
					{data.calcType === 'PERCENTAGE' && (
						<div className={cn(
							'flex flex-col items-center py-4',
							isRateLocked && 'opacity-60'
						)}>
							<div className="relative w-40">
								<Input
									type="number"
									step="0.01"
									min="0"
									max="100"
									value={ratePercentage}
									onChange={(e) => handleRateChange(e.target.value)}
									disabled={isRateLocked}
									className={cn(
										'text-center text-3xl font-bold h-16 pr-10',
										isRateLocked && 'cursor-not-allowed bg-muted'
									)}
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
						<div className={cn(
							'flex flex-col items-center py-4',
							isRateLocked && 'opacity-60'
						)}>
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
									disabled={isRateLocked}
									className={cn(
										'text-center text-3xl font-bold h-16 pl-10',
										isRateLocked && 'cursor-not-allowed bg-muted'
									)}
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
					<CommissionAdvancedConfig
						data={data}
						updateData={updateData}
						isOpen={advancedOpen}
						onOpenChange={setAdvancedOpen}
					/>

					{/* Validity Dates */}
					<div className="p-4 rounded-xl border border-border/50 space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<Label className="text-sm font-medium">{t('wizard.step3.validityCustom')}</Label>
								<p className="text-xs text-muted-foreground">{t('wizard.step3.validityDesc')}</p>
							</div>
							<Switch
								checked={data.customValidityEnabled}
								onCheckedChange={(checked) => updateData({ customValidityEnabled: checked })}
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>{t('config.effectiveFrom')}</Label>
								<Input
									type="date"
									value={data.effectiveFrom}
									onChange={(e) => updateData({ effectiveFrom: e.target.value })}
								/>
							</div>
							{data.customValidityEnabled && (
								<div className="space-y-2">
									<Label>{t('config.effectiveTo')}</Label>
									<Input
										type="date"
										value={data.effectiveTo || ''}
										onChange={(e) => updateData({ effectiveTo: e.target.value || null })}
									/>
								</div>
							)}
						</div>
					</div>

					{/* Aggregation Period & Priority */}
					<div className="p-4 rounded-xl border border-border/50 space-y-4">
						{/* Aggregation Period */}
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Clock className="w-4 h-4 text-muted-foreground" />
								<div>
									<Label className="text-sm font-medium">{t('wizard.step3.aggregationPeriod')}</Label>
									<p className="text-xs text-muted-foreground">{t('wizard.step3.aggregationPeriodHint')}</p>
								</div>
							</div>
							<Select
								value={data.aggregationPeriod}
								onValueChange={(value) => updateData({ aggregationPeriod: value as TierPeriod })}
							>
								<SelectTrigger className="w-[140px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="WEEKLY">{t('wizard.step3.periodOptions.WEEKLY')}</SelectItem>
									<SelectItem value="BIWEEKLY">{t('wizard.step3.periodOptions.BIWEEKLY')}</SelectItem>
									<SelectItem value="MONTHLY">{t('wizard.step3.periodOptions.MONTHLY')}</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* Priority */}
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<ArrowUpNarrowWide className="w-4 h-4 text-muted-foreground" />
								<div>
									<Label className="text-sm font-medium">{t('wizard.step3.priority')}</Label>
									<p className="text-xs text-muted-foreground">{t('wizard.step3.priorityHint')}</p>
								</div>
							</div>
							<Input
								type="number"
								min={1}
								max={100}
								value={data.priority}
								onChange={(e) => updateData({ priority: Math.max(1, Math.min(100, parseInt(e.target.value) || 1)) })}
								className="w-[80px] text-center"
							/>
						</div>
					</div>

					{/* Actions */}
					<div className="flex justify-end gap-3 pt-4 border-t border-border/50">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={updateConfigMutation.isPending}
						>
							{t('actions.cancel')}
						</Button>
						<Button
							onClick={handleSubmit}
							disabled={updateConfigMutation.isPending || !data.name.trim()}
						>
							{updateConfigMutation.isPending
								? tCommon('common.saving')
								: t('actions.save')}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
