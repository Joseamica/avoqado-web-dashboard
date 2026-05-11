import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { HelpCircle, Info } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useReservationSettingsTour } from '@/hooks/useReservationSettingsTour'
import { cn } from '@/lib/utils'
import reservationService from '@/services/reservation.service'
import type { OperatingHours } from '@/types/reservation'

// ----------------------------------------------------------------------------
// Dropdown option lists — discrete values for what used to be free-form number
// inputs. Labels are pre-rendered for legibility; the form still stores the
// raw numeric value (or `null` for "sin límite"/"no requerir") so the API
// payload shape doesn't change.

type NullableOption = { value: number | null; label: string }
type NumberOption = { value: number; label: string }

const SLOT_INTERVAL_OPTIONS: NumberOption[] = [
	{ value: 5, label: '5 minutos' },
	{ value: 10, label: '10 minutos' },
	{ value: 15, label: '15 minutos' },
	{ value: 20, label: '20 minutos' },
	{ value: 30, label: '30 minutos' },
	{ value: 45, label: '45 minutos' },
	{ value: 60, label: '1 hora' },
	{ value: 90, label: '1 hora 30 minutos' },
	{ value: 120, label: '2 horas' },
]

const DURATION_OPTIONS: NumberOption[] = [
	{ value: 15, label: '15 minutos' },
	{ value: 30, label: '30 minutos' },
	{ value: 45, label: '45 minutos' },
	{ value: 60, label: '1 hora' },
	{ value: 90, label: '1 hora 30 minutos' },
	{ value: 120, label: '2 horas' },
	{ value: 180, label: '3 horas' },
	{ value: 240, label: '4 horas' },
	{ value: 360, label: '6 horas' },
	{ value: 480, label: '8 horas' },
]

const MAX_ADVANCE_DAYS_OPTIONS: NumberOption[] = [
	{ value: 1, label: '1 día' },
	{ value: 3, label: '3 días' },
	{ value: 7, label: '1 semana' },
	{ value: 14, label: '2 semanas' },
	{ value: 30, label: '30 días' },
	{ value: 60, label: '60 días' },
	{ value: 90, label: '3 meses' },
	{ value: 180, label: '6 meses' },
	{ value: 365, label: '1 año' },
]

const MIN_NOTICE_OPTIONS: NumberOption[] = [
	{ value: 0, label: 'Sin mínimo' },
	{ value: 15, label: '15 minutos' },
	{ value: 30, label: '30 minutos' },
	{ value: 60, label: '1 hora' },
	{ value: 120, label: '2 horas' },
	{ value: 240, label: '4 horas' },
	{ value: 720, label: '12 horas' },
	{ value: 1440, label: '1 día' },
	{ value: 2880, label: '2 días' },
	{ value: 10080, label: '1 semana' },
]

const NO_SHOW_GRACE_OPTIONS: NumberOption[] = [
	{ value: 0, label: 'Sin gracia' },
	{ value: 5, label: '5 minutos' },
	{ value: 10, label: '10 minutos' },
	{ value: 15, label: '15 minutos' },
	{ value: 30, label: '30 minutos' },
	{ value: 45, label: '45 minutos' },
	{ value: 60, label: '1 hora' },
	{ value: 120, label: '2 horas' },
]

const PACING_MAX_OPTIONS: NullableOption[] = [
	// Server-side: null collapses to 1 for APPOINTMENTS_SERVICE (tableless
	// 1:1 services). Restaurants and venues with explicit values are
	// unaffected. Label flags the implicit floor so admins managing a
	// multi-resource service venue know to set the exact count.
	{ value: null, label: 'Sin límite (1 para citas)' },
	{ value: 1, label: '1 reserva' },
	{ value: 2, label: '2 reservas' },
	{ value: 3, label: '3 reservas' },
	{ value: 5, label: '5 reservas' },
	{ value: 10, label: '10 reservas' },
	{ value: 20, label: '20 reservas' },
	{ value: 50, label: '50 reservas' },
]

const ONLINE_CAPACITY_OPTIONS: NumberOption[] = [
	{ value: 0, label: '0%' },
	{ value: 25, label: '25%' },
	{ value: 50, label: '50%' },
	{ value: 75, label: '75%' },
	{ value: 100, label: '100%' },
]

const DEPOSIT_FIXED_OPTIONS: NullableOption[] = [
	{ value: null, label: 'Sin monto fijo' },
	{ value: 5, label: '5' },
	{ value: 10, label: '10' },
	{ value: 20, label: '20' },
	{ value: 50, label: '50' },
	{ value: 100, label: '100' },
	{ value: 200, label: '200' },
	{ value: 500, label: '500' },
]

