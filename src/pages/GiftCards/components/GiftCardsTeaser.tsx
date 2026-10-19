import { useTranslation } from 'react-i18next'
import { WalletCards } from 'lucide-react'

/** Lo que hace la función, en cuatro renglones. Detrás del cartel de <FeatureGate> se ve borroso (molde: PassesTeaser). */
export function GiftCardsTeaser() {
  const { t } = useTranslation('giftCards')
  return (
    <div className="space-y-4 rounded-2xl border border-input bg-card p-6" data-tour="gift-cards-teaser">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <WalletCards className="h-5 w-5" aria-hidden="true" />
        {t('teaser.title')}
      </h2>
      <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        <li>{t('teaser.sell')}</li>
        <li>{t('teaser.pay')}</li>
        <li>{t('teaser.track')}</li>
        <li>{t('teaser.reports')}</li>
      </ul>
    </div>
  )
}
