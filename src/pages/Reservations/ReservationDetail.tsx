import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
	CalendarDays,
	Check,
	Clock,
	LogIn,
	MapPin,
	Phone,
	Mail,
	User,
	Users,
	X,
	AlertTriangle,
	CalendarClock,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import reservationService from '@/services/reservation.service'

import { ReservationStatusBadge } from './components/ReservationStatusBadge'

export default function ReservationDetail() {
	const { t } = useTranslation('reservations')
	const { t: tCommon } = useTranslation()
	const { venueId } = useCurrentVenue()
	const { reservationId } = useParams<{ reservationId: string }>()
	const { toast } = useToast()
	const queryClient = useQueryClient()
	const { formatDate, formatTime } = useVenueDateTime()

	// Dialog states
	const [showCancelDialog, setShowCancelDialog] = useState(false)
	const [showNoShowDialog, setShowNoShowDialog] = useState(false)
	const [showRescheduleDialog, setShowRescheduleDialog] = useState(false)
	const [cancelReason, setCancelReason] = useState('')
	const [rescheduleStart, setRescheduleStart] = useState('')
	const [rescheduleEnd, setRescheduleEnd] = useState('')

	// Fetch reservation
	const { data: reservation, isLoading } = useQuery({
		queryKey: ['reservation', venueId, reservationId],
		queryFn: () => reservationService.getReservation(venueId, reservationId!),
		enabled: !!reservationId,
	})

	// Mutations
	const confirmMutation = useMutation({
		mutationFn: () => reservationService.confirmReservation(venueId, reservationId!),
		onSuccess: () => {
			toast({ title: t('toasts.confirmSuccess') })
			queryClient.invalidateQueries({ queryKey: ['reservation', venueId, reservationId] })
			queryClient.invalidateQueries({ queryKey: ['reservations', venueId] })
		},
		onError: (error: any) => {
			toast({ title: tCommon('error'), description: error.response?.data?.message || t('toasts.error'), variant: 'destructive' })
		},
	})

	const checkInMutation = useMutation({
		mutationFn: () => reservationService.checkIn(venueId, reservationId!),
		onSuccess: () => {
			toast({ title: t('toasts.checkInSuccess') })
			queryClient.invalidateQueries({ queryKey: ['reservation', venueId, reservationId] })
			queryClient.invalidateQueries({ queryKey: ['reservations', venueId] })
		},
		onError: (error: any) => {
			toast({ title: tCommon('error'), description: error.response?.data?.message || t('toasts.error'), variant: 'destructive' })
		},
	})

	const completeMutation = useMutation({
		mutationFn: () => reservationService.complete(venueId, reservationId!),
		onSuccess: () => {
			toast({ title: t('toasts.completeSuccess') })
			queryClient.invalidateQueries({ queryKey: ['reservation', venueId, reservationId] })
			queryClient.invalidateQueries({ queryKey: ['reservations', venueId] })
		},
		onError: (error: any) => {
			toast({ title: tCommon('error'), description: error.response?.data?.message || t('toasts.error'), variant: 'destructive' })
		},
	})

	const noShowMutation = useMutation({
		mutationFn: () => reservationService.markNoShow(venueId, reservationId!),
		onSuccess: () => {
			toast({ title: t('toasts.noShowSuccess') })
			setShowNoShowDialog(false)
			queryClient.invalidateQueries({ queryKey: ['reservation', venueId, reservationId] })
			queryClient.invalidateQueries({ queryKey: ['reservations', venueId] })
		},
		onError: (error: any) => {
			toast({ title: tCommon('error'), description: error.response?.data?.message || t('toasts.error'), variant: 'destructive' })
		},
	})

	const cancelMutation = useMutation({
		mutationFn: () => reservationService.cancelReservation(venueId, reservationId!, cancelReason || undefined),
		onSuccess: () => {
			toast({ title: t('toasts.cancelSuccess') })
			setShowCancelDialog(false)
			setCancelReason('')
			queryClient.invalidateQueries({ queryKey: ['reservation', venueId, reservationId] })
			queryClient.invalidateQueries({ queryKey: ['reservations', venueId] })
		},
		onError: (error: any) => {
			toast({ title: tCommon('error'), description: error.response?.data?.message || t('toasts.error'), variant: 'destructive' })
		},
	})

	const rescheduleMutation = useMutation({
		mutationFn: () =>
			reservationService.reschedule(venueId, reservationId!, {
				startsAt: rescheduleStart,
				endsAt: rescheduleEnd,
			}),
		onSuccess: () => {
			toast({ title: t('toasts.rescheduleSuccess') })
			setShowRescheduleDialog(false)
			queryClient.invalidateQueries({ queryKey: ['reservation', venueId, reservationId] })
			queryClient.invalidateQueries({ queryKey: ['reservations', venueId] })
		},
		onError: (error: any) => {
			toast({ title: tCommon('error'), description: error.response?.data?.message || t('toasts.error'), variant: 'destructive' })
		},
	})

	if (isLoading) {
		return (
			<div className="p-4 bg-background text-foreground">
				<div className="animate-pulse space-y-4">
					<div className="h-8 w-64 bg-muted rounded" />
					<div className="h-64 bg-muted rounded-xl" />
				</div>
			</div>
		)
	}

	if (!reservation) {
		return (
			<div className="p-4 bg-background text-foreground">
				<p className="text-muted-foreground">{t('emptyState.title')}</p>
			</div>
		)
	}

	const guestName = reservation.customer
		? `${reservation.customer.firstName} ${reservation.customer.lastName}`
		: reservation.guestName || t('unnamedGuest')

	const guestPhone = reservation.customer?.phone || reservation.guestPhone
	const guestEmail = reservation.customer?.email || reservation.guestEmail

	// Which actions are available based on current status
	const canConfirm = reservation.status === 'PENDING'
	const canCheckIn = reservation.status === 'CONFIRMED'
	const canComplete = reservation.status === 'CHECKED_IN'
	const canNoShow = reservation.status === 'CONFIRMED'
	const canCancel = ['PENDING', 'CONFIRMED'].includes(reservation.status)
	const canReschedule = ['PENDING', 'CONFIRMED'].includes(reservation.status)

	return (
		<div className="p-4 bg-background text-foreground">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<div className="flex items-center gap-3">
						<h1 className="text-2xl font-bold">
							{t('detail.title', { code: reservation.confirmationCode })}
						</h1>
						<ReservationStatusBadge status={reservation.status} />
					</div>
					<p className="text-muted-foreground">{guestName}</p>
				</div>

				{/* Action buttons */}
				<div className="flex items-center gap-2">
					{canConfirm && (
						<Button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
							<Check className="h-4 w-4 mr-2" />
							{t('actions.confirm')}
						</Button>
					)}
					{canCheckIn && (
						<Button onClick={() => checkInMutation.mutate()} disabled={checkInMutation.isPending}>
							<LogIn className="h-4 w-4 mr-2" />
							{t('actions.checkIn')}
						</Button>
					)}
					{canComplete && (
						<Button onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
							<Check className="h-4 w-4 mr-2" />
							{t('actions.complete')}
						</Button>
					)}
					{canReschedule && (
						<Button variant="outline" onClick={() => setShowRescheduleDialog(true)}>
							<CalendarClock className="h-4 w-4 mr-2" />
							{t('actions.reschedule')}
						</Button>
					)}
					{canNoShow && (
						<Button variant="outline" onClick={() => setShowNoShowDialog(true)}>
							<AlertTriangle className="h-4 w-4 mr-2" />
							{t('actions.markNoShow')}
						</Button>
					)}
					{canCancel && (
						<Button variant="destructive" onClick={() => setShowCancelDialog(true)}>
							<X className="h-4 w-4 mr-2" />
							{t('actions.cancel')}
						</Button>
					)}
				</div>
			</div>

			{/* Content grid */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Main info */}
				<div className="lg:col-span-2 space-y-6">
					{/* Reservation Details */}
					<div className="rounded-2xl border border-border/50 bg-card p-6">
						<h3 className="font-semibold mb-4">{t('detail.sections.reservationInfo')}</h3>
						<div className="grid grid-cols-2 gap-4">
							<div className="flex items-center gap-3">
								<CalendarDays className="h-5 w-5 text-muted-foreground" />
								<div>
									<div className="text-sm text-muted-foreground">{t('form.fields.date')}</div>
									<div className="font-medium">{formatDate(reservation.startsAt)}</div>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<Clock className="h-5 w-5 text-muted-foreground" />
								<div>
									<div className="text-sm text-muted-foreground">{t('form.fields.startTime')}</div>
									<div className="font-medium">
										{formatTime(reservation.startsAt)} – {formatTime(reservation.endsAt)}
									</div>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<Clock className="h-5 w-5 text-muted-foreground" />
								<div>
									<div className="text-sm text-muted-foreground">{t('form.fields.duration')}</div>
									<div className="font-medium">{reservation.duration} {t('minutes')}</div>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<Users className="h-5 w-5 text-muted-foreground" />
								<div>
									<div className="text-sm text-muted-foreground">{t('form.fields.partySize')}</div>
									<div className="font-medium">{reservation.partySize}</div>
								</div>
							</div>
							{reservation.table && (
								<div className="flex items-center gap-3">
									<MapPin className="h-5 w-5 text-muted-foreground" />
									<div>
										<div className="text-sm text-muted-foreground">{t('form.fields.table')}</div>
										<div className="font-medium">
											{t('form.tableCapacity', {
												number: reservation.table.number,
												capacity: reservation.table.capacity,
											})}
										</div>
									</div>
								</div>
							)}
							{reservation.assignedStaff && (
								<div className="flex items-center gap-3">
									<User className="h-5 w-5 text-muted-foreground" />
									<div>
										<div className="text-sm text-muted-foreground">{t('form.fields.staff')}</div>
										<div className="font-medium">
											{reservation.assignedStaff.firstName} {reservation.assignedStaff.lastName}
										</div>
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Notes */}
					{(reservation.specialRequests || reservation.internalNotes) && (
						<div className="rounded-2xl border border-border/50 bg-card p-6">
							<h3 className="font-semibold mb-4">{t('detail.sections.notes')}</h3>
							{reservation.specialRequests && (
								<div className="mb-4">
									<div className="text-sm text-muted-foreground mb-1">{t('form.fields.specialRequests')}</div>
									<p>{reservation.specialRequests}</p>
								</div>
							)}
							{reservation.internalNotes && (
								<div>
									<div className="text-sm text-muted-foreground mb-1">{t('form.fields.internalNotes')}</div>
									<p>{reservation.internalNotes}</p>
								</div>
							)}
						</div>
					)}

					{/* Status Timeline */}
					{reservation.statusLog && reservation.statusLog.length > 0 && (
						<div className="rounded-2xl border border-border/50 bg-card p-6">
							<h3 className="font-semibold mb-4">{t('detail.timeline')}</h3>
							<div className="space-y-3">
								{reservation.statusLog.map((entry, i) => (
									<div key={i} className="flex items-start gap-3">
										<div className="w-2 h-2 mt-2 rounded-full bg-primary" />
										<div>
											<div className="font-medium">
												{t(`status.${entry.status}`)}
											</div>
											<div className="text-sm text-muted-foreground">
												{formatDate(entry.at)} {formatTime(entry.at)}
												{entry.by && ` — ${entry.by}`}
											</div>
											{entry.reason && (
												<div className="text-sm text-muted-foreground italic">{entry.reason}</div>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Guest Info */}
					<div className="rounded-2xl border border-border/50 bg-card p-6">
						<h3 className="font-semibold mb-4">{t('detail.sections.guestInfo')}</h3>
						<div className="space-y-3">
							<div className="flex items-center gap-3">
								<User className="h-4 w-4 text-muted-foreground" />
								<span>{guestName}</span>
							</div>
							{guestPhone && (
								<div className="flex items-center gap-3">
									<Phone className="h-4 w-4 text-muted-foreground" />
									<span>{guestPhone}</span>
								</div>
							)}
							{guestEmail && (
								<div className="flex items-center gap-3">
									<Mail className="h-4 w-4 text-muted-foreground" />
									<span>{guestEmail}</span>
								</div>
							)}
						</div>
					</div>

					{/* Meta info */}
					<div className="rounded-2xl border border-border/50 bg-card p-6">
						<h3 className="font-semibold mb-4">{t('detail.confirmationCode')}</h3>
						<div className="font-mono text-lg text-center p-3 bg-muted rounded-lg">
							{reservation.confirmationCode}
						</div>
						<div className="mt-4 space-y-2 text-sm text-muted-foreground">
							<div className="flex justify-between">
								<span>{t('columns.channel')}</span>
								<span>{t(`channel.${reservation.channel}`)}</span>
							</div>
							{reservation.tags.length > 0 && (
								<div className="flex flex-wrap gap-1 mt-2">
									{reservation.tags.map(tag => (
										<Badge key={tag} variant="secondary" className="text-xs">
											{tag}
										</Badge>
									))}
								</div>
							)}
						</div>
					</div>

					{/* Deposit info */}
					{reservation.depositAmount != null && reservation.depositAmount > 0 && (
						<div className="rounded-2xl border border-border/50 bg-card p-6">
							<h3 className="font-semibold mb-4">{t('detail.deposit.title')}</h3>
							<div className="space-y-2">
								<div className="flex justify-between">
									<span className="text-muted-foreground">{t('detail.deposit.amount')}</span>
									<span className="font-medium">${reservation.depositAmount}</span>
								</div>
								{reservation.depositStatus && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">{t('detail.deposit.status')}</span>
										<span className="font-medium">{t(`depositStatus.${reservation.depositStatus}`)}</span>
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Cancel Dialog */}
			<AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('detail.cancel.title')}</AlertDialogTitle>
						<AlertDialogDescription>{t('detail.cancel.description')}</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="py-4">
						<Label>{t('detail.cancel.reasonLabel')}</Label>
						<Textarea
							value={cancelReason}
							onChange={e => setCancelReason(e.target.value)}
							placeholder={t('detail.cancel.reasonPlaceholder')}
							className="mt-2"
						/>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => cancelMutation.mutate()}
							disabled={cancelMutation.isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{t('detail.cancel.confirm')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* No Show Dialog */}
			<AlertDialog open={showNoShowDialog} onOpenChange={setShowNoShowDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('detail.noShow.title')}</AlertDialogTitle>
						<AlertDialogDescription>{t('detail.noShow.description')}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => noShowMutation.mutate()}
							disabled={noShowMutation.isPending}
						>
							{t('actions.markNoShow')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Reschedule — FullScreenModal */}
			<FullScreenModal
				open={showRescheduleDialog}
				onClose={() => setShowRescheduleDialog(false)}
				title={t('detail.reschedule.title')}
				actions={
					<Button
						onClick={() => rescheduleMutation.mutate()}
						disabled={rescheduleMutation.isPending || !rescheduleStart || !rescheduleEnd}
					>
						{rescheduleMutation.isPending ? tCommon('loading') : t('detail.reschedule.confirm')}
					</Button>
				}
			>
				<div className="max-w-2xl mx-auto p-6 space-y-6">
					<div className="space-y-2">
						<Label>{t('detail.reschedule.newStartTime')}</Label>
						<Input
							type="datetime-local"
							value={rescheduleStart}
							onChange={e => setRescheduleStart(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label>{t('detail.reschedule.newEndTime')}</Label>
						<Input
							type="datetime-local"
							value={rescheduleEnd}
							onChange={e => setRescheduleEnd(e.target.value)}
						/>
					</div>
				</div>
			</FullScreenModal>
		</div>
	)
}
