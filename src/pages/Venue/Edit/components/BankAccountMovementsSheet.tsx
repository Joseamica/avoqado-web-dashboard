/**
 * BankAccountMovementsSheet — estado de cuenta de una cuenta bancaria conectada.
 * Wrapper delgado: la lógica y el layout viven en <MovementsPanel> (reusado también
 * por la página bancos/movimientos del hub). Aquí solo el Sheet + header.
 */
import { useTranslation } from 'react-i18next'
import { Landmark } from 'lucide-react'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { type FinancialAccountSummary } from '@/services/financialConnection.service'
import { MovementsPanel } from '@/pages/Bancos/components/MovementsPanel'

interface Props {
  open: boolean
  onClose: () => void
  venueId: string
  account: FinancialAccountSummary
}

export function BankAccountMovementsSheet({ open, onClose, venueId, account }: Props) {
  const { t } = useTranslation('financialConnections')

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="space-y-1.5 px-6 pb-4 pt-6">
          <SheetTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-muted-foreground" aria-hidden />
            {t('movements.title')}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{t('movements.subtitle', { label: account.label ?? account.externalId })}</span>
            {account.clabe && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">CLABE {account.clabe}</span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 pb-8">
          {/* enabled=open: el Sheet solo consulta cuando está abierto (comportamiento previo). */}
          <MovementsPanel venueId={venueId} account={account} enabled={open} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
