/**
 * Bancos → Resumen. Página principal del hub: lista las conexiones bancarias del venue
 * con sus cuentas, saldos en vivo, y accesos a movimientos/transferir/conectar.
 * Reusa BankAccountsSection (panel completo ya existente) con su header propio oculto —
 * el CTA "Conectar banco" vive en el header de la página (derecha). Gated PRO (teaser visible):
 * cuando el venue no tiene BANKING_HUB, la query se apaga (no golpea el backend ni filtra
 * datos reales tras el blur del FeatureGate) y el CTA no se muestra.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { BankAccountsSection } from '@/pages/Venue/Edit/components/BankAccountsSection'
import { BankConnectWizard } from '@/pages/Venue/components/BankConnectWizard'
import { BancosPageHeader } from '@/pages/Bancos/BancosPageHeader'

export default function BancosResumen() {
  const { t } = useTranslation('financialConnections')
  const { venueId } = useCurrentVenue()
  const { hasAccess } = useTierFeatureAccess('BANKING_HUB')
  const [wizardOpen, setWizardOpen] = useState(false)

  // El CTA solo se muestra con acceso PRO (para un venue Free el hub va tras el blur del gate;
  // un botón visible aquí dejaría conectar sin plan).
  const connectAction =
    hasAccess && venueId ? (
      <Button data-tour="bancos-connect-btn" onClick={() => setWizardOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        {t('section.connectCta')}
      </Button>
    ) : undefined

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 sm:p-6">
      <BancosPageHeader title={t('hub.overview.title')} description={t('hub.overview.description')} actions={connectAction} />
      <FeatureGate feature="BANKING_HUB">
        <BankAccountsSection enabled={hasAccess} hideHeader />
      </FeatureGate>
      {venueId && <BankConnectWizard open={wizardOpen} onClose={() => setWizardOpen(false)} venueId={venueId} />}
    </div>
  )
}
