import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, TrendingUp, Users, Target, HelpCircle, Medal, Plus, Trash2, UserX, Check, ChevronsUpDown } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
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
							onCheckedChange={(checked) => updateData({ tiersEnabled: checked })}
						/>
					</div>

					{data.tiersEnabled && (
						<div className="space-y-4 pt-2">
							<p className="text-sm text-muted-foreground">
								{t('wizard.advanced.tiers.desc')}
							</p>

							{/* Period Selector */}
							<div>
								<label className="text-sm font-medium">{t('wizard.advanced.tiers.period')}</label>
								<Select
									value={data.tierPeriod}
									onValueChange={(value) => updateData({ tierPeriod: value as TierPeriod })}
								>
									<SelectTrigger className="mt-1.5">
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

							{/* Tiers Table */}
							<div className="space-y-2">
								<div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-2 text-xs font-medium text-muted-foreground px-2">
									<span>{t('wizard.advanced.tiers.levelHeader')}</span>
									<span>{t('wizard.advanced.tiers.fromHeader')}</span>
									<span>{t('wizard.advanced.tiers.toHeader')}</span>
									<span>{t('wizard.advanced.tiers.commissionHeader')}</span>
									<span></span>
								</div>

								{data.tiers.map((tier, index) => (
									<div
										key={index}
										className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-2 items-center p-2 rounded-lg bg-muted/30"
									>
										<span className="text-lg">{tierEmojis[index] || <Medal className="w-5 h-5" />}</span>

										<Input
											type="number"
											min={0}
											value={tier.minThreshold}
											onChange={(e) => updateTier(index, { minThreshold: parseFloat(e.target.value) || 0 })}
											className="h-8 text-sm"
										/>

										<Input
											type="number"
											min={0}
											placeholder={t('wizard.advanced.tiers.noLimit')}
											value={tier.maxThreshold ?? ''}
											onChange={(e) =>
												updateTier(index, {
													maxThreshold: e.target.value ? parseFloat(e.target.value) : null,
												})
											}
											className="h-8 text-sm"
										/>

										<div className="relative w-20">
											<Input
												type="number"
												step="0.1"
												min={0}
												max={100}
												value={(tier.rate * 100).toFixed(1)}
												onChange={(e) => updateTier(index, { rate: parseFloat(e.target.value) / 100 || 0 })}
												className="h-8 text-sm pr-6"
											/>
											<span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
												%
											</span>
										</div>

										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="h-8 w-8 text-muted-foreground hover:text-destructive"
											onClick={() => removeTier(index)}
											disabled={data.tiers.length <= 1}
										>
											<Trash2 className="w-4 h-4" />
										</Button>
									</div>
								))}

								<Button
									type="button"
									variant="outline"
									size="sm"
									className="w-full mt-2"
									onClick={addTier}
								>
									<Plus className="w-4 h-4 mr-2" />
									{t('wizard.advanced.tiers.addLevel')}
								</Button>
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
							onCheckedChange={(checked) => updateData({ roleRatesEnabled: checked })}
						/>
					</div>

					{data.roleRatesEnabled && (
						<div className="space-y-3 pt-2">
							{roleOptions.map((role) => (
								<div key={role.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
									<span className="text-sm font-medium">{role.label}</span>
									<div className="relative w-20">
										<Input
											type="number"
											step="0.1"
											min={0}
											max={100}
											value={((data.roleRates[role.key] || 0) * 100).toFixed(1)}
											onChange={(e) => updateRoleRate(role.key, parseFloat(e.target.value) || 0)}
											className="h-8 text-sm pr-6"
										/>
										<span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
											%
										</span>
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

							{/* Staff selector */}
							<Popover open={staffComboboxOpen} onOpenChange={setStaffComboboxOpen}>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										role="combobox"
										aria-expanded={staffComboboxOpen}
										className="w-full justify-between"
										disabled={availableStaff.length === 0}
									>
										{t('wizard.advanced.overrides.addStaff')}
										<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-full p-0" align="start">
									<Command>
										<CommandInput placeholder={t('overrides.searchStaff')} />
										<CommandList>
											<CommandEmpty>{t('overrides.noStaffFound')}</CommandEmpty>
											<CommandGroup>
												{availableStaff.map((staff) => (
													<CommandItem
														key={staff.staffId}
														value={`${staff.firstName} ${staff.lastName}`}
														onSelect={() => addOverride(staff.staffId, `${staff.firstName} ${staff.lastName}`)}
														className="cursor-pointer"
													>
														<Check className="mr-2 h-4 w-4 opacity-0" />
														<div className="flex items-center gap-2">
															<span>{staff.firstName} {staff.lastName}</span>
															{staff.role && (
																<Badge variant="secondary" className="text-xs">
																	{staff.role}
																</Badge>
															)}
														</div>
													</CommandItem>
												))}
											</CommandGroup>
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>

							{/* Overrides list */}
							{data.overrides.length > 0 && (
								<div className="space-y-2">
									{data.overrides.map((override) => (
										<div
											key={override.staffId}
											className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
										>
											<div className="flex items-center gap-3">
												<div className="flex flex-col">
													<span className="font-medium text-sm">{override.staffName}</span>
													{override.excludeFromCommissions ? (
														<span className="text-xs text-rose-600 dark:text-rose-400">
															{t('wizard.advanced.overrides.excluded')}
														</span>
													) : (
														<span className="text-xs text-muted-foreground">
															{t('wizard.advanced.overrides.customRateLabel', {
																rate: ((override.customRate || 0) * 100).toFixed(1),
															})}
														</span>
													)}
												</div>
											</div>

											<div className="flex items-center gap-2">
												{!override.excludeFromCommissions && (
													<div className="relative w-20">
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
															className="h-8 text-sm pr-6"
														/>
														<span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
															%
														</span>
													</div>
												)}

												<TooltipProvider>
													<Tooltip>
														<TooltipTrigger asChild>
															<Button
																type="button"
																variant={override.excludeFromCommissions ? 'destructive' : 'ghost'}
																size="icon"
																className="h-8 w-8"
																onClick={() =>
																	updateOverride(override.staffId, {
																		excludeFromCommissions: !override.excludeFromCommissions,
																	})
																}
															>
																<UserX className="w-4 h-4" />
															</Button>
														</TooltipTrigger>
														<TooltipContent>
															{override.excludeFromCommissions
																? t('wizard.advanced.overrides.includeInCommissions')
																: t('wizard.advanced.overrides.excludeFromCommissions')}
														</TooltipContent>
													</Tooltip>
												</TooltipProvider>

												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-muted-foreground hover:text-destructive"
													onClick={() => removeOverride(override.staffId)}
												>
													<Trash2 className="w-4 h-4" />
												</Button>
											</div>
										</div>
									))}
								</div>
							)}

							{data.overrides.length === 0 && (
								<div className="text-center py-4 text-sm text-muted-foreground">
									{t('wizard.advanced.overrides.noOverrides')}
								</div>
							)}
						</div>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	)
}
