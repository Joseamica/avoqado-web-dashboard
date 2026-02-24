import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PublicSlot } from '@/services/publicBooking.service'

interface TimeSlotPickerProps {
	slots: PublicSlot[]
	selectedSlot: PublicSlot | null
	onSelect: (slot: PublicSlot) => void
	timezone: string
	isLoading?: boolean
}

export function TimeSlotPicker({ slots, selectedSlot, onSelect, timezone, isLoading }: TimeSlotPickerProps) {
	const { t } = useTranslation('reservations')

	const slotsByHour = useMemo(() => {
		const grouped: Record<string, PublicSlot[]> = {}
		for (const slot of slots) {
			const time = new Date(slot.startsAt).toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false,
				timeZone: timezone,
			})
			const hourKey = time.split(':')[0] + ':00'
			if (!grouped[hourKey]) grouped[hourKey] = []
			grouped[hourKey].push(slot)
		}
		return grouped
	}, [slots, timezone])

	if (isLoading) {
		return (
			<div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
				<Loader2 className="h-5 w-5 animate-spin" />
				<span>{t('publicBooking.time.loading')}</span>
			</div>
		)
	}

	if (slots.length === 0) {
		return (
			<p className="py-8 text-center text-muted-foreground">
				{t('publicBooking.time.noSlots')}
			</p>
		)
	}

	return (
		<div className="space-y-4">
			<h2 className="text-lg font-semibold">{t('publicBooking.time.title')}</h2>
			<div className="space-y-3">
				{Object.entries(slotsByHour).map(([hour, hourSlots]) => (
					<div key={hour} className="flex items-start gap-3">
						<span className="w-12 shrink-0 pt-2 text-sm text-muted-foreground">{hour}</span>
						<div className="flex flex-wrap gap-2">
							{hourSlots.map(slot => {
								const time = new Date(slot.startsAt).toLocaleTimeString('en-US', {
									hour: '2-digit',
									minute: '2-digit',
									hour12: false,
									timeZone: timezone,
								})
								const isSelected = selectedSlot?.startsAt === slot.startsAt
								&& (selectedSlot?.classSessionId ?? null) === (slot.classSessionId ?? null)
								const isClassSlot = slot.remaining !== undefined
								const isFull = isClassSlot && slot.remaining! <= 0
								return (
									<Button
										key={slot.classSessionId || slot.startsAt}
										type="button"
										variant={isSelected ? 'default' : 'outline'}
										className={`h-auto min-w-[72px] flex-col gap-0.5 rounded-full px-3 py-2 ${isFull ? 'opacity-50' : ''}`}
										onClick={() => onSelect(slot)}
										disabled={isFull}
									>
										<span>{time}</span>
										{isClassSlot && (
											<span className={`text-[10px] leading-none ${isFull ? 'text-muted-foreground' : slot.remaining! <= 3 ? 'text-orange-500' : 'text-muted-foreground'}`}>
												{isFull
													? t('publicBooking.time.full', 'Lleno')
													: t('publicBooking.time.spotsLeft', { count: slot.remaining, defaultValue: '{{count}} lugares' })}
											</span>
										)}
									</Button>
								)
							})}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
