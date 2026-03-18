import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Award, Gift, Clock, TrendingUp, Sparkles, ArrowRight, Coins, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { GlassCard } from '@/components/ui/glass-card'
import { PermissionGate } from '@/components/PermissionGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import loyaltyService from '@/services/loyalty.service'
import { getIntlLocale } from '@/utils/i18n-locale'
import { cn } from '@/lib/utils'

// ─── Schema ─────────────────────────────────────────────────────────────────
const schema = z.object({
	active: z.boolean(),
	pointsPerDollar: z.number().min(0),
	pointsPerVisit: z.number().min(0),
	redemptionRate: z.number().min(0),
	minPointsRedeem: z.number().min(0),
	pointsExpireDays: z.number().min(1).nullable(),
})

type FormData = z.infer<typeof schema>

// ─── Section Header ─────────────────────────────────────────────────────────
function SectionHeader({
	icon: Icon,
	title,
	description,
	gradient,
}: {
	icon: React.ElementType
	title: string
	description: string
	gradient: string
}) {
	return (
		<div className="flex items-start gap-3 mb-5">
			<div className={cn('p-2 rounded-xl bg-linear-to-br', gradient)}>
				<Icon className="h-5 w-5" />
			</div>
			<div className="min-w-0">
				<h3 className="font-semibold text-sm">{title}</h3>
				<p className="text-xs text-muted-foreground mt-0.5">{description}</p>
			</div>
		</div>
	)
}

