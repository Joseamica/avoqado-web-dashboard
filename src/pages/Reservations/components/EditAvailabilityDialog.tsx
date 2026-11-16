import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Plus, X } from 'lucide-react'

import { AvisoDeCarga } from '@/components/AvisoDeCarga'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TimePicker } from '@/components/ui/time-picker'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { falloDeCarga } from '@/lib/falloDeCarga'
import reservationService from '@/services/reservation.service'
import type { OperatingHours } from '@/types/reservation'

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
type DayKey = (typeof DAY_KEYS)[number]

const MAX_RANGES = 3

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

	// «Cambio único» (sólo una fecha) no se ofrece todavía: el SERVIDOR sólo guarda el horario semanal, y la pestaña de
	// antes editaba ese mismo horario semanal con renglones por fecha. Cerrar «sólo este lunes» cerraba TODOS los lunes y
	// el negocio dejaba de recibir reservas en línea ese día sin saberlo (encargo 44e957). Vuelve cuando exista una
	// excepción con fecha en el SERVIDOR.
	const tab = 'recurring' as const
	const [hours, setHours] = useState<OperatingHours | null>(null)

	const settingsQuery = useQuery({
		queryKey: ['reservation-settings', venueId],
		queryFn: () => reservationService.getSettings(venueId),
		enabled: open && !!venueId,
	})
	const settings = settingsQuery.data

	// Seed local state from fetched settings when dialog opens
	useEffect(() => {
		if (open && settings?.operatingHours) {
			setHours(structuredClone(settings.operatingHours))
		}
	}, [open, settings])

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
									<TimePicker
										value={range.open}
										onChange={time => updateRange(day, index, 'open', time)}
										label=""
										error={!!error}
										className="w-[110px]"
										placeholder="--:--"
									/>
									<span className="text-muted-foreground text-xs">–</span>
									<TimePicker
										value={range.close}
										onChange={time => updateRange(day, index, 'close', time)}
										label=""
										error={!!error}
										className="w-[110px]"
										placeholder="--:--"
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
								<TimePicker disabled label="" className="w-[110px] opacity-40" placeholder="--:--" />
								<span className="text-muted-foreground text-xs">–</span>
								<TimePicker disabled label="" className="w-[110px] opacity-40" placeholder="--:--" />
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

				<AvisoDeCarga query={settingsQuery} hayDatos={!!hours} />
				{!hours ? (
					!falloDeCarga(settingsQuery) && (
						<div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
							<Loader2 className="h-5 w-5 animate-spin" />
							<span>{tCommon('loading')}</span>
						</div>
					)
				) : (
					<Tabs value={tab}>
						<TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none p-0 h-auto">
							<TabsTrigger
								value="single"
								disabled
								title={t('availability.singleChangeSoon')}
								className="gap-2 rounded-none border-b-2 border-transparent bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-foreground data-[state=active]:shadow-none px-4 pb-2 pt-1 text-sm"
							>
								{t('availability.singleChange', { defaultValue: 'Cambio único' })}
								<Badge variant="outline" className="text-[10px] h-4 px-1.5">
									{t('availability.comingSoon')}
								</Badge>
							</TabsTrigger>
							<TabsTrigger
								value="recurring"
								className="rounded-none border-b-2 border-transparent bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-foreground data-[state=active]:shadow-none px-4 pb-2 pt-1 text-sm"
							>
								{t('availability.recurringSchedule', { defaultValue: 'Calendario recurrente' })}
							</TabsTrigger>
						</TabsList>

						{/* Recurring schedule tab — weekday names */}
						<TabsContent value="recurring" className="mt-4">
							<p className="mb-2 text-sm text-muted-foreground">{t('availability.recurringNote')}</p>
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
