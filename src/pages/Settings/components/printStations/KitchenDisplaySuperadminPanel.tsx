import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Monitor } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { StaffRole } from '@/types'
import { setPrintStationKitchenDisplay, type PrintStation } from '@/services/printStations.service'

/**
 * Casilla «Se atiende con pantalla de cocina», etapa 1 (spec 2026-09-24 §4): SÓLO SUPERADMIN.
 * El cliente no ve este panel. El aviso es el recordatorio de la etapa 3: aquí es donde alguien
 * intentaría prenderla para un cliente. Español fijo: pantalla de superadmin, exenta de i18n.
 */
export function KitchenDisplaySuperadminPanel({ venueId, stations }: { venueId: string; stations: PrintStation[] }) {
  const { staffInfo } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ stationId, enabled }: { stationId: string; enabled: boolean }) =>
      setPrintStationKitchenDisplay(venueId, stationId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printStations', venueId] })
      toast({ title: 'Pantalla de cocina actualizada' })
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? 'No se pudo guardar la pantalla de cocina', variant: 'destructive' }),
  })

  if (staffInfo?.role !== StaffRole.SUPERADMIN) return null

  return (
    <Card className="overflow-hidden border-input bg-linear-to-r from-amber-400/10 to-pink-500/10">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-linear-to-r from-amber-400 to-pink-500 p-2 text-primary-foreground">
            <Monitor className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">Pantalla de cocina · Superadmin</p>
            <p className="text-sm text-muted-foreground">
              Sin ninguna estación activa con pantalla, las ventas de la caja no guardan comanda para la pantalla. La hoja impresa no
              cambia.
            </p>
          </div>
        </div>
        <p className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          La pantalla de cocina todavía no está lista para clientes. Antes de prenderla a un cliente, falta la etapa 3
          (docs/superpowers/specs/2026-09-24-pantalla-de-cocina-como-estacion-design.md §6).
        </p>
        <ul className="space-y-2">
          {stations.map(s => (
            <li key={s.id} className="flex items-center justify-between rounded-md border border-border/50 bg-card px-3 py-2">
              <Label htmlFor={`kds-${s.id}`}>
                {s.name}
                {!s.active && <span className="ml-2 text-xs text-muted-foreground">(apagada)</span>}
              </Label>
              <Switch
                id={`kds-${s.id}`}
                aria-label={s.name}
                checked={s.hasKitchenDisplay}
                disabled={mutation.isPending}
                onCheckedChange={enabled => mutation.mutate({ stationId: s.id, enabled })}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
