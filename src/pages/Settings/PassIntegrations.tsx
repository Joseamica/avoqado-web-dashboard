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
import { passConnectionIsLive } from './components/passes/passConnection'
import { TotalPassCard } from './components/passes/TotalPassCard'
import { WellhubCard } from './components/passes/WellhubCard'

/**
 * Configuración › Integraciones › Pases (Pantalla A del conector de pases, spec §8).
 *
 * El plan se decide DENTRO de la página: <FeatureGate> pinta el paywall con el teaser borroso detrás (como Delivery),
 * y los hooks de use-passes no consultan nada hasta que el plan esté COMPROBADO —la vista general corre tenga o no el
 * plan; lo demás, sólo concedido—. Si la consulta del plan falló (`unresolved`), se dice y se pide recargar: no se
 * adivina (P1-2). El permiso de configurar (`reservations:manage-passes`) sólo cambia la experiencia: sin él todo se ve,
 * en sólo lectura, con la explicación.
 *
 * Pausa suave (R62 del server, decisión del founder): sin el plan no se publican clases nuevas, pero lo publicado y
 * reservado sigue vivo unos días. `planActive` lo dice el server (es quien decide qué se publica). Con algo vivo en
 * TotalPass la página NO se esconde tras el paywall —«apagado se ve y se explica»—: la tarjeta explica la pausa, ofrece
 * mejorar el plan y deja Desconectar (que no tiene candado). Sin nada vivo, el paywall de siempre.
 */
export default function PassIntegrations() {
  const { t } = useTranslation('passes')
  const { venueId } = useCurrentVenue()
  const { can } = useAccess()
  const canManage = can('reservations:manage-passes')
  const { hasFeature, tierLoading, unresolved } = usePassesAccess(venueId ?? undefined)
  const overview = usePassIntegrationsOverview(venueId ?? undefined)
  const totalpass = overview.data?.connections.find(c => c.provider === 'TOTALPASS')
  const planPaused = overview.data?.planActive === false && !!totalpass && passConnectionIsLive(totalpass)

  const page = (
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
      ) : !planPaused && !hasFeature ? (
        // Sin plan y sin nada vivo, tras el paywall: lo que se ve (borroso) es qué hace la función.
        <PassesTeaser />
      ) : overview.isError && !overview.data ? (
        // Sólo si nunca llegaron datos: una recarga fallida (p. ej. tras un conectar sin red) no le quita al dueño la tarjeta,
        // la llave que tecleó ni el mensaje del intento.
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('page.loadError')}</AlertTitle>
          <AlertDescription>{apiErrorDescription(overview.error) || t('errors.generic')}</AlertDescription>
        </Alert>
      ) : !overview.data || !totalpass ? (
        <PassesTeaser />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <TotalPassCard
            venueId={venueId}
            connection={totalpass}
            classProducts={overview.data.classProducts}
            canManage={canManage}
            planPaused={planPaused}
          />
          <WellhubCard />
        </div>
      )}
    </div>
  )

  // Con la pausa a la vista no va el paywall encima: la tarjeta ya dice qué pasó y cómo volver (mejorar el plan) o salir (Desconectar).
  return planPaused ? page : <FeatureGate feature="AGGREGATOR_PASSES">{page}</FeatureGate>
}
