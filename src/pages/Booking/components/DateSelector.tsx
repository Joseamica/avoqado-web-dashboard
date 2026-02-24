import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar } from '@/components/ui/calendar'
import type { OperatingHours } from '@/types/reservation'

interface DateSelectorProps {
	selectedDate: Date | undefined
	onSelect: (date: Date | undefined) => void
	maxAdvanceDays: number
	timezone: string
	operatingHours?: OperatingHours
}

const DAY_MAP = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

export function DateSelector({ selectedDate, onSelect, maxAdvanceDays, timezone, operatingHours }: DateSelectorProps) {
	const { t } = useTranslation('reservations')

	const { fromDate, toDate } = useMemo(() => {
		const now = new Date()
		// Show today's date in venue timezone
		const venueNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
		const from = new Date(venueNow.getFullYear(), venueNow.getMonth(), venueNow.getDate())
		const to = new Date(from)
		to.setDate(to.getDate() + maxAdvanceDays)
		return { fromDate: from, toDate: to }
	}, [maxAdvanceDays, timezone])

	// Compute closed days of week from operating hours
	const disabledMatchers = useMemo(() => {
		const matchers: Array<{ before: Date } | { after: Date } | { dayOfWeek: number[] }> = [
			{ before: fromDate },
			{ after: toDate },
		]
		if (operatingHours) {
			const closedDays: number[] = []
			DAY_MAP.forEach((name, i) => {
				if (!operatingHours[name]?.enabled) closedDays.push(i)
			})
			if (closedDays.length > 0) {
				matchers.push({ dayOfWeek: closedDays })
			}
		}
		return matchers
	}, [fromDate, toDate, operatingHours])

	return (
		<div className="space-y-4">
			<h2 className="text-lg font-semibold">{t('publicBooking.date.title')}</h2>
			<div className="flex justify-center">
				<Calendar
					mode="single"
					selected={selectedDate}
					onSelect={onSelect}
					disabled={disabledMatchers}
					className="rounded-xl border"
				/>
			</div>
		</div>
	)
}
