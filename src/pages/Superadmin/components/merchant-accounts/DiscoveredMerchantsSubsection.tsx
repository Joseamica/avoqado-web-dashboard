/**
 * DiscoveredMerchantsSubsection — Section C of the AngelPay onboarding
 * wizard (Task 54).
 *
 * Lifted from `pages/Superadmin/Venues/AngelPayAccount.tsx` so the
 * approve+slot flow lives inline in `ManualAccountDialog` instead of
 * forcing the operator to bounce between pages.
 *
 * Behavior:
 *   - Lists every MerchantAccount with `providerCode=ANGELPAY && active=false`
 *     (the "discovered but pending approval" pool).
 *   - Slot occupancy banner so the admin sees PRIMARY/SECONDARY/TERTIARY
 *     state before choosing. Backend rejects SECONDARY/TERTIARY when no
 *     PRIMARY exists yet.
 *   - Per-row Approve calls the dedicated backend endpoint
 *     (`angelpayUserAccountAPI.approveDiscoveredMerchant`) which atomically
 *     flips active=true AND wires into the chosen slot.
 *   - Reject deletes the row (it can be re-discovered on the TPV's next
 *     auth if the merchant still exists on the AngelPay user's list).
 *
 * NOTE on filtering: like the source page, this is global per-provider
 * (MerchantAccount has no venueId — the venue link lives in
 * VenuePaymentConfig). The page already documents why; same caveat applies
 * here. Each AngelPay user reports their own merchants, cardinality stays
 * small in practice, admins approve based on context.
 *
 * Empty state copy is intentionally different from the page version:
 * here we're in the middle of onboarding so we tell the operator what to
 * do next ("inicia la TPV...") instead of a passive "ningún merchant aún".
 */

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Info, Loader2, XCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

import {
  angelpayUserAccountAPI,
  type AngelPayVenuePaymentSlot,
} from '@/services/superadmin-angelpay-user-account.service'
import {
  paymentProviderAPI,
  type MerchantAccount,
  type VenuePaymentConfig,
} from '@/services/paymentProvider.service'
import { terminalAPI, type Terminal } from '@/services/superadmin-terminals.service'

const SLOT_LABELS: Record<AngelPayVenuePaymentSlot, string> = {
  PRIMARY: 'Principal',
  SECONDARY: 'Secundario',
  TERTIARY: 'Terciario',
}

export interface DiscoveredMerchantsSubsectionProps {
  venueId: string
  /** Fires when the discovered pool count changes — drives "Crear manualmente" auto-expand. */
  onPendingCountChange?: (count: number) => void
}