const DEPOSIT_PERCENT_OPTIONS: NullableOption[] = [
	{ value: null, label: 'Sin porcentaje' },
	{ value: 10, label: '10%' },
	{ value: 15, label: '15%' },
	{ value: 20, label: '20%' },
	{ value: 25, label: '25%' },
	{ value: 30, label: '30%' },
	{ value: 50, label: '50%' },
	{ value: 75, label: '75%' },
	{ value: 100, label: '100%' },
]

const PARTY_SIZE_OPTIONS: NullableOption[] = [
	{ value: null, label: 'No requerir' },
	{ value: 2, label: '2 personas o más' },
	{ value: 3, label: '3 personas o más' },
	{ value: 4, label: '4 personas o más' },
	{ value: 5, label: '5 personas o más' },
	{ value: 6, label: '6 personas o más' },
	{ value: 8, label: '8 personas o más' },
	{ value: 10, label: '10 personas o más' },
	{ value: 15, label: '15 personas o más' },
]

const MIN_HOURS_BEFORE_CANCEL_OPTIONS: NullableOption[] = [
	{ value: null, label: 'Sin mínimo' },
	{ value: 1, label: '1 hora antes' },
	{ value: 2, label: '2 horas antes' },
	{ value: 4, label: '4 horas antes' },
	{ value: 8, label: '8 horas antes' },
	{ value: 12, label: '12 horas antes' },
	{ value: 24, label: '24 horas antes' },
	{ value: 48, label: '2 días antes' },
	{ value: 72, label: '3 días antes' },
]

const NO_SHOW_FEE_OPTIONS: NullableOption[] = [
	{ value: null, label: 'No cobrar' },
	{ value: 25, label: '25%' },
	{ value: 50, label: '50%' },
	{ value: 75, label: '75%' },
	{ value: 100, label: '100%' },
]

const CREDIT_REFUND_HOURS_OPTIONS: NumberOption[] = [
	{ value: 0, label: 'Hasta el inicio de la reserva' },
	{ value: 1, label: '1 hora antes' },
	{ value: 2, label: '2 horas antes' },
	{ value: 4, label: '4 horas antes' },
	{ value: 12, label: '12 horas antes' },
	{ value: 24, label: '24 horas antes' },
	{ value: 48, label: '2 días antes' },
	{ value: 72, label: '3 días antes' },
	{ value: 168, label: '7 días antes' },
	{ value: 720, label: '30 días antes' },
]

const CREDIT_LATE_PERCENT_OPTIONS: NumberOption[] = [
	{ value: 0, label: '0% (sin reembolso)' },
	{ value: 25, label: '25%' },
	{ value: 50, label: '50%' },
	{ value: 75, label: '75%' },
	{ value: 100, label: '100%' },
]

const WAITLIST_MAX_SIZE_OPTIONS: NumberOption[] = [
	{ value: 10, label: '10 personas' },
	{ value: 25, label: '25 personas' },
	{ value: 50, label: '50 personas' },
	{ value: 100, label: '100 personas' },
	{ value: 200, label: '200 personas' },
	{ value: 500, label: '500 personas' },
]

const WAITLIST_PRIORITY_OPTIONS: { value: 'fifo' | 'party_size' | 'broadcast'; label: string }[] = [
	{ value: 'fifo', label: 'Primero en llegar' },
	{ value: 'party_size', label: 'Por tamaño del grupo' },
	{ value: 'broadcast', label: 'Notificación masiva' },
]

const WAITLIST_NOTIFY_OPTIONS: NumberOption[] = [
	{ value: 5, label: '5 minutos' },
	{ value: 10, label: '10 minutos' },
	{ value: 15, label: '15 minutos' },
	{ value: 30, label: '30 minutos' },
	{ value: 45, label: '45 minutos' },
	{ value: 60, label: '1 hora' },
	{ value: 90, label: '1 hora 30 minutos' },
	{ value: 120, label: '2 horas' },
]

const DEPOSIT_MODE_OPTIONS = ['none', 'card_hold', 'deposit', 'prepaid'] as const

const REMINDER_CHANNEL_OPTIONS: { value: 'EMAIL' | 'SMS' | 'WHATSAPP'; label: string }[] = [
	{ value: 'EMAIL', label: 'Email' },
	{ value: 'SMS', label: 'SMS' },
	{ value: 'WHATSAPP', label: 'WhatsApp' },
]

