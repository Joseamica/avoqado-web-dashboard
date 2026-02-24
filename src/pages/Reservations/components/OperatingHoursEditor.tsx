import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { DaySchedule, OperatingHours } from '@/types/reservation'

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const MAX_RANGES = 3

interface OperatingHoursEditorProps {
	value: OperatingHours
	onChange: (hours: OperatingHours) => void
}

export function OperatingHoursEditor({ value, onChange }: OperatingHoursEditorProps) {
	const { t } = useTranslation('reservations')

	const updateDay = useCallback(
		(day: keyof OperatingHours, schedule: DaySchedule) => {
			onChange({ ...value, [day]: schedule })
		},
		[value, onChange],
	)

	const toggleDay = useCallback(
		(day: keyof OperatingHours) => {
			const current = value[day]
			const enabled = !current.enabled
			updateDay(day, {
				enabled,
				ranges: enabled && current.ranges.length === 0 ? [{ open: '09:00', close: '22:00' }] : current.ranges,
			})
		},
		[value, updateDay],
	)

	const updateRange = useCallback(
		(day: keyof OperatingHours, index: number, field: 'open' | 'close', time: string) => {
			const current = value[day]
			const newRanges = current.ranges.map((r, i) => (i === index ? { ...r, [field]: time } : r))
			updateDay(day, { ...current, ranges: newRanges })
		},
		[value, updateDay],
	)

	const addRange = useCallback(
		(day: keyof OperatingHours) => {
			const current = value[day]
			if (current.ranges.length >= MAX_RANGES) return
			updateDay(day, { ...current, ranges: [...current.ranges, { open: '', close: '' }] })
		},
		[value, updateDay],
	)

	const removeRange = useCallback(
		(day: keyof OperatingHours, index: number) => {
			const current = value[day]
			if (current.ranges.length <= 1) return
			updateDay(day, { ...current, ranges: current.ranges.filter((_, i) => i !== index) })
		},
		[value, updateDay],
	)

	return (
		<div className="space-y-3">
			{DAY_KEYS.map(day => {
				const schedule = value[day]
				return (
					<div key={day} className="flex items-start gap-4 rounded-lg border border-input p-3">
						{/* Day toggle */}
						<div className="flex items-center gap-3 min-w-[140px] pt-1">
							<Switch checked={schedule.enabled} onCheckedChange={() => toggleDay(day)} />
							<Label className="text-sm font-medium">{t(`settings.operatingHours.days.${day}`)}</Label>
						</div>

						{/* Time ranges or "Closed" label */}
						<div className="flex-1">
							{schedule.enabled ? (
								<div className="space-y-2">
									{schedule.ranges.map((range, index) => (
										<div key={index} className="flex items-center gap-2">
											<Input
												type="time"
												value={range.open}
												onChange={e => updateRange(day, index, 'open', e.target.value)}
												className="w-[120px]"
											/>
											<span className="text-muted-foreground">—</span>
											<Input
												type="time"
												value={range.close}
												onChange={e => updateRange(day, index, 'close', e.target.value)}
												className="w-[120px]"
											/>
											{schedule.ranges.length > 1 && (
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-muted-foreground hover:text-destructive"
													onClick={() => removeRange(day, index)}
													title={t('settings.operatingHours.removeRange')}
												>
													<X className="h-4 w-4" />
												</Button>
											)}
										</div>
									))}
									{schedule.ranges.length < MAX_RANGES && (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="text-xs h-7"
											onClick={() => addRange(day)}
										>
											<Plus className="h-3 w-3 mr-1" />
											{t('settings.operatingHours.addRange')}
										</Button>
									)}
								</div>
							) : (
								<span className="text-sm text-muted-foreground pt-1 inline-block">
									{t('settings.operatingHours.closed')}
								</span>
							)}
						</div>
					</div>
				)
			})}
		</div>
	)
}
