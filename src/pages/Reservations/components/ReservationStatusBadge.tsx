import { StatusBadge, type StatusVariant } from '@/components/ui/status-badge'
import type { ReservationStatus } from '@/types/reservation'
import { useTranslation } from 'react-i18next'

const statusMap: Record<ReservationStatus, StatusVariant> = {
	PENDING: 'warning',
	CONFIRMED: 'info',
	CHECKED_IN: 'success',
	COMPLETED: 'neutral',
	CANCELLED: 'error',
	NO_SHOW: 'error',
}

interface ReservationStatusBadgeProps {
	status: ReservationStatus
	className?: string
}

export function ReservationStatusBadge({ status, className }: ReservationStatusBadgeProps) {
	const { t } = useTranslation('reservations')
	return (
		<StatusBadge variant={statusMap[status]} className={className}>
			{t(`status.${status}`)}
		</StatusBadge>
	)
}