const REMINDER_OFFSET_OPTIONS: NumberOption[] = [
	{ value: 30, label: '30 min antes' },
	{ value: 60, label: '1h antes' },
	{ value: 120, label: '2h antes' },
	{ value: 360, label: '6h antes' },
	{ value: 720, label: '12h antes' },
	{ value: 1440, label: '24h antes' },
	{ value: 2880, label: '48h antes' },
	{ value: 10080, label: '1 semana antes' },
]

// ----------------------------------------------------------------------------
// Layout primitives — Square-style row pattern. SettingRow holds an arbitrary
// control aligned to the right of a labeled column; SettingToggleRow is the
// boolean-only variant where the Switch IS the control. Both expose a
// `tooltip` slot rendered as a tiny Info-icon trigger next to the label,
// matching the Square admin pattern where long-form context lives behind a
// hover affordance instead of cluttering the row with always-visible help.

type RowScope = 'appointments' | 'classes' | 'both'

// Tiny inline marker next to a row label that tells the admin whether the
// option applies to citas, clases, or both. `both` renders nothing — most
// rows are shared and adding a "Ambos" badge everywhere would just be noise.
function ScopeBadge({ scope }: { scope: RowScope }) {
	const { t } = useTranslation('reservations')
	if (scope === 'both') return null
	const label =
		scope === 'appointments'
			? t('settings.scope.appointments')
			: t('settings.scope.classes')
	const tone =
		scope === 'appointments'
			? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
			: 'bg-violet-500/10 text-violet-600 dark:text-violet-300'
	return (
		<span
			className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}
		>
			{label}
		</span>
	)
}

function InfoTooltip({ content }: { content: ReactNode }) {
	return (
		<TooltipProvider delayDuration={150}>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
						aria-label="Más información"
					>
						<Info className="h-3.5 w-3.5" />
					</button>
				</TooltipTrigger>
				<TooltipContent side="top" align="start" className="max-w-xs text-xs leading-relaxed">
					{content}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)
}

function SettingRow({
	label,
	tooltip,
	scope = 'both',
	children,
}: {
	label: ReactNode
	tooltip?: ReactNode
	scope?: RowScope
	children: ReactNode
}) {
	return (
		<div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
			<div className="flex min-w-0 items-center gap-1.5 sm:flex-1">
				<p className="text-sm font-medium text-foreground">{label}</p>
				<ScopeBadge scope={scope} />
				{tooltip ? <InfoTooltip content={tooltip} /> : null}
			</div>
			<div className="w-full sm:w-72">{children}</div>
		</div>
	)
}

function SettingToggleRow({
	label,
	tooltip,
	scope = 'both',
	checked,
	onCheckedChange,
	tourId,
}: {
	label: ReactNode
	tooltip?: ReactNode
	scope?: RowScope
	checked: boolean
	onCheckedChange: (v: boolean) => void
	tourId?: string
}) {
	return (
		<div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
			<div className="flex min-w-0 flex-1 items-center gap-1.5">
				<p className="text-sm font-medium text-foreground">{label}</p>
				<ScopeBadge scope={scope} />
				{tooltip ? <InfoTooltip content={tooltip} /> : null}
			</div>
			<Switch checked={checked} onCheckedChange={onCheckedChange} data-tour={tourId} />
		</div>
	)
}

// Compact horizontal toggle group for multi-select arrays. Used by the
// Recordatorios section to pick channels (Email/SMS/WhatsApp) and one or
// more "when to send" offsets without opening a popover.
function MultiPillSelect<T extends string | number>({
	options,
	value,
	onChange,
	ariaLabel,
}: {
	options: { value: T; label: string }[]
	value: T[]
	onChange: (next: T[]) => void
	ariaLabel: string
}) {
	return (
		<div role="group" aria-label={ariaLabel} className="flex flex-wrap justify-end gap-1.5">
			{options.map(o => {
				const selected = value.includes(o.value)
				return (
					<button
						key={String(o.value)}
						type="button"
						onClick={() => {
							onChange(selected ? value.filter(v => v !== o.value) : [...value, o.value])
						}}
						aria-pressed={selected}
						className={cn(
							'rounded-full border px-2.5 py-1 text-xs font-medium transition',
							selected
								? 'border-transparent bg-foreground text-background'
								: 'border-input bg-card text-muted-foreground hover:bg-muted/60',
						)}
					>
						{o.label}
					</button>
				)
			})}
		</div>
	)
}

// Stringify <-> parse helpers for Select (Radix forbids empty-string values,
// so `null` rides as the sentinel "__none__" through the dropdown and gets
// decoded back to null when applied to the form).
const NULL_SENTINEL = '__none__'
const encodeValue = (v: number | string | null | undefined): string =>
	v === null || v === undefined ? NULL_SENTINEL : String(v)
