import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Bell,
  CreditCard,
  Link2,
  Lock,
  Printer,
  ScrollText,
  Shield,
  SlidersHorizontal,
  Star,
  Store,
  User,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useAccess } from '@/hooks/use-access'
import { useVenueTier } from '@/hooks/use-tier-feature-access'
import { cn } from '@/lib/utils'

interface HubItem {
  to: string
  label: string
  icon: LucideIcon
  dataTour: string
  /** Show the tier Star badge (gating itself stays inside the page) */
  premiumLocked?: boolean
}

const ADMIN_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN']

function HubNavLink({ item }: { item: HubItem }) {
  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
      isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
    )
  return (
    <NavLink to={item.to} className={linkClasses} data-tour={item.dataTour}>
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.premiumLocked && <Star className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-400" />}
    </NavLink>
  )
}

export default function SettingsLayout() {
  const { t } = useTranslation('settings')
  const { fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const { can, role, isWhiteLabelEnabled, canFeature } = useAccess()
  const { hasFeatureAccess } = useVenueTier()

  const isAdmin = ADMIN_ROLES.includes(role ?? '')
  const showVenueGroup = !isWhiteLabelEnabled || canFeature('AVOQADO_SETTINGS')

  const accountItems: HubItem[] = [
    { to: 'profile', label: t('hub.items.profile'), icon: User, dataTour: 'settings-nav-profile' },
    { to: 'security', label: t('hub.items.security'), icon: Lock, dataTour: 'settings-nav-security' },
    { to: 'preferences', label: t('hub.items.preferences'), icon: SlidersHorizontal, dataTour: 'settings-nav-preferences' },
    { to: 'notifications', label: t('hub.items.notifications'), icon: Bell, dataTour: 'settings-nav-notifications' },
  ]

  const venueItems: HubItem[] = showVenueGroup
    ? [
        ...(isAdmin
          ? [
              { to: 'local', label: t('hub.items.venueInfo'), icon: Store, dataTour: 'settings-nav-venue-info' },
              { to: 'integrations', label: t('hub.items.integrations'), icon: Link2, dataTour: 'settings-nav-integrations' },
              { to: 'role-permissions', label: t('hub.items.roles'), icon: Shield, dataTour: 'settings-nav-roles' },
            ]
          : []),
        ...(isAdmin && can('billing:read')
          ? [{ to: 'billing', label: t('hub.items.billing'), icon: CreditCard, dataTour: 'settings-nav-billing' }]
          : []),
        ...(can('activity:read')
          ? [
              {
                to: 'activity-log',
                label: t('hub.items.activityLog'),
                icon: ScrollText,
                dataTour: 'settings-nav-activity-log',
                premiumLocked: !hasFeatureAccess('VENUE_AUDIT_LOG'),
              },
            ]
          : []),
        ...(can('printers:read')
          ? [{ to: 'print-stations', label: t('hub.items.printStations'), icon: Printer, dataTour: 'settings-nav-print-stations' }]
          : []),
      ]
    : []

  const superadminItems: HubItem[] =
    role === 'SUPERADMIN'
      ? [
          { to: `${fullBasePath}/payment-config`, label: t('hub.items.paymentConfig'), icon: Shield, dataTour: 'settings-nav-sa-payment-config' },
          { to: `${fullBasePath}/ecommerce-merchants`, label: t('hub.items.ecommerceChannels'), icon: Shield, dataTour: 'settings-nav-sa-ecommerce' },
          { to: `${fullBasePath}/merchant-accounts`, label: t('hub.items.merchantAccounts'), icon: Shield, dataTour: 'settings-nav-sa-merchants' },
        ]
      : []

  const groups = [
    { key: 'account', label: t('hub.groups.account'), items: accountItems, superadmin: false },
    { key: 'venue', label: t('hub.groups.venue'), items: venueItems, superadmin: false },
    { key: 'superadmin', label: t('hub.groups.superadmin'), items: superadminItems, superadmin: true },
  ].filter(g => g.items.length > 0)

  const nav = (
    <>
      {groups.map(group => (
        <div key={group.key} className="mb-4">
          <p
            className={cn(
              'px-2.5 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider',
              group.superadmin
                ? 'bg-gradient-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent'
                : 'text-muted-foreground/70',
            )}
          >
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map(item => (
              <HubNavLink key={item.to} item={item} />
            ))}
          </div>
        </div>
      ))}
    </>
  )

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop nav */}
      <aside className="hidden w-60 shrink-0 border-r border-border px-3 py-4 md:block" data-tour="settings-hub-nav">
        <Button
          variant="ghost"
          className="mb-2 w-full justify-start gap-2 px-2.5 font-semibold"
          onClick={() => navigate(`${fullBasePath}/home`)}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('hub.title')}
        </Button>
        {nav}
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile nav: horizontal scroll strip */}
        <div className="border-b border-border px-2 py-2 md:hidden">
          <div className="flex items-center gap-1 overflow-x-auto">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={t('hub.back')}
              onClick={() => navigate(`${fullBasePath}/home`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {groups.flatMap(g => g.items).map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                data-tour={item.dataTour}
                className={({ isActive }) =>
                  cn(
                    'flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-sm',
                    isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                {item.label}
                {item.premiumLocked && <Star className="ml-1 inline h-3 w-3 text-emerald-400" />}
              </NavLink>
            ))}
          </div>
        </div>

        <Outlet />
      </div>
    </div>
  )
}
