import { useTranslation } from 'react-i18next'

interface BookingHeaderProps {
	venueName: string
	logo: string | null
}

export function BookingHeader({ venueName, logo }: BookingHeaderProps) {
	const { t } = useTranslation('reservations')

	return (
		<div className="flex flex-col items-center gap-3 pb-4">
			{logo ? (
				<img src={logo} alt={venueName} className="h-16 w-16 rounded-full object-cover" />
			) : (
				<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
					{venueName.charAt(0).toUpperCase()}
				</div>
			)}
			<div className="text-center">
				<h1 className="text-xl font-semibold">{venueName}</h1>
				<p className="text-sm text-muted-foreground">{t('publicBooking.pageTitle')}</p>
			</div>
		</div>
	)
}