// ─── Field Row ──────────────────────────────────────────────────────────────
function FieldRow({
	label,
	description,
	suffix,
	prefix,
	error,
	hint,
	inputProps,
}: {
	label: string
	description: string
	suffix?: string
	prefix?: React.ReactNode
	error?: string
	hint?: React.ReactNode
	inputProps: React.ComponentProps<'input'>
}) {
	return (
		<div className="space-y-1.5">
			<Label className="text-sm font-medium">{label}</Label>
			<div className="flex items-center gap-2">
				{prefix}
				<div className="relative flex-1">
					<Input
						className={cn('h-9 w-full', suffix && 'pr-24')}
						{...inputProps}
					/>
					{suffix && (
						<span className="absolute inset-y-0 right-3 flex items-center pointer-events-none select-none text-xs text-muted-foreground whitespace-nowrap">
							{suffix}
						</span>
					)}
				</div>
			</div>
			<p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
			{hint}
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	)
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function LoyaltySettings() {
	const { venueId } = useCurrentVenue()
	const { toast } = useToast()
	const queryClient = useQueryClient()
	const { t, i18n } = useTranslation('loyalty')
	const { t: tCommon } = useTranslation()

	const [enableExpiration, setEnableExpiration] = useState(false)

	// Fetch loyalty config
	const { data: config, isLoading } = useQuery({
		queryKey: ['loyalty-config', venueId],
		queryFn: () => loyaltyService.getConfig(venueId),
	})

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { errors, isDirty },
	} = useForm<FormData>({
		resolver: zodResolver(schema),
		defaultValues: {
			active: true,
			pointsPerDollar: 1,
			pointsPerVisit: 0,
			redemptionRate: 0.01,
			minPointsRedeem: 100,
			pointsExpireDays: null,
		},
	})

	// Update form when config loads
	useEffect(() => {
		if (config) {
			reset({
				active: config.active,
				pointsPerDollar: config.pointsPerDollar,
				pointsPerVisit: config.pointsPerVisit,
				redemptionRate: config.redemptionRate,
				minPointsRedeem: config.minPointsRedeem,
				pointsExpireDays: config.pointsExpireDays,
			})
			setEnableExpiration(config.pointsExpireDays !== null)
		}
	}, [config, reset])

	const watchedActive = watch('active')
	const watchedRedemptionRate = watch('redemptionRate')
	const watchedPointsPerDollar = watch('pointsPerDollar')
	const watchedPointsPerVisit = watch('pointsPerVisit')
	const watchedMinPoints = watch('minPointsRedeem')
	const watchedExpireDays = watch('pointsExpireDays')

	// Update mutation
	const updateMutation = useMutation({
		mutationFn: (data: FormData) =>
			loyaltyService.updateConfig(venueId, {
				active: data.active,
				pointsPerDollar: data.pointsPerDollar,
				pointsPerVisit: data.pointsPerVisit,
				redemptionRate: data.redemptionRate,
				minPointsRedeem: data.minPointsRedeem,
				pointsExpireDays: enableExpiration ? data.pointsExpireDays : null,
			}),
		onSuccess: () => {
			toast({ title: t('settings.toasts.updateSuccess') })
			queryClient.invalidateQueries({ queryKey: ['loyalty-config', venueId] })
		},
		onError: (error: any) => {
			toast({
				title: tCommon('common.error'),
				description: error.response?.data?.message || t('settings.toasts.updateError'),
				variant: 'destructive',
			})
		},
	})

	const onSubmit = (data: FormData) => {
		updateMutation.mutate(data)
	}

	// Format currency
	const formatCurrency = useMemo(
		() => (amount: number) => {
			return new Intl.NumberFormat(getIntlLocale(i18n.language), {
				style: 'currency',
				currency: 'MXN',
			}).format(amount)
		},
		[i18n.language],
	)

	// Live preview calculations
	const exampleSpend = 500
	const earnedPoints = Math.round(exampleSpend * (watchedPointsPerDollar || 0)) + (watchedPointsPerVisit || 0)
	const exampleDiscount = (watchedMinPoints || 100) * (watchedRedemptionRate || 0)

	if (isLoading) {
		return (
			<div className="p-6 space-y-6">
				<div className="animate-pulse space-y-2">
					<div className="h-7 bg-muted rounded-lg w-48" />
					<div className="h-4 bg-muted rounded w-72" />
				</div>
				<div className="grid grid-cols-12 gap-4">
					<div className="col-span-12 lg:col-span-8 space-y-4">
						<div className="h-52 bg-muted/50 rounded-2xl" />
						<div className="h-64 bg-muted/50 rounded-2xl" />
					</div>
					<div className="col-span-12 lg:col-span-4 space-y-4">
						<div className="h-72 bg-muted/50 rounded-2xl" />
						<div className="h-44 bg-muted/50 rounded-2xl" />
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="p-6">
			{/* ── Header ── */}
			<div className="mb-6">
				<PageTitleWithInfo
					title={t('title')}
					className="text-2xl font-bold"
					tooltip={t('info.loyalty', {
						defaultValue: 'Configura el programa de lealtad, reglas de acumulacion y canje.',
					})}
				/>
				<p className="text-muted-foreground text-sm">{t('subtitle')}</p>
			</div>

			<form onSubmit={handleSubmit(onSubmit)}>
				<div className="grid grid-cols-12 gap-4">
					{/* ━━━━━━━━━━━━━━━ LEFT COLUMN (8 cols) ━━━━━━━━━━━━━━━ */}
					<div className="col-span-12 lg:col-span-8 space-y-4">
						{/* ── Program Status ── */}
						<GlassCard className="p-5">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div
										className={cn(
											'p-2.5 rounded-xl transition-colors duration-300',
											watchedActive
												? 'bg-linear-to-br from-green-500/20 to-green-500/5'
												: 'bg-linear-to-br from-muted-foreground/10 to-muted-foreground/5',
										)}
									>
										<Award
											className={cn(
												'h-5 w-5 transition-colors duration-300',
												watchedActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
											)}
										/>
									</div>
									<div>
										<h3 className="font-semibold text-sm">{t('settings.status.label')}</h3>
										<p className="text-xs text-muted-foreground">{t('settings.status.description')}</p>
									</div>
								</div>
								<div className="flex items-center gap-3">
									<span
										className={cn(
											'text-xs font-medium px-2 py-0.5 rounded-full transition-colors duration-300',
											watchedActive
												? 'bg-green-500/10 text-green-600 dark:text-green-400'
												: 'bg-muted text-muted-foreground',
										)}
									>
										{watchedActive ? t('settings.status.active') : t('settings.status.inactive')}
									</span>
									<Switch checked={watchedActive} onCheckedChange={checked => setValue('active', checked, { shouldDirty: true })} />
								</div>
							</div>
						</GlassCard>

						{/* ── Earning Rules ── */}
						<GlassCard className="p-5">
							<SectionHeader
								icon={TrendingUp}
								title={t('settings.earning.title')}
								description={t('settings.earning.description')}
								gradient="from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400"
							/>
							<div className="space-y-5">
								<FieldRow
									label={t('settings.earning.pointsPerDollar.label')}
									description={t('settings.earning.pointsPerDollar.description')}
									suffix={t('settings.earning.pointsPerDollar.suffix')}
									error={errors.pointsPerDollar?.message}
									inputProps={{ type: 'number', step: '0.1', min: '0', ...register('pointsPerDollar', { valueAsNumber: true }) }}
								/>

								<div className="border-t border-border/50" />

								<FieldRow
									label={t('settings.earning.pointsPerVisit.label')}
									description={t('settings.earning.pointsPerVisit.description')}
									suffix={t('settings.earning.pointsPerVisit.suffix')}
									error={errors.pointsPerVisit?.message}
									inputProps={{ type: 'number', min: '0', ...register('pointsPerVisit', { valueAsNumber: true }) }}
								/>
							</div>
						</GlassCard>

						{/* ── Redemption Rules ── */}
						<GlassCard className="p-5">
							<SectionHeader
								icon={Gift}
								title={t('settings.redemption.title')}
								description={t('settings.redemption.description')}
								gradient="from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400"
							/>
							<div className="space-y-5">
								<FieldRow
									label={t('settings.redemption.redemptionRate.label')}
									description={t('settings.redemption.redemptionRate.description')}
									suffix={t('settings.redemption.redemptionRate.suffix')}
									error={errors.redemptionRate?.message}
									prefix={<span className="text-sm text-muted-foreground">$</span>}
									hint={
										watchedRedemptionRate > 0 ? (
											<p className="text-[11px] text-primary font-medium">
												{t('settings.redemption.redemptionRate.example', {
													points: watchedMinPoints || 100,
													value: formatCurrency((watchedMinPoints || 100) * watchedRedemptionRate),
												})}
											</p>
										) : null
									}
									inputProps={{ type: 'number', step: '0.001', min: '0', ...register('redemptionRate', { valueAsNumber: true }) }}
								/>

								<div className="border-t border-border/50" />

								<FieldRow
									label={t('settings.redemption.minPointsRedeem.label')}
									description={t('settings.redemption.minPointsRedeem.description')}
									suffix={t('settings.redemption.minPointsRedeem.suffix')}
									error={errors.minPointsRedeem?.message}
									inputProps={{ type: 'number', min: '0', ...register('minPointsRedeem', { valueAsNumber: true }) }}
								/>
							</div>
						</GlassCard>

						{/* ── Expiration ── */}
						<GlassCard className="p-5">
							<SectionHeader
								icon={Clock}
								title={t('settings.expiration.title')}
								description={t('settings.expiration.description')}
								gradient="from-orange-500/20 to-orange-500/5 text-orange-600 dark:text-orange-400"
							/>

							<div className="flex items-center justify-between mb-4">
								<div>
									<p className="text-sm font-medium">{t('settings.expiration.enabled.label')}</p>
									<p className="text-xs text-muted-foreground">{t('settings.expiration.enabled.description')}</p>
								</div>
								<Switch
									checked={enableExpiration}
									onCheckedChange={checked => {
										setEnableExpiration(checked)
										if (!checked) {
											setValue('pointsExpireDays', null, { shouldDirty: true })
										} else {
											setValue('pointsExpireDays', 365, { shouldDirty: true })
										}
									}}
								/>
							</div>

							{enableExpiration ? (
								<div className="pt-4 border-t border-border/50">
									<FieldRow
										label={t('settings.expiration.days.label')}
										description={t('settings.expiration.days.description')}
										suffix={t('settings.expiration.days.suffix')}
										inputProps={{ type: 'number', min: '1', ...register('pointsExpireDays', { valueAsNumber: true }) }}
									/>
								</div>
							) : (
								<p className="text-xs text-muted-foreground italic">{t('settings.expiration.days.neverExpire')}</p>
							)}
						</GlassCard>
					</div>

					{/* ━━━━━━━━━━━━━━━ RIGHT COLUMN (4 cols) ━━━━━━━━━━━━━━━ */}
					<div className="col-span-12 lg:col-span-4 space-y-4">
						{/* ── Live Preview ── */}
						<GlassCard className="p-5 sticky top-4">
							<div className="flex items-center gap-2 mb-4">
								<Sparkles className="h-4 w-4 text-amber-500" />
								<h3 className="font-semibold text-sm">{t('settings.earning.title', { defaultValue: 'Vista previa' })}</h3>
							</div>

							{/* Earn flow */}
							<div className="rounded-xl bg-muted/40 p-4 space-y-3">
								<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
									{t('settings.earning.title')}
								</p>
								<div className="flex items-center gap-2">
									<div className="flex-1 text-center">
										<p className="text-lg font-bold">{formatCurrency(exampleSpend)}</p>
										<p className="text-[10px] text-muted-foreground">
											{t('transactions.reasons.purchase', { defaultValue: 'Compra' })}
										</p>
									</div>
									<ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
									<div className="flex-1 text-center">
										<div className="flex items-center justify-center gap-1">
											<Coins className="h-4 w-4 text-amber-500" />
											<p className="text-lg font-bold text-amber-600 dark:text-amber-400">{earnedPoints}</p>
										</div>
										<p className="text-[10px] text-muted-foreground">{t('pointsLabel')}</p>
									</div>
								</div>
								{(watchedPointsPerVisit || 0) > 0 && (
									<p className="text-[10px] text-center text-muted-foreground">
										+{watchedPointsPerVisit} {t('transactions.reasons.visit', { defaultValue: 'bonus visita' })}
									</p>
								)}
							</div>

							{/* Divider */}
							<div className="flex items-center gap-2 my-3">
								<div className="flex-1 border-t border-border/50" />
								<Star className="h-3 w-3 text-muted-foreground/50" />
								<div className="flex-1 border-t border-border/50" />
							</div>

							{/* Redeem flow */}
							<div className="rounded-xl bg-muted/40 p-4 space-y-3">
								<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
									{t('settings.redemption.title')}
								</p>
								<div className="flex items-center gap-2">
									<div className="flex-1 text-center">
										<div className="flex items-center justify-center gap-1">
											<Coins className="h-4 w-4 text-amber-500" />
											<p className="text-lg font-bold">{watchedMinPoints || 100}</p>
										</div>
										<p className="text-[10px] text-muted-foreground">{t('pointsLabel')}</p>
									</div>
									<ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
									<div className="flex-1 text-center">
										<p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(exampleDiscount)}</p>
										<p className="text-[10px] text-muted-foreground">
											{t('redeem.preview.discount', { defaultValue: 'Descuento' })}
										</p>
									</div>
								</div>
							</div>

							{/* Expiration note */}
							{enableExpiration && watchedExpireDays && (
								<div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
									<Clock className="h-3 w-3 shrink-0" />
									<span>
										{t('settings.expiration.days.description')} ({watchedExpireDays} {t('settings.expiration.days.suffix')})
									</span>
								</div>
							)}
						</GlassCard>

						{/* ── Save Button ── */}
						<PermissionGate permission="loyalty:update">
							<Button type="submit" className="w-full" disabled={!isDirty || updateMutation.isPending}>
								{updateMutation.isPending ? (
									<>
										<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
										{t('settings.saving')}
									</>
								) : (
									t('settings.save')
								)}
							</Button>
						</PermissionGate>
					</div>
				</div>
			</form>
		</div>
	)
}
