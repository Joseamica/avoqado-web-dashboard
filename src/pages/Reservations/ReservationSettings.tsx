import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CalendarDays, Clock, CreditCard, Globe, Shield, Users, Bell, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import reservationService from '@/services/reservation.service'
import type { OperatingHours } from '@/types/reservation'

const nullableNumber = (validator: z.ZodNumber) =>
	z.preprocess(v => (v === '' || v === null || v === undefined ? null : Number(v)), validator.nullable())

const settingsSchema = z.object({
	// Scheduling
	slotIntervalMin: z.coerce.number().min(5).max(120),
	defaultDurationMin: z.coerce.number().min(15).max(480),
	autoConfirm: z.boolean(),
	maxAdvanceDays: z.coerce.number().min(1).max(365),
	minNoticeMin: z.coerce.number().min(0).max(10080),
	noShowGraceMin: z.coerce.number().min(0).max(120),
	// Pacing
	pacingMaxPerSlot: nullableNumber(z.number().min(0)),
	onlineCapacityPercent: z.coerce.number().min(0).max(100),
	// Deposits
	depositMode: z.enum(['none', 'card_hold', 'deposit', 'prepaid']),
	depositFixedAmount: nullableNumber(z.number().min(0)),
	depositPercentage: nullableNumber(z.number().min(0).max(100)),
	depositPartySizeGte: nullableNumber(z.number().min(1)),
	// Public booking
	publicBookingEnabled: z.boolean(),
	requirePhone: z.boolean(),
	requireEmail: z.boolean(),
	// Cancellation
	allowCustomerCancel: z.boolean(),
	minHoursBeforeCancel: nullableNumber(z.number().min(0)),
	forfeitDeposit: z.boolean(),
	noShowFeePercent: nullableNumber(z.number().min(0).max(100)),
	// Credit refund policy on cancellation
	creditRefundMode: z.enum(['NEVER', 'ALWAYS', 'TIME_BASED']),
	creditFreeRefundHoursBefore: z.coerce.number().min(0).max(720),
	creditLateRefundPercent: z.coerce.number().min(0).max(100),
	creditNoShowRefund: z.boolean(),
	// Reschedule
	allowCustomerReschedule: z.boolean(),
	// Waitlist
	waitlistEnabled: z.boolean(),
	waitlistMaxSize: z.coerce.number().min(1).max(500),
	waitlistPriorityMode: z.enum(['fifo', 'party_size', 'broadcast']),
	waitlistNotifyWindow: z.coerce.number().min(5).max(120),
	// Reminders
	remindersEnabled: z.boolean(),
})

type SettingsFormData = z.infer<typeof settingsSchema>

const FieldError = ({ message }: { message?: string }) =>
	message ? (
		<p role="alert" className="text-xs text-destructive mt-1">
			{message}
		</p>
	) : null

