import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Loader2, ArrowRight, Info, ChefHat, Package, Sparkles, MapPin, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { updateProduct } from '@/services/menu.service'
import { pricingApi, type MarketBenchmarkResult } from '@/services/inventory.service'
import { getIntlLocale } from '@/utils/i18n-locale'
import { classifyStatus, type DerivedRow, type ProfitabilityStatus } from '../../types/profitability'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: DerivedRow | null
}

const STATUS_LABEL: Record<ProfitabilityStatus, string> = {
  EXCELLENT: 'Excelente',
  HEALTHY: 'Saludable',
  ACCEPTABLE: 'Aceptable',
  POOR: 'Pobre',
  UNDEFINED: 'Sin definir',
}

const STATUS_TONE: Record<ProfitabilityStatus, string> = {
  EXCELLENT: 'text-emerald-600 dark:text-emerald-400',
  HEALTHY: 'text-teal-600 dark:text-teal-400',
  ACCEPTABLE: 'text-amber-600 dark:text-amber-400',
  POOR: 'text-rose-600 dark:text-rose-400',
  UNDEFINED: 'text-muted-foreground',
}

const TARGET_MARGINS = [0.5, 0.6, 0.7]

function StatPill({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-base font-semibold tabular-nums tracking-tight mt-0.5', tone)}>{value}</div>
    </div>
  )
}

const CONFIDENCE_BADGE: Record<MarketBenchmarkResult['confidence'], { label: string; cls: string }> = {
  high: {
    label: 'Confianza alta',
    cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-400',
  },
  medium: {
    label: 'Confianza media',
    cls: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400',
  },
  low: {
    label: 'Confianza baja',
    cls: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400',
  },
}

function BenchmarkResult({
  data,
  currency,
  onUseMedian,
}: {
  data: MarketBenchmarkResult
  currency: (n: number) => string
  onUseMedian: (n: number) => void
}) {
  const conf = CONFIDENCE_BADGE[data.confidence]
  const hasMedian = data.medianEstimate !== null

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          <span>Benchmark de mercado</span>
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
              conf.cls,
            )}
          >
            {conf.label}
          </span>
          {data.cached && <span className="text-[10px] text-muted-foreground/70">(cache)</span>}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {data.comparablesFound} lugares cercanos
        </div>
      </div>

      {hasMedian ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border/60 bg-card p-2.5 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mín. est.</div>
            <div className="text-sm font-semibold tabular-nums mt-0.5 text-muted-foreground">
              {data.rangeLow !== null ? currency(data.rangeLow) : '—'}
            </div>
          </div>
          <div className="rounded-lg border-2 border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/20 p-2.5 text-center">
            <div className="text-[10px] uppercase tracking-wider text-violet-700 dark:text-violet-400">Mediana</div>
            <div className="text-lg font-bold tabular-nums mt-0.5 text-violet-700 dark:text-violet-300">
              {currency(data.medianEstimate!)}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-card p-2.5 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Máx. est.</div>
            <div className="text-sm font-semibold tabular-nums mt-0.5 text-muted-foreground">
              {data.rangeHigh !== null ? currency(data.rangeHigh) : '—'}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-3 text-center text-xs text-muted-foreground">
          No se pudo estimar una mediana — producto sin comparables claros.
        </div>
      )}

      <p className="text-xs text-muted-foreground italic leading-relaxed">{data.reasoning}</p>

      {data.comparableVenues.length > 0 && (
        <div className="text-[10px] text-muted-foreground">
          <span className="uppercase tracking-wider">Comparables: </span>
          {data.comparableVenues.slice(0, 5).join(' · ')}
          {data.comparableVenues.length > 5 && ` · +${data.comparableVenues.length - 5} más`}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {hasMedian && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onUseMedian(data.medianEstimate!)}
            className="text-xs gap-1.5 border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30"
          >
            <ArrowRight className="h-3 w-3" />
            Usar como sugerencia
          </Button>
        )}
        <span className="text-[10px] text-muted-foreground italic">
          Estimado por IA · verifica antes de aplicar
        </span>
      </div>
    </div>
  )
}

