import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import publicBookingService from '@/services/publicBooking.service'
import type { PublicSlot, PublicBookingResult, PublicVenueInfo } from '@/services/publicBooking.service'
import { BookingHeader } from './components/BookingHeader'
import { BookingStepIndicator } from './components/BookingStepIndicator'
import { ServiceSelector } from './components/ServiceSelector'
import { DateSelector } from './components/DateSelector'
import { TimeSlotPicker } from './components/TimeSlotPicker'
import { GuestInfoForm, type GuestFormData } from './components/GuestInfoForm'
import { BookingConfirmation } from './BookingConfirmation'

type Product = PublicVenueInfo['products'][number]

// Step calculation: skip service step if 0-1 products
function getStepConfig(hasServiceStep: boolean) {
	if (hasServiceStep) {
		return { totalSteps: 5, serviceStep: 1, dateStep: 2, timeStep: 3, formStep: 4, confirmStep: 5 }
	}
	return { totalSteps: 4, serviceStep: 0, dateStep: 1, timeStep: 2, formStep: 3, confirmStep: 4 }
}

export default function PublicBookingPage() {
	const { venueSlug } = useParams<{ venueSlug: string }>()
	const navigate = useNavigate()
	const { t } = useTranslation('reservations')
	const { toast } = useToast()

	// Flow state
	const [step, setStep] = useState(0) // 0 = loading
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
	const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
	const [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null)
	const [bookingResult, setBookingResult] = useState<PublicBookingResult | null>(null)

	// Fetch venue info
	const venueQuery = useQuery({
		queryKey: ['public-venue', venueSlug],
		queryFn: () => publicBookingService.getVenueInfo(venueSlug!),
		enabled: !!venueSlug,
		retry: false,
	})

	const venueInfo = venueQuery.data
	const hasServiceStep = (venueInfo?.products.length ?? 0) > 1
	const config = getStepConfig(hasServiceStep)

	// Initialize step once venue loads
	useEffect(() => {
		if (venueInfo && step === 0) {
			if (venueInfo.products.length <= 1) {
				setSelectedProduct(venueInfo.products[0] ?? null)
				setStep(config.dateStep)
			} else {
				setStep(config.serviceStep)
			}
		}
	}, [venueInfo, step, config.serviceStep, config.dateStep])

	// Build date string for API (YYYY-MM-DD)
	const selectedDateStr = selectedDate
		? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
		: null

	// Fetch availability when date is selected
	const availabilityQuery = useQuery({
		queryKey: ['public-availability', venueSlug, selectedDateStr, selectedProduct?.id],
		queryFn: () =>
			publicBookingService.getAvailability(venueSlug!, {
				date: selectedDateStr!,
				productId: selectedProduct?.id,
				duration: selectedProduct?.duration ?? undefined,
			}),
		enabled: !!selectedDateStr && !!venueSlug,
	})

	// Create reservation mutation
	const createMutation = useMutation({
		mutationFn: (data: GuestFormData) => {
			if (!venueSlug || !selectedSlot) throw new Error('Missing booking data')
			return publicBookingService.createReservation(venueSlug, {
				startsAt: selectedSlot.startsAt,
				endsAt: selectedSlot.endsAt,
				duration: selectedProduct?.duration ?? 60,
				guestName: data.guestName,
				guestPhone: data.guestPhone,
				guestEmail: data.guestEmail || undefined,
				partySize: data.partySize || undefined,
				productId: selectedProduct?.id,
				specialRequests: data.specialRequests || undefined,
			})
		},
		onSuccess: (result) => {
			setBookingResult(result)
			setStep(config.confirmStep)
		},
		onError: (error: any) => {
			const message = error.response?.data?.message || t('publicBooking.errors.generic')
			// If slot conflict, go back to time step and refetch
			if (error.response?.status === 409) {
				toast({ title: t('publicBooking.errors.slotTaken'), variant: 'destructive' })
				setSelectedSlot(null)
				setStep(config.timeStep)
				availabilityQuery.refetch()
			} else {
				toast({ title: message, variant: 'destructive' })
			}
		},
	})

	// Step labels for indicator
	const stepLabels = hasServiceStep
		? [
				t('publicBooking.steps.service'),
				t('publicBooking.steps.date'),
				t('publicBooking.steps.time'),
				t('publicBooking.steps.info'),
				t('publicBooking.steps.confirmation'),
			]
		: [
				t('publicBooking.steps.date'),
				t('publicBooking.steps.time'),
				t('publicBooking.steps.info'),
				t('publicBooking.steps.confirmation'),
			]

	// Handlers
	const handleServiceSelect = useCallback(
		(product: Product) => {
			setSelectedProduct(product)
			setStep(config.dateStep)
		},
		[config.dateStep],
	)

	const handleDateSelect = useCallback(
		(date: Date | undefined) => {
			setSelectedDate(date)
			setSelectedSlot(null)
			if (date) setStep(config.timeStep)
		},
		[config.timeStep],
	)

	const handleSlotSelect = useCallback(
		(slot: PublicSlot) => {
			setSelectedSlot(slot)
			setStep(config.formStep)
		},
		[config.formStep],
	)

	const handleFormSubmit = useCallback(
		(data: GuestFormData) => {
			createMutation.mutate(data)
		},
		[createMutation],
	)

	const handleBack = useCallback(() => {
		if (step === config.formStep) setStep(config.timeStep)
		else if (step === config.timeStep) setStep(config.dateStep)
		else if (step === config.dateStep && hasServiceStep) setStep(config.serviceStep)
	}, [step, config, hasServiceStep])

	const handleManageBooking = useCallback(() => {
		if (bookingResult && venueSlug) {
			navigate(`/book/${venueSlug}/manage/${bookingResult.cancelSecret}`)
		}
	}, [bookingResult, venueSlug, navigate])

	const handleNewBooking = useCallback(() => {
		setStep(0)
		setSelectedProduct(null)
		setSelectedDate(undefined)
		setSelectedSlot(null)
		setBookingResult(null)
		// Re-trigger initialization
		setTimeout(() => {
			if (venueInfo) {
				if (venueInfo.products.length <= 1) {
					setSelectedProduct(venueInfo.products[0] ?? null)
					setStep(config.dateStep)
				} else {
					setStep(config.serviceStep)
				}
			}
		}, 0)
	}, [venueInfo, config])

	// --- Error states ---

	if (venueQuery.isLoading || step === 0) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
			</div>
		)
	}

	if (venueQuery.isError) {
		const is404 = (venueQuery.error as any)?.response?.status === 404
		return (
			<div className="flex min-h-screen items-center justify-center bg-background px-4">
				<div className="max-w-sm space-y-4 text-center">
					<h1 className="text-2xl font-bold">
						{is404 ? t('publicBooking.errors.venueNotFound') : t('publicBooking.errors.generic')}
					</h1>
					<p className="text-muted-foreground">
						{is404
							? t('publicBooking.errors.venueNotFoundDescription')
							: t('publicBooking.errors.generic')}
					</p>
					{!is404 && (
						<Button onClick={() => venueQuery.refetch()} variant="outline">
							{t('publicBooking.guestForm.submit')}
						</Button>
					)}
				</div>
			</div>
		)
	}

	if (venueInfo && !venueInfo.publicBooking.enabled) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background px-4">
				<div className="max-w-sm space-y-4 text-center">
					<BookingHeader venueName={venueInfo.name} logo={venueInfo.logo} />
					<h2 className="text-xl font-semibold">{t('publicBooking.errors.bookingDisabled')}</h2>
					<p className="text-muted-foreground">
						{t('publicBooking.errors.bookingDisabledDescription')}
					</p>
					{venueInfo.phone && (
						<Button variant="outline" className="h-11" asChild>
							<a href={`tel:${venueInfo.phone}`}>
								<Phone className="mr-2 h-4 w-4" />
								{t('publicBooking.errors.bookingDisabledContact', { phone: venueInfo.phone })}
							</a>
						</Button>
					)}
				</div>
			</div>
		)
	}

	if (!venueInfo) return null

	// --- Main booking flow ---

	const showBack = step > (hasServiceStep ? config.serviceStep : config.dateStep) && step < config.confirmStep

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-lg px-4 py-6">
				<BookingHeader venueName={venueInfo.name} logo={venueInfo.logo} />

				{step < config.confirmStep && (
					<BookingStepIndicator
						currentStep={step}
						totalSteps={config.totalSteps}
						labels={stepLabels}
					/>
				)}

				{/* Back button */}
				{showBack && (
					<Button
						variant="ghost"
						size="sm"
						className="mb-4"
						onClick={handleBack}
					>
						<ArrowLeft className="mr-1 h-4 w-4" />
						{t('actions.goBack')}
					</Button>
				)}

				{/* Step content */}
				{step === config.serviceStep && hasServiceStep && (
					<ServiceSelector
						products={venueInfo.products}
						selectedProductId={selectedProduct?.id ?? null}
						onSelect={handleServiceSelect}
					/>
				)}

				{step === config.dateStep && (
					<DateSelector
						selectedDate={selectedDate}
						onSelect={handleDateSelect}
						maxAdvanceDays={30} // Default, could come from settings in the future
						timezone={venueInfo.timezone}
						operatingHours={venueInfo.operatingHours}
					/>
				)}

				{step === config.timeStep && (
					<TimeSlotPicker
						slots={availabilityQuery.data?.slots ?? []}
						selectedSlot={selectedSlot}
						onSelect={handleSlotSelect}
						timezone={venueInfo.timezone}
						isLoading={availabilityQuery.isLoading}
					/>
				)}

				{step === config.formStep && (
					<GuestInfoForm
						venueInfo={venueInfo}
						onSubmit={handleFormSubmit}
						isSubmitting={createMutation.isPending}
					/>
				)}

				{step === config.confirmStep && bookingResult && (
					<BookingConfirmation
						booking={bookingResult}
						venueInfo={venueInfo}
						onManageBooking={handleManageBooking}
						onNewBooking={handleNewBooking}
					/>
				)}

				{/* Footer */}
				<div className="mt-8 text-center">
					<p className="text-xs text-muted-foreground">{t('publicBooking.poweredBy')}</p>
				</div>
			</div>
		</div>
	)
}
