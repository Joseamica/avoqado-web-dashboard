/**
 * Bancos → Transferencias internas. Traspaso MG→MG entre cuentas del mismo proveedor.
 * Solo cuentas de NEGOCIO (MERCHANT) — las personales (CLIENT) no transfieren (guard backend + UI).
 * Reusa BankInternalTransferDialog. Gated PRO (teaser visible).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Currency } from '@/utils/currency'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { BankInternalTransferDialog } from '@/pages/Venue/Edit/components/BankInternalTransferDialog'
import { BancosEmptyState, BancosErrorState } from '@/pages/Bancos/BancosEmptyState'
import { BancosPageHeader } from '@/pages/Bancos/BancosPageHeader'
import { useBancosData } from '@/pages/Bancos/useBancosData'
import { type FinancialAccountSummary } from '@/services/financialConnection.service'

export default function BancosTransferencias() {
  const { t } = useTranslation('financialConnections')
  const { hasAccess } = useTierFeatureAccess('BANKING_HUB')
  const { venueId, accounts, hasConnection, hasPendingConnection, hasProviders, isLoading, isError, refetch } = useBancosData({
    enabled: hasAccess,
  })
  const [transferAccount, setTransferAccount] = useState<FinancialAccountSummary | null>(null)

  // Solo cuentas de conexiones MERCHANT pueden transferir.
  const merchantAccounts = accounts.filter(a => a.connection.accountKind === 'MERCHANT')

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 sm:p-6">
      <BancosPageHeader title={t('hub.transfers.title')} description={t('hub.transfers.description')} />
      <FeatureGate feature="BANKING_HUB">
        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : isError ? (
          <BancosErrorState onRetry={refetch} />
        ) : !hasConnection || !venueId ? (
          <BancosEmptyState venueId={venueId ?? ''} hasProviders={hasProviders} pendingReconnect={hasPendingConnection} />
        ) : merchantAccounts.length === 0 ? (
          <div className="rounded-xl border border-input bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
            {t('hub.transfers.merchantOnly')}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {merchantAccounts.map(({ account }) => (
              <div key={account.id} className="flex items-center justify-between gap-3 rounded-lg border border-input p-4">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{account.label ?? account.externalId}</span>
                  {account.clabe && <span className="text-xs text-muted-foreground">CLABE {account.clabe}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-semibold tabular-nums">
                    {account.lastBalance != null ? Currency(account.lastBalance) : t('account.noBalance')}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setTransferAccount(account)}>
                    <ArrowUpRight className="mr-1 h-4 w-4" />
                    {t('transfer.button')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </FeatureGate>

      {transferAccount && venueId && (
        <BankInternalTransferDialog
          open={!!transferAccount}
          onClose={() => setTransferAccount(null)}
          venueId={venueId}
          account={transferAccount}
        />
      )}
    </div>
  )
}
