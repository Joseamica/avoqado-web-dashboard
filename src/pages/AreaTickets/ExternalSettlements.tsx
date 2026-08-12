import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, TicketCheck } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getAreaTicketOverview } from '@/services/areaTickets.service'
import { IncidentsQueue } from './components/IncidentsQueue'
import { SettlementsQueue } from './components/SettlementsQueue'

const VALID_TABS = ['settlements', 'incidents'] as const
type TabValue = (typeof VALID_TABS)[number]

const tabTriggerClass =
  'group rounded-full border border-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/80 hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background'

const apiError = (error: any, fallback: string): string => error?.response?.data?.message ?? error?.response?.data?.error ?? fallback

/**
 * "Cobros por confirmar" + "Incidencias" (§caja externa fase 1, Task 15) — las dos
 * colas de trabajo que le faltaban al dashboard para OPERAR la ruta externa (otro
 * POS cobra en su propia caja; Avoqado nunca ve ese dinero). Catorce tareas
 * construyeron la ruta y el switch para encenderla; sin esta pantalla, las
 * incidencias que abre el job de conciliación quedan invisibles.
 *
 * SOLO lectura — ninguna acción de aquí confirma, resuelve ni reabre nada. Y los
 * importes que se muestran son SIEMPRE de referencia (lo que Avoqado calculó para
 * el vale), nunca ventas: ese dinero entró en la caja de OTRO punto de venta.
 */
export default function ExternalSettlements() {
  const { t } = useTranslation('settings')
  const { venueId } = useCurrentVenue()
  const location = useLocation()
  const navigate = useNavigate()

  const getTabFromHash = (): TabValue => {
    const hash = location.hash.replace('#', '')
    return (VALID_TABS as readonly string[]).includes(hash) ? (hash as TabValue) : 'settlements'
  }

  const [activeTab, setActiveTab] = useState<TabValue>(getTabFromHash)

  useEffect(() => {
    const tabFromHash = getTabFromHash()
    if (tabFromHash !== activeTab) setActiveTab(tabFromHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the hash should re-sync the tab
  }, [location.hash])

  const handleTabChange = (value: string) => {
    const tab = value as TabValue
    setActiveTab(tab)
    navigate(`${location.pathname}#${tab}`, { replace: true })
  }

  // Áreas compartidas entre las dos colas (filtro "Área") — mismo endpoint que ya
  // usa la pestaña de configuración, no hace falta uno nuevo.
  const overviewQuery = useQuery({
    queryKey: ['area-ticket-overview', venueId],
    queryFn: () => getAreaTicketOverview(venueId!),
    enabled: Boolean(venueId),
  })

  if (!venueId) return null

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <TicketCheck className="h-6 w-6" />
          {t('areaTickets.externalSettlements.title')}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t('areaTickets.externalSettlements.subtitle')}</p>
      </div>

      {overviewQuery.isLoading && (
        <div className="flex min-h-40 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> {t('areaTickets.externalSettlements.loading')}
        </div>
      )}

      {overviewQuery.isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('areaTickets.externalSettlements.loadError')}</AlertTitle>
          <AlertDescription>{apiError(overviewQuery.error, t('areaTickets.externalSettlements.loadErrorFallback'))}</AlertDescription>
        </Alert>
      )}

      {!overviewQuery.isLoading && !overviewQuery.isError && (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="inline-flex h-auto flex-wrap items-center justify-start rounded-full border border-border bg-muted/60 p-1 text-muted-foreground">
            <TabsTrigger value="settlements" className={tabTriggerClass} data-tour="area-external-settlements-tab-settlements">
              {t('areaTickets.externalSettlements.tabs.settlements')}
            </TabsTrigger>
            <TabsTrigger value="incidents" className={tabTriggerClass} data-tour="area-external-settlements-tab-incidents">
              {t('areaTickets.externalSettlements.tabs.incidents')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settlements" className="mt-6">
            <SettlementsQueue venueId={venueId} areas={overviewQuery.data?.areas ?? []} />
          </TabsContent>
          <TabsContent value="incidents" className="mt-6">
            <IncidentsQueue venueId={venueId} areas={overviewQuery.data?.areas ?? []} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
