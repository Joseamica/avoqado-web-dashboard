import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Wallet } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import RevenueShareEditDialog from '@/pages/Superadmin/components/RevenueShareEditDialog'
import { decimalToPercent, percentToDecimal } from '@/utils/fees'
import { cn } from '@/lib/utils'
import type { MerchantSlice, RevenueShareSlice, SetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'

interface Props {
  state: SetupState
  dispatch: (action: SetupAction) => void
  mode: 'create' | 'edit'
  /** Required when mode='edit' — drives the RevenueShareEditDialog CRUD. */
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

/** A "configured" revenue share is one the operator opted into (not skipped). */
function isRevenueShareConfigured(rs: RevenueShareSlice): boolean {
  return !rs.skipped
}

const fmtPctInt = (d?: number) =>
  d === undefined ? '–' : `${Math.round(d * 100)}`

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(n)

/** Skipped/default state. Matches `freshRevenueShare()` in useSetupReducer. */
function defaultSkippedRevenueShare(): RevenueShareSlice {
  return {
    skipped: true,
    useAggregator: false,
    aggregatorPriceIncludesTax: true,
    avoqadoShareOfProviderMargin: 0.5,
    taxRate: 0.16,
  }
}

// ─── Live preview math ──────────────────────────────────────────────
//
// Copied locally from RevenueShareEditDialog so that the dialog stays
// untouched. The math mirrors `computeRevenueSplit` in
// avoqado-server/src/services/payments/revenueShare.service.ts.

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function preIva(fee: number, includesTax: boolean, taxRate: number) {
  return includesTax ? fee / (1 + taxRate) : fee
}

interface PreviewResult {
  provider: number
  avoqado: number
  aggregator: number
  total: number
}

function previewSplit({
  amount,
  providerCostRatePct,
  venueChargeRatePct,
  ratesIncludeTax,
  rs,
}: {
  amount: number
  providerCostRatePct: number
  venueChargeRatePct: number
  ratesIncludeTax: boolean
  rs: RevenueShareSlice
}): PreviewResult {
  const taxRate = rs.taxRate
  const providerCostRate = providerCostRatePct / 100
  const venueChargeRate = venueChargeRatePct / 100

  const providerCost = preIva(amount * providerCostRate, ratesIncludeTax, taxRate)
  const venueCharge = preIva(amount * venueChargeRate, ratesIncludeTax, taxRate)

  if (!rs.useAggregator) {
    // Directo: margen = venueCharge - providerCost.
    const margin = venueCharge - providerCost
    const avoqadoShare = rs.avoqadoShareOfProviderMargin
    const avoqado = margin * avoqadoShare
    const provider = venueCharge - avoqado
    return {
      provider: round2(provider),
      avoqado: round2(avoqado),
      aggregator: 0,
      total: round2(venueCharge),
    }
  }

  // Con agregador: usamos la tasa de crédito como muestra representativa.
  const aggRate = rs.aggregatorCreditRate ?? 0
  const aggregatorPrice = preIva(amount * aggRate, rs.aggregatorPriceIncludesTax, taxRate)
  const m1 = aggregatorPrice - providerCost
  const m2 = venueCharge - aggregatorPrice
  const avoShareM1 = rs.avoqadoShareOfProviderMargin
  const avoShareM2 = rs.avoqadoShareOfAggregatorMargin ?? 0.5
  const avoFromM1 = m1 * avoShareM1
  const avoFromM2 = m2 * avoShareM2
  const avoqado = avoFromM1 + avoFromM2
  const provider = providerCost + (m1 - avoFromM1)
  const aggregator = m2 - avoFromM2
  return {
    provider: round2(provider),
    avoqado: round2(avoqado),
    aggregator: round2(aggregator),
    total: round2(venueCharge),
  }
}

export default function RevenueShareCard({
  state,
  dispatch,
  mode,
  merchantAccountId,
}: Props) {
  const [open, setOpen] = useState(false)

  const merchantReady = isMerchantValid(state.merchant)
  const configured = isRevenueShareConfigured(state.revenueShare)
  // In edit mode the operator opens the full RevenueShareEditDialog (which
  // owns its own CRUD against the API). In create mode we still gate on a
  // ready merchant slice because the local form just writes to the reducer.
  const disabled =
    (mode === 'edit' && !merchantAccountId) || (mode === 'create' && !merchantReady)

  const summary = useMemo(() => {
    if (!configured) return null
    const providerPct = fmtPctInt(state.revenueShare.avoqadoShareOfProviderMargin)
    if (!state.revenueShare.useAggregator) {
      return `Directo · Avoqado se queda ${providerPct}% del margen`
    }
    const aggPct = fmtPctInt(state.revenueShare.avoqadoShareOfAggregatorMargin)
    return `Vía agregador · Avoqado: ${providerPct}% / ${aggPct}%`
  }, [configured, state.revenueShare])

  const pendingLabel =
    mode === 'edit'
      ? 'Opcional'
      : !merchantReady
        ? 'Configura el merchant primero'
        : 'Opcional'

  // Friendly label for the edit dialog title — prefer the merchant slice's
  // captured display name, then the venue's name as a fallback. We don't have
  // a Blumon-style "(Sandbox)" suffix here because the panel is AngelPay-only.
  const merchantLabel =
    (state.merchant.mode === 'existing'
      ? state.merchant.existingMerchantLabel
      : state.merchant.displayName) ||
    state.venue.name ||
    'Merchant'

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className={cn(
          'text-left rounded-2xl border p-5 transition-colors',
          configured ? 'border-input bg-card' : 'border-dashed border-input bg-muted/20',
          !disabled && 'hover:bg-muted/30 cursor-pointer',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
        data-tour="setup-panel-card-revenue-share"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Reparto de ganancias</h3>
          </div>
          {configured ? (
            <Badge className="text-[10px] bg-green-600 hover:bg-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Configurado
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
              Opcional — usa el default (100% Avoqado)
            </span>
          )}
        </p>
      </button>

      {mode === 'edit' && merchantAccountId ? (
        // Delegate to the shared revenue-share editor used from
        // /superadmin/aggregators. It owns its own CRUD (create / update /
        // delete) against merchantRevenueShareAPI and invalidates the relevant
        // caches on success — no reducer mirroring needed.
        <RevenueShareEditDialog
          open={open}
          onOpenChange={setOpen}
          merchantAccountId={merchantAccountId}
          merchantLabel={merchantLabel}
        />
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Reparto de ganancias</DialogTitle>
            </DialogHeader>
            <RevenueShareDialogBody
              state={state}
              dispatch={dispatch}
              onClose={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

function RevenueShareDialogBody({
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
  const [draft, setDraft] = useState<RevenueShareSlice>(state.revenueShare)

  const setField = (patch: Partial<RevenueShareSlice>) =>
    setDraft(prev => ({ ...prev, ...patch }))

  // Live preview — typical rates pulled from RevenueShareEditDialog defaults.
  const preview = useMemo(
    () =>
      previewSplit({
        amount: 100,
        providerCostRatePct: 2,
        venueChargeRatePct: draft.useAggregator ? 7 : 5,
        ratesIncludeTax: true,
        rs: draft,
      }),
    [draft],
  )

  const inRange01 = (v: number | undefined) =>
    v !== undefined && Number.isFinite(v) && v >= 0 && v <= 1

  const canSave = useMemo(() => {
    if (draft.skipped) return true
    if (!inRange01(draft.avoqadoShareOfProviderMargin)) return false
    if (!inRange01(draft.taxRate)) return false
    if (draft.useAggregator) {
      if (!inRange01(draft.avoqadoShareOfAggregatorMargin)) return false
      if (
        draft.aggregatorDebitRate === undefined ||
        draft.aggregatorCreditRate === undefined ||
        draft.aggregatorAmexRate === undefined ||
        draft.aggregatorInternationalRate === undefined
      ) {
        return false
      }
    }
    return true
  }, [draft])

  const handleSave = () => {
    if (!canSave) return
    if (draft.skipped) {
      dispatch({ type: 'SET_REVENUE_SHARE', revenueShare: defaultSkippedRevenueShare() })
    } else {
      dispatch({ type: 'SET_REVENUE_SHARE', revenueShare: draft })
    }
    onClose()
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Cuánto se queda Avoqado de cada venta. Lo que sobra le toca al procesador
        (si no hay agregador) o se reparte con el agregador. Saltar = default 100%
        Avoqado.
      </p>

      {/* Section A — Skip toggle. */}
      <label className="flex items-start gap-3 cursor-pointer text-sm rounded-lg border border-input p-3 hover:bg-muted/30">
        <Checkbox
          checked={draft.skipped}
          onCheckedChange={c => setField({ skipped: !!c })}
          className="mt-0.5"
        />
        <div className="flex-1">
          <p className="font-medium">
            Saltar configuración (usar default 100% Avoqado)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Si lo dejas en default, todo el margen se atribuye a Avoqado en los
            reportes. Lo puedes ajustar después desde{' '}
            <strong>Superadmin → Agregadores</strong>.
          </p>
        </div>
      </label>

      {!draft.skipped && (
        <>
          {/* Aggregator toggle. */}
          <label className="flex items-start gap-3 cursor-pointer text-sm rounded-lg border border-input p-3 hover:bg-muted/30">
            <Checkbox
              checked={draft.useAggregator}
              onCheckedChange={c => setField({ useAggregator: !!c })}
              className="mt-0.5"
            />
            <div className="flex-1">
              <p className="font-medium">
                Este merchant pasa por un agregador intermediario
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Marca esto si Avoqado <em>NO</em> le cobra directamente al venue,
                sino a un intermediario que después le cobra al venue.
              </p>
            </div>
          </label>

          {/* Aggregator block. */}
          {draft.useAggregator && (
            <div className="space-y-3 rounded-lg border border-input p-3">
              <p className="text-xs text-muted-foreground">
                ¿Cuánto le cobra Avoqado al agregador por cada venta? Escribe el
                porcentaje tal cual: <strong>4</strong> = 4%.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <PercentField
                  label="Débito"
                  value={draft.aggregatorDebitRate}
                  onChange={v => setField({ aggregatorDebitRate: v })}
                />
                <PercentField
                  label="Crédito"
                  value={draft.aggregatorCreditRate}
                  onChange={v => setField({ aggregatorCreditRate: v })}
                />
                <PercentField
                  label="Amex"
                  value={draft.aggregatorAmexRate}
                  onChange={v => setField({ aggregatorAmexRate: v })}
                />
                <PercentField
                  label="Internacional"
                  value={draft.aggregatorInternationalRate}
                  onChange={v => setField({ aggregatorInternationalRate: v })}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <Checkbox
                  checked={draft.aggregatorPriceIncludesTax}
                  onCheckedChange={c => setField({ aggregatorPriceIncludesTax: !!c })}
                />
                Los precios del agregador incluyen IVA
              </label>
            </div>
          )}

          {/* Avoqado share inputs. */}
          <div className="space-y-3 rounded-lg border border-input p-3">
            <PercentField
              label={
                draft.useAggregator
                  ? 'Avoqado se queda __% del margen procesador (procesador ↔ agregador)'
                  : 'Avoqado se queda __% del margen procesador'
              }
              value={draft.avoqadoShareOfProviderMargin}
              onChange={v => setField({ avoqadoShareOfProviderMargin: v ?? 0.5 })}
            />
            {draft.useAggregator && (
              <PercentField
                label="Avoqado se queda __% del margen agregador (agregador ↔ venue)"
                value={draft.avoqadoShareOfAggregatorMargin}
                onChange={v => setField({ avoqadoShareOfAggregatorMargin: v ?? 0.5 })}
              />
            )}
          </div>

          {/* Tax rate. */}
          <div className="space-y-1">
            <Label className="text-xs">Tasa IVA</Label>
            <PercentField
              label=""
              value={draft.taxRate}
              onChange={v => setField({ taxRate: v ?? 0.16 })}
            />
          </div>

          {/* Live preview. */}
          <div className="rounded-lg border border-input bg-muted/30 p-3 space-y-1.5">
            <p className="text-xs font-semibold">Ejemplo con $100</p>
            <table className="w-full text-xs">
              <tbody>
                <tr>
                  <td className="py-0.5 text-muted-foreground">Avoqado</td>
                  <td className="py-0.5 text-right font-mono font-semibold">
                    {fmtMoney(preview.avoqado)}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 text-muted-foreground">Procesador</td>
                  <td className="py-0.5 text-right font-mono">
                    {fmtMoney(preview.provider)}
                  </td>
                </tr>
                {draft.useAggregator && (
                  <tr>
                    <td className="py-0.5 text-muted-foreground">Agregador</td>
                    <td className="py-0.5 text-right font-mono">
                      {fmtMoney(preview.aggregator)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="text-[11px] text-muted-foreground">
              Ejemplo con tasas típicas. Los valores reales dependen del costo /
              precio que ya configuraste.
            </p>
          </div>
        </>
      )}

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
          Guardar reparto
        </button>
      </div>
    </div>
  )
}

/**
 * Percentage rate input. The user types a percentage (50 for 50%), but the
 * state (and DB) keeps rates as decimals (0.5). Keeps a local text buffer so
 * intermediate states ("0.") aren't snapped away. Copied from PricingCard so
 * each card keeps its minor variant under its own roof.
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
      {label && <Label className="text-xs">{label}</Label>}
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
