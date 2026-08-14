import { useTranslation } from 'react-i18next'

import { FeatureGate } from '@/components/billing/FeatureGate'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'

export default function Bundles() {
  const { t } = useTranslation('promotions')
  // (venueId entra hasta la Task 7 — declararlo sin uso aquí truena el lint)

  return (
    <FeatureGate feature="PROMOTIONS">
      <div className="p-4 bg-background text-foreground" data-tour="bundles-page">
        <PageTitleWithInfo title={t('bundles.title')} tooltip={t('bundles.subtitle')} />
        {/* Task 7 reemplaza esto con la lista real */}
        <p className="text-muted-foreground mt-6">{t('bundles.list.emptyStateDesc')}</p>
      </div>
    </FeatureGate>
  )
}
