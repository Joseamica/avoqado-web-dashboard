import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  getSettlementConfigurations,
  updateSettlementConfiguration,
  type SettlementConfiguration,
  type TransactionCardType,
} from '@/services/settlementConfiguration.service'
import { cn } from '@/lib/utils'
import type { SettlementSlice, SetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'

interface Props {
  state: SetupState
  dispatch: (action: SetupAction) => void
  mode: 'create' | 'edit'
  /** Required when mode='edit'. */
  merchantAccountId?: string
}

/** Local mirror of `isCardValid(s, 'settlement')`. All 4 day-counts must be set
 *  and the slice must not be skipped. With `freshSettlement()` populating
 *  defaults (T+1 / T+3), the card is valid out of the box. */
function isSettlementValid(s: SettlementSlice): boolean {
  if (s.skipped) return false
  return (
    s.daysDebit !== undefined &&
    s.daysCredit !== undefined &&
    s.daysAmex !== undefined &&
    s.daysInternational !== undefined
  )
}

const dayTypeLabel = (t: SettlementSlice['dayType']) =>
  t === 'BUSINESS_DAYS' ? 'días hábiles' : 'días naturales'

export default function SettlementCard({ state, dispatch, mode, merchantAccountId }: Props) {
  const [open, setOpen] = useState(false)

  const isValid = isSettlementValid(state.settlement)
  // In edit mode the card is enabled once we have the merchantAccountId so we
  // can look up the active rows by card type and PUT them. In create mode the
  // slice has sane defaults so the card is always enabled.
  const disabled = mode === 'edit' && !merchantAccountId

  const summary = useMemo(() => {
    if (!isValid) return null
    const { daysDebit, daysCredit, daysAmex, daysInternational, dayType } = state.settlement
    return `T+${daysDebit}/${daysCredit}/${daysAmex}/${daysInternational} · ${dayTypeLabel(dayType)}`
  }, [isValid, state.settlement])

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
        data-tour="setup-panel-card-settlement"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Liquidación</h3>
          </div>
          {isValid ? (
            <Badge className="text-[10px] bg-green-600 hover:bg-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Listo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              Pendiente
            </Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-foreground">
          {summary || (
            <span className="text-muted-foreground">
              Pendiente — cuándo se deposita al venue
            </span>
          )}
        </p>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Liquidación</DialogTitle>
          </DialogHeader>
          <SettlementDialogBody
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

function SettlementDialogBody({
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

  // In edit mode we need the existing settlement rows so we know which row id
  // to PUT per card type. Same query key as useMerchantBundle so the cache is
  // shared with the panel's hydration round-trip.
  const { data: existingConfigs = [] } = useQuery<SettlementConfiguration[]>({
    queryKey: ['settlement-configs-by-merchant', merchantAccountId],
    queryFn: () => getSettlementConfigurations({ merchantAccountId: merchantAccountId! }),
    enabled: mode === 'edit' && !!merchantAccountId,
  })
  // Local form buffer — only commit to reducer when user clicks "Guardar".
  // Opening the dialog should not flip the panel's progress indicator.
  const [draft, setDraft] = useState<SettlementSlice>(state.settlement)

  const setField = (patch: Partial<SettlementSlice>) =>
    setDraft(prev => ({ ...prev, ...patch }))

  const canSave = isSettlementValid(draft)

  const handleApplyAll = () => {
    // Take DÉBITO as reference (falls back to CRÉDITO, then 1) and copy to the
    // other three. Useful when all card types settle on the same cadence.
    const ref = draft.daysDebit ?? draft.daysCredit ?? 1
    setField({
      daysDebit: ref,
      daysCredit: ref,
      daysAmex: ref,
      daysInternational: ref,
    })
  }

  // In edit mode, settlement state is split server-side into one row per
  // TransactionCardType. We update each row independently with the day count
  // for that card type, plus the shared cutoff/timezone/dayType fields. If a
  // card type has no existing active row we skip it (a full create-on-missing
  // flow is a follow-up). The Promise.all + multi-PUT shape is acceptable
  // because each row is independent — the backend rejects partial updates per
  // card with its own validation error and the toast surfaces the first one.
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!merchantAccountId) {
        throw new Error('merchantAccountId required in edit mode')
      }
      const byCard = (cardType: TransactionCardType) =>
        existingConfigs.find(c => c.cardType === cardType && c.effectiveTo === null)

      const desired: Array<{ cardType: TransactionCardType; days: number | undefined }> = [
        { cardType: 'DEBIT', days: draft.daysDebit },
        { cardType: 'CREDIT', days: draft.daysCredit },
        { cardType: 'AMEX', days: draft.daysAmex },
        { cardType: 'INTERNATIONAL', days: draft.daysInternational },
      ]

      const updates: Array<Promise<unknown>> = []
      for (const { cardType, days } of desired) {
        if (days === undefined) continue
        const existing = byCard(cardType)
        if (!existing) {
          // No active row for this card type. Skipping rather than auto-creating
          // is intentional — a full create flow needs SettlementConfiguration's
          // POST schema (cardType, merchantAccountId, etc.). Tracked separately.
          // eslint-disable-next-line no-console
          console.warn(
            `[SettlementCard] No active settlement row for cardType=${cardType} on merchant ${merchantAccountId} — skipping update`,
          )
          continue
        }
        updates.push(
          updateSettlementConfiguration(existing.id, {
            settlementDays: days,
            settlementDayType: draft.dayType,
            cutoffTime: draft.cutoffTime,
            cutoffTimezone: draft.cutoffTimezone,
            // effectiveFrom is omitted: the route treats it as a versioning
            // boundary — patching the day count on the same row is what we
            // want from the panel.
          }),
        )
      }

      await Promise.all(updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['settlement-configs-by-merchant', merchantAccountId],
      })
      dispatch({ type: 'SET_SETTLEMENT', settlement: draft })
      toast({ title: 'Liquidación actualizada' })
      onClose()
    },
    onError: (err: any) => {
      toast({
        title: 'No se pudo actualizar la liquidación',
        description: err?.response?.data?.message || 'Error en el servidor',
        variant: 'destructive',
      })
    },
  })

  const handleSave = () => {
    if (!canSave) return
    if (mode === 'edit' && merchantAccountId) {
      saveMutation.mutate()
      return
    }
    dispatch({ type: 'SET_SETTLEMENT', settlement: draft })
    onClose()
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Cuándo se deposita al venue. T+N significa <strong>N días</strong> después
        del corte.
      </p>

      {/* Días por tipo de tarjeta — caso típico: débito/crédito T+1, AMEX/Internacional T+3 */}
      <div className="space-y-2 rounded-lg border border-input p-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">
            Días de liquidación por tipo de tarjeta
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-[11px]"
            onClick={handleApplyAll}
          >
            Aplicar a todos
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Débito"
            value={draft.daysDebit}
            hint="T+N días"
            onChange={v => setField({ daysDebit: v })}
          />
          <NumberField
            label="Crédito"
            value={draft.daysCredit}
            hint="T+N días"
            onChange={v => setField({ daysCredit: v })}
          />
          <NumberField
            label="Amex"
            value={draft.daysAmex}
            hint="típicamente T+3"
            onChange={v => setField({ daysAmex: v })}
          />
          <NumberField
            label="Internacional"
            value={draft.daysInternational}
            hint="típicamente T+3"
            onChange={v => setField({ daysInternational: v })}
          />
        </div>
      </div>

      {/* Day type + cutoff + timezone + effective date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tipo de día</Label>
          <Select
            value={draft.dayType}
            onValueChange={v =>
              setField({ dayType: v as 'BUSINESS_DAYS' | 'CALENDAR_DAYS' })
            }
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BUSINESS_DAYS">Días hábiles</SelectItem>
              <SelectItem value="CALENDAR_DAYS">Días naturales</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hora de corte</Label>
          <Input
            value={draft.cutoffTime}
            onChange={e => setField({ cutoffTime: e.target.value })}
            placeholder="23:00"
            className="h-10"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Zona horaria</Label>
          <Input
            value={draft.cutoffTimezone}
            onChange={e => setField({ cutoffTimezone: e.target.value })}
            placeholder="America/Mexico_City"
            className="h-10"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Vigente desde</Label>
          <Input
            type="date"
            value={draft.effectiveFrom}
            onChange={e => setField({ effectiveFrom: e.target.value })}
            className="h-10"
          />
          <p className="text-[11px] text-muted-foreground">Vacío = hoy.</p>
        </div>
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
          {mode === 'edit' ? 'Guardar cambios' : 'Guardar liquidación'}
        </button>
      </div>
    </div>
  )
}

/** Clearable number input with optional helper hint — empty => undefined. */
function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step="1"
        min="0"
        value={value ?? ''}
        onChange={e => {
          const raw = e.target.value
          onChange(raw === '' ? undefined : parseFloat(raw))
        }}
        className="h-10"
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
