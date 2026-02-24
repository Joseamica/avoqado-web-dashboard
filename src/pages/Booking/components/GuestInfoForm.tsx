import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LoadingButton } from '@/components/ui/loading-button'
import { CancellationPolicyBanner } from './CancellationPolicyBanner'
import type { PublicVenueInfo } from '@/services/publicBooking.service'

// Schema is dynamic based on venue settings, so we create it in the component
function createSchema(t: (key: string) => string, requireEmail: boolean) {
	return z.object({
		guestPhone: z.string().min(1, t('publicBooking.validation.phoneRequired')),
		guestName: z.string().min(1, t('publicBooking.validation.nameRequired')),
		guestEmail: requireEmail
			? z.string().min(1, t('publicBooking.validation.emailRequired')).email(t('publicBooking.validation.emailInvalid'))
			: z.string().email(t('publicBooking.validation.emailInvalid')).optional().or(z.literal('')),
		partySize: z.coerce.number().min(1).max(100).optional(),
		specialRequests: z.string().max(2000).optional(),
	})
}

export type GuestFormData = z.infer<ReturnType<typeof createSchema>>

interface GuestInfoFormProps {
	venueInfo: PublicVenueInfo
	onSubmit: (data: GuestFormData) => void
	isSubmitting: boolean
	cancellationSettings?: {
		allowCustomerCancel: boolean
		minHoursBeforeStart: number | null
		forfeitDeposit: boolean
	}
	hasDeposit?: boolean
}

export function GuestInfoForm({
	venueInfo,
	onSubmit,
	isSubmitting,
	cancellationSettings,
	hasDeposit = false,
}: GuestInfoFormProps) {
	const { t } = useTranslation('reservations')

	const schema = createSchema(t, venueInfo.publicBooking.requireEmail)

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<GuestFormData>({
		resolver: zodResolver(schema),
		defaultValues: {
			guestPhone: '',
			guestName: '',
			guestEmail: '',
			partySize: 2,
			specialRequests: '',
		},
	})

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
			<h2 className="text-lg font-semibold">{t('publicBooking.guestForm.title')}</h2>

			{/* Phone first — Mexican market */}
			<div className="space-y-2">
				<Label htmlFor="guestPhone">{t('publicBooking.guestForm.phone')} *</Label>
				<Input
					id="guestPhone"
					type="tel"
					className="h-12 text-base"
					placeholder={t('publicBooking.guestForm.phonePlaceholder')}
					{...register('guestPhone')}
				/>
				{errors.guestPhone && (
					<p className="text-sm text-destructive">{errors.guestPhone.message}</p>
				)}
			</div>

			{/* Name */}
			<div className="space-y-2">
				<Label htmlFor="guestName">{t('publicBooking.guestForm.name')} *</Label>
				<Input
					id="guestName"
					className="h-12 text-base"
					placeholder={t('publicBooking.guestForm.namePlaceholder')}
					{...register('guestName')}
				/>
				{errors.guestName && (
					<p className="text-sm text-destructive">{errors.guestName.message}</p>
				)}
			</div>

			{/* Email */}
			<div className="space-y-2">
				<Label htmlFor="guestEmail">
					{venueInfo.publicBooking.requireEmail
						? `${t('publicBooking.guestForm.email').replace(' (optional)', '')} *`
						: t('publicBooking.guestForm.email')}
				</Label>
				<Input
					id="guestEmail"
					type="email"
					className="h-12 text-base"
					placeholder={t('publicBooking.guestForm.emailPlaceholder')}
					{...register('guestEmail')}
				/>
				{errors.guestEmail && (
					<p className="text-sm text-destructive">{errors.guestEmail.message}</p>
				)}
			</div>

			{/* Party size */}
			<div className="space-y-2">
				<Label htmlFor="partySize">{t('publicBooking.guestForm.partySize')}</Label>
				<Input
					id="partySize"
					type="number"
					min={1}
					max={100}
					className="h-12 text-base"
					{...register('partySize')}
				/>
			</div>

			{/* Special requests */}
			<div className="space-y-2">
				<Label htmlFor="specialRequests">{t('publicBooking.guestForm.specialRequests')}</Label>
				<Textarea
					id="specialRequests"
					rows={3}
					className="text-base"
					placeholder={t('publicBooking.guestForm.specialRequestsPlaceholder')}
					{...register('specialRequests')}
				/>
			</div>

			{/* Cancellation policy */}
			{cancellationSettings && (
				<CancellationPolicyBanner
					allowCustomerCancel={cancellationSettings.allowCustomerCancel}
					minHoursBeforeStart={cancellationSettings.minHoursBeforeStart}
					forfeitDeposit={cancellationSettings.forfeitDeposit}
					hasDeposit={hasDeposit}
				/>
			)}

			<LoadingButton
				type="submit"
				isLoading={isSubmitting}
				className="h-12 w-full text-base"
			>
				{isSubmitting ? t('publicBooking.guestForm.submitting') : t('publicBooking.guestForm.submit')}
			</LoadingButton>
		</form>
	)
}
