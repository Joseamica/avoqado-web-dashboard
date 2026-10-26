import api from '@/api'
import { Switch } from '@/components/ui/switch'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, ArrowLeftRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface ExchangesSettingProps {
  venueId: string
  effective: boolean
}

interface ToggleVariables {
  next: boolean
  previous: boolean
}

export function ExchangesSetting({ venueId, effective }: ExchangesSettingProps) {
  const { t } = useTranslation('venue')
  const { can } = useAccess()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [enabled, setEnabled] = useState(effective)

  useEffect(() => {
    setEnabled(effective)
  }, [effective])

  const canUpdate = can('venues:update')

  const toggle = useMutation({
    mutationFn: async ({ next }: ToggleVariables) => {
      await api.put(`/api/v1/dashboard/venues/${venueId}/settings`, {
        exchangesEnabled: next,
      })
      return next
    },
    onSuccess: next => {
      toast({
        title: t(next ? 'edit.exchanges.enabledTitle' : 'edit.exchanges.disabledTitle'),
        description: t('edit.exchanges.saved'),
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
    onError: (error: any, variables) => {
      setEnabled(variables.previous)
      const status = error?.response?.status
      const fallback = status === 403 ? t('edit.exchanges.permissionError') : t('edit.exchanges.saveError')
      toast({
        title: t('edit.exchanges.errorTitle'),
        description: status === 403 ? fallback : error?.response?.data?.message || fallback,
        variant: 'destructive',
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
  })

  const handleCheckedChange = (next: boolean) => {
    if (!canUpdate || toggle.isPending) return

    const previous = enabled
    setEnabled(next)
    toggle.mutate({ next, previous })
  }

  return (
    <div data-tour="exchanges-setting" className="rounded-xl border border-input bg-card shadow-sm">
      <div className="flex flex-row items-start justify-between gap-4 p-4">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-base font-medium text-foreground">{t('edit.exchanges.title')}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(enabled ? 'edit.exchanges.enabledDescription' : 'edit.exchanges.disabledDescription')}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-1">
          {toggle.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Switch
            checked={enabled}
            onCheckedChange={handleCheckedChange}
            disabled={!canUpdate || toggle.isPending}
            aria-label={t('edit.exchanges.switchLabel')}
          />
        </div>
      </div>

      {!canUpdate && <p className="mx-4 mb-4 border-t border-border pt-3 text-xs text-muted-foreground">{t('edit.exchanges.readOnly')}</p>}
    </div>
  )
}
