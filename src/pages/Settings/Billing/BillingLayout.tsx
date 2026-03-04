import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { NavTabs } from '@/components/ui/nav-tabs'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useCurrentVenue } from '@/hooks/use-current-venue'

export default function BillingLayout() {
  const { t } = useTranslation('billing')
  const { fullBasePath } = useCurrentVenue()
  const basePath = `${fullBasePath}/settings/billing`

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="flex flex-row justify-between w-full px-6 py-3 bg-background border-b">
        <PageTitleWithInfo
          title={t('pageTitle')}
          className="text-xl font-semibold text-foreground"
          tooltip={t('info.billing', {
            defaultValue: 'Gestiona suscripciones, historial, metodos de pago y tokens.',
          })}
        />
      </div>

      {/* Horizontal Navigation */}
      <NavTabs
        className="bg-background h-14"
        items={[
          { to: `${basePath}/subscriptions`, label: t('tabs.subscriptions') },
          { to: `${basePath}/history`, label: t('tabs.history') },
          { to: `${basePath}/payment-methods`, label: t('tabs.paymentMethods') },
          { to: `${basePath}/tokens`, label: t('tabs.tokens') },
        ]}
      />

      {/* Content - Child routes render here */}
      <div className="flex-1 pb-4">
        <Outlet />
      </div>
    </div>
  )
}
