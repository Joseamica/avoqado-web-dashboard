/**
 * RevenueShareEditDialog — inline CRUD for `MerchantRevenueShare` from the
 * report on /superadmin/aggregators.
 *
 * Copy intencionalmente en lenguaje plática (no "margen / share / split") porque
 * el operador es Jose, no un actuario. La fórmula EXACTA del backend está
 * mirroreada en `previewSplit()` abajo para mostrar un ejemplo en vivo de $100
 * mientras el usuario llena el form — esto es lo único que realmente le ayuda
 * a entender qué le tocará a cada parte.
 *
 * Anti-loop: lazy `useState` + `key` en el render del padre (mismo patrón que
 * usamos para PaymentProviderDialog tras fix de React #185).
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2, Wallet, Building2, CreditCard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { merchantRevenueShareAPI, type MerchantRevenueShare } from '@/services/merchantRevenueShare.service'
import { useToast } from '@/hooks/use-toast'

// ─── Helpers ────────────────────────────────────────────────────────────

interface RevenueShareEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchantAccountId: string
  /** Friendly label for the dialog title (e.g. "Cuenta Blumon A (Sandbox)"). */
  merchantLabel: string
}

/** Decimal (DB) → percent string (UI). Sin float drift. */
const toPct = (d: number | string | null | undefined): string => {
  if (d == null) return ''
  const n = typeof d === 'string' ? parseFloat(d) : d
  if (!Number.isFinite(n)) return ''
  return String(parseFloat((n * 100).toFixed(6)))
}

const fromPct = (s: string): number | undefined => {
  if (s === '' || s == null) return undefined
  const n = parseFloat(s)
  if (!Number.isFinite(n)) return undefined
  return parseFloat((n / 100).toFixed(6))
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n)

interface FormState {
  useAggregator: boolean
  aggregatorDebitPct: string
  aggregatorCreditPct: string
  aggregatorAmexPct: string
  aggregatorInternationalPct: string
  aggregatorPriceIncludesTax: boolean
  avoqadoProviderSharePct: string
  avoqadoAggregatorSharePct: string
  taxRatePct: string
  notes: string
}

function blankForm(): FormState {
  return {
    useAggregator: false,
    aggregatorDebitPct: '',
    aggregatorCreditPct: '',
    aggregatorAmexPct: '',
    aggregatorInternationalPct: '',
    aggregatorPriceIncludesTax: true,
    avoqadoProviderSharePct: '50',
    avoqadoAggregatorSharePct: '50',
    taxRatePct: '16',
    notes: '',
  }
}

function fromExisting(s: MerchantRevenueShare): FormState {
  const agg = s.aggregatorPrice
  return {
    useAggregator: !!agg,
    aggregatorDebitPct: toPct(agg?.DEBIT),
    aggregatorCreditPct: toPct(agg?.CREDIT),
    aggregatorAmexPct: toPct(agg?.AMEX),
    aggregatorInternationalPct: toPct(agg?.INTERNATIONAL),
    aggregatorPriceIncludesTax: s.aggregatorPriceIncludesTax,
    avoqadoProviderSharePct: toPct(s.avoqadoShareOfProviderMargin) || '50',
    avoqadoAggregatorSharePct: toPct(s.avoqadoShareOfAggregatorMargin) || '50',
    taxRatePct: toPct(s.taxRate) || '16',
    notes: s.notes ?? '',
  }
}

// ─── Live preview math ─────────────────────────────────────────────────
//
// Mirror exacto de `computeRevenueSplit()` en
// `avoqado-server/src/services/payments/revenueShare.service.ts`.
// Usamos defaults sensatos para los rates de provider/venue ya que esos
// vienen de ProviderCostStructure / VenuePricingStructure (no son de
// este dialog). Por eso lo etiquetamos como "ejemplo" — para mostrar el
// reparto cualitativo, no un cálculo de venta real.

