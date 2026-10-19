import { ShoppingBag } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import { FeatureGate } from '@/components/billing/FeatureGate'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useOnlineOrderingStatus } from '@/hooks/use-online-ordering-status'
import { InboxTab } from './components/InboxTab'
import { MenuTab } from './components/MenuTab'
import { SettingsTab } from './components/SettingsTab'

const TABS = ['bandeja', 'menu', 'configuracion'] as const
type TabValue = (typeof TABS)[number]

const pill = 'rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background'

/**
 * Pedidos en línea (Ventas): Bandeja, Menú en línea y Configuración.
 * 🔴 La Bandeja NO lleva candado de plan (los pedidos que ya llegaron se atienden aunque venza el plan);
 * Menú en línea y Configuración van dentro de <FeatureGate> y sólo con `online-orders:manage`.
 */
export default function OnlineOrderingPage() {
  const { t } = useTranslation('onlineOrdering')
  const { hasPlan, canManage } = useOnlineOrderingStatus()
  const location = useLocation()
  const navigate = useNavigate()

  const hash = location.hash.replace('#', '')
  const tab: TabValue = (TABS as readonly string[]).includes(hash) ? (hash as TabValue) : 'bandeja'

  const setTab = (value: string) => navigate(`${location.pathname}#${value}`, { replace: true })

  const needManage = (
    <p className="rounded-xl border border-input bg-muted/40 p-4 text-sm text-muted-foreground">{t('page.needManage')}</p>
  )

  return (
    <div className="space-y-6 bg-background p-4 text-foreground">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t('page.title')}</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-full border border-border bg-muted/60 px-1 py-1">
          <TabsTrigger value="bandeja" className={pill} data-tour="online-ordering-tab-tray">
            {t('tabs.tray')}
          </TabsTrigger>
          <TabsTrigger value="menu" className={pill} data-tour="online-ordering-tab-menu">
            {t('tabs.menu')}
          </TabsTrigger>
          <TabsTrigger value="configuracion" className={pill} data-tour="online-ordering-tab-settings">
            {t('tabs.settings')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'bandeja' && (
        <div data-testid="tab-content-tray" className="space-y-4">
          {!hasPlan && (
            <p className="rounded-xl border border-input bg-muted/40 p-4 text-sm text-muted-foreground">{t('page.noPlanNotice')}</p>
          )}
          {/* El ÚNICO sondeo de la bandeja vive en InboxTab: sólo corre con esta pestaña montada. */}
          <InboxTab />
        </div>
      )}

      {tab === 'menu' && (
        <FeatureGate feature="ONLINE_ORDERING">
          {canManage ? <div data-testid="tab-content-menu"><MenuTab /></div> : needManage}
        </FeatureGate>
      )}

      {tab === 'configuracion' && (
        <FeatureGate feature="ONLINE_ORDERING">
          {canManage ? <div data-testid="tab-content-settings"><SettingsTab /></div> : needManage}
        </FeatureGate>
      )}
    </div>
  )
}
