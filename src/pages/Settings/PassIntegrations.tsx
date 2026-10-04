import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { usePassIntegrationsOverview, usePassesAccess } from '@/hooks/use-passes'
import { apiErrorDescription } from '@/utils/apiError'
import { PassesTeaser } from './components/passes/PassesTeaser'
import { WellhubCard } from './components/passes/WellhubCard'

/**
 * Configuración › Integraciones › Pases (Pantalla A del conector de pases, spec §8).
 *
 * El plan se decide DENTRO de la página: <FeatureGate> pinta el paywall con el teaser borroso detrás (como Delivery),
 * y los hooks de use-passes no consultan nada hasta que el plan esté COMPROBADO —la vista general corre tenga o no el
 * plan (R62, pausa suave); lo demás, sólo concedido—. Sin plan, detrás del paywall va el teaser aunque la vista
 * general haya llegado (la Tarea 5 agrega la tarjeta «pausada por el plan» cuando TotalPass sigue vivo). Si la
 * consulta del plan falló (`unresolved`), se dice y se pide recargar: no se adivina (P1-2). El permiso de configurar
 * (`reservations:manage-passes`) sólo cambia la experiencia: sin él todo se ve, en sólo lectura, con la explicación.
 */
export default function PassIntegrations() {
  const { t } = useTranslation('passes')
  const { venueId } = useCurrentVenue()
  const { can } = useAccess()
  const canManage = can('reservations:manage-passes')
  const { hasFeature, tierLoading, unresolved } = usePassesAccess(venueId ?? undefined)
  const overview = usePassIntegrationsOverview(venueId ?? undefined)
  const totalpass = overview.data?.connections.find(c => c.provider === 'TOTALPASS')

  return (
    <FeatureGate feature="AGGREGATOR_PASSES">
      <div className="space-y-6 p-6" data-tour="pass-integrations-page">
        <div>
          <PageTitleWithInfo title={t('page.title')} className="text-2xl font-bold text-foreground" tooltip={t('page.info')} />
          <p className="mt-1 text-muted-foreground">{t('page.subtitle')}</p>
        </div>

        {!canManage && (
          <Alert className="border-input bg-muted/40">
            <AlertDescription className="text-sm text-muted-foreground">{t('page.readOnly')}</AlertDescription>
          </Alert>
        )}

        {unresolved ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{t('errors.planUnresolved')}</AlertDescription>
          </Alert>
        ) : tierLoading || overview.isLoading || !venueId ? (
          <div className="flex items-center justify-center py-16" role="status" aria-label={t('common:loading')}>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasFeature ? (
          // Sin plan, tras el paywall: lo que se ve (borroso) es qué hace la función, aunque la vista general sí llegó (R62).
          <PassesTeaser />
        ) : overview.isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('page.loadError')}</AlertTitle>
            <AlertDescription>{apiErrorDescription(overview.error) || t('errors.generic')}</AlertDescription>
          </Alert>
        ) : !overview.data || !totalpass ? (
          <PassesTeaser />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <WellhubCard />
          </div>
        )}
      </div>
    </FeatureGate>
  )
}
