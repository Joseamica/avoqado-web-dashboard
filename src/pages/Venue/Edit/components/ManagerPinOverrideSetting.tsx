import api from '@/api'
import { Switch } from '@/components/ui/switch'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface ManagerPinOverrideSettingProps {
  venueId: string
  storedSetting: boolean
}

interface ToggleVariables {
  next: boolean
  previous: boolean
}

/**
 * PIN de autorización de gerente.
 *
 * Con esto encendido, cuando alguien sin permiso intenta una acción, el POS le
 * pide el código de un encargado para autorizarla UNA vez, en lugar de decirle
 * "no tienes permiso" y dejarlo ahí. El token muere al usarse: la terminal nunca
 * queda con permisos abiertos.
 *
 * 🔴 Es el switch CANÓNICO del venue: escribe `VenueSettings.managerPinOverrideEnabled`
 * en el server y el POS sólo lo lee. No se espeja en Android/iOS — no se toca
 * durante el turno desde el piso, se decide una vez en la oficina.
 *
 * 🔴 Core, todos los planes: a diferencia de `CashReconciliationSetting`, este
 * componente NO lleva `useTierFeatureAccess`. Nace APAGADO — ningún local
 * existente amanece pidiendo códigos.
 */
export function ManagerPinOverrideSetting({ venueId, storedSetting }: ManagerPinOverrideSettingProps) {
  const { t } = useTranslation('venue')
  const { can } = useAccess()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [enabled, setEnabled] = useState(storedSetting)

  useEffect(() => {
    setEnabled(storedSetting)
  }, [storedSetting])

  const canUpdate = can('venues:update')

  const toggle = useMutation({
    mutationFn: async ({ next }: ToggleVariables) => {
      await api.put(`/api/v1/dashboard/venues/${venueId}/settings`, {
        managerPinOverrideEnabled: next,
      })
      return next
    },
    onSuccess: next => {
      toast({
        title: t(next ? 'edit.managerPinOverride.enabledTitle' : 'edit.managerPinOverride.disabledTitle'),
        description: t('edit.managerPinOverride.saved'),
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
    onError: (error: any, variables) => {
      // El switch vuelve a donde estaba: nunca puede quedarse pintado como
      // encendido si el server no lo guardó.
      setEnabled(variables.previous)
      const status = error?.response?.status
      const fallback =
        status === 403 ? t('edit.managerPinOverride.permissionError') : t('edit.managerPinOverride.saveError')
      toast({
        title: t('edit.managerPinOverride.errorTitle'),
        description: error?.response?.data?.message || fallback,
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
    <div data-tour="manager-pin-override-setting" className="rounded-xl border border-border/50 bg-card shadow-sm">
      <div className="flex flex-row items-start justify-between gap-4 p-4">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-base font-medium text-foreground">{t('edit.managerPinOverride.title')}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{t('edit.managerPinOverride.description')}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-1">
          {toggle.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Switch
            checked={enabled}
            onCheckedChange={handleCheckedChange}
            disabled={!canUpdate || toggle.isPending}
            aria-label={t('edit.managerPinOverride.switchLabel')}
          />
        </div>
      </div>

      {!canUpdate && (
        <p className="mx-4 mb-4 border-t border-border pt-3 text-xs text-muted-foreground">
          {t('edit.managerPinOverride.readOnly')}
        </p>
      )}
    </div>
  )
}
