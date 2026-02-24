import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import reservationService from '@/services/reservation.service'
import type { OperatingHours } from '@/types/reservation'

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
type DayKey = (typeof DAY_KEYS)[number]

const MAX_RANGES = 3

function getWeekDays(baseDate: Date): Date[] {
	const dayOfWeek = baseDate.getDay()
	const monday = new Date(baseDate)
	monday.setDate(monday.getDate() - ((dayOfWeek + 6) % 7))
	return Array.from({ length: 7 }, (_, i) => {
		const d = new Date(monday)
		d.setDate(d.getDate() + i)
		return d
	})
}

function getDayKeyForDate(date: Date): DayKey {
	const jsDay = date.getDay() // 0=Sunday
	return DAY_KEYS[(jsDay + 6) % 7] // Convert to Monday-first
}

/** Check if two time ranges overlap. Times are "HH:mm" strings. */
function rangesOverlap(a: { open: string; close: string }, b: { open: string; close: string }): boolean {
	// Empty values → skip validation
	if (!a.open || !a.close || !b.open || !b.close) return false
	return a.open < b.close && b.open < a.close
}

/** Validate all ranges for a day: no open >= close, no overlaps. Returns error key or null. */
function validateDayRanges(ranges: { open: string; close: string }[]): string | null {
	for (const range of ranges) {
		if (!range.open || !range.close) continue
		if (range.open >= range.close) return 'invalidTime'
	}
	for (let i = 0; i < ranges.length; i++) {
		for (let j = i + 1; j < ranges.length; j++) {
			if (rangesOverlap(ranges[i], ranges[j])) return 'overlapping'
		}
	}
	return null
}

interface EditAvailabilityDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function EditAvailabilityDialog({ open, onOpenChange }: EditAvailabilityDialogProps) {
	const { t } = useTranslation('reservations')
	const { t: tCommon } = useTranslation()
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()
	const { toast } = useToast()

	const [tab, setTab] = useState<'single' | 'recurring'>('single')
	const [weekBase, setWeekBase] = useState(new Date())
	const [hours, setHours] = useState<OperatingHours | null>(null)

	const { data: settings, isLoading } = useQuery({
		queryKey: ['reservation-settings', venueId],
		queryFn: () => reservationService.getSettings(venueId),
		enabled: open && !!venueId,
	})

	// Seed local state from fetched settings when dialog opens
	useEffect(() => {
		if (open && settings?.operatingHours) {
			setHours(structuredClone(settings.operatingHours))
			setWeekBase(new Date())
		}
	}, [open, settings])

	const weekDays = useMemo(() => getWeekDays(weekBase), [weekBase])

