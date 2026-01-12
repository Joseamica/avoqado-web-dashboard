import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Award, Gift, Clock, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PermissionGate } from '@/components/PermissionGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import loyaltyService from '@/services/loyalty.service'
import { getIntlLocale } from '@/utils/i18n-locale'

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

	// Schema
	const schema = z.object({
		active: z.boolean(),
		pointsPerDollar: z.number().min(0),
		pointsPerVisit: z.number().min(0),
		redemptionRate: z.number().min(0),
		minPointsRedeem: z.number().min(0),
		pointsExpireDays: z.number().min(1).nullable(),
	})

	type FormData = z.infer<typeof schema>

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
		[i18n.language]
	)

	// Calculate example discount
	const examplePoints = 100
	const exampleDiscount = examplePoints * (watchedRedemptionRate || 0)

	if (isLoading) {
		return (
			<div className="p-6 bg-background text-foreground">
				<div className="animate-pulse space-y-6">
					<div className="h-8 bg-muted rounded w-1/3"></div>
					<div className="grid gap-6 md:grid-cols-2">
						<div className="h-48 bg-muted rounded"></div>
						<div className="h-48 bg-muted rounded"></div>
						<div className="h-48 bg-muted rounded"></div>
						<div className="h-48 bg-muted rounded"></div>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="p-6 bg-background text-foreground">
			<div className="mb-6">
				<PageTitleWithInfo
					title={t('title')}
					className="text-2xl font-bold"
					tooltip={t('info.loyalty', {
						defaultValue: 'Configura el programa de lealtad, reglas de acumulacion y canje.',
					})}
				/>
				<p className="text-muted-foreground">{t('subtitle')}</p>
			</div>

			<form onSubmit={handleSubmit(onSubmit)}>
				<div className="grid gap-6 md:grid-cols-2">
					{/* Program Status */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Award className="h-5 w-5" />
								{t('settings.status.label')}
							</CardTitle>
							<CardDescription>{t('settings.status.description')}</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">
										{watchedActive ? t('settings.status.active') : t('settings.status.inactive')}
									</p>
									<p className="text-sm text-muted-foreground">
										{watchedActive ? 'Customers can earn and redeem points' : 'Points system is disabled'}
									</p>
								</div>
								<Switch
									checked={watchedActive}
									onCheckedChange={(checked) => setValue('active', checked, { shouldDirty: true })}
								/>
							</div>
						</CardContent>
					</Card>

					{/* Earning Rules */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<TrendingUp className="h-5 w-5" />
								{t('settings.earning.title')}
							</CardTitle>
							<CardDescription>{t('settings.earning.description')}</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="pointsPerDollar">{t('settings.earning.pointsPerDollar.label')}</Label>
								<div className="flex items-center gap-2">
									<Input
										id="pointsPerDollar"
										type="number"
										step="0.1"
										min="0"
										className="flex-1"
										{...register('pointsPerDollar', { valueAsNumber: true })}
									/>
									<span className="text-sm text-muted-foreground whitespace-nowrap">
										{t('settings.earning.pointsPerDollar.suffix')}
									</span>
								</div>
								<p className="text-xs text-muted-foreground">
									{t('settings.earning.pointsPerDollar.description')}
								</p>
								{errors.pointsPerDollar && (
									<p className="text-sm text-destructive">{errors.pointsPerDollar.message}</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="pointsPerVisit">{t('settings.earning.pointsPerVisit.label')}</Label>
								<div className="flex items-center gap-2">
									<Input
										id="pointsPerVisit"
										type="number"
										min="0"
										className="flex-1"
										{...register('pointsPerVisit', { valueAsNumber: true })}
									/>
									<span className="text-sm text-muted-foreground whitespace-nowrap">
										{t('settings.earning.pointsPerVisit.suffix')}
									</span>
								</div>
								<p className="text-xs text-muted-foreground">
									{t('settings.earning.pointsPerVisit.description')}
								</p>
								{errors.pointsPerVisit && (
									<p className="text-sm text-destructive">{errors.pointsPerVisit.message}</p>
								)}
							</div>
						</CardContent>
					</Card>

					{/* Redemption Rules */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Gift className="h-5 w-5" />
								{t('settings.redemption.title')}
							</CardTitle>
							<CardDescription>{t('settings.redemption.description')}</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="redemptionRate">{t('settings.redemption.redemptionRate.label')}</Label>
								<div className="flex items-center gap-2">
									<span className="text-muted-foreground">$</span>
									<Input
										id="redemptionRate"
										type="number"
										step="0.001"
										min="0"
										className="flex-1"
										{...register('redemptionRate', { valueAsNumber: true })}
									/>
									<span className="text-sm text-muted-foreground whitespace-nowrap">
										{t('settings.redemption.redemptionRate.suffix')}
									</span>
								</div>
								<p className="text-xs text-muted-foreground">
									{t('settings.redemption.redemptionRate.description')}
								</p>
								{watchedRedemptionRate > 0 && (
									<p className="text-xs text-primary">
										{t('settings.redemption.redemptionRate.example', {
											points: examplePoints,
											value: formatCurrency(exampleDiscount),
										})}
									</p>
								)}
								{errors.redemptionRate && (
									<p className="text-sm text-destructive">{errors.redemptionRate.message}</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="minPointsRedeem">{t('settings.redemption.minPointsRedeem.label')}</Label>
								<div className="flex items-center gap-2">
									<Input
										id="minPointsRedeem"
										type="number"
										min="0"
										className="flex-1"
										{...register('minPointsRedeem', { valueAsNumber: true })}
									/>
									<span className="text-sm text-muted-foreground whitespace-nowrap">
										{t('settings.redemption.minPointsRedeem.suffix')}
									</span>
								</div>
								<p className="text-xs text-muted-foreground">
									{t('settings.redemption.minPointsRedeem.description')}
								</p>
								{errors.minPointsRedeem && (
									<p className="text-sm text-destructive">{errors.minPointsRedeem.message}</p>
								)}
							</div>
						</CardContent>
					</Card>

					{/* Expiration Settings */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Clock className="h-5 w-5" />
								{t('settings.expiration.title')}
							</CardTitle>
							<CardDescription>{t('settings.expiration.description')}</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">{t('settings.expiration.enabled.label')}</p>
									<p className="text-sm text-muted-foreground">
										{t('settings.expiration.enabled.description')}
									</p>
								</div>
								<Switch
									checked={enableExpiration}
									onCheckedChange={(checked) => {
										setEnableExpiration(checked)
										if (!checked) {
											setValue('pointsExpireDays', null, { shouldDirty: true })
										} else {
											setValue('pointsExpireDays', 365, { shouldDirty: true })
										}
									}}
								/>
							</div>

							{enableExpiration && (
								<div className="space-y-2">
									<Label htmlFor="pointsExpireDays">{t('settings.expiration.days.label')}</Label>
									<div className="flex items-center gap-2">
										<Input
											id="pointsExpireDays"
											type="number"
											min="1"
											className="flex-1"
											{...register('pointsExpireDays', { valueAsNumber: true })}
										/>
										<span className="text-sm text-muted-foreground whitespace-nowrap">
											{t('settings.expiration.days.suffix')}
										</span>
									</div>
									<p className="text-xs text-muted-foreground">
										{t('settings.expiration.days.description')}
									</p>
								</div>
							)}

							{!enableExpiration && (
								<p className="text-sm text-muted-foreground italic">
									{t('settings.expiration.days.neverExpire')}
								</p>
							)}
						</CardContent>
					</Card>
				</div>

				<PermissionGate permission="loyalty:update">
					<div className="flex justify-end mt-6">
						<Button type="submit" disabled={!isDirty || updateMutation.isPending}>
							{updateMutation.isPending ? (
								<>
									<div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
									{t('settings.saving')}
								</>
							) : (
								t('settings.save')
							)}
						</Button>
					</div>
				</PermissionGate>
			</form>
		</div>
	)
}
