import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CalendarDays, Clock, CreditCard, Globe, Shield, Users, Bell } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import reservationService from '@/services/reservation.service'
import type { OperatingHours } from '@/types/reservation'
import { OperatingHoursEditor } from './components/OperatingHoursEditor'

const settingsSchema = z.object({
	// Scheduling
	slotIntervalMin: z.coerce.number().min(5).max(120),
	defaultDurationMin: z.coerce.number().min(15).max(480),
	autoConfirm: z.boolean(),
	maxAdvanceDays: z.coerce.number().min(1).max(365),
	minNoticeMin: z.coerce.number().min(0).max(10080),
	noShowGraceMin: z.coerce.number().min(0).max(120),
	// Pacing
	pacingMaxPerSlot: z.coerce.number().min(0).nullable(),
	onlineCapacityPercent: z.coerce.number().min(0).max(100),
	// Deposits
	depositMode: z.enum(['none', 'card_hold', 'deposit', 'prepaid']),
	depositFixedAmount: z.coerce.number().min(0).nullable(),
	depositPercentage: z.coerce.number().min(0).max(100).nullable(),
	depositPartySizeGte: z.coerce.number().min(1).nullable(),
	// Public booking
	publicBookingEnabled: z.boolean(),
	requirePhone: z.boolean(),
	requireEmail: z.boolean(),
	// Cancellation
	allowCustomerCancel: z.boolean(),
	minHoursBeforeCancel: z.coerce.number().min(0).nullable(),
	forfeitDeposit: z.boolean(),
	noShowFeePercent: z.coerce.number().min(0).max(100).nullable(),
	// Waitlist
	waitlistEnabled: z.boolean(),
	waitlistMaxSize: z.coerce.number().min(1).max(500),
	waitlistPriorityMode: z.enum(['fifo', 'party_size', 'broadcast']),
	waitlistNotifyWindow: z.coerce.number().min(5).max(120),
	// Reminders
	remindersEnabled: z.boolean(),
})