	const weekLabel = useMemo(() => {
		const days = getWeekDays(weekBase)
		const from = days[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
		const to = days[6].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
		return `${from} – ${to}`
	}, [weekBase])

	const goPrevWeek = () => setWeekBase(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d })
	const goNextWeek = () => setWeekBase(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d })

	// Validate all days — compute errors map
	const validationErrors = useMemo<Record<DayKey, string | null>>(() => {
		const errors = {} as Record<DayKey, string | null>
		for (const day of DAY_KEYS) {
			if (!hours || !hours[day].enabled) {
				errors[day] = null
			} else {
				errors[day] = validateDayRanges(hours[day].ranges)
			}
		}
		return errors
	}, [hours])

	const hasAnyError = useMemo(() => Object.values(validationErrors).some(Boolean), [validationErrors])

	// Mutation helpers
	const toggleDay = useCallback((day: DayKey) => {
		setHours(prev => {
			if (!prev) return prev
			const current = prev[day]
			const enabled = !current.enabled
			return {
				...prev,
				[day]: {
					enabled,
					ranges: enabled && current.ranges.length === 0 ? [{ open: '09:00', close: '17:00' }] : current.ranges,
				},
			}
		})
	}, [])

	const updateRange = useCallback((day: DayKey, index: number, field: 'open' | 'close', time: string) => {
		setHours(prev => {
			if (!prev) return prev
			const current = prev[day]
			return {
				...prev,
				[day]: {
					...current,
					ranges: current.ranges.map((r, i) => (i === index ? { ...r, [field]: time } : r)),
				},
			}
		})
	}, [])

	const addRange = useCallback((day: DayKey) => {
		setHours(prev => {
			if (!prev) return prev
			const current = prev[day]
			if (current.ranges.length >= MAX_RANGES) return prev
			return {
				...prev,
				[day]: { ...current, ranges: [...current.ranges, { open: '', close: '' }] },
			}
		})
	}, [])

	const removeRange = useCallback((day: DayKey, index: number) => {
		setHours(prev => {
			if (!prev) return prev
			const current = prev[day]
			if (current.ranges.length <= 1) return prev
			return {
				...prev,
				[day]: { ...current, ranges: current.ranges.filter((_, i) => i !== index) },
			}
		})
	}, [])

	const resetToDefaults = useCallback(() => {
		if (settings?.operatingHours) {
			setHours(structuredClone(settings.operatingHours))
		}
	}, [settings])

	// Save
	const saveMutation = useMutation({
		mutationFn: () => {
			if (!hours) throw new Error('No hours')
			return reservationService.updateSettings(venueId, { operatingHours: hours })
		},
		onSuccess: () => {
			toast({ title: t('settings.saved') })
			queryClient.invalidateQueries({ queryKey: ['reservation-settings', venueId] })
			onOpenChange(false)
		},
		onError: (err: any) => {
			toast({ title: err?.response?.data?.message || t('toasts.error'), variant: 'destructive' })
		},
	})

	// Render a single day row (shared between both tabs)
	const renderDayRow = (day: DayKey, label: string) => {
		if (!hours) return null
		const schedule = hours[day]
		const error = validationErrors[day]

		return (
			<div key={day}>
				<div className="flex items-center gap-3 py-2.5">
					<Checkbox
						checked={schedule.enabled}
						onCheckedChange={() => toggleDay(day)}
						className="h-5 w-5"
					/>
					<span className={`text-sm min-w-[120px] ${schedule.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
						{label}
					</span>
					<div className="flex-1 flex flex-col gap-1.5">
						{schedule.enabled ? (
							schedule.ranges.map((range, index) => (
								<div key={index} className="flex items-center gap-1.5">
									<Input
										type="time"
										value={range.open}
										onChange={e => updateRange(day, index, 'open', e.target.value)}
										className={`w-[100px] h-8 text-sm ${error ? 'border-destructive' : ''}`}
									/>
									<span className="text-muted-foreground text-xs">–</span>
									<Input
										type="time"
										value={range.close}
										onChange={e => updateRange(day, index, 'close', e.target.value)}
										className={`w-[100px] h-8 text-sm ${error ? 'border-destructive' : ''}`}
									/>
									{schedule.ranges.length > 1 && (
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="h-7 w-7 text-muted-foreground hover:text-destructive"
											onClick={() => removeRange(day, index)}
										>
											<X className="h-3.5 w-3.5" />
										</Button>
									)}
									{index === schedule.ranges.length - 1 && schedule.ranges.length < MAX_RANGES && (
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="h-7 w-7 text-muted-foreground"
											onClick={() => addRange(day)}
										>
											<Plus className="h-3.5 w-3.5" />
										</Button>
									)}
								</div>
							))
						) : (
							<div className="flex items-center gap-1.5">
								<Input type="time" disabled className="w-[100px] h-8 text-sm opacity-40" />
								<span className="text-muted-foreground text-xs">–</span>
								<Input type="time" disabled className="w-[100px] h-8 text-sm opacity-40" />
							</div>
						)}
					</div>
				</div>
			</div>
		)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{t('availability.title', { defaultValue: 'Editar disponibilidad' })}</DialogTitle>
				</DialogHeader>

				{/* Validation error banner — like Square */}
				{hasAnyError && (
					<div className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-destructive text-destructive-foreground text-sm">
						<AlertTriangle className="h-4 w-4 shrink-0" />
						{t('availability.invalidTime', { defaultValue: 'Introduce una hora válida' })}
					</div>
				)}

				{isLoading || !hours ? (
					<div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
						<Loader2 className="h-5 w-5 animate-spin" />
						<span>{tCommon('loading')}</span>
					</div>
				) : (
					<Tabs value={tab} onValueChange={v => setTab(v as 'single' | 'recurring')}>
						<TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none p-0 h-auto">
							<TabsTrigger
								value="single"
								className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:shadow-none px-4 pb-2 pt-1 text-sm"
							>
								{t('availability.singleChange', { defaultValue: 'Cambio único' })}
							</TabsTrigger>
							<TabsTrigger
								value="recurring"
								className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:shadow-none px-4 pb-2 pt-1 text-sm"
							>
								{t('availability.recurringSchedule', { defaultValue: 'Calendario recurrente' })}
							</TabsTrigger>
						</TabsList>

						{/* Single change tab — week view with specific dates */}
						<TabsContent value="single" className="mt-4">
							{/* Week navigator */}
							<div className="flex items-center gap-2 mb-4">
								<Button variant="ghost" size="icon" className="h-7 w-7" onClick={goPrevWeek}>
									<ChevronLeft className="h-4 w-4" />
								</Button>
								<span className="text-sm font-medium bg-muted px-3 py-1 rounded-full">
									{weekLabel}
								</span>
								<Button variant="ghost" size="icon" className="h-7 w-7" onClick={goNextWeek}>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>

							<div className="divide-y divide-border">
								{weekDays.map(day => {
									const dayKey = getDayKeyForDate(day)
									const label = day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
									return renderDayRow(dayKey, label)
								})}
							</div>

							<button
								type="button"
								className="mt-4 text-sm font-medium text-foreground underline underline-offset-2 hover:text-foreground/80 cursor-pointer"
								onClick={resetToDefaults}
							>
								{t('availability.resetWeek', { defaultValue: 'Restablecer semana a los valores predeterminados' })}
							</button>
						</TabsContent>

						{/* Recurring schedule tab — weekday names */}
						<TabsContent value="recurring" className="mt-4">
							<div className="divide-y divide-border">
								{DAY_KEYS.map(day =>
									renderDayRow(day, t(`settings.operatingHours.days.${day}`)),
								)}
							</div>
						</TabsContent>
					</Tabs>
				)}

				<DialogFooter className="pt-2">
					<Button
						onClick={() => saveMutation.mutate()}
						disabled={saveMutation.isPending || !hours || hasAnyError}
						className="ml-auto"
					>
						{saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
						{t('availability.done', { defaultValue: 'Listo' })}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
