import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, ArrowRightLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import {
  updateAreaSettlementRoute,
  type ExternalConfirmationMode,
  type ExternalDeliveryTracking,
  type ExternalOfflinePolicy,
  type FulfillmentArea,
  type UpdateAreaSettlementRouteInput,
} from '@/services/areaTickets.service'

const apiError = (error: any, fallback: string): string => error?.response?.data?.message ?? error?.response?.data?.error ?? fallback

// Los mismos defaults que `@default(...)` en el schema del server (AVOQADO / MANUAL /
// BLOCK / TRACKED) — a lo que vuelve un área al apagar la ruta externa.
const AVOQADO_DEFAULTS: UpdateAreaSettlementRouteInput = {
  settlementRoute: 'AVOQADO',
  externalConfirmationMode: 'MANUAL',
  externalOfflinePolicy: 'BLOCK',
  externalDeliveryTracking: 'TRACKED',
}

/**
 * Switch canónico de la ruta de cobro de UN área (§caja externa fase 1). Las apps
 * (Android/iOS/TPV) sólo LEEN este valor — este card es lo único que lo escribe.
 *
 * Apagado (AVOQADO, default) es lo que hoy hace todo venue: Avoqado cobra y registra
 * los vales del área. Encenderlo (EXTERNAL) es una decisión de dinero — otra caja
 * cobra por su cuenta y Avoqado deja de registrar esas ventas — por eso pide
 * confirmación explícita y nunca se enciende solo.
 */