export function DiscoveredMerchantsSubsection({ venueId, onPendingCountChange }: DiscoveredMerchantsSubsectionProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: providers = [] } = useQuery({
    queryKey: ['payment-providers-for-angelpay-discovery'],
    queryFn: () => paymentProviderAPI.getAllPaymentProviders({ active: true }),
  })
  const angelpayProvider = providers.find((p) => p.code === 'ANGELPAY')

  const {
    data: pendingMerchants = [],
    isLoading,
    isError,
    error,
  } = useQuery<MerchantAccount[]>({
    queryKey: ['merchant-accounts-discovered-angelpay', angelpayProvider?.id],
    queryFn: () =>
      paymentProviderAPI.getAllMerchantAccounts({
        providerId: angelpayProvider!.id,
        active: false,
      }),
    enabled: !!angelpayProvider?.id,
  })

  // Forward pending count to parent so it can auto-expand the manual-entry
  // fallback when there's nothing to approve. Effect avoids the infinite
  // render loop you'd get by calling the prop directly during render.
  useEffect(() => {
    onPendingCountChange?.(pendingMerchants.length)
  }, [pendingMerchants.length, onPendingCountChange])

  const { data: venuePaymentConfig } = useQuery<VenuePaymentConfig | null>({
    queryKey: ['venue-payment-config-for-angelpay-approval', venueId],
    queryFn: () => paymentProviderAPI.getVenuePaymentConfig(venueId),
    enabled: !!venueId,
  })

  // NEXGO terminals only — AngelPay merchants are brand-incompatible with PAX
  // (backend's `assertMerchantTerminalCompatible` would reject those anyway,
  // and the operator UI should match the eligible set).
  const { data: venueTerminals = [] } = useQuery<Terminal[]>({
    queryKey: ['superadmin-terminals-for-angelpay-scoping', venueId],
    queryFn: () => terminalAPI.getAllTerminals({ venueId }),
    enabled: !!venueId,
  })
  const nexgoTerminals = venueTerminals.filter(
    (t) => (t.brand ?? '').toUpperCase() === 'NEXGO' && t.status === 'ACTIVE',
  )
  // Only surface per-terminal scoping when there's more than one eligible
  // terminal — no point asking the operator to "select" when there's one.
  const showTerminalScoping = nexgoTerminals.length > 1

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['merchant-accounts-discovered-angelpay'] })
    queryClient.invalidateQueries({ queryKey: ['venue-payment-config-for-angelpay-approval', venueId] })
    queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
    queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
    queryClient.invalidateQueries({ queryKey: ['venue-payment-config'] })
    // Terminal.assignedMerchantIds may have changed — refresh terminal lists
    // anywhere they're read (terminal config, assignment dialog, etc.).
    queryClient.invalidateQueries({ queryKey: ['superadmin-terminals-for-angelpay-scoping', venueId] })
    queryClient.invalidateQueries({ queryKey: ['superadmin-terminals'] })
    queryClient.invalidateQueries({ queryKey: ['terminals'] })
  }

  const approveMutation = useMutation({
    mutationFn: ({
      merchantAccountId,
      slot,
      terminalIds,
    }: {
      merchantAccountId: string
      slot: AngelPayVenuePaymentSlot
      terminalIds?: string[]
    }) => angelpayUserAccountAPI.approveDiscoveredMerchant({ venueId, merchantAccountId, slot, terminalIds }),
    onSuccess: (_data, variables) => {
      toast({
        title: 'Merchant aprobado',
        description: `Asignado al slot ${SLOT_LABELS[variables.slot]} del venue.`,
      })
      invalidate()
    },
    onError: (err) => {
      const anyErr = err as { response?: { data?: { message?: string }; status?: number }; message?: string }
      const status = anyErr?.response?.status
      const baseMsg = anyErr?.response?.data?.message || anyErr?.message || 'Error desconocido'
      const description = status === 409 ? `${baseMsg} Prueba con otro slot.` : baseMsg
      toast({
        title: status === 409 ? 'Slot ocupado' : 'No se pudo aprobar',
        description,
        variant: 'destructive',
      })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => paymentProviderAPI.deleteMerchantAccount(id),
    onSuccess: () => {
      toast({ title: 'Merchant rechazado', description: 'La cuenta fue eliminada.' })
      invalidate()
    },
    onError: (err) => {
      const anyErr = err as { response?: { data?: { message?: string } }; message?: string }
      toast({
        title: 'No se pudo rechazar',
        description: anyErr?.response?.data?.message || anyErr?.message || 'Error desconocido',
        variant: 'destructive',
      })
    },
  })

  return (
    <div className="space-y-3">
      <SlotOccupancyBanner config={venuePaymentConfig ?? null} />

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando merchants pendientes…
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          Error al cargar: {(error as Error | undefined)?.message || 'desconocido'}
        </p>
      )}

      {!isLoading && !isError && pendingMerchants.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Sin merchants descubiertos aún</AlertTitle>
          <AlertDescription className="text-xs">
            Inicia la TPV en una terminal Nexgo de este venue y haz cualquier cobro — los merchants asociados a la
            cuenta AngelPay se descubrirán automáticamente y aparecerán aquí en segundos.
          </AlertDescription>
        </Alert>
      )}

      {pendingMerchants.map((m) => (
        <DiscoveredMerchantRow
          key={m.id}
          merchant={m}
          hasVenueConfig={!!venuePaymentConfig}
          nexgoTerminals={nexgoTerminals}
          showTerminalScoping={showTerminalScoping}
          isApproving={approveMutation.isPending && approveMutation.variables?.merchantAccountId === m.id}
          isRejecting={rejectMutation.isPending && rejectMutation.variables === m.id}
          onApprove={(slot, terminalIds) => approveMutation.mutate({ merchantAccountId: m.id, slot, terminalIds })}
          onReject={() => rejectMutation.mutate(m.id)}
        />
      ))}
    </div>
  )
}

