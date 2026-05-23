import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, DollarSign, Info, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { upsertVenuePricingStructure } from '@/services/cost-management.service'
import { decimalToPercent, percentToDecimal } from '@/utils/fees'
import { cn } from '@/lib/utils'
import type { MerchantSlice, PricingSlice, SetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'

interface Props {
  state: SetupState
  dispatch: (action: SetupAction) => void
  mode: 'create' | 'edit'
  /** Required when mode='edit'. */
  merchantAccountId?: string
}

const MERCHANT_ID_RE = /^\d+$/

/** Local mirror of `isCardValid(s, 'merchant')` — the gate for opening this card. */
function isMerchantValid(m: MerchantSlice): boolean {
  if (m.mode === 'empty') return false
  if (m.mode === 'existing') return !!m.existingMerchantId
  return (
    MERCHANT_ID_RE.test(m.externalMerchantId) &&
    !!m.name.trim() &&
    !!m.affiliation.trim() &&
    !!m.displayName.trim() &&
    m.idConfirmed
  )
}

/** Local mirror of `isCardValid(s, 'pricing')`. The 4 rates must be set + not skipped. */
function isPricingValid(p: PricingSlice): boolean {
  if (p.skipped) return false
  return (
    p.debitRate !== undefined &&
    p.creditRate !== undefined &&
    p.amexRate !== undefined &&
    p.internationalRate !== undefined
  )
}

const fmtPercent = (d?: number) => (d === undefined ? '–' : `${decimalToPercent(d)}%`)

export default function PricingCard({ state, dispatch, mode, merchantAccountId }: Props) {
  const [open, setOpen] = useState(false)

  const merchantReady = isMerchantValid(state.merchant)
  const isValid = isPricingValid(state.pricing)
  // In edit mode the card is enabled once we have the merchantAccountId; the
  // venueId and slot's accountType are derived from the hydrated state.
  const disabled =
    (mode === 'edit' && !merchantAccountId) || (mode === 'create' && !merchantReady)

  const summary = useMemo(() => {
    if (!isValid) return null
    return `Lo que el venue paga · Débito ${fmtPercent(state.pricing.debitRate)} · Crédito ${fmtPercent(
      state.pricing.creditRate,
    )} · Amex ${fmtPercent(state.pricing.amexRate)} · Internac. ${fmtPercent(
      state.pricing.internationalRate,
    )}`
  }, [isValid, state.pricing])

  const pendingLabel =
    mode === 'edit'
      ? 'Pendiente'
      : !merchantReady
        ? 'Configura el merchant primero'
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
        data-tour="setup-panel-card-pricing"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Precio al venue</h3>
          </div>
          {isValid ? (
            <Badge className="text-[10px] bg-green-600 hover:bg-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Listo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              {pendingLabel}
            </Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-foreground">
          {summary || (
            <span className="text-muted-foreground">
              Pendiente — lo que Avoqado le cobra al venue
            </span>
          )}
        </p>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Precio al venue</DialogTitle>
          </DialogHeader>
          <PricingDialogBody
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

function PricingDialogBody({
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
  // Local form buffer — only commit to reducer when user clicks "Guardar".
  // Opening the dialog should not flip the panel's progress indicator.
  const [draft, setDraft] = useState<PricingSlice>(state.pricing)

  const isReplaceMode = state.slot.mode === 'replace'

  const setField = (patch: Partial<PricingSlice>) => setDraft(prev => ({ ...prev, ...patch }))

  const canSave = isPricingValid(draft)

  // In edit mode the venueId comes from the hydrated venue slice and the
  // accountType comes from the slot we resolved when loading the bundle. The
  // backend UPSERTs on (venueId, accountType, effectiveFrom) so a same-day
  // save replaces the row in place.
  const venueId = state.venue.id
  const slotAccountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' =
    state.slot.mode !== 'empty' ? state.slot.accountType : 'PRIMARY'

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!merchantAccountId || !venueId) {
        return Promise.reject(
          new Error('merchantAccountId / venueId required in edit mode'),
        )
      }
      return upsertVenuePricingStructure({
        venueId,
        accountType: slotAccountType,
        debitRate: draft.debitRate!,
        creditRate: draft.creditRate!,
        amexRate: draft.amexRate!,
        internationalRate: draft.internationalRate!,
        fixedFeePerTransaction: draft.fixedFeePerTransaction,
        monthlyServiceFee: draft.monthlyServiceFee,
        effectiveFrom: draft.effectiveFrom || new Date().toISOString().slice(0, 10),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['venue-pricing-by-merchant', merchantAccountId],
      })
      dispatch({ type: 'SET_PRICING', pricing: draft })
      toast({ title: 'Precio actualizado' })
      onClose()
    },
    onError: (err: any) => {
      toast({
        title: 'No se pudo actualizar el precio',
        description: err?.response?.data?.message || 'Error en el servidor',
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
    dispatch({ type: 'SET_PRICING', pricing: draft })
    onClose()
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Lo que Avoqado le cobra al venue. Escribe el porcentaje tal cual:{' '}
        <strong>1.5</strong> = 1.5%.
      </p>

      {isReplaceMode && (
        <div className="flex items-start gap-2 rounded-md border border-input bg-muted/30 p-3 text-xs">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
          <p>Reemplazando un slot — el precio es obligatorio.</p>
        </div>
      )}

      {/* Rate grid — 4 percents + fixed/monthly + effective date + IVA flag. */}
      <div className="grid grid-cols-2 gap-3">
        <PercentField
          label="Débito"
          value={draft.debitRate}
          onChange={v => setField({ debitRate: v })}
        />
        <PercentField
          label="Crédito"
          value={draft.creditRate}
          onChange={v => setField({ creditRate: v })}
        />
        <PercentField
          label="Amex"
          value={draft.amexRate}
          onChange={v => setField({ amexRate: v })}
        />
        <PercentField
          label="Internacional"
          value={draft.internationalRate}
          onChange={v => setField({ internationalRate: v })}
        />
        <NumberField
          label="Cuota fija / transacción"
          value={draft.fixedFeePerTransaction}
          onChange={v => setField({ fixedFeePerTransaction: v })}
        />
        <NumberField
          label="Cuota mensual de servicio"
          value={draft.monthlyServiceFee}
          onChange={v => setField({ monthlyServiceFee: v })}
        />
        <div className="space-y-1">
          <Label className="text-xs">Vigente desde</Label>
          <Input
            type="date"
            value={draft.effectiveFrom}
            onChange={e => setField({ effectiveFrom: e.target.value })}
            className="h-10"
          />
          <p className="text-[11px] text-muted-foreground">
            Vacío = hoy.
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tasa IVA (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={
              draft.taxRate === undefined ? '' : String(decimalToPercent(draft.taxRate))
            }
            onChange={e => {
              const raw = e.target.value
              const parsed = parseFloat(raw)
              setField({
                taxRate: raw.trim() === '' || Number.isNaN(parsed) ? 0 : percentToDecimal(parsed),
              })
            }}
            className="h-10"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs">
        <Checkbox
          checked={draft.includesTax}
          onCheckedChange={c => setField({ includesTax: !!c })}
        />
        Las tasas ya incluyen IVA
      </label>

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
          {mode === 'edit' ? 'Guardar cambios' : 'Guardar precio'}
        </button>
      </div>
    </div>
  )
}

/** Clearable number input — empty => undefined. Mirrors the wizard's helper. */
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step="0.0001"
        value={value ?? ''}
        onChange={e => {
          const raw = e.target.value
          onChange(raw === '' ? undefined : parseFloat(raw))
        }}
        className="h-10"
      />
    </div>
  )
}

/**
 * Percentage rate input. The user types a percentage (1.5 for 1.5%), but the
 * state (and DB) keeps rates as decimals (0.015). Keeps a local text buffer so
 * intermediate states ("1.") aren't snapped away. Same contract as the wizard's
 * PercentField.
 */
function PercentField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
}) {
  const [text, setText] = useState<string>(() =>
    value === undefined ? '' : String(decimalToPercent(value)),
  )
  // Re-sync the buffer when `value` changes from outside.
  useEffect(() => {
    const fromText = text.trim() === '' ? undefined : percentToDecimal(parseFloat(text))
    const isNan = fromText !== undefined && Number.isNaN(fromText)
    if (fromText !== value && !(isNan && value === undefined)) {
      setText(value === undefined ? '' : String(decimalToPercent(value)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={text}
          onChange={e => {
            const raw = e.target.value
            setText(raw)
            const parsed = parseFloat(raw)
            onChange(
              raw.trim() === '' || Number.isNaN(parsed) ? undefined : percentToDecimal(parsed),
            )
          }}
          className="h-10 pr-7"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          %
        </span>
      </div>
    </div>
  )
}
