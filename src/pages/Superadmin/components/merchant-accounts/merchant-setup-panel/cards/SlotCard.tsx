import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Layers, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  paymentProviderAPI,
  type MerchantAccount,
  type VenuePaymentConfig,
} from '@/services/paymentProvider.service'
import { cn } from '@/lib/utils'
import type { AccountSlot, SetupState, SlotSlice } from '../types'
import type { SetupAction } from '../useSetupReducer'

interface Props {
  state: SetupState
  dispatch: (action: SetupAction) => void
  mode: 'create' | 'edit'
  /** Required when mode='edit'. */
  merchantAccountId?: string
}

const SLOTS: AccountSlot[] = ['PRIMARY', 'SECONDARY', 'TERTIARY']

/** Maps an AccountSlot to the `VenuePaymentConfig` field that stores its occupant. */
const SLOT_FIELD: Record<AccountSlot, 'primaryAccountId' | 'secondaryAccountId' | 'tertiaryAccountId'> = {
  PRIMARY: 'primaryAccountId',
  SECONDARY: 'secondaryAccountId',
  TERTIARY: 'tertiaryAccountId',
}

/** Pulls the merchantAccount id occupying `slot` out of a `VenuePaymentConfig`. */
function slotOccupant(cfg: VenuePaymentConfig | null | undefined, slot: AccountSlot): string | null {
  if (!cfg) return null
  return (cfg[SLOT_FIELD[slot]] as string | null | undefined) ?? null
}

/**
 * Local mirror of `isCardValid(s, 'slot')` so the surface stays self-contained.
 * Mode 'empty' is invalid; 'replace' requires `replacedAccountId`. The deeper
 * check (chosen slot is actually free / actually holds replacedAccountId) lives
 * in the dialog because it needs the live VenuePaymentConfig fetch.
 */
function isSlotValid(slot: SlotSlice): boolean {
  if (slot.mode === 'empty') return false
  if (slot.mode === 'replace') return !!slot.replacedAccountId
  return true
}