function SlotOccupancyBanner({ config }: { config: VenuePaymentConfig | null }) {
  if (!config) {
    return (
      <Alert>
        <AlertTitle className="text-sm">Slots de pago del venue</AlertTitle>
        <AlertDescription className="text-xs">
          Este venue aún no tiene configuración de pagos. La primera aprobación deberá ser al slot{' '}
          <strong>Principal</strong> (el backend rechazará Secundario/Terciario hasta que exista el Principal).
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert>
      <AlertTitle className="text-sm">Slots de pago del venue</AlertTitle>
      <AlertDescription>
        <ul className="text-xs space-y-0.5 mt-1">
          <li>
            <strong>Principal:</strong>{' '}
            {config.primaryAccount?.displayName ?? <span className="italic">vacío</span>}
          </li>
          <li>
            <strong>Secundario:</strong>{' '}
            {config.secondaryAccount?.displayName ?? <span className="italic">vacío</span>}
          </li>
          <li>
            <strong>Terciario:</strong>{' '}
            {config.tertiaryAccount?.displayName ?? <span className="italic">vacío</span>}
          </li>
        </ul>
      </AlertDescription>
    </Alert>
  )
}

function DiscoveredMerchantRow({
  merchant,
  hasVenueConfig,
  nexgoTerminals,
  showTerminalScoping,
  isApproving,
  isRejecting,
  onApprove,
  onReject,
}: {
  merchant: MerchantAccount
  hasVenueConfig: boolean
  nexgoTerminals: Terminal[]
  showTerminalScoping: boolean
  isApproving: boolean
  isRejecting: boolean
  /**
   * `terminalIds` is undefined when admin didn't narrow scope (= available on
   * all venue terminals). When defined, it's the *selected* subset.
   */
  onApprove: (slot: AngelPayVenuePaymentSlot, terminalIds?: string[]) => void
  onReject: () => void
}) {
  const displayName = merchant.angelpayMerchantName || merchant.displayName || 'Sin nombre'
  const affiliation = merchant.angelpayAffiliation || '—'
  const externalId = merchant.externalMerchantId
  const [slot, setSlot] = useState<AngelPayVenuePaymentSlot>('PRIMARY')
  // Default: all eligible terminals selected (mirrors "no restriction" semantic).
  // The admin deselects to narrow scope.
  const [selectedTerminalIds, setSelectedTerminalIds] = useState<string[]>(() =>
    nexgoTerminals.map((t) => t.id),
  )
  // Keep selection in sync if the eligible terminal pool changes (e.g. a new
  // terminal activates while the dialog is open).
  useEffect(() => {
    setSelectedTerminalIds((current) => {
      const eligibleIds = new Set(nexgoTerminals.map((t) => t.id))
      const next = current.filter((id) => eligibleIds.has(id))
      // Backfill any *new* eligible terminals so the default stays "all selected".
      for (const t of nexgoTerminals) {
        if (!next.includes(t.id)) next.push(t.id)
      }
      return next
    })
  }, [nexgoTerminals])

  const toggleTerminal = (terminalId: string) => {
    setSelectedTerminalIds((current) =>
      current.includes(terminalId) ? current.filter((id) => id !== terminalId) : [...current, terminalId],
    )
  }

  const handleApprove = () => {
    // Only forward `terminalIds` when the admin actually narrowed scope —
    // i.e. there's a meaningful subset (not "all" and not "none, fall back
    // to inheritance"). Treat "none selected" as "no restriction" so the
    // admin doesn't accidentally orphan the merchant from every terminal.
    const narrowed =
      showTerminalScoping &&
      selectedTerminalIds.length > 0 &&
      selectedTerminalIds.length < nexgoTerminals.length
    onApprove(slot, narrowed ? selectedTerminalIds : undefined)
  }

  return (
    <div className="flex flex-col gap-3 p-3 border rounded-md bg-muted/30">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{displayName}</span>
            <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">PENDIENTE</Badge>
          </div>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            <span>
              Afiliación: <span className="font-mono">{affiliation}</span>
            </span>
            <span>
              AngelPay ID: <span className="font-mono">{externalId}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={slot}
            onValueChange={(v) => setSlot(v as AngelPayVenuePaymentSlot)}
            disabled={isApproving || isRejecting}
          >
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PRIMARY">Slot principal</SelectItem>
              <SelectItem
                value="SECONDARY"
                disabled={!hasVenueConfig}
                title={!hasVenueConfig ? 'Requiere slot principal seedeado primero' : undefined}
              >
                Slot secundario
              </SelectItem>
              <SelectItem
                value="TERTIARY"
                disabled={!hasVenueConfig}
                title={!hasVenueConfig ? 'Requiere slot principal seedeado primero' : undefined}
              >
                Slot terciario
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="text-green-700 border-green-300 hover:bg-green-50"
            disabled={isApproving || isRejecting}
            onClick={handleApprove}
          >
            {isApproving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
            Aprobar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-700 border-red-300 hover:bg-red-50"
            disabled={isApproving || isRejecting}
            onClick={onReject}
          >
            {isRejecting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
            Rechazar
          </Button>
        </div>
      </div>

      {/* Per-terminal scoping — only when the venue has >1 NEXGO terminal.
          Otherwise the merchant maps 1:1 to the only eligible terminal via
          inheritance and the chip strip would be noise. */}
      {showTerminalScoping && (
        <div className="space-y-1.5">
          <Label className="text-xs">Disponible en terminales</Label>
          <p className="text-[11px] text-muted-foreground">
            Por defecto disponible en todas. Deselecciona para restringir.
          </p>
          <div className="flex flex-wrap gap-2">
            {nexgoTerminals.map((t) => {
              const isSelected = selectedTerminalIds.includes(t.id)
              return (
                <Button
                  key={t.id}
                  type="button"
                  size="sm"
                  variant={isSelected ? 'default' : 'outline'}
                  className="h-7 text-xs px-2.5"
                  disabled={isApproving || isRejecting}
                  onClick={() => toggleTerminal(t.id)}
                  title={isSelected ? 'Deselecciona para excluir esta terminal' : 'Selecciona para incluir esta terminal'}
                >
                  {t.name}
                </Button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default DiscoveredMerchantsSubsection
