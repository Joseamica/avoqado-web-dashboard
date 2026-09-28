import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Crown, Loader2, Monitor } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
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
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useToast } from '@/hooks/use-toast'
import { setPrintStationKitchenDisplay, type PrintStation } from '@/services/printStations.service'
import { StaffRole } from '@/types'
import { codigoDeRechazo, estadoDeCasilla, RECHAZO_NO_LANZADA, RECHAZO_REQUIERE_PRO } from './kitchenDisplay'

/**
 * Casilla «Pantalla de cocina» de UNA estación (etapa 3, diseño A del 26-sep). Prender y apagar piden confirmación
 * porque cambian a dónde llegan las comandas. El servidor decide (puerta de lanzamiento + plan Pro, fase 3.1); aquí
 * sólo se refleja, y un rechazo con código se explica en vez de mostrarse como error genérico.
 */
export function KitchenDisplayToggle({
  venueId,
  station,
  abiertaAClientes,
}: {
  venueId: string
  station: PrintStation
  abiertaAClientes: boolean
}) {
  const { t } = useTranslation('printStations')
  const { can, role } = useAccess()
  const { hasAccess } = useTierFeatureAccess('KITCHEN_DISPLAY')
  const { fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()
  // Valor que espera confirmación (true = prender, false = apagar); null = sin diálogo.
  const [pendiente, setPendiente] = useState<boolean | null>(null)
  const [pideMejorar, setPideMejorar] = useState(false)

  const estado = estadoDeCasilla({
    abiertaAClientes,
    esSuperadmin: role === StaffRole.SUPERADMIN,
    puedeConfigurar: can('printers:manage'),
    tieneAccesoPro: hasAccess,
    prendida: station.hasKitchenDisplay,
  })

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => setPrintStationKitchenDisplay(venueId, station.id, enabled),
    onSuccess: (_data, enabled) => {
      toast({ title: t(enabled ? 'kitchenDisplay.enabledToast' : 'kitchenDisplay.disabledToast', { name: station.name }) })
      qc.invalidateQueries({ queryKey: ['printStations', venueId] })
    },
    onError: error => {
      const code = codigoDeRechazo(error)
      // El plan cambió desde que se cargó la pantalla: se ofrece el plan, no un error.
      if (code === RECHAZO_REQUIERE_PRO) {
        setPideMejorar(true)
        return
      }
      const description =
        code === RECHAZO_NO_LANZADA
          ? t('kitchenDisplay.errors.notReleased')
          : ((error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('errors.generic'))
      toast({ title: t('errors.title'), description, variant: 'destructive' })
    },
    onSettled: () => setPendiente(null),
  })

  if (estado.tipo === 'OCULTA') return null

  const alCambiar = (next: boolean) => {
    if (mutation.isPending || estado.tipo === 'SOLO_LECTURA') return
    if (next && estado.tipo === 'REQUIERE_PRO') {
      setPideMejorar(true)
      return
    }
    // SOLO_APAGAR nunca prende (el servidor lo rechazaría).
    if (next && estado.tipo !== 'EDITABLE') return
    setPendiente(next)
  }

  const prende = pendiente === true
  const impresora = station.printer?.name ?? null
  const detalle = prende
    ? impresora
      ? t('kitchenDisplay.confirmOn.withPrinter', { printer: impresora })
      : t('kitchenDisplay.confirmOn.withoutPrinter')
    : impresora
      ? t('kitchenDisplay.confirmOff.withPrinter', { printer: impresora })
      : t('kitchenDisplay.confirmOff.withoutPrinter')

  return (
    <div className="rounded-lg border border-input p-3" data-tour="print-station-kitchen-display">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{t('kitchenDisplay.title')}</p>
              <Badge variant="outline" className="border-primary/30 bg-primary/5 px-2 py-0 text-[10px] text-primary">
                {t('kitchenDisplay.proBadge')}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t('kitchenDisplay.description')}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Switch
            checked={station.hasKitchenDisplay}
            onCheckedChange={alCambiar}
            disabled={estado.tipo === 'SOLO_LECTURA' || mutation.isPending}
            aria-label={t('kitchenDisplay.switchLabel', { name: station.name })}
          />
        </div>
      </div>

      {estado.tipo === 'EDITABLE' && estado.soloAvoqado && (
        <p className="mt-3 rounded-md bg-linear-to-r from-amber-400/15 to-pink-500/15 px-3 py-2 text-xs text-foreground">
          {t('kitchenDisplay.soloAvoqado')}
        </p>
      )}
      {estado.tipo === 'SOLO_APAGAR' && (
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          {t(estado.motivo === 'PLAN' ? 'kitchenDisplay.planLapsed' : 'kitchenDisplay.pilotOn')}
        </p>
      )}
      {estado.tipo === 'SOLO_LECTURA' && (
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">{t('kitchenDisplay.readOnly')}</p>
      )}

      {pideMejorar && (
        <div className="mt-3 flex items-start gap-3 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3">
          <Crown className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{t('kitchenDisplay.requiresPro')}</p>
            {can('billing:read') ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 h-8 cursor-pointer gap-1.5 border-amber-400/40 text-amber-600 hover:bg-amber-400/10 dark:text-amber-400"
                onClick={() => navigate(`${fullBasePath}/settings/billing/subscriptions`)}
              >
                <Crown className="h-3.5 w-3.5" /> {t('kitchenDisplay.seePlans')}
              </Button>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">{t('kitchenDisplay.askOwner')}</p>
            )}
          </div>
        </div>
      )}

      <AlertDialog
        open={pendiente !== null}
        onOpenChange={open => {
          if (!open && !mutation.isPending) setPendiente(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(prende ? 'kitchenDisplay.confirmOn.title' : 'kitchenDisplay.confirmOff.title', { name: station.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>{prende ? t('kitchenDisplay.confirmOn.body', { name: station.name }) : detalle}</AlertDialogDescription>
            {prende && <p className="text-sm text-muted-foreground">{detalle}</p>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={e => {
                e.preventDefault()
                if (pendiente !== null && !mutation.isPending) mutation.mutate(pendiente)
              }}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t(prende ? 'kitchenDisplay.confirmOn.action' : 'kitchenDisplay.confirmOff.action')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
