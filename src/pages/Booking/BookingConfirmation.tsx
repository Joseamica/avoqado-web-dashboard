import { useTranslation } from 'react-i18next'
import { CalendarPlus, Download, Settings, Plus, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PublicBookingResult, PublicVenueInfo } from '@/services/publicBooking.service'

interface BookingConfirmationProps {
	booking: PublicBookingResult
	venueInfo: PublicVenueInfo
	onManageBooking: () => void
	onNewBooking: () => void
}

function buildGoogleCalendarUrl(booking: PublicBookingResult, venueName: string): string {
	const start = new Date(booking.startsAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
	const end = new Date(booking.endsAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
	const params = new URLSearchParams({
		action: 'TEMPLATE',
		text: `Reservation at ${venueName}`,
		dates: `${start}/${end}`,
		details: `Confirmation code: ${booking.confirmationCode}`,
	})
	return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function buildIcsContent(booking: PublicBookingResult, venueName: string): string {
	const start = new Date(booking.startsAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
	const end = new Date(booking.endsAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'BEGIN:VEVENT',
		`DTSTART:${start}`,
		`DTEND:${end}`,
		`SUMMARY:Reservation at ${venueName}`,
		`DESCRIPTION:Confirmation code: ${booking.confirmationCode}`,
		'END:VEVENT',
		'END:VCALENDAR',
	].join('\r\n')
}

function downloadIcs(booking: PublicBookingResult, venueName: string) {
	const content = buildIcsContent(booking, venueName)
	const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = `reservation-${booking.confirmationCode}.ics`
	link.click()
	URL.revokeObjectURL(url)
}

export function BookingConfirmation({
	booking,
	venueInfo,
	onManageBooking,
	onNewBooking,
}: BookingConfirmationProps) {
	const { t } = useTranslation('reservations')

	const startDate = new Date(booking.startsAt)
	const endDate = new Date(booking.endsAt)

	const dateStr = startDate.toLocaleDateString(undefined, {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: venueInfo.timezone,
	})
	const timeStr = `${startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: venueInfo.timezone })} - ${endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: venueInfo.timezone })}`

	return (
		<div className="space-y-6 text-center">
			<div className="flex justify-center">
				<div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
					<CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
				</div>
			</div>

			<div>
				<h2 className="text-xl font-semibold">{t('publicBooking.confirmation.title')}</h2>
			</div>

			{/* Confirmation code */}
			<div className="rounded-xl bg-muted/50 p-4">
				<p className="text-sm text-muted-foreground">{t('publicBooking.confirmation.code')}</p>
				<p className="mt-1 text-3xl font-bold tracking-wider">{booking.confirmationCode}</p>
			</div>

			{/* Details */}
			<div className="space-y-2 text-left">
				<div className="flex justify-between border-b border-border py-2">
					<span className="text-muted-foreground">{t('publicBooking.confirmation.dateTime')}</span>
					<span className="text-right font-medium">
						{dateStr}
						<br />
						{timeStr}
					</span>
				</div>
			</div>

			{/* Calendar actions */}
			<div className="flex gap-3">
				<Button
					variant="outline"
					className="h-11 flex-1"
					onClick={() => window.open(buildGoogleCalendarUrl(booking, venueInfo.name), '_blank')}
				>
					<CalendarPlus className="mr-2 h-4 w-4" />
					{t('publicBooking.confirmation.addToCalendar')}
				</Button>
				<Button
					variant="outline"
					className="h-11 flex-1"
					onClick={() => downloadIcs(booking, venueInfo.name)}
				>
					<Download className="mr-2 h-4 w-4" />
					{t('publicBooking.confirmation.downloadIcs')}
				</Button>
			</div>

			{/* Manage booking */}
			<Button
				variant="secondary"
				className="h-11 w-full"
				onClick={onManageBooking}
			>
				<Settings className="mr-2 h-4 w-4" />
				{t('publicBooking.confirmation.manageBooking')}
			</Button>

			{/* New booking */}
			<Button
				variant="ghost"
				className="h-11 w-full"
				onClick={onNewBooking}
			>
				<Plus className="mr-2 h-4 w-4" />
				{t('publicBooking.confirmation.newBooking')}
			</Button>
		</div>
	)
}