interface PreviewParams {
  /** Monto base para el ejemplo. Por convención: $100. */
  amount: number
  /** % que asumimos cobra el procesador (Blumon/AngelPay) — ejemplo. */
  providerCostRatePct: number
  /** % que asumimos cobra Avoqado/agregador al venue — ejemplo. */
  venueChargeRatePct: number
  /** Asumimos que los rates de arriba incluyen IVA (cómo se guardan en la DB usualmente). */
  ratesIncludeTax: boolean
  form: FormState
}

interface PreviewResult {
  provider: number
  avoqado: number
  aggregator: number
  total: number
  aggregatorReceives: number // intermediate — what aggregator gets paid (before split)
  venuePays: number
  customerPaid: number
}

function preIva(fee: number, includesTax: boolean, taxRate: number) {
  return includesTax ? fee / (1 + taxRate) : fee
}

function previewSplit({
  amount,
  providerCostRatePct,
  venueChargeRatePct,
  ratesIncludeTax,
  form,
}: PreviewParams): PreviewResult {
  const taxRate = (fromPct(form.taxRatePct) ?? 0.16)
  const providerCostRate = providerCostRatePct / 100
  const venueChargeRate = venueChargeRatePct / 100

  const providerCost = preIva(amount * providerCostRate, ratesIncludeTax, taxRate)
  const venueCharge = preIva(amount * venueChargeRate, ratesIncludeTax, taxRate)

  if (!form.useAggregator) {
    // Directo
    const margin = venueCharge - providerCost
    const avoqadoShare = (fromPct(form.avoqadoProviderSharePct) ?? 0.5)
    const avoqado = margin * avoqadoShare
    const provider = venueCharge - avoqado
    return {
      provider: round2(provider),
      avoqado: round2(avoqado),
      aggregator: 0,
      total: round2(venueCharge),
      aggregatorReceives: 0,
      venuePays: round2(venueCharge),
      customerPaid: amount,
    }
  }

  // Con agregador — usamos el rate del aggregator del tipo Crédito como muestra
  const aggRate = (fromPct(form.aggregatorCreditPct) ?? 0) // crédito como representativo
  const aggregatorPrice = preIva(
    amount * aggRate,
    form.aggregatorPriceIncludesTax,
    taxRate,
  )
  const m1 = aggregatorPrice - providerCost
  const m2 = venueCharge - aggregatorPrice
  const avoShareM1 = (fromPct(form.avoqadoProviderSharePct) ?? 0.5)
  const avoShareM2 = (fromPct(form.avoqadoAggregatorSharePct) ?? 0.5)
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
    aggregatorReceives: round2(aggregatorPrice),
    venuePays: round2(venueCharge),
    customerPaid: amount,
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

// ─── Component ─────────────────────────────────────────────────────────

export default function RevenueShareEditDialog({
  open,
  onOpenChange,
  merchantAccountId,
  merchantLabel,
}: RevenueShareEditDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const { data: existing, isLoading } = useQuery({
    queryKey: ['merchant-revenue-share', merchantAccountId],
    queryFn: () => merchantRevenueShareAPI.getByMerchant(merchantAccountId),
    staleTime: 30_000,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reparto de ganancias — {merchantLabel}</DialogTitle>
          <DialogDescription>
            Aquí defines cuánto se queda Avoqado de cada venta procesada por este merchant. Lo que sobra le
            toca al agregador (si hay uno en medio) o se atribuye al costo del procesador.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <EditDialogForm
            key={existing?.id ?? `new-${merchantAccountId}`}
            existing={existing}
            merchantAccountId={merchantAccountId}
            onClose={() => onOpenChange(false)}
            onAskDelete={() => setConfirmDeleteOpen(true)}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ['merchant-revenue-share', merchantAccountId] })
              queryClient.invalidateQueries({ queryKey: ['revenue-share-report'] })
            }}
            toast={toast}
          />
        )}
      </DialogContent>

      {existing && (
        <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar el reparto de {merchantLabel}?</AlertDialogTitle>
              <AlertDialogDescription>
                Volverá al comportamiento por default: 100% de la ganancia para Avoqado. Esto NO afecta las
                ventas ya cobradas — solo futuras corridas del reporte.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  try {
                    await merchantRevenueShareAPI.remove(existing.id)
                    queryClient.invalidateQueries({ queryKey: ['merchant-revenue-share', merchantAccountId] })
                    queryClient.invalidateQueries({ queryKey: ['revenue-share-report'] })
                    toast({ title: 'Reparto eliminado', description: merchantLabel })
                    setConfirmDeleteOpen(false)
                    onOpenChange(false)
                  } catch (err: any) {
                    toast({
                      title: 'Error',
                      description: err?.response?.data?.message || 'No se pudo eliminar',
                      variant: 'destructive',
                    })
                  }
                }}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Dialog>
  )
}

