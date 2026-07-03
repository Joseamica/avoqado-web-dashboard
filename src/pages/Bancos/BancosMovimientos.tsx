/**
 * Bancos → Movimientos. Estado de cuenta a página completa: selector de cuenta conectada
 * + MovementsPanel (totales por categoría + tabla paginada). Gated PRO (teaser visible).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { MovementsPanel } from '@/pages/Bancos/components/MovementsPanel'
import { BancosEmptyState, BancosErrorState } from '@/pages/Bancos/BancosEmptyState'
import { BancosPageHeader } from '@/pages/Bancos/BancosPageHeader'
import { useBancosData } from '@/pages/Bancos/useBancosData'

export default function BancosMovimientos() {
  const { t } = useTranslation('financialConnections')
  // Gatea las queries: un venue sin PRO no golpea el backend ni filtra datos tras el blur.
  const { hasAccess } = useTierFeatureAccess('BANKING_HUB')
  const { venueId, accounts, hasConnection, hasPendingConnection, hasProviders, isLoading, isError, refetch } = useBancosData({
    enabled: hasAccess,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Seleccionar la primera cuenta por defecto cuando cargan (y si la actual desaparece).
  useEffect(() => {
    if (accounts.length === 0) {
      if (selectedId !== null) setSelectedId(null)
      return
    }
    if (!selectedId || !accounts.some(a => a.account.id === selectedId)) {
      setSelectedId(accounts[0].account.id)
    }
  }, [accounts, selectedId])

  const selected = accounts.find(a => a.account.id === selectedId)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 sm:p-6">
      <BancosPageHeader title={t('hub.movements.title')} description={t('hub.movements.description')} />
      <FeatureGate feature="BANKING_HUB">
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : isError ? (
          <BancosErrorState onRetry={refetch} />
        ) : !hasConnection || !venueId ? (
          <BancosEmptyState venueId={venueId ?? ''} hasProviders={hasProviders} pendingReconnect={hasPendingConnection} />
        ) : (
          <div className="flex flex-col gap-5">
            {/* Selector de cuenta (solo si hay más de una) */}
            {accounts.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {accounts.map(({ account }) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setSelectedId(account.id)}
                    className={cn(
                      'cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                      selectedId === account.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {account.label ?? account.externalId}
                  </button>
                ))}
              </div>
            )}
            {selected && <MovementsPanel venueId={venueId} account={selected.account} enabled={hasAccess} />}
          </div>
        )}
      </FeatureGate>
    </div>
  )
}