export function ExternalRouteAreaCard({ venueId, area, onSaved }: { venueId: string; area: FulfillmentArea; onSaved: () => void }) {
  const { t } = useTranslation('settings')
  const { toast } = useToast()
  const { can } = useAccess()
  const canConfigure = can('area-tickets:configure')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const isExternal = area.settlementRoute === 'EXTERNAL'

  const mutation = useMutation({
    mutationFn: (input: UpdateAreaSettlementRouteInput) => updateAreaSettlementRoute(venueId, area.id, input),
    onSuccess: () => {
      toast({ title: t('areaTickets.externalRoute.saved') })
      onSaved()
    },
    onError: (error: any) =>
      toast({
        title: t('areaTickets.externalRoute.saveError'),
        description: apiError(error, t('areaTickets.externalRoute.saveErrorFallback')),
        variant: 'destructive',
      }),
  })

  const handleToggle = (checked: boolean) => {
    if (checked) {
      // Encender SIEMPRE pasa por el diálogo — nunca se prende directo desde el switch.
      setConfirmOpen(true)
      return
    }
    // Apagar regresa el cobro a Avoqado: no es la misma decisión de riesgo que
    // encenderlo (nadie pierde visibilidad de ventas), así que no repite el diálogo.
    mutation.mutate(AVOQADO_DEFAULTS)
  }

  const confirmEnable = () => {
    setConfirmOpen(false)
    mutation.mutate({
      settlementRoute: 'EXTERNAL',
      externalConfirmationMode: area.externalConfirmationMode,
      externalOfflinePolicy: area.externalOfflinePolicy,
      externalDeliveryTracking: area.externalDeliveryTracking,
    })
  }

  // Las cuatro políticas viajan siempre juntas (el endpoint las exige todas) — cada
  // Select cambia SU campo y reenvía los otros tres tal como están hoy en `area`.
  const savePolicy = (
    field: 'externalConfirmationMode' | 'externalOfflinePolicy' | 'externalDeliveryTracking',
    value: ExternalConfirmationMode | ExternalOfflinePolicy | ExternalDeliveryTracking,
  ) => {
    mutation.mutate({
      settlementRoute: 'EXTERNAL',
      externalConfirmationMode: field === 'externalConfirmationMode' ? (value as ExternalConfirmationMode) : area.externalConfirmationMode,
      externalOfflinePolicy: field === 'externalOfflinePolicy' ? (value as ExternalOfflinePolicy) : area.externalOfflinePolicy,
      externalDeliveryTracking:
        field === 'externalDeliveryTracking' ? (value as ExternalDeliveryTracking) : area.externalDeliveryTracking,
    })
  }

  // Mientras CUALQUIER PATCH de este área está en vuelo, todo el card se congela —
  // los tres Select comparten una sola mutation y podrían pisarse con valores viejos
  // si se dispara una segunda escritura antes de que la primera confirme.
  const disabled = !canConfigure || mutation.isPending

  return (
    <>
      <Card className="border-input shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">{area.name}</CardTitle>
              <CardDescription>{t('areaTickets.externalRoute.cardSubtitle')}</CardDescription>
            </div>
            <Badge variant={isExternal ? 'secondary' : 'outline'} className="gap-1.5">
              <ArrowRightLeft className="h-3 w-3" />
              {isExternal ? t('areaTickets.externalRoute.statusExternal') : t('areaTickets.externalRoute.statusAvoqado')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex min-h-16 items-center justify-between gap-6 rounded-lg border border-input bg-muted/40 px-4 py-3">
            <div className="space-y-0.5">
              <p className="font-medium">{t('areaTickets.externalRoute.toggleLabel')}</p>
              <p className="text-sm text-muted-foreground">{t('areaTickets.externalRoute.toggleDescription')}</p>
            </div>
            <Switch checked={isExternal} disabled={disabled} onCheckedChange={handleToggle} data-tour="area-external-route-toggle" />
          </div>
          {!canConfigure && <p className="text-sm text-amber-600">{t('areaTickets.externalRoute.noPermission')}</p>}

          {!isExternal && <p className="text-xs text-muted-foreground">{t('areaTickets.externalRoute.policiesDisabledNote')}</p>}

          <div className="grid gap-3 md:grid-cols-3" data-tour="area-external-route-policies">
            <div className="space-y-1.5">
              <Label>{t('areaTickets.externalRoute.confirmationMode.label')}</Label>
              <Select
                value={area.externalConfirmationMode}
                disabled={disabled || !isExternal}
                onValueChange={(value: ExternalConfirmationMode) => savePolicy('externalConfirmationMode', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">{t('areaTickets.externalRoute.confirmationMode.manual')}</SelectItem>
                  <SelectItem value="ASSUME_ON_PRINT">{t('areaTickets.externalRoute.confirmationMode.assumeOnPrint')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {area.externalConfirmationMode === 'MANUAL'
                  ? t('areaTickets.externalRoute.confirmationMode.manualHint')
                  : t('areaTickets.externalRoute.confirmationMode.assumeOnPrintHint')}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>{t('areaTickets.externalRoute.offlinePolicy.label')}</Label>
              <Select
                value={area.externalOfflinePolicy}
                disabled={disabled || !isExternal}
                onValueChange={(value: ExternalOfflinePolicy) => savePolicy('externalOfflinePolicy', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BLOCK">{t('areaTickets.externalRoute.offlinePolicy.block')}</SelectItem>
                  <SelectItem value="ALLOW">{t('areaTickets.externalRoute.offlinePolicy.allow')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {area.externalOfflinePolicy === 'BLOCK'
                  ? t('areaTickets.externalRoute.offlinePolicy.blockHint')
                  : t('areaTickets.externalRoute.offlinePolicy.allowHint')}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>{t('areaTickets.externalRoute.deliveryTracking.label')}</Label>
              <Select
                value={area.externalDeliveryTracking}
                disabled={disabled || !isExternal}
                onValueChange={(value: ExternalDeliveryTracking) => savePolicy('externalDeliveryTracking', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRACKED">{t('areaTickets.externalRoute.deliveryTracking.tracked')}</SelectItem>
                  <SelectItem value="UNTRACKED">{t('areaTickets.externalRoute.deliveryTracking.untracked')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {area.externalDeliveryTracking === 'TRACKED'
                  ? t('areaTickets.externalRoute.deliveryTracking.trackedHint')
                  : t('areaTickets.externalRoute.deliveryTracking.untrackedHint')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              {t('areaTickets.externalRoute.confirmDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('areaTickets.externalRoute.confirmDialog.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEnable} data-tour="area-external-route-confirm">
              {t('areaTickets.externalRoute.confirmDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
