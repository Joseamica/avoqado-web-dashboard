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
          {!canConfigure && <p className="text-sm text-warning-foreground">{t('areaTickets.externalRoute.noPermission')}</p>}

          {!isExternal && <p className="text-xs text-muted-foreground">{t('areaTickets.externalRoute.policiesDisabledNote')}</p>}

          <div className="grid gap-3 md:grid-cols-3" data-tour="area-external-route-policies">
            <div className="space-y-1.5">
              <Label>{t('areaTickets.externalRoute.confirmationMode.label')}</Label>
              <Select
                value={area.externalConfirmationMode}
                disabled={disabled || !isExternal}
                onValueChange={(value: ExternalConfirmationMode) => savePolicy('externalConfirmationMode', value)}
              >
                <SelectTrigger data-tour="area-external-confirmation-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">{t('areaTickets.externalRoute.confirmationMode.manual')}</SelectItem>
                  {/* FASE 2 — quien escribe el estado ASSUMED es el registro de impresión de las
                      apps (Android/iOS), que no existe todavía: hoy NADIE lo escribe. Un área en
                      este modo emitiría vales que se quedan pendientes para siempre, y el job de
                      conciliación los ignora a propósito (sólo mira MANUAL), así que tampoco se
                      abriría una incidencia. Se ve pero no se puede elegir; reactivar en Fase 2 =
                      quitar este `disabled` y el <Badge>. */}
                  <SelectItem value="ASSUME_ON_PRINT" disabled>
                    {t('areaTickets.externalRoute.confirmationMode.assumeOnPrint')}
                    <Badge variant="outline" className="ml-2 h-4 px-1.5 text-[10px]">
                      {t('common:comingSoon')}
                    </Badge>
                  </SelectItem>
                </SelectContent>
              </Select>
              {area.externalConfirmationMode === 'ASSUME_ON_PRINT' ? (
                // Un área que ya haya quedado guardada así (por API/DB) no puede mentir sobre
                // lo que hace: se le dice qué pasa de verdad y cómo salir.
                <p className="text-xs text-warning-foreground">{t('areaTickets.externalRoute.confirmationMode.assumeOnPrintStuck')}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t('areaTickets.externalRoute.confirmationMode.manualHint')}</p>
              )}
              <p className="text-xs text-muted-foreground">{t('areaTickets.externalRoute.confirmationMode.assumeOnPrintPending')}</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label>{t('areaTickets.externalRoute.offlinePolicy.label')}</Label>
                <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                  {t('common:comingSoon')}
                </Badge>
              </div>
              {/* FASE 2 — este campo tiene CERO lectores en el server: se valida, se persiste y se
                  audita, pero nada cambia de comportamiento según su valor. Quien sabe si el área
                  se quedó sin conexión son las apps (Android/iOS). Deshabilitado siempre — no sólo
                  cuando la ruta está apagada — para no prometer algo que hoy no ocurre. Reactivar
                  en Fase 2 = devolverle `disabled={disabled || !isExternal}` y quitar el <Badge>. */}
              <Select
                value={area.externalOfflinePolicy}
                disabled
                onValueChange={(value: ExternalOfflinePolicy) => savePolicy('externalOfflinePolicy', value)}
              >
                <SelectTrigger data-tour="area-external-offline-policy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BLOCK">{t('areaTickets.externalRoute.offlinePolicy.block')}</SelectItem>
                  <SelectItem value="ALLOW">{t('areaTickets.externalRoute.offlinePolicy.allow')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('areaTickets.externalRoute.offlinePolicy.pendingHint')}</p>
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
              <AlertTriangle className="h-5 w-5 text-warning-foreground" />
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
