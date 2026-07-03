/**
 * BancosEmptyState — se muestra en las páginas del hub cuando el venue aún no tiene
 * una conexión bancaria CONNECTED. Tres casos:
 *  - `pendingReconnect`: ya hay conexión(es) pero ninguna CONNECTED (NEEDS_REAUTH/PENDING) →
 *    NO abrir un wizard nuevo (crearía duplicada); mandar al Resumen a reconectar/continuar.
 *  - proveedores disponibles: invitar a conectar (wizard embebido).
 *  - sin proveedores (prod sin seed): mensaje "no disponibles", sin CTA.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Landmark, Plus, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { BankConnectWizard } from '@/pages/Venue/components/BankConnectWizard'

export function BancosEmptyState({
  venueId,
  hasProviders,
  pendingReconnect = false,
}: {
  venueId: string
  hasProviders: boolean
  pendingReconnect?: boolean
}) {
  const { t } = useTranslation('financialConnections')
  const { fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const [wizardOpen, setWizardOpen] = useState(false)

  if (pendingReconnect) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-input bg-card px-6 py-14 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <RefreshCw className="h-6 w-6" aria-hidden />
        </span>
        <h2 className="text-lg font-semibold">{t('hub.empty.pendingTitle')}</h2>
        <p className="max-w-[36ch] text-sm text-muted-foreground">{t('hub.empty.pendingDescription')}</p>
        <Button onClick={() => navigate(`${fullBasePath}/bancos`)}>{t('hub.empty.goToResumen')}</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-input bg-card px-6 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
        <Landmark className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold">{t('hub.empty.title')}</h2>
      <p className="max-w-[36ch] text-sm text-muted-foreground">
        {hasProviders ? t('hub.empty.description') : t('hub.empty.noProviders')}
      </p>
      {hasProviders && (
        <Button data-tour="bancos-connect-btn" onClick={() => setWizardOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          {t('hub.empty.connectCta')}
        </Button>
      )}
      <BankConnectWizard open={wizardOpen} onClose={() => setWizardOpen(false)} venueId={venueId} />
    </div>
  )
}

/** Estado de error de red (distinto de "no tienes banco") para las páginas del hub. */
export function BancosErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('financialConnections')
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-input bg-card px-6 py-14 text-center">
      <h2 className="text-lg font-semibold text-destructive">{t('hub.error.title')}</h2>
      <p className="max-w-[36ch] text-sm text-muted-foreground">{t('hub.error.description')}</p>
      <Button variant="outline" onClick={onRetry}>
        {t('hub.error.retry')}
      </Button>
    </div>
  )
}
