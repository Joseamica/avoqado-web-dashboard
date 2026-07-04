import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CreditCard, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { aggregatorAPI, type Aggregator } from '@/services/aggregator.service'
import { upsertProviderCostStructure } from '@/services/cost-management.service'
import { decimalToPercent, percentToDecimal } from '@/utils/fees'
import { cn } from '@/lib/utils'
import type { CostSlice, MerchantSlice, SetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'

interface Props {
  state: SetupState
  dispatch: (action: SetupAction) => void
  mode: 'create' | 'edit'
  /** Required when mode='edit'. */
  merchantAccountId?: string
  /** Required when mode='edit' — needed by the cost-structures POST. */
  providerId?: string
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

/** Local mirror of `isCardValid(s, 'cost')`. The 4 rates must be set + not skipped. */
function isCostValid(c: CostSlice): boolean {
  if (c.skipped) return false
  return (
    c.debitRate !== undefined &&
    c.creditRate !== undefined &&
    c.amexRate !== undefined &&
    c.internationalRate !== undefined
  )
}

const fmtPercent = (d?: number) => (d === undefined ? '–' : `${decimalToPercent(d)}%`)

export default function CostCard({ state, dispatch, mode, merchantAccountId, providerId }: Props) {
  const [open, setOpen] = useState(false)

  const merchantReady = isMerchantValid(state.merchant)
  const isValid = isCostValid(state.cost)
  // In edit mode the card is enabled once we have the ids needed to PUT.
  // In create mode we still gate on `merchantReady` so the operator can't fill
  // costs without first picking/typing a merchant.
  const disabled =
    (mode === 'edit' && (!merchantAccountId || !providerId)) ||
    (mode === 'create' && !merchantReady)

  const summary = useMemo(() => {
    if (!isValid) return null
    return `Débito ${fmtPercent(state.cost.debitRate)} · Crédito ${fmtPercent(
      state.cost.creditRate,
    )} · Amex ${fmtPercent(state.cost.amexRate)} · Internac. ${fmtPercent(
      state.cost.internationalRate,
    )}`
  }, [isValid, state.cost])

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
        data-tour="setup-panel-card-cost"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Costo del procesador</h3>
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
              Pendiente — lo que AngelPay nos cobra
            </span>
          )}
        </p>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Costo del procesador</DialogTitle>
          </DialogHeader>
          <CostDialogBody
            state={state}
            dispatch={dispatch}
            mode={mode}
            merchantAccountId={merchantAccountId}
            providerId={providerId}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

function CostDialogBody({
  state,
  dispatch,
  mode,
  merchantAccountId,
  providerId,
  onClose,
}: {
  state: SetupState
  dispatch: (action: SetupAction) => void
  mode: 'create' | 'edit'
  merchantAccountId?: string
  providerId?: string
  onClose: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Local form buffer — only commit to reducer when user clicks "Guardar".
  // Opening the dialog should not flip the panel's progress indicator.
  const [draft, setDraft] = useState<CostSlice>(state.cost)

  // Inline "Crear agregador" sub-dialog state.
  const [createAggOpen, setCreateAggOpen] = useState(false)

  const { data: aggregators = [] } = useQuery<Aggregator[]>({
    queryKey: ['aggregators', 'active'],
    queryFn: () => aggregatorAPI.getAll({ active: true }),
  })

  const setField = (patch: Partial<CostSlice>) => setDraft(prev => ({ ...prev, ...patch }))

  // Inline "Crear agregador" mutation. baseFees stays at zeros — the real revenue
  // share is configured per merchant via MerchantRevenueShare, not on the
  // aggregator itself. Same shape the wizard uses.
  const createAggMutation = useMutation({
    mutationFn: (input: { name: string; ivaRate: number; active: boolean }) =>
      aggregatorAPI.create({
        name: input.name.trim(),
        baseFees: { DEBIT: 0, CREDIT: 0, AMEX: 0, INTERNATIONAL: 0 },
        ivaRate: input.ivaRate,
        active: input.active,
      }),
    onSuccess: created => {
      queryClient.invalidateQueries({ queryKey: ['aggregators', 'active'] })
      // Select the new aggregator immediately so the operator doesn't have to
      // re-open the dropdown.
      setField({ aggregatorId: created.id })
      toast({ title: 'Agregador creado', description: created.name })
      setCreateAggOpen(false)
    },
    onError: (err: any) => {
      toast({
        title: 'No se pudo crear el agregador',
        description:
          err?.response?.data?.message || err?.response?.data?.error || 'Error',
        variant: 'destructive',
      })
    },
  })

  const canSave = isCostValid(draft)

  // Edit-mode upsert. The backend route UPSERTs based on
  // (providerId, merchantAccountId, effectiveFrom) so saving the same date
  // updates the row in place. We invalidate the cost-structures query so the
  // next hydration sees the new values.
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!merchantAccountId || !providerId) {
        // Guarded by `disabled` on the card surface — defensive only.
        return Promise.reject(new Error('merchantAccountId / providerId required in edit mode'))
      }
      return upsertProviderCostStructure({
        providerId,
        merchantAccountId,
        debitRate: draft.debitRate!,
        creditRate: draft.creditRate!,
        amexRate: draft.amexRate!,
        internationalRate: draft.internationalRate!,
        fixedCostPerTransaction: draft.fixedCostPerTransaction,
        monthlyFee: draft.monthlyFee,
        effectiveFrom: draft.effectiveFrom || new Date().toISOString().slice(0, 10),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['cost-structures-by-merchant', merchantAccountId],
      })
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantAccountId] })
      // Mirror the new values into the reducer so the card summary stays in
      // sync without waiting for a refetch round-trip.
      dispatch({ type: 'SET_COST', cost: draft })
      toast({ title: 'Costo actualizado' })
      onClose()
    },
    onError: (err: any) => {
      toast({
        title: 'No se pudo actualizar el costo',
        description: err?.response?.data?.message || 'Error en el servidor',
        variant: 'destructive',
      })
    },
  })

  const handleSave = () => {
    if (!canSave) return
    if (mode === 'edit' && merchantAccountId && providerId) {
      saveMutation.mutate()
      return
    }
    dispatch({ type: 'SET_COST', cost: draft })
    onClose()
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Lo que AngelPay nos cobra. Escribe el porcentaje tal cual:{' '}
        <strong>1.5</strong> = 1.5%.
      </p>

      {/* Aggregator picker */}
      <div className="space-y-1">
        <Label className="text-xs">Agregador (opcional)</Label>
        {aggregators.length > 0 ? (
          <Select
            value={draft.aggregatorId ?? 'none'}
            onValueChange={v => {
              if (v === '__create__') {
                setCreateAggOpen(true)
                return
              }
              setField({ aggregatorId: v === 'none' ? undefined : v })
            }}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Sin agregador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin agregador</SelectItem>
              {aggregators.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
              <SelectItem value="__create__" className="text-primary">
                + Crear agregador nuevo
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground">
              No hay agregadores configurados. Crea uno o captura las tasas manualmente.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setCreateAggOpen(true)}
            >
              + Crear agregador
            </Button>
          </div>
        )}
        {draft.aggregatorId && (
          <p className="text-[11px] text-muted-foreground">
            Agregador asociado. El revenue-share se configura por merchant después de crear.
          </p>
        )}
      </div>

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
          value={draft.fixedCostPerTransaction}
          onChange={v => setField({ fixedCostPerTransaction: v })}
        />
        <NumberField
          label="Cuota mensual"
          value={draft.monthlyFee}
          onChange={v => setField({ monthlyFee: v })}
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
          {mode === 'edit' ? 'Guardar cambios' : 'Guardar costo'}
        </button>
      </div>

      <CreateAggregatorDialog
        open={createAggOpen}
        onOpenChange={setCreateAggOpen}
        onSubmit={(name, ivaRate, active) =>
          createAggMutation.mutate({ name, ivaRate, active })
        }
        isPending={createAggMutation.isPending}
      />
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
  // Re-sync the buffer when `value` changes from outside (e.g. aggregator prefill).
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

/**
 * Inline "Crear agregador" mini-dialog. Captures name + IVA + active toggle and
 * delegates POST to the parent via `onSubmit`. Keeps internal form state isolated
 * so re-opening the dialog starts fresh.
 */
function CreateAggregatorDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSubmit: (name: string, ivaRate: number, active: boolean) => void
  isPending: boolean
}) {
  const [name, setName] = useState('')
  const [ivaText, setIvaText] = useState('16')
  const [active, setActive] = useState(true)

  // Reset the form whenever the dialog opens so the previous attempt doesn't
  // leak through.
  useEffect(() => {
    if (open) {
      setName('')
      setIvaText('16')
      setActive(true)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Crear agregador</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Nombre *</Label>
            <Input
              placeholder="ej. Nombre del agregador"
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-10"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tasa IVA (%)</Label>
            <Input
              type="number"
              placeholder="16"
              step="0.01"
              value={ivaText}
              onChange={e => setIvaText(e.target.value)}
              className="h-10"
            />
            <p className="text-[11px] text-muted-foreground">Default 16% (IVA MX).</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox checked={active} onCheckedChange={c => setActive(!!c)} />
            Activo
          </label>
          <p className="text-[11px] text-muted-foreground">
            Las tasas reales por proveedor se configuran después en{' '}
            <strong>Superadmin → Agregadores</strong> o por merchant.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() =>
              onSubmit(
                name,
                ivaText.trim() === '' ? 0.16 : percentToDecimal(parseFloat(ivaText)),
                active,
              )
            }
            disabled={isPending || !name.trim()}
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Crear
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
