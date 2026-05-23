import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2 } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { SettlementSlice, SetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'

interface Props {
  state: SetupState
  dispatch: (action: SetupAction) => void
  mode: 'create' | 'edit'
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

export default function SettlementCard({ state, dispatch, mode }: Props) {
  const [open, setOpen] = useState(false)

  const isValid = isSettlementValid(state.settlement)
  // Settlement has sane defaults — the only thing that disables the card is
  // edit mode (where per-card save lives elsewhere).
  const disabled = mode === 'edit'

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
  onClose,
}: {
  state: SetupState
  dispatch: (action: SetupAction) => void
  onClose: () => void
}) {
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

  const handleSave = () => {
    if (!canSave) return
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
          className="text-xs text-muted-foreground hover:underline"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="text-xs font-medium bg-foreground text-background rounded-md px-3 py-1.5 disabled:opacity-50"
        >
          Guardar liquidación
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
