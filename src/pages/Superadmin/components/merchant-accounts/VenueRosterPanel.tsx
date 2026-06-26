import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Layers, Loader2, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/use-toast'
import { paymentProviderAPI, type VenueMerchantRoster } from '@/services/paymentProvider.service'

/**
 * VenueRosterPanel (Superadmin) — the venue's N-merchant-account roster + the
 * per-venue "roster cost engine" rollout flag (PR-2). Read the roster; flip the flag
 * ON only after the recompute-diff gate passes for the venue. Self-contained: owns its
 * own queries/mutations so it can be dropped wherever a venueId is available.
 *
 * Superadmin-only surface → hardcoded Spanish (no i18n), per repo convention.
 */
interface Props {
  venueId: string
  venueName?: string
}

const SLOT_LABEL: Record<string, string> = { PRIMARY: 'Slot 1', SECONDARY: 'Slot 2', TERTIARY: 'Slot 3' }

export default function VenueRosterPanel({ venueId, venueName }: Props) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data, isLoading } = useQuery<VenueMerchantRoster>({
    queryKey: ['venue-merchant-roster', venueId],
    queryFn: () => paymentProviderAPI.getVenueMerchantRoster(venueId),
    enabled: !!venueId,
  })

  const accounts = useMemo(() => data?.accounts ?? [], [data])
  const enabled = data?.rosterRolloutEnabled ?? false

  const rolloutMutation = useMutation({
    mutationFn: (next: boolean) => paymentProviderAPI.updateVenueRosterRollout(venueId, next),
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['venue-merchant-roster', venueId] })
      toast({ title: res.rosterRolloutEnabled ? 'Motor por roster ACTIVADO' : 'Motor por roster desactivado' })
    },
    onError: (err: any) => {
      toast({
        title: 'No se pudo cambiar el motor de cobro',
        description: err?.response?.data?.message || err?.message || 'Error en el servidor',
        variant: 'destructive',
      })
    },
  })

  return (
    <div className="rounded-2xl border border-input bg-card p-5" data-tour="venue-roster-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Roster de cuentas{venueName ? ` · ${venueName}` : ''}</h3>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {data?.count ?? 0} cuentas
        </Badge>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Todas las cuentas de comercio que las terminales de este venue pueden cobrar, más allá de los 3 slots fijos.
      </p>

      {/* Roster rollout flag */}
      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-input p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">Motor de cobro por roster</span>
            {enabled ? (
              <Badge className="text-[10px] bg-green-600 hover:bg-green-600">Activo</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                Slots (legacy)
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Préndelo SOLO después de que la compuerta de recálculo salga sin STOPs para este venue.
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={isLoading || rolloutMutation.isPending || !data?.hasConfig}
          onCheckedChange={() => setConfirmOpen(true)}
          data-tour="venue-roster-rollout-toggle"
        />
      </div>

      {data && !data.hasConfig && (
        <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
          Este venue no tiene configuración de pagos; no se puede activar el motor por roster.
        </p>
      )}

      {/* Roster list */}
      <div className="mt-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando roster…
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin cuentas en el roster todavía.</p>
        ) : (
          accounts.map(a => (
            <div
              key={a.merchantAccountId}
              className="flex items-center justify-between gap-3 rounded-lg border border-input px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{a.merchantAccount?.displayName || `ID ${a.merchantAccountId}`}</p>
                <p className="text-[11px] text-muted-foreground">
                  {a.merchantAccount?.provider?.code || '—'} · prioridad {a.priority}
                  {a.inheritedFromOrg && ' · heredada de la organización'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {a.legacySlotType ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {SLOT_LABEL[a.legacySlotType] ?? a.legacySlotType}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    Extra
                  </Badge>
                )}
                {a.active ? (
                  <Badge className="text-[10px] bg-green-600 hover:bg-green-600">
                    <CheckCircle2 className="w-3 h-3" />
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Inactiva
                  </Badge>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={enabled ? 'Desactivar motor por roster' : 'Activar motor por roster'}
        description={
          enabled
            ? 'El venue volverá a resolver costo y ruteo por los 3 slots legacy. ¿Continuar?'
            : 'El costo y el ruteo de pagos de este venue pasarán a resolverse por el roster de N cuentas. Hazlo SOLO si la compuerta de recálculo salió sin STOPs. ¿Continuar?'
        }
        confirmText={enabled ? 'Desactivar' : 'Activar'}
        variant={enabled ? 'destructive' : 'default'}
        onConfirm={() => rolloutMutation.mutate(!enabled)}
      />
    </div>
  )
}
