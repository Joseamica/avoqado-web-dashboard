import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Users, Clock, MapPin, User, MessageSquare, ArrowLeft, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import publicBookingService from '@/services/publicBooking.service'

export default function BookingManagePage() {
	const { venueSlug, cancelSecret } = useParams<{ venueSlug: string; cancelSecret: string }>()
	const navigate = useNavigate()
	const { t } = useTranslation('reservations')
	const { toast } = useToast()
	const queryClient = useQueryClient()

	const [showCancelDialog, setShowCancelDialog] = useState(false)
	const [cancelReason, setCancelReason] = useState('')

	// Fetch reservation
	const reservationQuery = useQuery({
		queryKey: ['public-reservation', venueSlug, cancelSecret],
		queryFn: () => publicBookingService.getReservation(venueSlug!, cancelSecret!),
		enabled: !!venueSlug && !!cancelSecret,
		retry: false,
	})

	// Fetch venue info for timezone
	const venueQuery = useQuery({
		queryKey: ['public-venue', venueSlug],
		queryFn: () => publicBookingService.getVenueInfo(venueSlug!),
		enabled: !!venueSlug,
		retry: false,
	})

	// Cancel mutation
	const cancelMutation = useMutation({
		mutationFn: () => publicBookingService.cancelReservation(venueSlug!, cancelSecret!, cancelReason || undefined),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['public-reservation', venueSlug, cancelSecret] })
			setShowCancelDialog(false)
			toast({ title: t('toasts.cancelSuccess') })
		},
		onError: (error: any) => {
			const message = error.response?.data?.message || t('publicBooking.errors.generic')
			toast({ title: message, variant: 'destructive' })
		},
	})

	const reservation = reservationQuery.data
	const venueInfo = venueQuery.data
	const timezone = venueInfo?.timezone ?? 'America/Mexico_City'

	// Loading
	if (reservationQuery.isLoading || venueQuery.isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
			</div>
		)
	}

	// Error
	if (reservationQuery.isError) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background px-4">
				<div className="max-w-sm space-y-4 text-center">
					<h1 className="text-2xl font-bold">{t('publicBooking.errors.reservationNotFound')}</h1>
					<p className="text-muted-foreground">{t('publicBooking.errors.reservationNotFoundDescription')}</p>
					<Button variant="outline" onClick={() => navigate(`/book/${venueSlug}`)}>
						<ArrowLeft className="mr-2 h-4 w-4" />
						{t('publicBooking.manage.backToBooking')}
					</Button>
				</div>
			</div>
		)
	}

	if (!reservation) return null

	const isCancelled = reservation.status === 'CANCELLED'
	const startDate = new Date(reservation.startsAt)
	const endDate = new Date(reservation.endsAt)

	const dateStr = startDate.toLocaleDateString(undefined, {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: timezone,
	})
	const timeStr = `${startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: timezone })} - ${endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: timezone })}`

	const statusColors: Record<string, string> = {
		PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
		CONFIRMED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
		CHECKED_IN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
		COMPLETED: 'bg-muted text-muted-foreground',
		CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
		NO_SHOW: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-lg px-4 py-6">
				{/* Header */}
				{venueInfo && (
					<div className="flex flex-col items-center gap-3 pb-6">
						{venueInfo.logo ? (
							<img src={venueInfo.logo} alt={venueInfo.name} className="h-16 w-16 rounded-full object-cover" />
						) : (
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
								{venueInfo.name.charAt(0).toUpperCase()}
							</div>
						)}
						<h1 className="text-xl font-semibold">{t('publicBooking.manage.title')}</h1>
					</div>
				)}

				{/* Status */}
				<div className="mb-6 flex justify-center">
					<Badge className={statusColors[reservation.status] || ''}>
						{t(`status.${reservation.status}`)}
					</Badge>
				</div>

				{/* Cancelled notice */}
				{isCancelled && (
					<div className="mb-6 rounded-xl bg-red-50 p-4 text-center dark:bg-red-900/10">
						<XCircle className="mx-auto mb-2 h-6 w-6 text-red-500" />
						<p className="font-medium text-red-700 dark:text-red-400">
							{t('publicBooking.manage.cancelledStatus')}
						</p>
					</div>
				)}

				{/* Confirmation code */}
				<div className="mb-6 rounded-xl bg-muted/50 p-4 text-center">
					<p className="text-sm text-muted-foreground">{t('detail.confirmationCode')}</p>
					<p className="mt-1 text-3xl font-bold tracking-wider">{reservation.confirmationCode}</p>
				</div>

				{/* Details */}
				<div className="space-y-4 rounded-xl border border-border p-4">
					{/* Date & Time */}
					<div className="flex items-start gap-3">
						<CalendarDays className="mt-0.5 h-5 w-5 text-muted-foreground" />
						<div>
							<p className="font-medium">{dateStr}</p>
							<p className="text-sm text-muted-foreground">{timeStr}</p>
						</div>
					</div>

					{/* Duration */}
					<div className="flex items-center gap-3">
						<Clock className="h-5 w-5 text-muted-foreground" />
						<p>{t('form.fields.durationMin', { min: reservation.duration })}</p>
					</div>

					{/* Party size */}
					<div className="flex items-center gap-3">
						<Users className="h-5 w-5 text-muted-foreground" />
						<p>{t('people', { count: reservation.partySize })}</p>
					</div>

					{/* Product / Service */}
					{reservation.product && (
						<div className="flex items-center gap-3">
							<MapPin className="h-5 w-5 text-muted-foreground" />
							<p>{reservation.product.name}</p>
						</div>
					)}

					{/* Table */}
					{reservation.table && (
						<div className="flex items-center gap-3">
							<MapPin className="h-5 w-5 text-muted-foreground" />
							<p>{t('publicBooking.manage.table')} {reservation.table.number}</p>
						</div>
					)}

					{/* Staff */}
					{reservation.assignedStaff && (
						<div className="flex items-center gap-3">
							<User className="h-5 w-5 text-muted-foreground" />
							<p>{t('publicBooking.manage.staff')}: {reservation.assignedStaff.firstName} {reservation.assignedStaff.lastName}</p>
						</div>
					)}

					{/* Special requests */}
					{reservation.specialRequests && (
						<div className="flex items-start gap-3">
							<MessageSquare className="mt-0.5 h-5 w-5 text-muted-foreground" />
							<div>
								<p className="text-sm font-medium">{t('publicBooking.manage.specialRequests')}</p>
								<p className="text-sm text-muted-foreground">{reservation.specialRequests}</p>
							</div>
						</div>
					)}

					{/* Deposit */}
					{reservation.depositAmount != null && (
						<div className="flex items-center justify-between border-t border-border pt-3">
							<span className="text-muted-foreground">{t('publicBooking.manage.deposit')}</span>
							<span className="font-medium">${reservation.depositAmount}</span>
						</div>
					)}
				</div>

				{/* Actions */}
				<div className="mt-6 space-y-3">
					{!isCancelled && reservation.status !== 'COMPLETED' && reservation.status !== 'NO_SHOW' && (
						<Button
							variant="destructive"
							className="h-11 w-full"
							onClick={() => setShowCancelDialog(true)}
						>
							{t('publicBooking.manage.cancelButton')}
						</Button>
					)}

					<Button
						variant="outline"
						className="h-11 w-full"
						onClick={() => navigate(`/book/${venueSlug}`)}
					>
						<ArrowLeft className="mr-2 h-4 w-4" />
						{t('publicBooking.manage.backToBooking')}
					</Button>
				</div>

				{/* Footer */}
				<div className="mt-8 text-center">
					<p className="text-xs text-muted-foreground">{t('publicBooking.poweredBy')}</p>
				</div>
			</div>

			{/* Cancel dialog */}
			<AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('publicBooking.manage.cancelTitle')}</AlertDialogTitle>
						<AlertDialogDescription>
							{t('publicBooking.manage.cancelDescription')}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="space-y-2 py-2">
						<Label>{t('publicBooking.manage.cancelReasonLabel')}</Label>
						<Textarea
							value={cancelReason}
							onChange={(e) => setCancelReason(e.target.value)}
							placeholder={t('publicBooking.manage.cancelReasonPlaceholder')}
							rows={3}
						/>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel>{t('actions.goBack')}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => cancelMutation.mutate()}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{t('publicBooking.manage.cancelConfirm')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
