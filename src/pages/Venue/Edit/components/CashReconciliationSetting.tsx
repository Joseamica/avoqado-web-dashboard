import api from '@/api'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useAccess } from '@/hooks/use-access'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Banknote, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface CashReconciliationSettingProps {
  venueId: string
  storedSetting: boolean
}

interface ToggleVariables {
  next: boolean
  previous: boolean
}

export function CashReconciliationSetting({ venueId, storedSetting }: CashReconciliationSettingProps) {
  const { t } = useTranslation('venue')
  const { can } = useAccess()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { hasAccess, isResolved, isLoading } = useTierFeatureAccess('CASH_RECONCILIATION')
  const [enabled, setEnabled] = useState(storedSetting)

  useEffect(() => {
    setEnabled(storedSetting)
  }, [storedSetting])

  const canUpdate = can('venues:update')
  const entitlementActive = isResolved && hasAccess

  const toggle = useMutation({
    mutationFn: async ({ next }: ToggleVariables) => {
      await api.put(`/api/v1/dashboard/venues/${venueId}/settings`, {
        cashReconciliationEnabled: next,
      })
      return next
    },
    onSuccess: next => {
      toast({
        title: t(next ? 'edit.cashReconciliation.enabledTitle' : 'edit.cashReconciliation.disabledTitle'),
        description: t('edit.cashReconciliation.saved'),
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
    onError: (error: any, variables) => {
      setEnabled(variables.previous)
      const status = error?.response?.status
      const fallback =
        status === 403
          ? t('edit.cashReconciliation.permissionError')
          : status === 503
            ? t('edit.cashReconciliation.unavailableError')
            : t('edit.cashReconciliation.saveError')
      toast({
        title: t('edit.cashReconciliation.errorTitle'),
        description: error?.response?.data?.message || fallback,
        variant: 'destructive',
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
  })

  // A stored opt-in remains visible after downgrade so it can be explicitly disabled.
  if (!entitlementActive && !storedSetting) return null

  const handleCheckedChange = (next: boolean) => {
    if (!canUpdate || toggle.isPending) return
    if (next && !entitlementActive) return

    const previous = enabled
    setEnabled(next)
    toggle.mutate({ next, previous })
  }

  return (
    <div
      data-tour="cash-reconciliation-setting"
      className="rounded-xl border border-border bg-muted/25 p-3"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Banknote className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{t('edit.cashReconciliation.title')}</p>
              <Badge variant="outline" className="border-primary/30 bg-primary/5 px-2 py-0 text-[10px] text-primary">
                {t('edit.cashReconciliation.proBadge')}
              </Badge>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('edit.cashReconciliation.description')}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-1">
          {(toggle.isPending || isLoading) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Switch
            checked={enabled}
            onCheckedChange={handleCheckedChange}
            disabled={!canUpdate || toggle.isPending || (!enabled && !entitlementActive)}
            aria-label={t('edit.cashReconciliation.switchLabel')}
          />
        </div>
      </div>

      {storedSetting && !entitlementActive && (
        <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-warning-foreground">
          {t('edit.cashReconciliation.downgraded')}
        </p>
      )}

      {!canUpdate && (
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          {t('edit.cashReconciliation.readOnly')}
        </p>
      )}
    </div>
  )
}