export function QuickPriceEditDialog({ open, onOpenChange, row }: Props) {
  const { venueId, venue } = useCurrentVenue()
  const { i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Currency follows the venue. Falls back to USD to match the rest of the
  // dashboard (see KpiCard.tsx). Locale follows the user's i18n setting so
  // separators/formatting match other dashboard surfaces.
  const currency = useMemo(() => {
    const code = venue?.currency || 'USD'
    const locale = getIntlLocale(i18n.language)
    return (n: number) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency: code, minimumFractionDigits: 2 }).format(n)
  }, [venue?.currency, i18n.language])

  // Local form state
  const [priceInput, setPriceInput] = useState('')
  const [costInput, setCostInput] = useState('')
  const [benchmarkRequested, setBenchmarkRequested] = useState(false)

  // Reset form when a new row opens
  useEffect(() => {
    if (open && row) {
      setPriceInput(row.price.toFixed(2))
      setCostInput(row.cost !== null ? row.cost.toFixed(2) : '')
      setBenchmarkRequested(false)
    }
  }, [open, row])

  // Lazy benchmark query — only fires when the user clicks "Ver benchmark"
  const benchmark = useQuery<MarketBenchmarkResult>({
    queryKey: ['market-benchmark', venueId, row?.productId],
    queryFn: async () => {
      const res = await pricingApi.getMarketBenchmark(venueId!, row!.productId)
      return res.data.data as MarketBenchmarkResult
    },
    enabled: !!venueId && !!row && benchmarkRequested,
    staleTime: 24 * 60 * 60 * 1000, // 24h — matches backend cache
    retry: false,
  })

  const isRecipe = row?.type === 'RECIPE'
  const Icon = isRecipe ? ChefHat : Package

  // Live derivations
  const preview = useMemo(() => {
    const price = parseFloat(priceInput || '0')
    const cost = parseFloat(costInput || '0')
    const hasCost = cost > 0 && Number.isFinite(cost)
    const hasPrice = price > 0 && Number.isFinite(price)
    if (!hasPrice) {
      return { price: 0, cost, marginAmount: null, marginPct: null, status: 'UNDEFINED' as const, valid: false }
    }
    if (!hasCost) {
      return { price, cost: 0, marginAmount: null, marginPct: null, status: 'UNDEFINED' as const, valid: true }
    }
    const marginAmount = price - cost
    const marginPct = marginAmount / price
    return { price, cost, marginAmount, marginPct, status: classifyStatus(marginPct), valid: true }
  }, [priceInput, costInput])

  // Apply a target margin → solves for price given current cost
  const applyTargetMargin = (margin: number) => {
    const cost = parseFloat(costInput || '0')
    if (!(cost > 0)) return
    const newPrice = cost / (1 - margin)
    setPriceInput(newPrice.toFixed(2))
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!venueId || !row) throw new Error('venueId/row missing')
      const payload: { price: number; cost?: number } = { price: preview.price }
      // Only persist cost edits for QUANTITY products — recipe cost is derived
      if (!isRecipe && preview.cost > 0) payload.cost = preview.cost
      return updateProduct(venueId, row.productId, payload as any)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-profitability', venueId] })
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
      toast({ title: 'Cambios guardados', description: row?.name })
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'No se pudieron guardar los cambios',
        description: error?.response?.data?.message || error?.message || 'Error desconocido',
      })
    },
  })

  if (!row) return null

  const priceChanged = preview.price !== row.price
  const costChanged = !isRecipe && preview.cost !== (row.cost ?? 0)
  const canSave = preview.valid && (priceChanged || costChanged) && !mutation.isPending

  return (
    <Dialog open={open} onOpenChange={mutation.isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 gap-0 flex flex-col" hasTitle>
        <DialogHeader className="p-6 pb-3 border-b border-border/40 flex-none">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                isRecipe
                  ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-400'
                  : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-400',
              )}
            >
              <Icon className="h-3 w-3" />
              {isRecipe ? 'Receta' : 'Unitario'}
            </span>
            {row.category && <span className="text-xs text-muted-foreground">{row.category}</span>}
          </div>
          <DialogTitle className="text-lg tracking-tight">{row.name}</DialogTitle>
          <DialogDescription>Edita precio y margen sin salir del análisis de rentabilidad.</DialogDescription>
        </DialogHeader>

        {/* Scrollable middle section — header + footer stay pinned */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

        {/* Before / After preview */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground text-center">Actual</div>
            <StatPill label="Precio" value={currency(row.price)} />
            <StatPill label="Costo" value={row.cost !== null ? currency(row.cost) : '—'} />
            <StatPill
              label="Margen"
              value={row.marginPct !== null ? `${(row.marginPct * 100).toFixed(1)}%` : '—'}
              tone={STATUS_TONE[row.status]}
            />
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground text-center">Nuevo</div>
            <StatPill
              label="Precio"
              value={preview.valid ? currency(preview.price) : '—'}
              tone={priceChanged ? 'text-foreground' : 'text-muted-foreground'}
            />
            <StatPill
              label="Costo"
              value={preview.cost > 0 ? currency(preview.cost) : '—'}
              tone={costChanged ? 'text-foreground' : 'text-muted-foreground'}
            />
            <StatPill
              label={`Margen · ${STATUS_LABEL[preview.status]}`}
              value={preview.marginPct !== null ? `${(preview.marginPct * 100).toFixed(1)}%` : '—'}
              tone={STATUS_TONE[preview.status]}
            />
          </div>
        </div>

        {/* Inputs */}
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="qe-price" className="text-xs font-medium">
              Nuevo precio
            </Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                id="qe-price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={priceInput}
                onChange={e => setPriceInput(e.target.value)}
                className="pl-7 h-10 text-base tabular-nums"
                autoFocus
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="qe-cost" className="text-xs font-medium flex items-center gap-1.5">
                Costo unitario
                {isRecipe && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground" type="button">
                          <Info className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs leading-relaxed">
                        El costo de una receta se calcula desde sus ingredientes. Edítalos en{' '}
                        <strong>Inventario → Recetas</strong>.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </Label>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {isRecipe ? 'solo lectura' : 'editable'}
              </span>
            </div>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                id="qe-cost"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={costInput}
                onChange={e => setCostInput(e.target.value)}
                disabled={isRecipe}
                className={cn('pl-7 h-10 text-base tabular-nums', isRecipe && 'bg-muted/40 cursor-not-allowed')}
              />
            </div>
          </div>

          {/* Quick margin targets */}
          {preview.cost > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                Sugerencias de precio por margen
              </div>
              <div className="grid grid-cols-3 gap-2">
                {TARGET_MARGINS.map(m => {
                  const suggested = preview.cost / (1 - m)
                  const active = Math.abs(preview.price - suggested) < 0.01
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => applyTargetMargin(m)}
                      aria-pressed={active}
                      className={cn(
                        'group flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2 cursor-pointer transition-all',
                        'hover:-translate-y-px hover:shadow-sm active:translate-y-0 active:shadow-none',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                        active
                          ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                          : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5',
                      )}
                    >
                      <span className="text-sm font-semibold tabular-nums">{Math.round(m * 100)}%</span>
                      <span className={cn('text-[11px] tabular-nums', active ? 'text-foreground/80' : 'text-muted-foreground')}>
                        {currency(suggested)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Market benchmark — AI-assisted price exploration */}
        <div className="mt-5 rounded-xl border border-border/60 bg-gradient-to-br from-violet-50/30 to-transparent dark:from-violet-950/10">
          {!benchmarkRequested ? (
            <button
              type="button"
              onClick={() => setBenchmarkRequested(true)}
              className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-violet-500/15 p-2">
                  <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium">Ver benchmark de mercado</div>
                  <div className="text-xs text-muted-foreground">
                    Compara con restaurantes cercanos (IA · ~5s · advisory)
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-all" />
            </button>
          ) : benchmark.isLoading ? (
            <div className="flex items-center gap-3 p-4">
              <Loader2 className="h-4 w-4 animate-spin text-violet-600 dark:text-violet-400" />
              <div className="text-sm text-muted-foreground">
                Analizando lugares cercanos y comparables…
              </div>
            </div>
          ) : benchmark.isError ? (
            <div className="flex items-start gap-3 p-4">
              <AlertCircle className="h-4 w-4 mt-0.5 text-rose-600 dark:text-rose-400 flex-none" />
              <div className="text-sm">
                <div className="font-medium text-rose-700 dark:text-rose-400">No se pudo generar el benchmark</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {(benchmark.error as any)?.response?.data?.message || 'Intenta de nuevo en un momento.'}
                </div>
              </div>
            </div>
          ) : benchmark.data ? (
            <BenchmarkResult
              data={benchmark.data}
              currency={currency}
              onUseMedian={n => setPriceInput(n.toFixed(2))}
            />
          ) : null}
        </div>

        </div>
        {/* End scrollable section */}

        <DialogFooter className="p-4 border-t border-border/40 gap-2 flex-none bg-card">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSave} className="gap-1.5">
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
