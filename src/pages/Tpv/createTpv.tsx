import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { TerminalPurchaseWizard } from './components/purchase-wizard/TerminalPurchaseWizard'

export default function CreateTpv() {
  const { t } = useTranslation('tpv')
  const location = useLocation()

  const [wizardOpen, setWizardOpen] = useState(false)

  // Auto-open wizard when page loads
  useEffect(() => {
    setWizardOpen(true)
  }, [])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-semibold">{t('create.title')}</h1>
        <p className="text-muted-foreground">{t('purchaseWizard.subtitle')}</p>
      </div>

      <TerminalPurchaseWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSuccess={() => {
          // Wizard handles navigation
        }}
      />
    </div>
  )
}