export default function SlotCard({ state, dispatch, mode, merchantAccountId }: Props) {
  const [open, setOpen] = useState(false)

  const venueReady = !!state.venue.id
  const isValid = isSlotValid(state.slot)
  // In edit mode the card is enabled once we know which merchant we're
  // re-binding. In create mode we still gate on a chosen venue.
  const disabled =
    (mode === 'edit' && !merchantAccountId) || (mode === 'create' && !venueReady)

  const summary = useMemo(() => {
    if (state.slot.mode === 'empty') return null
    if (state.slot.mode === 'fill') return `${state.slot.accountType} · libre`
    return `${state.slot.accountType} · reemplazar`
  }, [state.slot])

  const pendingLabel = mode === 'edit'
    ? 'Pendiente'
    : !venueReady
      ? 'Selecciona venue primero'
      : 'Pendiente'

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className={cn(
          'text-left rounded-2xl border p-5 transition-colors',
          isValid ? 'border-input bg-card' : 'border-dashed border-input bg-muted/20',
          !disabled && 'hover:bg-muted/30 cursor-pointer',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
        data-tour="setup-panel-card-slot"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Slot</h3>
          </div>
          {isValid ? (
            <Badge className="text-[10px] bg-green-600 hover:bg-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Listo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">{pendingLabel}</Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-foreground">
          {summary || <span className="text-muted-foreground">Slot de ruteo de pagos</span>}
        </p>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Slot del venue</DialogTitle>
          </DialogHeader>
          <SlotDialogBody
            state={state}
            dispatch={dispatch}
            mode={mode}
            merchantAccountId={merchantAccountId}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

function SlotDialogBody({
  state,
  dispatch,
  mode,
  merchantAccountId,
  onClose,
}: {
  state: SetupState
  dispatch: (action: SetupAction) => void
  mode: 'create' | 'edit'
  merchantAccountId?: string
  onClose: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const venueId = state.venue.id

  // Live VenuePaymentConfig is the source of truth for slot occupancy. Same
  // query key as the legacy wizard so we share the cache.
  const { data: paymentConfig } = useQuery<VenuePaymentConfig | null>({
    queryKey: ['venue-payment-config', venueId],
    queryFn: () => paymentProviderAPI.getVenuePaymentConfig(venueId as string),
    enabled: !!venueId,
  })

  // Used to render the occupant's friendly name. Reusing the wizard's cache key.
  const { data: allMerchants = [] } = useQuery<MerchantAccount[]>({
    queryKey: ['merchant-accounts-all'],
    queryFn: () => paymentProviderAPI.getAllMerchantAccounts(),
  })

  const merchantLabel = (id: string): string => {
    const m = allMerchants.find(x => x.id === id)
    return m ? m.displayName || m.angelpayMerchantName || `ID ${m.externalMerchantId}` : 'Cuenta desconocida'
  }

  // The merchant being assigned by this panel run. In create mode and existing
  // merchant choice we can detect "already in slot" pre-save.
  const selectedMerchantId =
    state.merchant.mode === 'existing' ? state.merchant.existingMerchantId : undefined

  // Local draft so the operator can pick a slot, see the warning banner, then
  // either confirm via Save or cancel without dirtying the reducer.
  const [draft, setDraft] = useState<SlotSlice>(
    state.slot.mode === 'empty' ? { accountType: 'PRIMARY', mode: 'empty' } : state.slot,
  )

  const occupantOf = (slot: AccountSlot) => slotOccupant(paymentConfig, slot)

  const handleSlotPick = (slot: AccountSlot) => {
    const occupant = occupantOf(slot)
    // NOTE: out of scope here — the legacy wizard also handled the
    // cross-slot "Mover merchant de slot" (swap vs vacate) dialog when the
    // incoming merchant already occupies a different slot. The setup-panel
    // iteration keeps things to fill / replace. The plan acknowledges this.
    setDraft(
      occupant
        ? { accountType: slot, mode: 'replace', replacedAccountId: occupant }
        : { accountType: slot, mode: 'fill' },
    )
  }

  // Re-derive validity against the live payment-config. The reducer's static
  // isSlotValid only checks the slice shape — here we also block save when
  // the chosen slot's occupancy doesn't match the chosen mode.
  const draftOccupant = occupantOf(draft.accountType)
  const fillIntoOccupiedSlot = draft.mode === 'fill' && draftOccupant !== null
  const replaceMismatch =
    draft.mode === 'replace' && draftOccupant !== (draft.replacedAccountId ?? null)
  const canSave = isSlotValid(draft) && !fillIntoOccupiedSlot && !replaceMismatch

  // Edit-mode save: re-bind the merchant into the chosen slot via
  // updateVenuePaymentConfig. The backend auto-clears the merchant from
  // whichever slot it currently occupies before reassigning, so we only need
  // to PUT the new slot field. The backend rejects PRIMARY→{SECONDARY,
  // TERTIARY} moves that would leave PRIMARY empty — we surface that
  // BadRequestError as a toast so the operator knows to designate a
  // replacement PRIMARY first.
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!merchantAccountId || !venueId) {
        return Promise.reject(
          new Error('merchantAccountId / venueId required in edit mode'),
        )
      }
      const payload =
        draft.accountType === 'PRIMARY'
          ? { primaryAccountId: merchantAccountId }
          : draft.accountType === 'SECONDARY'
            ? { secondaryAccountId: merchantAccountId }
            : { tertiaryAccountId: merchantAccountId }
      return paymentProviderAPI.updateVenuePaymentConfig(venueId, payload)
    },
    onSuccess: () => {
      // The hydration hook keyed the VenuePaymentConfig fetch by merchant id;
      // the SlotCard's local picker uses ['venue-payment-config', venueId];
      // and the wider merchant list might be displaying slot occupancy too.
      // Invalidate all three so nothing goes stale.
      queryClient.invalidateQueries({
        queryKey: ['venue-payment-config-by-merchant', merchantAccountId],
      })
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config', venueId] })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
      dispatch({ type: 'SET_SLOT', slot: draft })
      toast({ title: 'Slot actualizado' })
      onClose()
    },
    onError: (err: any) => {
      toast({
        title: 'No se pudo actualizar el slot',
        description:
          err?.response?.data?.message ||
          err?.message ||
          'Error en el servidor',
        variant: 'destructive',
      })
    },
  })

  const handleSave = () => {
    if (!canSave) return
    if (mode === 'edit' && merchantAccountId && venueId) {
      saveMutation.mutate()
      return
    }
    dispatch({ type: 'SET_SLOT', slot: draft })
    onClose()
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        ¿En qué slot de ruteo de pagos va esta cuenta? Reemplazar un slot ocupado obliga a recapturar el
        precio.
      </p>

      {/* Slot conflict banner — the bug we shipped earlier. Operator chose
          mode=fill on a slot that's actually occupied; block Save until they
          either pick a different free slot or click on the occupied one to
          switch to replace. */}
      {fillIntoOccupiedSlot && (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            El slot <strong>{draft.accountType}</strong> ya está ocupado por{' '}
            <strong>{merchantLabel(draftOccupant!)}</strong>. Elige otro slot libre, o haz click sobre{' '}
            {draft.accountType} para reemplazarlo.
          </span>
        </p>
      )}

      {/* Replace-mode warning: forces pricing recapture in a later card.  */}
      {draft.mode === 'replace' && draft.replacedAccountId && !replaceMismatch && (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Reemplazar <strong>{merchantLabel(draft.replacedAccountId)}</strong> requiere recapturar el
            precio al venue en el siguiente paso.
          </span>
        </p>
      )}

      <div className="space-y-2">
        {SLOTS.map(slot => {
          const occupant = occupantOf(slot)
          const selected = draft.mode !== 'empty' && draft.accountType === slot
          const isSelf = !!occupant && occupant === selectedMerchantId
          return (
            <button
              key={slot}
              type="button"
              onClick={() => handleSlotPick(slot)}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-lg border border-input px-3 py-2.5 text-left text-sm cursor-pointer hover:bg-muted/50',
                selected && 'border-foreground bg-muted/40',
              )}
            >
              <div className="min-w-0">
                <p className="font-medium">{slot}</p>
                {occupant && (
                  <p className="truncate text-[11px] text-muted-foreground">{merchantLabel(occupant)}</p>
                )}
              </div>
              {isSelf ? (
                <Badge className="text-[10px] shrink-0 bg-green-600 hover:bg-green-600">
                  Asignado aquí
                </Badge>
              ) : occupant ? (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  Ocupado — reemplazar
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] shrink-0">
                  Libre
                </Badge>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={saveMutation.isPending}
          className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saveMutation.isPending}
          className="inline-flex items-center text-xs font-medium bg-foreground text-background rounded-md px-3 py-1.5 disabled:opacity-50"
        >
          {saveMutation.isPending && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
          {mode === 'edit' ? 'Guardar cambios' : 'Guardar slot'}
        </button>
      </div>
    </div>
  )
}