interface FormProps {
  existing: MerchantRevenueShare | null | undefined
  merchantAccountId: string
  onClose: () => void
  onAskDelete: () => void
  onSaved: () => void
  toast: ReturnType<typeof useToast>['toast']
}

function EditDialogForm({ existing, merchantAccountId, onClose, onAskDelete, onSaved, toast }: FormProps) {
  const [form, setForm] = useState<FormState>(() => (existing ? fromExisting(existing) : blankForm()))

  // Live preview — recalcula con cada keystroke.
  const preview = useMemo(
    () =>
      previewSplit({
        amount: 100,
        // Defaults razonables: 2% procesador, 7% venue (típico con agregador) o 5% (directo)
        providerCostRatePct: 2,
        venueChargeRatePct: form.useAggregator ? 7 : 5,
        ratesIncludeTax: true,
        form,
      }),
    [form],
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      const aggregatorPrice = form.useAggregator
        ? {
            DEBIT: fromPct(form.aggregatorDebitPct) ?? 0,
            CREDIT: fromPct(form.aggregatorCreditPct) ?? 0,
            AMEX: fromPct(form.aggregatorAmexPct) ?? 0,
            INTERNATIONAL: fromPct(form.aggregatorInternationalPct) ?? 0,
          }
        : null
      const avoqadoShareOfProviderMargin = fromPct(form.avoqadoProviderSharePct) ?? 0.5
      const avoqadoShareOfAggregatorMargin = form.useAggregator
        ? fromPct(form.avoqadoAggregatorSharePct) ?? 0.5
        : null
      const taxRate = fromPct(form.taxRatePct) ?? 0.16
      const notes = form.notes.trim() || undefined

      if (existing) {
        return merchantRevenueShareAPI.update(existing.id, {
          aggregatorPrice,
          aggregatorPriceIncludesTax: form.aggregatorPriceIncludesTax,
          avoqadoShareOfProviderMargin,
          avoqadoShareOfAggregatorMargin,
          taxRate,
          notes,
        })
      }
      return merchantRevenueShareAPI.create({
        merchantAccountId,
        aggregatorPrice,
        aggregatorPriceIncludesTax: form.aggregatorPriceIncludesTax,
        avoqadoShareOfProviderMargin,
        avoqadoShareOfAggregatorMargin,
        taxRate,
        notes,
      })
    },
    onSuccess: () => {
      toast({ title: existing ? 'Reparto actualizado' : 'Reparto creado' })
      onSaved()
      onClose()
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err?.response?.data?.message || 'No se pudo guardar el reparto',
        variant: 'destructive',
      })
    },
  })

  const clampPct = (v: string, def = '50'): string => {
    if (v === '') return ''
    const n = parseFloat(v)
    if (!Number.isFinite(n)) return def
    return String(Math.max(0, Math.min(100, n)))
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        saveMutation.mutate()
      }}
      className="space-y-4 py-2"
    >
      {existing && (
        <Badge variant="secondary" className="text-[10px]">
          Editando configuración existente
        </Badge>
      )}

      {/* PASO 1: ¿Hay agregador intermedio? */}
      <label className="flex items-start gap-3 cursor-pointer text-sm rounded-lg border border-input p-3 hover:bg-muted/30">
        <Checkbox
          checked={form.useAggregator}
          onCheckedChange={c => setForm(f => ({ ...f, useAggregator: !!c }))}
          className="mt-0.5"
        />
        <div className="flex-1">
          <p className="font-medium">
            Este merchant pasa por un <strong>agregador intermediario</strong> antes de
            llegar al venue.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Marca esto si Avoqado <em>NO</em> le cobra directamente al venue, sino a un intermediario que
            después le cobra al venue.
          </p>
        </div>
      </label>

      {/* PASO 2: Tarifas del agregador (solo si useAggregator) */}
      {form.useAggregator && (
        <div className="space-y-3 rounded-lg border border-input p-3">
          <div>
            <Label className="text-sm font-medium">
              <CreditCard className="w-3.5 h-3.5 inline mr-1" />
              ¿Cuánto le cobra Avoqado al agregador por cada venta?
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Es lo que el agregador nos paga por usar nuestra infraestructura. Pon el porcentaje literal:
              <strong> 4 = 4%</strong>. Ejemplo: ~4% débito/crédito, ~5% Amex.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PctField
              label="Por venta con Débito"
              value={form.aggregatorDebitPct}
              placeholder="ej. 4"
              onChange={v => setForm(f => ({ ...f, aggregatorDebitPct: v }))}
            />
            <PctField
              label="Por venta con Crédito"
              value={form.aggregatorCreditPct}
              placeholder="ej. 4"
              onChange={v => setForm(f => ({ ...f, aggregatorCreditPct: v }))}
            />
            <PctField
              label="Por venta con Amex"
              value={form.aggregatorAmexPct}
              placeholder="ej. 5"
              onChange={v => setForm(f => ({ ...f, aggregatorAmexPct: v }))}
            />
            <PctField
              label="Por venta Internacional"
              value={form.aggregatorInternationalPct}
              placeholder="ej. 5"
              onChange={v => setForm(f => ({ ...f, aggregatorInternationalPct: v }))}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox
              checked={form.aggregatorPriceIncludesTax}
              onCheckedChange={c => setForm(f => ({ ...f, aggregatorPriceIncludesTax: !!c }))}
            />
            Estos porcentajes ya incluyen IVA
          </label>
        </div>
      )}

      {/* PASO 3: Reparto provider→{aggregator|venue} */}
      <div className="space-y-2 rounded-lg border border-input p-3">
        <Label className="text-sm">
          <Wallet className="w-3.5 h-3.5 inline mr-1" />
          De la ganancia entre el <strong>procesador</strong> y{' '}
          {form.useAggregator ? <strong>el agregador</strong> : <strong>el venue</strong>}, ¿cuánto se queda
          Avoqado?
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={100}
            step={1}
            value={form.avoqadoProviderSharePct}
            onChange={e => setForm(f => ({ ...f, avoqadoProviderSharePct: e.target.value }))}
            onBlur={e => setForm(f => ({ ...f, avoqadoProviderSharePct: clampPct(e.target.value, '50') }))}
            className="h-10 w-24"
          />
          <span className="text-sm text-muted-foreground">
            % (lo demás se lo lleva {form.useAggregator ? 'el agregador' : 'el procesador'})
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {form.useAggregator ? (
            <>
              <strong>50</strong> = Avoqado y el agregador se reparten 50/50 esta capa.{' '}
              <strong>100</strong> = Avoqado se lleva todo, el <strong>agregador no gana</strong> en esta
              capa. <strong>0</strong> = todo va al agregador, Avoqado no toma nada de esta capa.
            </>
          ) : (
            <>
              <strong>50</strong> = se reparten mitad y mitad. <strong>100</strong> = Avoqado se lleva toda
              la ganancia. <strong>0</strong> = no aplica (no tendría sentido en venta directa).
            </>
          )}
        </p>
      </div>

      {/* PASO 4: Reparto aggregator→venue (solo con agregador) */}
      {form.useAggregator && (
        <div className="space-y-2 rounded-lg border border-input p-3">
          <Label className="text-sm">
            <Building2 className="w-3.5 h-3.5 inline mr-1" />
            De la ganancia entre el <strong>agregador</strong> y el <strong>venue</strong>, ¿cuánto se queda
            Avoqado?
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              value={form.avoqadoAggregatorSharePct}
              onChange={e => setForm(f => ({ ...f, avoqadoAggregatorSharePct: e.target.value }))}
              onBlur={e =>
                setForm(f => ({ ...f, avoqadoAggregatorSharePct: clampPct(e.target.value, '50') }))
              }
              className="h-10 w-24"
            />
            <span className="text-sm text-muted-foreground">% (lo demás se lo lleva el agregador)</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            <strong>50</strong> = Avoqado y el agregador se reparten 50/50 lo que el agregador le cobra de
            más al venue. <strong>100</strong> = Avoqado se lleva todo el sobreprecio, el agregador no gana
            en esta capa. <strong>0</strong> = el agregador se queda con todo su sobreprecio sin compartir
            con Avoqado.
          </p>
        </div>
      )}

      {/* IVA */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">IVA (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={form.taxRatePct}
            onChange={e => setForm(f => ({ ...f, taxRatePct: e.target.value }))}
            onBlur={e => setForm(f => ({ ...f, taxRatePct: clampPct(e.target.value, '16') }))}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Notas (opcional)</Label>
          <Input
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="ej. Acuerdo Q3 2026"
            className="h-10"
          />
        </div>
      </div>

      {/* ─── LIVE PREVIEW PANEL ─── */}
      <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          💰 Ejemplo: en una venta de <span className="font-mono">$100</span> con tarjeta de Crédito
        </div>
        <div className="text-[11px] text-muted-foreground">
          Asumiendo procesador cobra <strong>2%</strong> y{' '}
          {form.useAggregator ? (
            <>
              Avoqado le cobra al agregador <strong>{form.aggregatorCreditPct || '0'}%</strong>, agregador
              cobra al venue <strong>~7%</strong>
            </>
          ) : (
            <>
              Avoqado le cobra al venue <strong>~5%</strong>
            </>
          )}{' '}
          (los porcentajes reales viven en Cost Structures y Venue Pricing — esto es solo ilustrativo).
        </div>

        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 text-muted-foreground">Cliente paga</td>
              <td className="py-1 text-right font-mono">{fmtMoney(preview.customerPaid)}</td>
            </tr>
            <tr>
              <td className="py-1 text-muted-foreground">Venue paga (en su factura)</td>
              <td className="py-1 text-right font-mono text-muted-foreground">{fmtMoney(preview.venuePays)}</td>
            </tr>
            {form.useAggregator && (
              <tr>
                <td className="py-1 text-muted-foreground">Agregador recibe (de Avoqado)</td>
                <td className="py-1 text-right font-mono text-muted-foreground">
                  {fmtMoney(preview.aggregatorReceives)}
                </td>
              </tr>
            )}
            <tr className="border-t border-border/60">
              <td className="py-2 font-semibold text-primary">
                <Wallet className="w-3.5 h-3.5 inline mr-1" />
                Avoqado gana
              </td>
              <td className="py-2 text-right font-mono font-bold text-primary">
                {fmtMoney(preview.avoqado)}
              </td>
            </tr>
            {form.useAggregator && (
              <tr>
                <td className="py-1 text-muted-foreground">Agregador gana (de su margen)</td>
                <td className="py-1 text-right font-mono">{fmtMoney(preview.aggregator)}</td>
              </tr>
            )}
            <tr>
              <td className="py-1 text-muted-foreground">Procesador (costo + resto)</td>
              <td className="py-1 text-right font-mono">{fmtMoney(preview.provider)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <DialogFooter className="gap-2">
        {existing && (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto text-destructive hover:bg-destructive/10"
            onClick={onAskDelete}
            disabled={saveMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Eliminar
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onClose} disabled={saveMutation.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
          {existing ? 'Guardar cambios' : 'Crear reparto'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function PctField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step="0.01"
          min={0}
          max={100}
          placeholder={placeholder ?? '0.00'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-10 pr-7"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
      </div>
    </div>
  )
}