type SettingsFormData = z.infer<typeof settingsSchema>

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
			waitlistEnabled: true,
			waitlistMaxSize: 50,
			waitlistPriorityMode: 'fifo',
			waitlistNotifyWindow: 30,
			remindersEnabled: true,
		},
	})

	// Operating hours managed separately (complex JSON, not a flat form field)
	const [operatingHours, setOperatingHours] = useState<OperatingHours | null>(null)
	const [operatingHoursDirty, setOperatingHoursDirty] = useState(false)
	const initialOperatingHoursRef = useRef<string>('')

	const handleOperatingHoursChange = useCallback((hours: OperatingHours) => {
		setOperatingHours(hours)
		setOperatingHoursDirty(JSON.stringify(hours) !== initialOperatingHoursRef.current)
	}, [])

	useEffect(() => {
		if (settings) {
			setOperatingHours(settings.operatingHours)
			initialOperatingHoursRef.current = JSON.stringify(settings.operatingHours)
			setOperatingHoursDirty(false)
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
				},
				waitlist: {
					enabled: data.waitlistEnabled,
					maxSize: data.waitlistMaxSize,
					priorityMode: data.waitlistPriorityMode,
					notifyWindowMin: data.waitlistNotifyWindow,
				},
				reminders: {
					enabled: data.remindersEnabled,
					channels: settings?.reminders.channels || ['EMAIL'],
					minutesBefore: settings?.reminders.minutesBefore || [1440, 120],
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

	const depositMode = watch('depositMode')
	const waitlistEnabled = watch('waitlistEnabled')

	if (isLoading) {
		return (
			<div className="p-4 bg-background text-foreground">
				<div className="animate-pulse space-y-4">
					<div className="h-8 w-64 bg-muted rounded" />
					<div className="h-48 bg-muted rounded-xl" />
					<div className="h-48 bg-muted rounded-xl" />
				</div>
			</div>
		)
	}

	return (
		<div className="p-4 bg-background text-foreground max-w-4xl">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<PageTitleWithInfo title={t('settings.title')} className="text-2xl font-bold" />
					<p className="text-muted-foreground">{t('settings.subtitle')}</p>
				</div>
				<Button
					onClick={handleSubmit(data => updateMutation.mutate(data))}
					disabled={(!isDirty && !operatingHoursDirty) || updateMutation.isPending}
				>
					{updateMutation.isPending ? tCommon('loading') : t('actions.saveChanges')}
				</Button>
			</div>

			<form className="space-y-6">
				{/* Operating Hours */}
				{operatingHours && (
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Clock className="h-5 w-5" />
								{t('settings.sections.operatingHours')}
							</CardTitle>
							<CardDescription>{t('settings.operatingHours.subtitle')}</CardDescription>
						</CardHeader>
						<CardContent>
							<OperatingHoursEditor value={operatingHours} onChange={handleOperatingHoursChange} />
						</CardContent>
					</Card>
				)}

				{/* Scheduling */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CalendarDays className="h-5 w-5" />
							{t('settings.sections.scheduling')}
						</CardTitle>
					</CardHeader>
					<CardContent className="grid grid-cols-2 gap-6">
						<div className="space-y-2">
							<Label>{t('settings.scheduling.slotInterval')}</Label>
							<Input type="number" {...register('slotIntervalMin')} />
							<p className="text-xs text-muted-foreground">{t('settings.scheduling.slotIntervalHelp')}</p>
						</div>
						<div className="space-y-2">
							<Label>{t('settings.scheduling.defaultDuration')}</Label>
							<Input type="number" {...register('defaultDurationMin')} />
							<p className="text-xs text-muted-foreground">{t('settings.scheduling.defaultDurationHelp')}</p>
						</div>
						<div className="space-y-2">
							<Label>{t('settings.scheduling.maxAdvanceDays')}</Label>
							<Input type="number" {...register('maxAdvanceDays')} />
							<p className="text-xs text-muted-foreground">{t('settings.scheduling.maxAdvanceDaysHelp')}</p>
						</div>
						<div className="space-y-2">
							<Label>{t('settings.scheduling.minNotice')}</Label>
							<Input type="number" {...register('minNoticeMin')} />
							<p className="text-xs text-muted-foreground">{t('settings.scheduling.minNoticeHelp')}</p>
						</div>
						<div className="space-y-2">
							<Label>{t('settings.scheduling.noShowGrace')}</Label>
							<Input type="number" {...register('noShowGraceMin')} />
							<p className="text-xs text-muted-foreground">{t('settings.scheduling.noShowGraceHelp')}</p>
						</div>
						<div className="flex items-center justify-between rounded-lg border p-4">
							<div>
								<Label>{t('settings.scheduling.autoConfirm')}</Label>
								<p className="text-xs text-muted-foreground">{t('settings.scheduling.autoConfirmHelp')}</p>
							</div>
							<Switch
								checked={watch('autoConfirm')}
								onCheckedChange={v => setValue('autoConfirm', v, { shouldDirty: true })}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Pacing */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Clock className="h-5 w-5" />
							{t('settings.sections.pacing')}
						</CardTitle>
					</CardHeader>
					<CardContent className="grid grid-cols-2 gap-6">
						<div className="space-y-2">
							<Label>{t('settings.pacing.maxPerSlot')}</Label>
							<Input type="number" {...register('pacingMaxPerSlot')} placeholder="—" />
							<p className="text-xs text-muted-foreground">{t('settings.pacing.maxPerSlotHelp')}</p>
						</div>
						<div className="space-y-2">
							<Label>{t('settings.pacing.onlineCapacity')}</Label>
							<div className="flex items-center gap-2">
								<Input type="number" {...register('onlineCapacityPercent')} className="flex-1" />
								<span className="text-muted-foreground">%</span>
							</div>
							<p className="text-xs text-muted-foreground">{t('settings.pacing.onlineCapacityHelp')}</p>
						</div>
					</CardContent>
				</Card>

				{/* Deposits */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CreditCard className="h-5 w-5" />
							{t('settings.sections.deposits')}
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="space-y-2">
							<Label>{t('settings.deposits.mode')}</Label>
							<Select
								value={depositMode}
								onValueChange={v => setValue('depositMode', v as any, { shouldDirty: true })}
							>
								<SelectTrigger>
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
						{depositMode !== 'none' && (
							<div className="grid grid-cols-2 gap-6">
								<div className="space-y-2">
									<Label>{t('settings.deposits.fixedAmount')}</Label>
									<Input type="number" step="0.01" {...register('depositFixedAmount')} />
								</div>
								<div className="space-y-2">
									<Label>{t('settings.deposits.percentage')}</Label>
									<div className="flex items-center gap-2">
										<Input type="number" {...register('depositPercentage')} className="flex-1" />
										<span className="text-muted-foreground">%</span>
									</div>
								</div>
								<div className="space-y-2">
									<Label>{t('settings.deposits.partySizeGte')}</Label>
									<div className="flex items-center gap-2">
										<Input type="number" {...register('depositPartySizeGte')} className="flex-1" />
										<span className="text-sm text-muted-foreground">{t('settings.deposits.partySizeGteHelp')}</span>
									</div>
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Public Booking */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Globe className="h-5 w-5" />
							{t('settings.sections.publicBooking')}
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex items-center justify-between rounded-lg border p-4">
							<div>
								<Label>{t('settings.publicBooking.enabled')}</Label>
								<p className="text-xs text-muted-foreground">{t('settings.publicBooking.enabledHelp')}</p>
							</div>
							<Switch
								checked={watch('publicBookingEnabled')}
								onCheckedChange={v => setValue('publicBookingEnabled', v, { shouldDirty: true })}
							/>
						</div>
						<div className="flex items-center justify-between rounded-lg border p-4">
							<Label>{t('settings.publicBooking.requirePhone')}</Label>
							<Switch
								checked={watch('requirePhone')}
								onCheckedChange={v => setValue('requirePhone', v, { shouldDirty: true })}
							/>
						</div>
						<div className="flex items-center justify-between rounded-lg border p-4">
							<Label>{t('settings.publicBooking.requireEmail')}</Label>
							<Switch
								checked={watch('requireEmail')}
								onCheckedChange={v => setValue('requireEmail', v, { shouldDirty: true })}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Cancellation */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Shield className="h-5 w-5" />
							{t('settings.sections.cancellation')}
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex items-center justify-between rounded-lg border p-4">
							<Label>{t('settings.cancellation.allowCustomerCancel')}</Label>
							<Switch
								checked={watch('allowCustomerCancel')}
								onCheckedChange={v => setValue('allowCustomerCancel', v, { shouldDirty: true })}
							/>
						</div>
						<div className="grid grid-cols-2 gap-6">
							<div className="space-y-2">
								<Label>{t('settings.cancellation.minHoursBefore')}</Label>
								<Input type="number" {...register('minHoursBeforeCancel')} />
								<p className="text-xs text-muted-foreground">{t('settings.cancellation.minHoursBeforeHelp')}</p>
							</div>
							<div className="space-y-2">
								<Label>{t('settings.cancellation.noShowFee')}</Label>
								<div className="flex items-center gap-2">
									<Input type="number" {...register('noShowFeePercent')} className="flex-1" />
									<span className="text-muted-foreground">%</span>
								</div>
								<p className="text-xs text-muted-foreground">{t('settings.cancellation.noShowFeeHelp')}</p>
							</div>
						</div>
						<div className="flex items-center justify-between rounded-lg border p-4">
							<Label>{t('settings.cancellation.forfeitDeposit')}</Label>
							<Switch
								checked={watch('forfeitDeposit')}
								onCheckedChange={v => setValue('forfeitDeposit', v, { shouldDirty: true })}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Waitlist */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5" />
							{t('settings.sections.waitlist')}
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex items-center justify-between rounded-lg border p-4">
							<Label>{t('settings.waitlist.enabled')}</Label>
							<Switch
								checked={waitlistEnabled}
								onCheckedChange={v => setValue('waitlistEnabled', v, { shouldDirty: true })}
							/>
						</div>
						{waitlistEnabled && (
							<div className="grid grid-cols-2 gap-6">
								<div className="space-y-2">
									<Label>{t('settings.waitlist.maxSize')}</Label>
									<Input type="number" {...register('waitlistMaxSize')} />
								</div>
								<div className="space-y-2">
									<Label>{t('settings.waitlist.priorityMode')}</Label>
									<Select
										value={watch('waitlistPriorityMode')}
										onValueChange={v => setValue('waitlistPriorityMode', v as any, { shouldDirty: true })}
									>
										<SelectTrigger>
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
									<Label>{t('settings.waitlist.notifyWindow')}</Label>
									<div className="flex items-center gap-2">
										<Input type="number" {...register('waitlistNotifyWindow')} className="flex-1" />
										<span className="text-muted-foreground">{t('minutes')}</span>
									</div>
									<p className="text-xs text-muted-foreground">{t('settings.waitlist.notifyWindowHelp')}</p>
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Reminders */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Bell className="h-5 w-5" />
							{t('settings.sections.reminders')}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between rounded-lg border p-4">
							<Label>{t('settings.reminders.enabled')}</Label>
							<Switch
								checked={watch('remindersEnabled')}
								onCheckedChange={v => setValue('remindersEnabled', v, { shouldDirty: true })}
							/>
						</div>
					</CardContent>
				</Card>
			</form>
		</div>
	)
}
