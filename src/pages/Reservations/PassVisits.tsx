import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Ticket } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { FilterPill, SingleSelectFilterContent } from '@/components/filters'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { usePassIntegrationsOverview, usePassesAccess } from '@/hooks/use-passes'
import { DateRangeFilterContent, type DateRangeValue } from '@/pages/AreaTickets/components/DateRangeFilterContent'
import type { PassProvider } from '@/types/passes'
import { PassVisitsList } from './components/passes/PassVisitsList'
import { PassVisitsSummary } from './components/passes/PassVisitsSummary'
import { PASS_VISIT_TABS, type PassVisitTab } from './components/passes/passVisitTabs'

const VALID_TABS = Object.keys(PASS_VISIT_TABS) as PassVisitTab[]

const tabTriggerClass =
  'group rounded-full border border-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/80 hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background'

/**
 * Reservaciones › Pases (Pantalla B, spec §8): el equivalente a la pantalla de check-ins de buq. Pestañas píldora en
 * el hash (como CommissionsPage / ExternalSettlements), filtros Stripe-style compartidos por las pestañas, y el
 * reporte del mes arriba (Tarea 9). Si la consulta del plan falló (`unresolved`), se dice y no se monta la lista (P1-2).
 */
export default function PassVisits() {
  const { t } = useTranslation('passes')
  const { venueId } = useCurrentVenue()
  const { unresolved } = usePassesAccess(venueId ?? undefined)
  // Misma clave que la lista (TanStack la pide una vez). Sólo se ofrecen los proveedores que tienen conexión: Wellhub sigue
  // «muy pronto» y no se presenta como si funcionara (H6); con uno solo, el filtro de proveedor no aporta y no se pinta.
  const overview = usePassIntegrationsOverview(venueId ?? undefined)
  const location = useLocation()
  const navigate = useNavigate()

  const getTabFromHash = (): PassVisitTab => {
    const hash = location.hash.replace('#', '')
    return (VALID_TABS as string[]).includes(hash) ? (hash as PassVisitTab) : 'pending'
  }
  const [activeTab, setActiveTab] = useState<PassVisitTab>(getTabFromHash)
  useEffect(() => {
    const tabFromHash = getTabFromHash()
    if (tabFromHash !== activeTab) setActiveTab(tabFromHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the hash should re-sync the tab
  }, [location.hash])
  const handleTabChange = (value: string) => {
    const tab = value as PassVisitTab
    setActiveTab(tab)
    navigate(`${location.pathname}#${tab}`, { replace: true })
  }

  const [provider, setProvider] = useState<PassProvider | null>(null)
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: null, to: null })
  const providerOptions = useMemo(
    () =>
      (overview.data?.connections ?? [])
        .filter(c => c.status !== null)
        .map(c => ({ value: c.provider, label: t(`providers.${c.provider}`) })),
    [overview.data, t],
  )
  const dateLabel = dateRange.from || dateRange.to ? [dateRange.from, dateRange.to].filter(Boolean).join(' – ') : null

  if (!venueId) return null

  return (
    <FeatureGate feature="AGGREGATOR_PASSES">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-6" data-tour="pass-visits-page">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Ticket className="h-6 w-6" />
            {t('visits.title')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t('visits.subtitle')}</p>
        </div>

        {unresolved ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{t('errors.planUnresolved')}</AlertDescription>
          </Alert>
        ) : (
          <>
            {/* key: el mes por defecto sale de la zona del venue; otra sucursal arranca en SU mes actual (switchVenue no desmonta). */}
            <PassVisitsSummary key={`summary-${venueId}`} venueId={venueId} />

            <div className="flex flex-wrap items-center gap-2">
              {providerOptions.length > 1 && (
                <FilterPill
                  label={t('visits.filters.provider')}
                  activeLabel={provider ? t(`providers.${provider}`) : null}
                  onClear={() => setProvider(null)}
                >
                  <SingleSelectFilterContent
                    title={t('visits.filters.provider')}
                    options={providerOptions}
                    selectedValue={provider}
                    onSelect={value => setProvider(value as PassProvider)}
                  />
                </FilterPill>
              )}
              <FilterPill label={t('visits.filters.date')} activeLabel={dateLabel} onClear={() => setDateRange({ from: null, to: null })}>
                <DateRangeFilterContent
                  title={t('visits.filters.date')}
                  value={dateRange}
                  onApply={setDateRange}
                  labels={{
                    from: t('visits.filters.dateFrom'),
                    to: t('visits.filters.dateTo'),
                    apply: t('visits.filters.apply'),
                    clear: t('visits.filters.clear'),
                  }}
                />
              </FilterPill>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="inline-flex h-auto flex-wrap items-center justify-start rounded-full border border-border bg-muted/60 p-1 text-muted-foreground">
                {VALID_TABS.map(tab => (
                  <TabsTrigger key={tab} value={tab} className={tabTriggerClass} data-tour={`passes-visits-tab-${tab}`}>
                    {t(`visits.tabs.${tab}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* key: el aviso «confirmación solicitada» y el diálogo de rechazo no cruzan a otra sucursal (switchVenue no desmonta). */}
            <PassVisitsList key={venueId} venueId={venueId} tab={activeTab} provider={provider} dateRange={dateRange} />
          </>
        )}
      </div>
    </FeatureGate>
  )
}