export default function ReservationSettings() {
	const { venueId } = useCurrentVenue()
	const { toast } = useToast()
	const queryClient = useQueryClient()
	const { t } = useTranslation('reservations')
	const { t: tCommon } = useTranslation()

	const { data: settings, isLoading } = useQuery({
		queryKey: ['reservation-settings', venueId],
		queryFn: () => reservationService.getSettings(venueId),
	})

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { errors, isDirty },
	} = useForm<SettingsFormData>({
		resolver: zodResolver(settingsSchema),
		defaultValues: {
			slotIntervalMin: 15,
			defaultDurationMin: 60,
			autoConfirm: true,
			maxAdvanceDays: 60,
			minNoticeMin: 60,
			noShowGraceMin: 15,
			pacingMaxPerSlot: null,
			onlineCapacityPercent: 100,
			depositMode: 'none',
			depositFixedAmount: null,
			depositPercentage: null,
			depositPartySizeGte: null,
			publicBookingEnabled: false,
			requirePhone: true,
			requireEmail: false,
			allowCustomerCancel: true,
			minHoursBeforeCancel: 2,
			forfeitDeposit: false,
			noShowFeePercent: null,
			creditRefundMode: 'TIME_BASED',
			creditFreeRefundHoursBefore: 12,
			creditLateRefundPercent: 0,
			creditNoShowRefund: false,
			allowCustomerReschedule: true,
			waitlistEnabled: true,
			waitlistMaxSize: 50,
			waitlistPriorityMode: 'fifo',
			waitlistNotifyWindow: 30,
			remindersEnabled: true,
		},
	})

	// Single watch() call — one subscription instead of 14 inline calls
	const formValues = watch()

	// Operating hours managed separately in calendar
	const [operatingHours, setOperatingHours] = useState<OperatingHours | null>(null)

	useEffect(() => {
		if (settings) {
			setOperatingHours(settings.operatingHours)
			reset({
				slotIntervalMin: settings.scheduling.slotIntervalMin,
				defaultDurationMin: settings.scheduling.defaultDurationMin,
				autoConfirm: settings.scheduling.autoConfirm,
				maxAdvanceDays: settings.scheduling.maxAdvanceDays,
				minNoticeMin: settings.scheduling.minNoticeMin,
				noShowGraceMin: settings.scheduling.noShowGraceMin,
				pacingMaxPerSlot: settings.scheduling.pacingMaxPerSlot,
				onlineCapacityPercent: settings.scheduling.onlineCapacityPercent,
				depositMode: settings.deposits.mode,
				depositFixedAmount: settings.deposits.fixedAmount,
				depositPercentage: settings.deposits.percentageOfTotal,
				depositPartySizeGte: settings.deposits.requiredForPartySizeGte,
				publicBookingEnabled: settings.publicBooking.enabled,
				requirePhone: settings.publicBooking.requirePhone,
				requireEmail: settings.publicBooking.requireEmail,
				allowCustomerCancel: settings.cancellation.allowCustomerCancel,
				minHoursBeforeCancel: settings.cancellation.minHoursBeforeStart,
				forfeitDeposit: settings.cancellation.forfeitDeposit,
				noShowFeePercent: settings.cancellation.noShowFeePercent,
				creditRefundMode: settings.cancellation.creditRefundMode ?? 'TIME_BASED',
				creditFreeRefundHoursBefore: settings.cancellation.creditFreeRefundHoursBefore ?? 12,
				creditLateRefundPercent: settings.cancellation.creditLateRefundPercent ?? 0,
				creditNoShowRefund: settings.cancellation.creditNoShowRefund ?? false,
				allowCustomerReschedule: settings.cancellation.allowCustomerReschedule ?? true,
				waitlistEnabled: settings.waitlist.enabled,
				waitlistMaxSize: settings.waitlist.maxSize,
				waitlistPriorityMode: settings.waitlist.priorityMode,
				waitlistNotifyWindow: settings.waitlist.notifyWindowMin,
				remindersEnabled: settings.reminders.enabled,
			})
		}
	}, [settings, reset])

	const updateMutation = useMutation({
		mutationFn: (data: SettingsFormData) => {
			// Transform flat form → nested API shape + include operatingHours
			return reservationService.updateSettings(venueId, {
				scheduling: {
					slotIntervalMin: data.slotIntervalMin,
					defaultDurationMin: data.defaultDurationMin,
					autoConfirm: data.autoConfirm,
					maxAdvanceDays: data.maxAdvanceDays,
					minNoticeMin: data.minNoticeMin,
					noShowGraceMin: data.noShowGraceMin,
					pacingMaxPerSlot: data.pacingMaxPerSlot,
					onlineCapacityPercent: data.onlineCapacityPercent,
				},
				deposits: {
					enabled: data.depositMode !== 'none',
					mode: data.depositMode,
					fixedAmount: data.depositFixedAmount,
					percentageOfTotal: data.depositPercentage,
					requiredForPartySizeGte: data.depositPartySizeGte,
					paymentWindowHrs: null,
				},
				publicBooking: {
					enabled: data.publicBookingEnabled,
					requirePhone: data.requirePhone,
					requireEmail: data.requireEmail,
				},
				cancellation: {
					allowCustomerCancel: data.allowCustomerCancel,
					minHoursBeforeStart: data.minHoursBeforeCancel,
					forfeitDeposit: data.forfeitDeposit,
					noShowFeePercent: data.noShowFeePercent,
					creditRefundMode: data.creditRefundMode,
					creditFreeRefundHoursBefore: data.creditFreeRefundHoursBefore,
					creditLateRefundPercent: data.creditLateRefundPercent,
					creditNoShowRefund: data.creditNoShowRefund,
					allowCustomerReschedule: data.allowCustomerReschedule,
				},
				waitlist: {
					enabled: data.waitlistEnabled,
					maxSize: data.waitlistMaxSize,
					priorityMode: data.waitlistPriorityMode,
					notifyWindowMin: data.waitlistNotifyWindow,
				},
				reminders: {
					enabled: data.remindersEnabled,
					channels: settings?.reminders.channels ?? ['EMAIL'],
					minutesBefore: settings?.reminders.minutesBefore ?? [1440, 120],
				},
				...(operatingHours ? { operatingHours } : {}),
			})
		},
		onSuccess: () => {
			toast({ title: t('settings.saved') })
			queryClient.invalidateQueries({ queryKey: ['reservation-settings', venueId] })
		},
		onError: (error: any) => {
			toast({
				title: tCommon('error'),
				description: error.response?.data?.message || t('toasts.error'),
				variant: 'destructive',
			})
		},
	})

	const isPending = updateMutation.isPending
	const canSave = isDirty && !isPending
	const handleSave = handleSubmit(data => updateMutation.mutate(data))

	if (isLoading) {
		return (
			<div className="p-4 bg-background text-foreground">
				<div className="animate-pulse space-y-4">
					<div className="h-8 w-64 rounded bg-muted" />
					<div className="h-48 rounded-lg bg-muted" />
					<div className="h-48 rounded-lg bg-muted" />
				</div>
			</div>
		)
	}

	return (
		<div className="p-4 bg-background text-foreground max-w-4xl pb-24">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<PageTitleWithInfo title={t('settings.title')} className="text-2xl font-bold" />
					<p className="text-muted-foreground">{t('settings.subtitle')}</p>
				</div>
				<Button onClick={handleSave} disabled={!canSave} data-tour="reservation-settings-save">
					{isPending ? tCommon('loading') : t('actions.saveChanges')}
				</Button>
			</div>

			<form onSubmit={handleSave}>
				<fieldset disabled={isPending} className="space-y-6">
					{/* Scheduling */}
					<Card className="border-input" data-tour="reservation-settings-scheduling">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<CalendarDays className="h-5 w-5" />
								{t('settings.sections.scheduling')}
							</CardTitle>
						</CardHeader>
						<CardContent className="grid grid-cols-2 gap-6">
							<div className="space-y-2">
								<Label htmlFor="slot-interval">{t('settings.scheduling.slotInterval')}</Label>
								<Input id="slot-interval" type="number" className="h-12 text-base" {...register('slotIntervalMin')} />
								<p className="text-xs text-muted-foreground">{t('settings.scheduling.slotIntervalHelp')}</p>
								<FieldError message={errors.slotIntervalMin?.message} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="default-duration">{t('settings.scheduling.defaultDuration')}</Label>
								<Input id="default-duration" type="number" className="h-12 text-base" {...register('defaultDurationMin')} />
								<p className="text-xs text-muted-foreground">{t('settings.scheduling.defaultDurationHelp')}</p>
								<FieldError message={errors.defaultDurationMin?.message} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="max-advance-days">{t('settings.scheduling.maxAdvanceDays')}</Label>
								<Input id="max-advance-days" type="number" className="h-12 text-base" {...register('maxAdvanceDays')} />
								<p className="text-xs text-muted-foreground">{t('settings.scheduling.maxAdvanceDaysHelp')}</p>
								<FieldError message={errors.maxAdvanceDays?.message} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="min-notice">{t('settings.scheduling.minNotice')}</Label>
								<Input id="min-notice" type="number" className="h-12 text-base" {...register('minNoticeMin')} />
								<p className="text-xs text-muted-foreground">{t('settings.scheduling.minNoticeHelp')}</p>
								<FieldError message={errors.minNoticeMin?.message} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="no-show-grace">{t('settings.scheduling.noShowGrace')}</Label>
								<Input id="no-show-grace" type="number" className="h-12 text-base" {...register('noShowGraceMin')} />
								<p className="text-xs text-muted-foreground">{t('settings.scheduling.noShowGraceHelp')}</p>
								<FieldError message={errors.noShowGraceMin?.message} />
							</div>
							<div className="flex items-center justify-between rounded-lg border border-input p-4">
								<div>
									<Label htmlFor="auto-confirm">{t('settings.scheduling.autoConfirm')}</Label>
									<p className="text-xs text-muted-foreground">{t('settings.scheduling.autoConfirmHelp')}</p>
								</div>
								<Switch
									id="auto-confirm"
									checked={formValues.autoConfirm}
									onCheckedChange={v => setValue('autoConfirm', v, { shouldDirty: true })}
									data-tour="reservation-auto-confirm"
								/>
							</div>
						</CardContent>
					</Card>

					{/* Pacing */}
					<Card className="border-input" data-tour="reservation-settings-pacing">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Clock className="h-5 w-5" />
								{t('settings.sections.pacing')}
							</CardTitle>
						</CardHeader>
						<CardContent className="grid grid-cols-2 gap-6">
							<div className="space-y-2">
								<Label htmlFor="pacing-max-per-slot">{t('settings.pacing.maxPerSlot')}</Label>
								<Input
									id="pacing-max-per-slot"
									type="number"
									className="h-12 text-base"
									placeholder="—"
									{...register('pacingMaxPerSlot')}
								/>
								<p className="text-xs text-muted-foreground">{t('settings.pacing.maxPerSlotHelp')}</p>
								<FieldError message={errors.pacingMaxPerSlot?.message} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="online-capacity">{t('settings.pacing.onlineCapacity')}</Label>
								<div className="flex items-center gap-2">
									<Input
										id="online-capacity"
										type="number"
										className="h-12 flex-1 text-base"
										{...register('onlineCapacityPercent')}
									/>
									<span className="text-muted-foreground">%</span>
								</div>
								<p className="text-xs text-muted-foreground">{t('settings.pacing.onlineCapacityHelp')}</p>
								<FieldError message={errors.onlineCapacityPercent?.message} />
							</div>
						</CardContent>
					</Card>

					{/* Deposits */}
					<Card className="border-input" data-tour="reservation-settings-deposits">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<CreditCard className="h-5 w-5" />
								{t('settings.sections.deposits')}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="space-y-2">
								<Label htmlFor="deposit-mode">{t('settings.deposits.mode')}</Label>
								<Select
									value={formValues.depositMode}
									onValueChange={v => setValue('depositMode', v as SettingsFormData['depositMode'], { shouldDirty: true })}
								>
									<SelectTrigger id="deposit-mode" className="h-12 text-base">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">{t('settings.deposits.modes.none')}</SelectItem>
										<SelectItem value="card_hold">{t('settings.deposits.modes.card_hold')}</SelectItem>
										<SelectItem value="deposit">{t('settings.deposits.modes.deposit')}</SelectItem>
										<SelectItem value="prepaid">{t('settings.deposits.modes.prepaid')}</SelectItem>
									</SelectContent>
								</Select>
							</div>
							{formValues.depositMode !== 'none' && (
								<div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
									<div className="space-y-2">
										<Label htmlFor="deposit-fixed-amount">{t('settings.deposits.fixedAmount')}</Label>
										<Input
											id="deposit-fixed-amount"
											type="number"
											step="0.01"
											className="h-12 text-base"
											{...register('depositFixedAmount')}
										/>
										<FieldError message={errors.depositFixedAmount?.message} />
									</div>
									<div className="space-y-2">
										<Label htmlFor="deposit-percentage">{t('settings.deposits.percentage')}</Label>
										<div className="flex items-center gap-2">
											<Input
												id="deposit-percentage"
												type="number"
												className="h-12 flex-1 text-base"
												{...register('depositPercentage')}
											/>
											<span className="text-muted-foreground">%</span>
										</div>
										<FieldError message={errors.depositPercentage?.message} />
									</div>
									<div className="space-y-2">
										<Label htmlFor="deposit-party-size-gte">{t('settings.deposits.partySizeGte')}</Label>
										<div className="flex items-center gap-2">
											<Input
												id="deposit-party-size-gte"
												type="number"
												className="h-12 flex-1 text-base"
												{...register('depositPartySizeGte')}
											/>
											<span className="text-sm text-muted-foreground">{t('settings.deposits.partySizeGteHelp')}</span>
										</div>
										<FieldError message={errors.depositPartySizeGte?.message} />
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Public Booking */}
					<Card className="border-input" data-tour="reservation-settings-public-booking">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Globe className="h-5 w-5" />
								{t('settings.sections.publicBooking')}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center justify-between rounded-lg border border-input p-4">
								<div>
									<Label htmlFor="public-booking-enabled">{t('settings.publicBooking.enabled')}</Label>
									<p className="text-xs text-muted-foreground">{t('settings.publicBooking.enabledHelp')}</p>
								</div>
								<Switch
									id="public-booking-enabled"
									checked={formValues.publicBookingEnabled}
									onCheckedChange={v => setValue('publicBookingEnabled', v, { shouldDirty: true })}
									data-tour="reservation-public-booking-enabled"
								/>
							</div>
							<div className="flex items-center justify-between rounded-lg border border-input p-4">
								<Label htmlFor="require-phone">{t('settings.publicBooking.requirePhone')}</Label>
								<Switch
									id="require-phone"
									checked={formValues.requirePhone}
									onCheckedChange={v => setValue('requirePhone', v, { shouldDirty: true })}
								/>
							</div>
							<div className="flex items-center justify-between rounded-lg border border-input p-4">
								<Label htmlFor="require-email">{t('settings.publicBooking.requireEmail')}</Label>
								<Switch
									id="require-email"
									checked={formValues.requireEmail}
									onCheckedChange={v => setValue('requireEmail', v, { shouldDirty: true })}
								/>
							</div>
						</CardContent>
					</Card>

					{/* Cancellation */}
					<Card className="border-input" data-tour="reservation-settings-cancellation">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Shield className="h-5 w-5" />
								{t('settings.sections.cancellation')}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center justify-between rounded-lg border border-input p-4">
								<Label htmlFor="allow-customer-cancel">{t('settings.cancellation.allowCustomerCancel')}</Label>
								<Switch
									id="allow-customer-cancel"
									checked={formValues.allowCustomerCancel}
									onCheckedChange={v => setValue('allowCustomerCancel', v, { shouldDirty: true })}
								/>
							</div>
							<div className="flex items-center justify-between rounded-lg border border-input p-4">
								<div>
									<Label htmlFor="allow-customer-reschedule">{t('settings.cancellation.allowReschedule')}</Label>
									<p className="text-xs text-muted-foreground mt-1">{t('settings.cancellation.allowRescheduleHelp')}</p>
								</div>
								<Switch
									id="allow-customer-reschedule"
									checked={formValues.allowCustomerReschedule}
									onCheckedChange={v => setValue('allowCustomerReschedule', v, { shouldDirty: true })}
								/>
							</div>
							<div className="grid grid-cols-2 gap-6">
								<div className="space-y-2">
									<Label htmlFor="min-hours-before-cancel">{t('settings.cancellation.minHoursBefore')}</Label>
									<Input
										id="min-hours-before-cancel"
										type="number"
										className="h-12 text-base"
										{...register('minHoursBeforeCancel')}
									/>
									<p className="text-xs text-muted-foreground">{t('settings.cancellation.minHoursBeforeHelp')}</p>
									<FieldError message={errors.minHoursBeforeCancel?.message} />
								</div>
								<div className="space-y-2">
									<Label htmlFor="no-show-fee">{t('settings.cancellation.noShowFee')}</Label>
									<div className="flex items-center gap-2">
										<Input id="no-show-fee" type="number" className="h-12 flex-1 text-base" {...register('noShowFeePercent')} />
										<span className="text-muted-foreground">%</span>
									</div>
									<p className="text-xs text-muted-foreground">{t('settings.cancellation.noShowFeeHelp')}</p>
									<FieldError message={errors.noShowFeePercent?.message} />
								</div>
							</div>
							<div className="flex items-center justify-between rounded-lg border border-input p-4">
								<Label htmlFor="forfeit-deposit">{t('settings.cancellation.forfeitDeposit')}</Label>
								<Switch
									id="forfeit-deposit"
									checked={formValues.forfeitDeposit}
									onCheckedChange={v => setValue('forfeitDeposit', v, { shouldDirty: true })}
								/>
							</div>
						</CardContent>
					</Card>

					{/* Credit Refund Policy — separate Card for visual + structural consistency */}
					<Card className="border-input" data-tour="reservation-settings-credit-refund">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Wallet className="h-5 w-5" />
								{t('settings.cancellation.creditRefundTitle')}
							</CardTitle>
							<p className="text-xs text-muted-foreground">{t('settings.cancellation.creditRefundHelp')}</p>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="credit-refund-mode">{t('settings.cancellation.creditRefundMode')}</Label>
								<Select
									value={formValues.creditRefundMode}
									onValueChange={v =>
										setValue('creditRefundMode', v as SettingsFormData['creditRefundMode'], { shouldDirty: true })
									}
								>
									<SelectTrigger id="credit-refund-mode" className="h-12 text-base">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="ALWAYS">{t('settings.cancellation.creditRefundAlways')}</SelectItem>
										<SelectItem value="TIME_BASED">{t('settings.cancellation.creditRefundTimeBased')}</SelectItem>
										<SelectItem value="NEVER">{t('settings.cancellation.creditRefundNever')}</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{formValues.creditRefundMode === 'TIME_BASED' && (
								<div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
									<div className="space-y-2">
										<Label htmlFor="credit-free-refund-hours">{t('settings.cancellation.creditFreeRefundHoursBefore')}</Label>
										<Input
											id="credit-free-refund-hours"
											type="number"
											min={0}
											max={720}
											className="h-12 text-base"
											{...register('creditFreeRefundHoursBefore')}
										/>
										<p className="text-xs text-muted-foreground">{t('settings.cancellation.creditFreeRefundHoursHelp')}</p>
										<FieldError message={errors.creditFreeRefundHoursBefore?.message} />
									</div>
									<div className="space-y-2">
										<Label htmlFor="credit-late-refund-percent">{t('settings.cancellation.creditLateRefundPercent')}</Label>
										<div className="flex items-center gap-2">
											<Input
												id="credit-late-refund-percent"
												type="number"
												min={0}
												max={100}
												className="h-12 flex-1 text-base"
												{...register('creditLateRefundPercent')}
											/>
											<span className="text-muted-foreground">%</span>
										</div>
										<p className="text-xs text-muted-foreground">{t('settings.cancellation.creditLateRefundHelp')}</p>
										<FieldError message={errors.creditLateRefundPercent?.message} />
									</div>
								</div>
							)}

							<div className="flex items-center justify-between rounded-lg border border-input p-4">
								<div>
									<Label htmlFor="credit-no-show-refund">{t('settings.cancellation.creditNoShowRefund')}</Label>
									<p className="text-xs text-muted-foreground mt-1">{t('settings.cancellation.creditNoShowRefundHelp')}</p>
								</div>
								<Switch
									id="credit-no-show-refund"
									checked={formValues.creditNoShowRefund}
									onCheckedChange={v => setValue('creditNoShowRefund', v, { shouldDirty: true })}
								/>
							</div>
						</CardContent>
					</Card>

					{/* Waitlist */}
					<Card className="border-input" data-tour="reservation-settings-waitlist">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Users className="h-5 w-5" />
								{t('settings.sections.waitlist')}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center justify-between rounded-lg border border-input p-4">
								<Label htmlFor="waitlist-enabled">{t('settings.waitlist.enabled')}</Label>
								<Switch
									id="waitlist-enabled"
									checked={formValues.waitlistEnabled}
									onCheckedChange={v => setValue('waitlistEnabled', v, { shouldDirty: true })}
								/>
							</div>
							{formValues.waitlistEnabled && (
								<div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
									<div className="space-y-2">
										<Label htmlFor="waitlist-max-size">{t('settings.waitlist.maxSize')}</Label>
										<Input
											id="waitlist-max-size"
											type="number"
											className="h-12 text-base"
											{...register('waitlistMaxSize')}
										/>
										<FieldError message={errors.waitlistMaxSize?.message} />
									</div>
									<div className="space-y-2">
										<Label htmlFor="waitlist-priority-mode">{t('settings.waitlist.priorityMode')}</Label>
										<Select
											value={formValues.waitlistPriorityMode}
											onValueChange={v =>
												setValue('waitlistPriorityMode', v as SettingsFormData['waitlistPriorityMode'], { shouldDirty: true })
											}
										>
											<SelectTrigger id="waitlist-priority-mode" className="h-12 text-base">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="fifo">{t('waitlist.priorityMode.fifo')}</SelectItem>
												<SelectItem value="party_size">{t('waitlist.priorityMode.party_size')}</SelectItem>
												<SelectItem value="broadcast">{t('waitlist.priorityMode.broadcast')}</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label htmlFor="waitlist-notify-window">{t('settings.waitlist.notifyWindow')}</Label>
										<div className="flex items-center gap-2">
											<Input
												id="waitlist-notify-window"
												type="number"
												className="h-12 flex-1 text-base"
												{...register('waitlistNotifyWindow')}
											/>
											<span className="text-muted-foreground">{t('minutes')}</span>
										</div>
										<p className="text-xs text-muted-foreground">{t('settings.waitlist.notifyWindowHelp')}</p>
										<FieldError message={errors.waitlistNotifyWindow?.message} />
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Reminders */}
					<Card className="border-input" data-tour="reservation-settings-reminders">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Bell className="h-5 w-5" />
								{t('settings.sections.reminders')}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center justify-between rounded-lg border border-input p-4">
								<Label htmlFor="reminders-enabled">{t('settings.reminders.enabled')}</Label>
								<Switch
									id="reminders-enabled"
									checked={formValues.remindersEnabled}
									onCheckedChange={v => setValue('remindersEnabled', v, { shouldDirty: true })}
								/>
							</div>
						</CardContent>
					</Card>
				</fieldset>

				{/* Sticky bottom action bar — keeps Save reachable on long forms */}
				<div className="sticky bottom-0 z-10 -mx-4 mt-6 flex items-center justify-end gap-3 border-t border-input bg-background/95 px-4 py-3 backdrop-blur-sm">
					<Button type="submit" disabled={!canSave} data-tour="reservation-settings-save-bottom">
						{isPending ? tCommon('loading') : t('actions.saveChanges')}
					</Button>
				</div>
			</form>
		</div>
	)
}
