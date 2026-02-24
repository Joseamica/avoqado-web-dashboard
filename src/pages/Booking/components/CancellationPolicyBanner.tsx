import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'

interface CancellationPolicyBannerProps {
	allowCustomerCancel: boolean
	minHoursBeforeStart: number | null
	forfeitDeposit: boolean
	hasDeposit: boolean
}

export function CancellationPolicyBanner({
	allowCustomerCancel,
	minHoursBeforeStart,
	forfeitDeposit,
	hasDeposit,
}: CancellationPolicyBannerProps) {
	const { t } = useTranslation('reservations')

	return (
		<div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
			<Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
			<div className="space-y-0.5">
				<p className="font-medium text-foreground">{t('publicBooking.cancellationPolicy.title')}</p>
				{allowCustomerCancel && minHoursBeforeStart ? (
					<p>{t('publicBooking.cancellationPolicy.allowCancel', { hours: minHoursBeforeStart })}</p>
				) : !allowCustomerCancel ? (
					<p>{t('publicBooking.cancellationPolicy.noCancel')}</p>
				) : null}
				{hasDeposit && forfeitDeposit && (
					<p>{t('publicBooking.cancellationPolicy.depositForfeit')}</p>
				)}
			</div>
		</div>
	)
}