const decodeNullableNumber = (raw: string): number | null =>
	raw === NULL_SENTINEL ? null : Number(raw)

// SelectField renders the same trigger across every numeric/nullable dropdown.
// Keeps the markup terse and ensures every row has the same h-10 height.
function SelectField<T extends { value: number | null; label: string } | { value: number; label: string }>({
	options,
	value,
	onChange,
	ariaLabel,
}: {
	options: T[]
	value: string
	onChange: (raw: string) => void
	ariaLabel: string
}) {
	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger aria-label={ariaLabel} className="h-10">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((o) => (
					<SelectItem key={encodeValue(o.value)} value={encodeValue(o.value)}>
						{o.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}

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
	// Payments — type-aware upfront defaults (separate per type)
	appointmentUpfrontDefault: z.enum(['required', 'at_venue', 'optional']),
	classUpfrontDefault: z.enum(['required', 'at_venue', 'optional']),
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
	reminderChannels: z.array(z.enum(['EMAIL', 'SMS', 'WHATSAPP'])),
	reminderMinBefore: z.array(z.number().int().min(0)),
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
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { isDirty },
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
			appointmentUpfrontDefault: 'at_venue',
			classUpfrontDefault: 'required',
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
			reminderChannels: ['EMAIL'],
			reminderMinBefore: [1440, 120],
		},
	})

	// Single watch() call — one subscription instead of many inline calls
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
				appointmentUpfrontDefault: settings.payments?.appointmentUpfrontDefault ?? 'at_venue',
				classUpfrontDefault: settings.payments?.classUpfrontDefault ?? 'required',
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
				reminderChannels: (settings.reminders.channels?.length
					? settings.reminders.channels
					: ['EMAIL']) as ('EMAIL' | 'SMS' | 'WHATSAPP')[],
				reminderMinBefore: settings.reminders.minutesBefore?.length
					? settings.reminders.minutesBefore
					: [1440, 120],
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
				payments: {
					appointmentUpfrontDefault: data.appointmentUpfrontDefault,
					classUpfrontDefault: data.classUpfrontDefault,
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
					channels: data.reminderChannels.length ? data.reminderChannels : ['EMAIL'],
					minutesBefore: data.reminderMinBefore.length
						? [...data.reminderMinBefore].sort((a, b) => b - a)
						: [1440, 120],
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
	const { start: startTour } = useReservationSettingsTour()

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

	// Cast helpers — RHF's PathValue<K> generic can't unify with `number` here,
	// so we widen via `as any` at the call boundary. Schema validation still
	// enforces the actual numeric ranges at submit time.
	const setNumber = (key: keyof SettingsFormData, raw: string) =>
		setValue(key, Number(raw) as any, { shouldDirty: true })
	const setNullableNumber = (key: keyof SettingsFormData, raw: string) =>
		setValue(key, decodeNullableNumber(raw) as any, { shouldDirty: true })

	return (
		<div className="max-w-4xl">
			{/* Sticky header — keeps the save CTA reachable while the user
			    scrolls the long settings form. Background opaque so rows
			    underneath don't bleed through during scroll. */}
			<div className="sticky top-0 z-10 border-b border-input bg-background px-4 py-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<PageTitleWithInfo title={t('settings.title')} className="text-2xl font-bold" />
						<p className="text-muted-foreground">{t('settings.subtitle')}</p>
					</div>
					<div className="flex items-center gap-2 self-start sm:self-auto">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={startTour}
							className="gap-1.5"
							aria-label={t('settings.settingsTour.start')}
						>
							<HelpCircle className="h-4 w-4" />
							<span className="hidden sm:inline">{t('settings.settingsTour.start')}</span>
						</Button>
						<Button
							onClick={handleSave}
							disabled={!canSave}
							data-tour="reservation-settings-save"
						>
							{isPending ? tCommon('loading') : t('actions.saveChanges')}
						</Button>
					</div>
				</div>
			</div>

			<form onSubmit={handleSave} className="p-4">
				<fieldset disabled={isPending} className="space-y-8">
					{/* ------------------------------------------------------------ Programación */}
					<section className="space-y-3" data-tour="reservation-settings-scheduling">
						<h2 className="text-base font-semibold">{t('settings.sections.scheduling')}</h2>
						<Card className="border-input">
							<div className="divide-y divide-input">
								<SettingRow
									label={t('settings.scheduling.slotInterval')}
									tooltip={t('settings.scheduling.slotIntervalHelp')}
									scope="appointments"
								>
									<SelectField
										options={SLOT_INTERVAL_OPTIONS}
										value={encodeValue(formValues.slotIntervalMin)}
										onChange={raw => setNumber('slotIntervalMin', raw)}
										ariaLabel={t('settings.scheduling.slotInterval')}
									/>
								</SettingRow>
								<SettingRow
									label={t('settings.scheduling.defaultDuration')}
									tooltip={t('settings.scheduling.defaultDurationHelp')}
									scope="appointments"
								>
									<SelectField
										options={DURATION_OPTIONS}
										value={encodeValue(formValues.defaultDurationMin)}
										onChange={raw => setNumber('defaultDurationMin', raw)}
										ariaLabel={t('settings.scheduling.defaultDuration')}
									/>
								</SettingRow>
								<SettingRow
									label={t('settings.scheduling.maxAdvanceDays')}
									tooltip={t('settings.scheduling.maxAdvanceDaysHelp')}
								>
									<SelectField
										options={MAX_ADVANCE_DAYS_OPTIONS}
										value={encodeValue(formValues.maxAdvanceDays)}
										onChange={raw => setNumber('maxAdvanceDays', raw)}
										ariaLabel={t('settings.scheduling.maxAdvanceDays')}
									/>
								</SettingRow>
								<SettingRow
									label={t('settings.scheduling.minNotice')}
									tooltip={t('settings.scheduling.minNoticeHelp')}
								>
									<SelectField
										options={MIN_NOTICE_OPTIONS}
										value={encodeValue(formValues.minNoticeMin)}
										onChange={raw => setNumber('minNoticeMin', raw)}
										ariaLabel={t('settings.scheduling.minNotice')}
									/>
								</SettingRow>
								<SettingRow
									label={t('settings.scheduling.noShowGrace')}
									tooltip={t('settings.scheduling.noShowGraceHelp')}
								>
									<SelectField
										options={NO_SHOW_GRACE_OPTIONS}
										value={encodeValue(formValues.noShowGraceMin)}
										onChange={raw => setNumber('noShowGraceMin', raw)}
										ariaLabel={t('settings.scheduling.noShowGrace')}
									/>
								</SettingRow>
								<SettingToggleRow
									label={t('settings.scheduling.autoConfirm')}
									tooltip={t('settings.scheduling.autoConfirmHelp')}
									checked={formValues.autoConfirm}
									onCheckedChange={v => setValue('autoConfirm', v, { shouldDirty: true })}
									tourId="reservation-auto-confirm"
								/>
							</div>
						</Card>
					</section>

					{/* ------------------------------------------------------------- Ritmo */}
					<section className="space-y-3" data-tour="reservation-settings-pacing">
						<h2 className="text-base font-semibold">{t('settings.sections.pacing')}</h2>
						<Card className="border-input">
							<div className="divide-y divide-input">
								<SettingRow
									label={t('settings.pacing.maxPerSlot')}
									tooltip={t('settings.pacing.maxPerSlotHelp')}
									scope="appointments"
								>
									<SelectField
										options={PACING_MAX_OPTIONS}
										value={encodeValue(formValues.pacingMaxPerSlot)}
										onChange={raw => setNullableNumber('pacingMaxPerSlot', raw)}
										ariaLabel={t('settings.pacing.maxPerSlot')}
									/>
								</SettingRow>
								<SettingRow
									label={t('settings.pacing.onlineCapacity')}
									tooltip={t('settings.pacing.onlineCapacityHelp')}
								>
									<SelectField
										options={ONLINE_CAPACITY_OPTIONS}
										value={encodeValue(formValues.onlineCapacityPercent)}
										onChange={raw => setNumber('onlineCapacityPercent', raw)}
										ariaLabel={t('settings.pacing.onlineCapacity')}
									/>
								</SettingRow>
							</div>
						</Card>
					</section>

					{/* -------------------------------------------------------- Depósitos */}
					<section className="space-y-3" data-tour="reservation-settings-deposits">
						<h2 className="text-base font-semibold">{t('settings.sections.deposits')}</h2>
						<Card className="border-input">
							<div className="divide-y divide-input">
								<SettingRow label={t('settings.deposits.mode')} tooltip={t('settings.deposits.modeTooltip')}>
									<Select
										value={formValues.depositMode}
										onValueChange={v =>
											setValue('depositMode', v as SettingsFormData['depositMode'], { shouldDirty: true })
										}
									>
										<SelectTrigger aria-label={t('settings.deposits.mode')} className="h-10">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{DEPOSIT_MODE_OPTIONS.map(mode => (
												<SelectItem key={mode} value={mode}>
													{t(`settings.deposits.modes.${mode}`)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</SettingRow>
								{formValues.depositMode !== 'none' && (
									<>
										<SettingRow
											label={t('settings.deposits.fixedAmount')}
											tooltip={t('settings.deposits.fixedAmountTooltip')}
										>
											<SelectField
												options={DEPOSIT_FIXED_OPTIONS}
												value={encodeValue(formValues.depositFixedAmount)}
												onChange={raw => setNullableNumber('depositFixedAmount', raw)}
												ariaLabel={t('settings.deposits.fixedAmount')}
											/>
										</SettingRow>
										<SettingRow
											label={t('settings.deposits.percentage')}
											tooltip={t('settings.deposits.percentageTooltip')}
										>
											<SelectField
												options={DEPOSIT_PERCENT_OPTIONS}
												value={encodeValue(formValues.depositPercentage)}
												onChange={raw => setNullableNumber('depositPercentage', raw)}
												ariaLabel={t('settings.deposits.percentage')}
											/>
										</SettingRow>
										<SettingRow
											label={t('settings.deposits.partySizeGte')}
											tooltip={t('settings.deposits.partySizeGteHelp')}
										>
											<SelectField
												options={PARTY_SIZE_OPTIONS}
												value={encodeValue(formValues.depositPartySizeGte)}
												onChange={raw => setNullableNumber('depositPartySizeGte', raw)}
												ariaLabel={t('settings.deposits.partySizeGte')}
											/>
										</SettingRow>
									</>
								)}
							</div>
						</Card>
					</section>

					{/* ------------------------------------------------------ Pagos por tipo */}
					<section className="space-y-3" data-tour="reservation-settings-payments">
						<div>
							<h2 className="text-base font-semibold">{t('settings.payments.sectionTitle')}</h2>
							<p className="text-sm text-muted-foreground">
								{t('settings.payments.sectionSubtitle')}
							</p>
						</div>
						<Card className="border-input">
							<div className="divide-y divide-input">
								<SettingRow
									label={t('settings.payments.appointmentUpfrontDefault')}
									tooltip={t('settings.payments.appointmentUpfrontDefaultTooltip')}
									scope="appointments"
								>
									<Select
										value={formValues.appointmentUpfrontDefault}
										onValueChange={v =>
											setValue('appointmentUpfrontDefault', v as SettingsFormData['appointmentUpfrontDefault'], {
												shouldDirty: true,
											})
										}
									>
										<SelectTrigger
											aria-label={t('settings.payments.appointmentUpfrontDefault')}
											className="h-10"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="required">{t('settings.payments.options.required')}</SelectItem>
											<SelectItem value="at_venue">{t('settings.payments.options.at_venue')}</SelectItem>
											<SelectItem value="optional">{t('settings.payments.options.optional')}</SelectItem>
										</SelectContent>
									</Select>
								</SettingRow>
								<SettingRow
									label={t('settings.payments.classUpfrontDefault')}
									tooltip={t('settings.payments.classUpfrontDefaultTooltip')}
									scope="classes"
								>
									<Select
										value={formValues.classUpfrontDefault}
										onValueChange={v =>
											setValue('classUpfrontDefault', v as SettingsFormData['classUpfrontDefault'], {
												shouldDirty: true,
											})
										}
									>
										<SelectTrigger
											aria-label={t('settings.payments.classUpfrontDefault')}
											className="h-10"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="required">{t('settings.payments.options.required')}</SelectItem>
											<SelectItem value="at_venue">{t('settings.payments.options.at_venue')}</SelectItem>
											<SelectItem value="optional">{t('settings.payments.options.optional')}</SelectItem>
										</SelectContent>
									</Select>
								</SettingRow>
							</div>
						</Card>
					</section>

					{/* ------------------------------------------------- Reservaciones Online */}
					<section className="space-y-3" data-tour="reservation-settings-public-booking">
						<h2 className="text-base font-semibold">{t('settings.sections.publicBooking')}</h2>
						<Card className="border-input">
							<div className="divide-y divide-input">
								<SettingToggleRow
									label={t('settings.publicBooking.enabled')}
									tooltip={t('settings.publicBooking.enabledHelp')}
									checked={formValues.publicBookingEnabled}
									onCheckedChange={v => setValue('publicBookingEnabled', v, { shouldDirty: true })}
									tourId="reservation-public-booking-enabled"
								/>
								<SettingToggleRow
									label={t('settings.publicBooking.requirePhone')}
									tooltip={t('settings.publicBooking.requirePhoneTooltip')}
									checked={formValues.requirePhone}
									onCheckedChange={v => setValue('requirePhone', v, { shouldDirty: true })}
								/>
								<SettingToggleRow
									label={t('settings.publicBooking.requireEmail')}
									tooltip={t('settings.publicBooking.requireEmailTooltip')}
									checked={formValues.requireEmail}
									onCheckedChange={v => setValue('requireEmail', v, { shouldDirty: true })}
								/>
							</div>
						</Card>
					</section>

					{/* -------------------------------------------------------- Cancelación */}
					<section className="space-y-3" data-tour="reservation-settings-cancellation">
						<h2 className="text-base font-semibold">{t('settings.sections.cancellation')}</h2>
						<Card className="border-input">
							<div className="divide-y divide-input">
								<SettingToggleRow
									label={t('settings.cancellation.allowCustomerCancel')}
									tooltip={t('settings.cancellation.allowCustomerCancelTooltip')}
									checked={formValues.allowCustomerCancel}
									onCheckedChange={v => setValue('allowCustomerCancel', v, { shouldDirty: true })}
								/>
								<SettingToggleRow
									label={t('settings.cancellation.allowReschedule')}
									tooltip={t('settings.cancellation.allowRescheduleHelp')}
									checked={formValues.allowCustomerReschedule}
									onCheckedChange={v => setValue('allowCustomerReschedule', v, { shouldDirty: true })}
								/>
								<SettingRow
									label={t('settings.cancellation.minHoursBefore')}
									tooltip={t('settings.cancellation.minHoursBeforeHelp')}
								>
									<SelectField
										options={MIN_HOURS_BEFORE_CANCEL_OPTIONS}
										value={encodeValue(formValues.minHoursBeforeCancel)}
										onChange={raw => setNullableNumber('minHoursBeforeCancel', raw)}
										ariaLabel={t('settings.cancellation.minHoursBefore')}
									/>
								</SettingRow>
								<SettingRow
									label={t('settings.cancellation.noShowFee')}
									tooltip={t('settings.cancellation.noShowFeeHelp')}
								>
									<SelectField
										options={NO_SHOW_FEE_OPTIONS}
										value={encodeValue(formValues.noShowFeePercent)}
										onChange={raw => setNullableNumber('noShowFeePercent', raw)}
										ariaLabel={t('settings.cancellation.noShowFee')}
									/>
								</SettingRow>
								<SettingToggleRow
									label={t('settings.cancellation.forfeitDeposit')}
									tooltip={t('settings.cancellation.forfeitDepositTooltip')}
									checked={formValues.forfeitDeposit}
									onCheckedChange={v => setValue('forfeitDeposit', v, { shouldDirty: true })}
								/>
							</div>
						</Card>
					</section>

					{/* ----------------------------------------- Reembolsos en créditos */}
					<section className="space-y-3" data-tour="reservation-settings-credit-refund">
						<div>
							<h2 className="text-base font-semibold">{t('settings.cancellation.creditRefundTitle')}</h2>
							<p className="text-sm text-muted-foreground">
								{t('settings.cancellation.creditRefundHelp')}
							</p>
						</div>
						<Card className="border-input">
							<div className="divide-y divide-input">
								<SettingRow
									label={t('settings.cancellation.creditRefundMode')}
									tooltip={t('settings.cancellation.creditRefundModeTooltip')}
									scope="classes"
								>
									<Select
										value={formValues.creditRefundMode}
										onValueChange={v =>
											setValue('creditRefundMode', v as SettingsFormData['creditRefundMode'], { shouldDirty: true })
										}
									>
										<SelectTrigger aria-label={t('settings.cancellation.creditRefundMode')} className="h-10">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="ALWAYS">{t('settings.cancellation.creditRefundAlways')}</SelectItem>
											<SelectItem value="TIME_BASED">{t('settings.cancellation.creditRefundTimeBased')}</SelectItem>
											<SelectItem value="NEVER">{t('settings.cancellation.creditRefundNever')}</SelectItem>
										</SelectContent>
									</Select>
								</SettingRow>
								{formValues.creditRefundMode === 'TIME_BASED' && (
									<>
										<SettingRow
											label={t('settings.cancellation.creditFreeRefundHoursBefore')}
											tooltip={t('settings.cancellation.creditFreeRefundHoursHelp')}
											scope="classes"
										>
											<SelectField
												options={CREDIT_REFUND_HOURS_OPTIONS}
												value={encodeValue(formValues.creditFreeRefundHoursBefore)}
												onChange={raw => setNumber('creditFreeRefundHoursBefore', raw)}
												ariaLabel={t('settings.cancellation.creditFreeRefundHoursBefore')}
											/>
										</SettingRow>
										<SettingRow
											label={t('settings.cancellation.creditLateRefundPercent')}
											tooltip={t('settings.cancellation.creditLateRefundHelp')}
											scope="classes"
										>
											<SelectField
												options={CREDIT_LATE_PERCENT_OPTIONS}
												value={encodeValue(formValues.creditLateRefundPercent)}
												onChange={raw => setNumber('creditLateRefundPercent', raw)}
												ariaLabel={t('settings.cancellation.creditLateRefundPercent')}
											/>
										</SettingRow>
									</>
								)}
								<SettingToggleRow
									label={t('settings.cancellation.creditNoShowRefund')}
									tooltip={t('settings.cancellation.creditNoShowRefundHelp')}
									scope="classes"
									checked={formValues.creditNoShowRefund}
									onCheckedChange={v => setValue('creditNoShowRefund', v, { shouldDirty: true })}
								/>
							</div>
						</Card>
					</section>

					{/* --------------------------------------------------- Lista de espera */}
					<section className="space-y-3" data-tour="reservation-settings-waitlist">
						<h2 className="text-base font-semibold">{t('settings.sections.waitlist')}</h2>
						<Card className="border-input">
							<div className="divide-y divide-input">
								<SettingToggleRow
									label={t('settings.waitlist.enabled')}
									tooltip={t('settings.waitlist.enabledTooltip')}
									checked={formValues.waitlistEnabled}
									onCheckedChange={v => setValue('waitlistEnabled', v, { shouldDirty: true })}
								/>
								{formValues.waitlistEnabled && (
									<>
										<SettingRow
											label={t('settings.waitlist.maxSize')}
											tooltip={t('settings.waitlist.maxSizeTooltip')}
										>
											<SelectField
												options={WAITLIST_MAX_SIZE_OPTIONS}
												value={encodeValue(formValues.waitlistMaxSize)}
												onChange={raw => setNumber('waitlistMaxSize', raw)}
												ariaLabel={t('settings.waitlist.maxSize')}
											/>
										</SettingRow>
										<SettingRow
											label={t('settings.waitlist.priorityMode')}
											tooltip={t('settings.waitlist.priorityModeTooltip')}
										>
											<Select
												value={formValues.waitlistPriorityMode}
												onValueChange={v =>
													setValue('waitlistPriorityMode', v as SettingsFormData['waitlistPriorityMode'], {
														shouldDirty: true,
													})
												}
											>
												<SelectTrigger aria-label={t('settings.waitlist.priorityMode')} className="h-10">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{WAITLIST_PRIORITY_OPTIONS.map(o => (
														<SelectItem key={o.value} value={o.value}>
															{o.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</SettingRow>
										<SettingRow
											label={t('settings.waitlist.notifyWindow')}
											tooltip={t('settings.waitlist.notifyWindowHelp')}
										>
											<SelectField
												options={WAITLIST_NOTIFY_OPTIONS}
												value={encodeValue(formValues.waitlistNotifyWindow)}
												onChange={raw => setNumber('waitlistNotifyWindow', raw)}
												ariaLabel={t('settings.waitlist.notifyWindow')}
											/>
										</SettingRow>
									</>
								)}
							</div>
						</Card>
					</section>

					{/* ----------------------------------------------------- Recordatorios */}
					<section className="space-y-3" data-tour="reservation-settings-reminders">
						<h2 className="text-base font-semibold">{t('settings.sections.reminders')}</h2>
						<Card className="border-input">
							<div className="divide-y divide-input">
								<SettingToggleRow
									label={t('settings.reminders.enabled')}
									tooltip={t('settings.reminders.enabledTooltip')}
									checked={formValues.remindersEnabled}
									onCheckedChange={v => setValue('remindersEnabled', v, { shouldDirty: true })}
								/>
								{formValues.remindersEnabled && (
									<>
										<SettingRow
											label={t('settings.reminders.channels')}
											tooltip={t('settings.reminders.channelsTooltip')}
										>
											<MultiPillSelect
												options={REMINDER_CHANNEL_OPTIONS}
												value={formValues.reminderChannels}
												onChange={next =>
													setValue('reminderChannels', next, { shouldDirty: true })
												}
												ariaLabel={t('settings.reminders.channels')}
											/>
										</SettingRow>
										<SettingRow
											label={t('settings.reminders.whenToSend')}
											tooltip={t('settings.reminders.whenToSendTooltip')}
										>
											<MultiPillSelect
												options={REMINDER_OFFSET_OPTIONS}
												value={formValues.reminderMinBefore}
												onChange={next =>
													setValue('reminderMinBefore', next, { shouldDirty: true })
												}
												ariaLabel={t('settings.reminders.whenToSend')}
											/>
										</SettingRow>
									</>
								)}
							</div>
						</Card>
					</section>
				</fieldset>
			</form>
		</div>
	)
}
