import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function BillingLayout() {
  const { t } = useTranslation('billing')

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="flex flex-row justify-between w-full px-6 py-3 bg-background border-b">
        <h1 className="text-xl font-semibold text-foreground">{t('pageTitle')}</h1>
      </div>

      {/* Horizontal Navigation */}
      <BillingNav className="bg-card h-14" />

      {/* Content - Child routes render here */}
      <div className="flex-1 pb-4">
        <Outlet />
      </div>
    </div>
  )
}

function BillingNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  const { t } = useTranslation('billing')
  const { venueSlug } = useCurrentVenue()
  const basePath = `/venues/${venueSlug}/settings/billing`

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors py-4 border-b-2 cursor-pointer ${
      isActive
        ? 'text-foreground border-primary'
        : 'text-muted-foreground border-transparent hover:text-primary'
    }`

  return (
    <nav className={cn('flex items-center space-x-6 lg:space-x-8 border-b border-border px-6', className)} {...props}>
      <NavLink to={`${basePath}/subscriptions`} className={navLinkClass}>
        {t('tabs.subscriptions')}
      </NavLink>
      <NavLink to={`${basePath}/history`} className={navLinkClass}>
        {t('tabs.history')}
      </NavLink>
      <NavLink to={`${basePath}/payment-methods`} className={navLinkClass}>
        {t('tabs.paymentMethods')}
      </NavLink>
      <NavLink to={`${basePath}/tokens`} className={navLinkClass}>
        {t('tabs.tokens')}
      </NavLink>
    </nav>
  )
}
