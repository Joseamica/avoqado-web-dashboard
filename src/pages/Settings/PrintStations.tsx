import { useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTerminology } from '@/hooks/use-terminology'
import { StationsTab } from './components/printStations/StationsTab'
import { PrintersTab } from './components/printStations/PrintersTab'
import { GatewayTab } from './components/printStations/GatewayTab'
import { RoutingTab } from './components/printStations/RoutingTab'

const triggerClass =
  'group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground'

/**
 * Impresoras y estaciones (print stations) — FREE. Configura el ruteo de comandas
 * de cocina/barra: estaciones, impresoras de red, gateway y ruteo por categoría/producto.
 * Permiso: printers:read (ver) / printers:manage (mutar). Sin FeatureGate.
 */
export default function PrintStations() {
  const { t } = useTranslation('printStations')
  const { term } = useTerminology()
  const { venueId } = useCurrentVenue()

  if (!venueId) return null

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Printer className="h-6 w-6" /> {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description', { kitchen: term('kitchen') })}</p>
      </div>

      <Tabs defaultValue="stations">
        <TabsList className="inline-flex h-10 items-center justify-start rounded-full border border-border bg-muted/60 px-1 py-1 text-muted-foreground">
          <TabsTrigger value="stations" className={triggerClass}>
            {t('tabs.stations')}
          </TabsTrigger>
          <TabsTrigger value="printers" className={triggerClass}>
            {t('tabs.printers')}
          </TabsTrigger>
          <TabsTrigger value="gateway" className={triggerClass}>
            {t('tabs.gateway')}
          </TabsTrigger>
          <TabsTrigger value="routing" className={triggerClass}>
            {t('tabs.routing')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stations" className="mt-6">
          <StationsTab venueId={venueId} />
        </TabsContent>
        <TabsContent value="printers" className="mt-6">
          <PrintersTab venueId={venueId} />
        </TabsContent>
        <TabsContent value="gateway" className="mt-6">
          <GatewayTab venueId={venueId} />
        </TabsContent>
        <TabsContent value="routing" className="mt-6">
          <RoutingTab venueId={venueId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
