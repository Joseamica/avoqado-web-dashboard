import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, TrendingUp, Users, Target, HelpCircle, Plus, Trash2, UserX, Search } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useRoleConfig } from '@/hooks/use-role-config'
import { teamService } from '@/services/team.service'
import type { TierPeriod, CreateCommissionTierInput } from '@/types/commission'
import type { WizardData, WizardOverride } from './CreateCommissionWizard'
import { TieredExample } from './LiveExample'

interface AdvancedConfigProps {
	data: WizardData
	updateData: (updates: Partial<WizardData>) => void
	isOpen: boolean
	onOpenChange: (open: boolean) => void
}

const tierPeriodOptions: TierPeriod[] = ['WEEKLY', 'BIWEEKLY', 'MONTHLY']
const tierEmojis = ['🥉', '🥈', '🥇', '💎', '👑']

export default function AdvancedConfig({ data, updateData, isOpen, onOpenChange }: AdvancedConfigProps) {
	const { t, i18n } = useTranslation('commissions')
	const { venueId } = useCurrentVenue()
	const { getDisplayName: getRoleDisplayName } = useRoleConfig()
	const [staffComboboxOpen, setStaffComboboxOpen] = useState(false)
	const [staffSearchQuery, setStaffSearchQuery] = useState('')

	// Fetch venue staff for selection
	const { data: staffData } = useQuery({
		queryKey: ['team-members', venueId],
		queryFn: () => teamService.getTeamMembers(venueId!, 1, 100),
		enabled: !!venueId && data.overridesEnabled,
	})
	const staffList = staffData?.data || []

	// Filter out staff that already have overrides
	const availableStaff = staffList.filter(
		(staff) => !data.overrides.some((override) => override.staffId === staff.staffId)
	)

	// Filter staff by search query
	const filteredStaff = availableStaff.filter((staff) =>
		`${staff.firstName} ${staff.lastName}`.toLowerCase().includes(staffSearchQuery.toLowerCase())
	)

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
			style: 'currency',
			currency: 'MXN',
			minimumFractionDigits: 0,
		}).format(amount)
	}

	// Tier management
	const addTier = () => {
		const lastTier = data.tiers[data.tiers.length - 1]
		const newTier: CreateCommissionTierInput = {
			tierLevel: data.tiers.length + 1,
			name: `Nivel ${data.tiers.length + 1}`,
			minThreshold: lastTier?.maxThreshold ?? 0,
			maxThreshold: null,
			rate: (lastTier?.rate ?? 0.02) + 0.01,
		}
		updateData({ tiers: [...data.tiers, newTier] })
	}

	const removeTier = (index: number) => {
		if (data.tiers.length <= 1) return
		const newTiers = data.tiers.filter((_, i) => i !== index)
		updateData({ tiers: newTiers })
	}

	const updateTier = (index: number, updates: Partial<CreateCommissionTierInput>) => {
		const newTiers = [...data.tiers]
		newTiers[index] = { ...newTiers[index], ...updates }
		updateData({ tiers: newTiers })
	}

	// Role rates
	const roleOptions = [
		{ key: 'WAITER', label: getRoleDisplayName('WAITER') },
		{ key: 'CASHIER', label: getRoleDisplayName('CASHIER') },
		{ key: 'MANAGER', label: getRoleDisplayName('MANAGER') },
	]

	const updateRoleRate = (role: string, rate: number) => {
		updateData({
			roleRates: {
				...data.roleRates,
				[role]: rate / 100, // Convert from percentage to decimal
			},
		})
	}

	// Override management
	const addOverride = (staffId: string, staffName: string) => {
		const newOverride: WizardOverride = {
			staffId,
			staffName,
			customRate: data.defaultRate, // Default to current rate
			excludeFromCommissions: false,
		}
		updateData({ overrides: [...data.overrides, newOverride] })
		setStaffComboboxOpen(false)
		setStaffSearchQuery('') // Clear search query
	}

	const removeOverride = (staffId: string) => {
		updateData({
			overrides: data.overrides.filter((o) => o.staffId !== staffId),
		})
	}

	const updateOverride = (staffId: string, updates: Partial<WizardOverride>) => {
		updateData({
			overrides: data.overrides.map((o) =>
				o.staffId === staffId ? { ...o, ...updates } : o
			),
		})
	}

	// InfoTooltip helper component
	const InfoTooltip = ({ content }: { content: React.ReactNode }) => (
		<TooltipProvider>
			<Tooltip delayDuration={300}>
				<TooltipTrigger asChild>
					<button type="button" className="ml-2 text-muted-foreground hover:text-foreground transition-colors">
						<HelpCircle className="w-4 h-4" />
					</button>
				</TooltipTrigger>
				<TooltipContent side="right" className="max-w-[300px] p-4">
					{content}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)

	return (
		<Collapsible open={isOpen} onOpenChange={onOpenChange}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="w-full flex items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors text-left"
				>
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-lg bg-muted">
							<Target className="w-4 h-4 text-muted-foreground" />
						</div>
						<div>
							<span className="font-medium text-sm">{t('wizard.step2.advanced')}</span>
							<p className="text-xs text-muted-foreground">{t('wizard.step2.advancedDesc')}</p>
						</div>
					</div>
					<ChevronRight className={cn('w-5 h-5 text-muted-foreground transition-transform', isOpen && 'rotate-90')} />
				</button>
			</CollapsibleTrigger>

			<CollapsibleContent className="mt-4 space-y-4">
				{/* Tiers Section */}
				<div className="p-4 rounded-xl border border-border/50 space-y-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center">
							<div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/5">
								<TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
							</div>
							<div className="ml-3">
								<span className="font-medium text-sm">{t('wizard.advanced.tiers.title')}</span>
								<InfoTooltip
									content={
										<div className="space-y-2 text-sm">
											<p className="font-medium">{t('wizard.advanced.tiers.tooltip.title')}</p>
											<p>{t('wizard.advanced.tiers.tooltip.desc')}</p>
											<div className="mt-2 space-y-1">
												<p className="font-medium">{t('wizard.advanced.tiers.tooltip.example')}</p>
												<p>• {t('wizard.advanced.tiers.tooltip.bronze')}</p>
												<p>• {t('wizard.advanced.tiers.tooltip.silver')}</p>
												<p>• {t('wizard.advanced.tiers.tooltip.gold')}</p>
											</div>
										</div>
									}
								/>
							</div>
						</div>
						<Switch
							checked={data.tiersEnabled}
							onCheckedChange={(checked) => {
								// Mutually exclusive: if enabling tiers, disable role rates
								if (checked) {
									updateData({ tiersEnabled: true, roleRatesEnabled: false })
								} else {
									updateData({ tiersEnabled: false })
								}
							}}
						/>
					</div>

					{data.tiersEnabled && (
						<div className="space-y-4 pt-2">
							<p className="text-sm text-muted-foreground">
								{t('wizard.advanced.tiers.desc')}
							</p>

							{/* Period Selector */}
							<div className="flex items-center gap-3">
								<label className="text-sm font-medium whitespace-nowrap">{t('wizard.advanced.tiers.period')}:</label>
								<Select
									value={data.tierPeriod}
									onValueChange={(value) => updateData({ tierPeriod: value as TierPeriod })}
								>
									<SelectTrigger className="w-[180px]">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{tierPeriodOptions.map((period) => (
											<SelectItem key={period} value={period}>
												{t(`wizard.advanced.tiers.periodOptions.${period}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Tiers as Horizontal Cards */}
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
								{data.tiers.map((tier, index) => (
									<div
										key={index}
										className="relative p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 border border-border/50 space-y-3"
									>
										{/* Delete button */}
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive"
											onClick={() => removeTier(index)}
											disabled={data.tiers.length <= 1}
										>
											<Trash2 className="w-3.5 h-3.5" />
										</Button>

										{/* Tier header with emoji */}
										<div className="flex items-center gap-2">
											<span className="text-2xl">{tierEmojis[index] || '🏅'}</span>
											<span className="font-semibold text-sm">
												{t('wizard.advanced.tiers.levelHeader')} {index + 1}
											</span>
										</div>

										{/* Range display */}
										<div className="text-sm text-muted-foreground">
											{formatCurrency(tier.minThreshold)} - {tier.maxThreshold ? formatCurrency(tier.maxThreshold) : '∞'}
										</div>

										{/* Editable fields */}
										<div className="grid grid-cols-2 gap-2">
											<div>
												<label className="text-xs text-muted-foreground">{t('wizard.advanced.tiers.fromHeader')}</label>
												<div className="relative mt-1">
													<span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
													<Input
														type="number"
														min={0}
														value={tier.minThreshold}
														onChange={(e) => updateTier(index, { minThreshold: parseFloat(e.target.value) || 0 })}
														className="h-9 text-sm pl-5"
													/>
												</div>
											</div>
											<div>
												<label className="text-xs text-muted-foreground">{t('wizard.advanced.tiers.toHeader')}</label>
												<div className="relative mt-1">
													<span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
													<Input
														type="number"
														min={0}
														placeholder="∞"
														value={tier.maxThreshold ?? ''}
														onChange={(e) =>
															updateTier(index, {
																maxThreshold: e.target.value ? parseFloat(e.target.value) : null,
															})
														}
														className="h-9 text-sm pl-5"
													/>
												</div>
											</div>
										</div>

										{/* Commission rate - prominent */}
										<div className="pt-2 border-t border-border/50">
											<label className="text-xs text-muted-foreground">{t('wizard.advanced.tiers.commissionHeader')}</label>
											<div className="relative mt-1">
												<Input
													type="number"
													step="0.1"
													min={0}
													max={100}
													value={(tier.rate * 100).toFixed(1)}
													onChange={(e) => updateTier(index, { rate: parseFloat(e.target.value) / 100 || 0 })}
													className="h-10 text-lg font-semibold pr-8"
												/>
												<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
													%
												</span>
											</div>
										</div>
									</div>
								))}

								{/* Add tier button as a card */}
								<button
									type="button"
									onClick={addTier}
									className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/50 hover:bg-muted/30 transition-colors min-h-[180px] cursor-pointer"
								>
									<Plus className="w-6 h-6 text-muted-foreground mb-2" />
									<span className="text-sm font-medium text-muted-foreground">
										{t('wizard.advanced.tiers.addLevel')}
									</span>
								</button>
							</div>

							{/* Tiered Example */}
							<TieredExample data={data} totalSales={15000} />
						</div>
					)}
				</div>

				{/* Role Rates Section */}
				<div className="p-4 rounded-xl border border-border/50 space-y-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center">
							<div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5">
								<Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
							</div>
							<div className="ml-3">
								<span className="font-medium text-sm">{t('wizard.advanced.roleRates.title')}</span>
								<InfoTooltip
									content={
										<div className="space-y-2 text-sm">
											<p className="font-medium">{t('wizard.advanced.roleRates.tooltip.title')}</p>
											<p>{t('wizard.advanced.roleRates.tooltip.desc')}</p>
											<p>{t('wizard.advanced.roleRates.tooltip.example')}</p>
										</div>
									}
								/>
							</div>
						</div>
						<Switch
							checked={data.roleRatesEnabled}
							onCheckedChange={(checked) => {
								// Mutually exclusive: if enabling role rates, disable tiers
								if (checked) {
									updateData({ roleRatesEnabled: true, tiersEnabled: false })
								} else {
									updateData({ roleRatesEnabled: false })
								}
							}}
						/>
					</div>

					{data.roleRatesEnabled && (
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
							{roleOptions.map((role) => (
								<div
									key={role.key}
									className="flex flex-col p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 border border-border/50"
								>
									{/* Role header - fixed height area */}
									<div className="flex items-start gap-2 min-h-[48px]">
										<div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
											<Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
										</div>
										<span className="font-medium text-sm line-clamp-2">{role.label}</span>
									</div>
									{/* Commission input - always at bottom */}
									<div className="mt-3">
										<label className="text-xs text-muted-foreground">{t('wizard.advanced.roleRates.commissionHeader')}</label>
										<div className="relative mt-1">
											<Input
												type="number"
												step="0.1"
												min={0}
												max={100}
												value={((data.roleRates[role.key] || 0) * 100).toFixed(1)}
												onChange={(e) => updateRoleRate(role.key, parseFloat(e.target.value) || 0)}
												className="h-10 text-lg font-semibold pr-8"
											/>
											<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
												%
											</span>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Limits Section */}
				<div className="p-4 rounded-xl border border-border/50 space-y-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center">
							<div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-500/5">
								<Target className="w-4 h-4 text-orange-600 dark:text-orange-400" />
							</div>
							<div className="ml-3">
								<span className="font-medium text-sm">{t('wizard.advanced.limits.title')}</span>
								<InfoTooltip
									content={
										<div className="space-y-2 text-sm">
											<p className="font-medium">{t('wizard.advanced.limits.tooltip.title')}</p>
											<p>{t('wizard.advanced.limits.tooltip.minExplain')}</p>
											<p>{t('wizard.advanced.limits.tooltip.maxExplain')}</p>
										</div>
									}
								/>
							</div>
						</div>
						<Switch
							checked={data.limitsEnabled}
							onCheckedChange={(checked) => updateData({ limitsEnabled: checked })}
						/>
					</div>

					{data.limitsEnabled && (
						<div className="grid grid-cols-2 gap-4 pt-2">
							<div>
								<label className="text-sm font-medium">{t('wizard.advanced.limits.min')}</label>
								<div className="relative mt-1.5">
									<span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
									<Input
										type="number"
										min={0}
										placeholder="0"
										value={data.minAmount ?? ''}
										onChange={(e) =>
											updateData({ minAmount: e.target.value ? parseFloat(e.target.value) : null })
										}
										className="pl-7"
									/>
								</div>
							</div>

							<div>
								<label className="text-sm font-medium">{t('wizard.advanced.limits.max')}</label>
								<div className="relative mt-1.5">
									<span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
									<Input
										type="number"
										min={0}
										placeholder="500"
										value={data.maxAmount ?? ''}
										onChange={(e) =>
											updateData({ maxAmount: e.target.value ? parseFloat(e.target.value) : null })
										}
										className="pl-7"
									/>
								</div>
							</div>

							{data.maxAmount && (
								<div className="col-span-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/30 text-sm text-orange-700 dark:text-orange-400">
									{t('wizard.advanced.limits.exampleTitle', { max: formatCurrency(data.maxAmount) })}
									<br />
									{t('wizard.advanced.limits.exampleText', {
										sale: formatCurrency(20000),
										rate: (data.defaultRate * 100).toFixed(0),
										calculated: formatCurrency(20000 * data.defaultRate),
										actual: formatCurrency(Math.min(20000 * data.defaultRate, data.maxAmount)),
									})}
								</div>
							)}
						</div>
					)}
				</div>

				{/* Overrides Section */}
				<div className="p-4 rounded-xl border border-border/50 space-y-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center">
							<div className="p-2 rounded-lg bg-gradient-to-br from-rose-500/20 to-rose-500/5">
								<UserX className="w-4 h-4 text-rose-600 dark:text-rose-400" />
							</div>
							<div className="ml-3">
								<span className="font-medium text-sm">{t('wizard.advanced.overrides.title')}</span>
								<InfoTooltip
									content={
										<div className="space-y-2 text-sm">
											<p className="font-medium">{t('wizard.advanced.overrides.tooltip.title')}</p>
											<p>{t('wizard.advanced.overrides.tooltip.desc')}</p>
											<p>{t('wizard.advanced.overrides.tooltip.example')}</p>
										</div>
									}
								/>
							</div>
						</div>
						<Switch
							checked={data.overridesEnabled}
							onCheckedChange={(checked) => updateData({ overridesEnabled: checked })}
						/>
					</div>

					{data.overridesEnabled && (
						<div className="space-y-4 pt-2">
							<p className="text-sm text-muted-foreground">
								{t('wizard.advanced.overrides.desc')}
							</p>

							{/* Overrides as Horizontal Cards */}
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
								{data.overrides.map((override) => (
									<div
										key={override.staffId}
										className={cn(
											"relative p-4 rounded-xl bg-gradient-to-br border space-y-3",
											override.excludeFromCommissions
												? "from-rose-500/10 to-rose-500/5 border-rose-500/30"
												: "from-muted/50 to-muted/20 border-border/50"
										)}
									>
										{/* Delete button */}
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
											onClick={() => removeOverride(override.staffId)}
										>
											<Trash2 className="w-3.5 h-3.5" />
										</Button>

										{/* Staff avatar and name */}
										<div className="flex items-center gap-3">
											<div className={cn(
												"p-2 rounded-lg",
												override.excludeFromCommissions
													? "bg-rose-500/20"
													: "bg-rose-500/10"
											)}>
												{override.excludeFromCommissions ? (
													<UserX className="w-4 h-4 text-rose-600 dark:text-rose-400" />
												) : (
													<Users className="w-4 h-4 text-rose-600 dark:text-rose-400" />
												)}
											</div>
											<div className="flex-1 min-w-0">
												<span className="font-semibold text-sm truncate block">
													{override.staffName}
												</span>
											</div>
										</div>

										{/* Status / Exclusion toggle */}
										<div className="flex items-center justify-between py-2 border-y border-border/30">
											<span className="text-xs text-muted-foreground">
												{t('wizard.advanced.overrides.excludeLabel')}
											</span>
											<Switch
												checked={override.excludeFromCommissions}
												onCheckedChange={(checked) =>
													updateOverride(override.staffId, {
														excludeFromCommissions: checked,
													})
												}
												className="scale-90"
											/>
										</div>

										{/* Commission rate - only show if not excluded */}
										{!override.excludeFromCommissions ? (
											<div>
												<label className="text-xs text-muted-foreground">
													{t('wizard.advanced.overrides.customRate')}
												</label>
												<div className="relative mt-1">
													<Input
														type="number"
														step="0.1"
														min={0}
														max={100}
														value={((override.customRate || 0) * 100).toFixed(1)}
														onChange={(e) =>
															updateOverride(override.staffId, {
																customRate: parseFloat(e.target.value) / 100 || 0,
															})
														}
														className="h-10 text-lg font-semibold pr-8"
													/>
													<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
														%
													</span>
												</div>
											</div>
										) : (
											<div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
												<UserX className="w-4 h-4" />
												<span className="text-xs font-medium">
													{t('wizard.advanced.overrides.excluded')}
												</span>
											</div>
										)}
									</div>
								))}

								{/* Add staff button as a card */}
								<Popover open={staffComboboxOpen} onOpenChange={(open) => {
									setStaffComboboxOpen(open)
									if (!open) setStaffSearchQuery('') // Clear search when closing
								}}>
									<PopoverTrigger asChild>
										<button
											type="button"
											disabled={availableStaff.length === 0}
											className={cn(
												"flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed transition-colors min-h-[180px]",
												availableStaff.length === 0
													? "border-border/30 bg-muted/10 cursor-not-allowed opacity-50"
													: "border-border/50 hover:border-primary/50 hover:bg-muted/30 cursor-pointer"
											)}
										>
											<Plus className="w-6 h-6 text-muted-foreground mb-2" />
											<span className="text-sm font-medium text-muted-foreground">
												{t('wizard.advanced.overrides.addStaff')}
											</span>
											{availableStaff.length === 0 && (
												<span className="text-xs text-muted-foreground mt-1">
													{t('wizard.advanced.overrides.noMoreStaff')}
												</span>
											)}
										</button>
									</PopoverTrigger>
									<PopoverContent className="w-[360px] sm:w-[420px] md:w-[480px] p-0" align="start">
										<div className="flex flex-col">
											{/* Search input */}
											<div className="flex items-center border-b border-border px-3 py-2">
												<Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
												<input
													type="text"
													placeholder={t('overrides.searchStaff')}
													value={staffSearchQuery}
													onChange={(e) => setStaffSearchQuery(e.target.value)}
													className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
												/>
											</div>
											{/* Scrollable staff list */}
											<div className="max-h-[340px] overflow-y-auto p-1">
												{filteredStaff.length === 0 ? (
													<div className="py-6 text-center text-sm text-muted-foreground">
														{t('overrides.noStaffFound')}
													</div>
												) : (
													filteredStaff.map((staff) => (
														<button
															key={staff.staffId}
															type="button"
															onClick={() => addOverride(staff.staffId, `${staff.firstName} ${staff.lastName}`)}
															className="group flex w-full flex-col items-start rounded-sm px-2 py-2 text-left hover:bg-accent focus:bg-accent cursor-pointer"
														>
															<span className="w-full text-sm font-medium leading-tight line-clamp-2">
																{staff.firstName} {staff.lastName}
															</span>
															{staff.role && (
																<span className="w-full text-xs text-muted-foreground line-clamp-1 group-hover:text-accent-foreground/70">
																	{getRoleDisplayName(staff.role)}
																</span>
															)}
														</button>
													))
												)}
											</div>
										</div>
									</PopoverContent>
								</Popover>
							</div>

							{data.overrides.length === 0 && (
								<div className="text-center py-2 text-sm text-muted-foreground">
									{t('wizard.advanced.overrides.hint')}
								</div>
							)}
						</div>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	)
}
