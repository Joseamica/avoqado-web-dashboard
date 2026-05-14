import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, AlertCircle, ChefHat, Package, Coins, Check, CheckCircle2, CreditCard, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { updateProduct } from '@/services/menu.service'
import { pricingApi, type BulkBenchmarkResponse, type MarketBenchmarkResult } from '@/services/inventory.service'
import { purchaseTokens } from '@/services/chatService'
import { useTokenBudget, formatTokenCount, tokenBudgetQueryKey } from '@/hooks/use-token-budget'
import { getIntlLocale } from '@/utils/i18n-locale'
import { AddTokensDialog } from '@/pages/Settings/components/AddTokensDialog'
import api from '@/api'
import type { DerivedRow } from '../../types/profitability'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: DerivedRow[]
}

// Approximate token cost per benchmark — calibrated from the prompt size
const ESTIMATED_TOKENS_PER_PRODUCT = 1500

function isResult(r: BulkBenchmarkResponse['results'][number]): r is MarketBenchmarkResult {
  return 'medianEstimate' in r
}

function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-4 w-4 items-center justify-center rounded border transition-colors flex-none',
        checked
          ? 'bg-violet-600 border-violet-600 text-primary-foreground'
          : 'bg-card border-border',
      )}
      aria-hidden
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  )
}

export function BulkBenchmarkDialog({ open, onOpenChange, rows }: Props) {
  const { venueId, venue, fullBasePath } = useCurrentVenue()
  const { i18n } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const currency = useMemo(() => {
    const code = venue?.currency || 'USD'
    const locale = getIntlLocale(i18n.language)
    return (n: number) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency: code, minimumFractionDigits: 2 }).format(n)
  }, [venue?.currency, i18n.language])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [response, setResponse] = useState<BulkBenchmarkResponse | null>(null)
  // Tracks which productIds have been applied during this dialog session
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  // Currently in-flight per-row apply
  const [applyingId, setApplyingId] = useState<string | null>(null)
  // Inline token purchase dialog
  const [addTokensOpen, setAddTokensOpen] = useState(false)

  // ── Token budget awareness ────────────────────────────────────────
  const { data: tokenBudget } = useTokenBudget()

  // Payment methods are needed by AddTokensDialog. Fetch lazily.
  const { data: paymentMethods } = useQuery<Array<{ id: string; card: { brand: string; last4: string } }>>({
    queryKey: ['paymentMethods', venueId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/dashboard/venues/${venueId}/payment-methods`)
      return res.data.data || []
    },
    enabled: !!venueId && open,
    staleTime: 5 * 60 * 1000,
  })
  const defaultPaymentMethod = paymentMethods?.[0]
  const hasPaymentMethod = !!defaultPaymentMethod

  // Purchase mutation — mirrors the one in TokenBudgetSection.tsx
  const purchaseMutation = useMutation({
    mutationFn: ({ tokenAmount, paymentMethodId }: { tokenAmount: number; paymentMethodId: string }) =>
      purchaseTokens(tokenAmount, paymentMethodId),
    onSuccess: (_, { tokenAmount }) => {
      queryClient.invalidateQueries({ queryKey: tokenBudgetQueryKey })
      setAddTokensOpen(false)
      toast({
        title: 'Tokens agregados',
        description: `Se compraron ${formatTokenCount(tokenAmount)} tokens. Ya puedes continuar con tu análisis.`,
      })
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Error al comprar tokens',
        description: err?.response?.data?.error || err?.message || 'Intenta de nuevo.',
      })
    },
  })

  const eligibleRows = useMemo(() => rows.filter(r => r.cost !== null && r.cost > 0), [rows])
  const allSelected = selected.size === eligibleRows.length && eligibleRows.length > 0

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(eligibleRows.map(r => r.productId)))
    }
  }

  const toggleOne = (productId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!venueId) throw new Error('venueId missing')
      const res = await pricingApi.getBulkMarketBenchmark(venueId, Array.from(selected))
      return res.data.data as BulkBenchmarkResponse
    },
    onSuccess: data => {
      setResponse(data)
      if (data.warning) {
        toast({ title: 'Análisis completo con advertencia', description: data.warning })
      } else {
        toast({
          title: `Análisis completo`,
          description: `${data.productsProcessed} productos analizados${data.productsFailed > 0 ? `, ${data.productsFailed} fallaron` : ''}.`,
        })
      }
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'No se pudo completar el análisis',
        description: error?.response?.data?.message || error?.message || 'Error desconocido',
      })
    },
  })

  const estimatedTokens = selected.size * ESTIMATED_TOKENS_PER_PRODUCT
  const canRun = selected.size > 0 && selected.size <= 50 && !mutation.isPending

  // ── Token budget warning level ────────────────────────────────────
  // Determines what banner to show in the selection footer.
  //   exceed → projected > available  (red, offers purchase action)
  //   warn   → projected > 50% of available (amber, info-only)
  //   ok     → silent
  type Level = 'ok' | 'warn' | 'exceed'
  const tokenStatus = useMemo<{
    level: Level
    available: number
    deficit: number
    overageCostUSD: number
    autoRecharge: boolean
    autoRechargeAmountUSD: number
  }>(() => {
    if (!tokenBudget || selected.size === 0) {
      return { level: 'ok', available: 0, deficit: 0, overageCostUSD: 0, autoRecharge: false, autoRechargeAmountUSD: 0 }
    }
    const available = tokenBudget.totalAvailable ?? 0
    const pricePer1k = tokenBudget.pricing?.pricePerThousandTokens ?? 0
    const deficit = Math.max(0, estimatedTokens - available)
    const overageCostUSD = (deficit / 1000) * pricePer1k
    const autoRecharge = !!tokenBudget.autoRechargeEnabled
    const autoRechargeAmountUSD = ((tokenBudget.autoRechargeAmount ?? 0) / 1000) * pricePer1k

    let level: Level = 'ok'
    if (estimatedTokens > available) level = 'exceed'
    else if (estimatedTokens > available * 0.5) level = 'warn'

    return { level, available, deficit, overageCostUSD, autoRecharge, autoRechargeAmountUSD }
  }, [tokenBudget, selected.size, estimatedTokens])


  const reset = () => {
    setSelected(new Set())
    setResponse(null)
    setAppliedIds(new Set())
    setApplyingId(null)
    onOpenChange(false)
  }

  // ── Apply a single suggested price ───────────────────────────────
  const applyOne = async (productId: string, price: number) => {
    if (!venueId) return
    setApplyingId(productId)
    try {
      await updateProduct(venueId, productId, { price } as any)
      setAppliedIds(prev => new Set(prev).add(productId))
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'No se pudo aplicar el precio',
        description: err?.response?.data?.message || err?.message || 'Error desconocido',
      })
    } finally {
      setApplyingId(null)
    }
  }

  // ── Apply all eligible suggestions in batch ──────────────────────
  const applyAllMutation = useMutation({
    mutationFn: async () => {
      if (!venueId || !response) throw new Error('venueId or response missing')
      const eligibleApplies = response.results
        .filter(isResult)
        .filter(r => r.medianEstimate !== null && r.confidence !== 'low' && !appliedIds.has(r.productId))

      const applied: string[] = []
      const failed: string[] = []
      // Serial to avoid hammering the DB with parallel writes for the same venue
      for (const r of eligibleApplies) {
        try {
          await updateProduct(venueId, r.productId, { price: r.medianEstimate! } as any)
          applied.push(r.productId)
        } catch {
          failed.push(r.productId)
        }
      }
      return { applied, failed }
    },
    onSuccess: ({ applied, failed }) => {
      setAppliedIds(prev => {
        const next = new Set(prev)
        applied.forEach(id => next.add(id))
        return next
      })
      toast({
        title: `${applied.length} precios actualizados`,
        description:
          failed.length > 0
            ? `${failed.length} fallaron y deberás aplicarlos manualmente.`
            : 'Catálogo sincronizado con el benchmark.',
      })
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Error en la actualización masiva',
        description: err?.message || 'Error desconocido',
      })
    },
  })

  // Refresh the underlying Rentabilidad query when the dialog closes
  // (only if at least one apply happened during this session)
  const handleClose = () => {
    if (appliedIds.size > 0) {
      queryClient.invalidateQueries({ queryKey: ['inventory-profitability', venueId] })
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
    }
    reset()
  }

  // ── Render results state ─────────────────────────────────────────
  if (response) {
    const results = response.results
    // Apply-all eligibility: has median + non-low confidence + not yet applied
    const applyableAll = results
      .filter(isResult)
      .filter(r => r.medianEstimate !== null && r.confidence !== 'low' && !appliedIds.has(r.productId))
    const applyAllCount = applyableAll.length
    const totalAppliable = results
      .filter(isResult)
      .filter(r => r.medianEstimate !== null && r.confidence !== 'low').length

    return (
      <Dialog open={open} onOpenChange={applyAllMutation.isPending || applyingId ? undefined : handleClose}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 gap-0 flex flex-col" hasTitle>
          <DialogHeader className="p-6 pb-3 border-b border-border/40 flex-none">
            <DialogTitle className="text-lg tracking-tight flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              Resultados del benchmark
            </DialogTitle>
            <DialogDescription>
              {response.productsProcessed} analizados · {response.productsFailed} con error · tokens restantes:{' '}
              <span className="font-semibold tabular-nums">{response.tokensAvailableAfter.toLocaleString()}</span>
              {appliedIds.size > 0 && (
                <>
                  {' · '}
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                    {appliedIds.size} aplicado{appliedIds.size === 1 ? '' : 's'}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            {results.map((r, i) => {
              const row = rows.find(rr => rr.productId === r.productId)
              if (!isResult(r)) {
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 p-3 text-sm"
                  >
                    <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 flex-none" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{row?.name ?? r.productId}</div>
                      <div className="text-xs text-muted-foreground">{r.error}</div>
                    </div>
                  </div>
                )
              }
              const diff = row && r.medianEstimate ? r.medianEstimate - row.price : null
              const diffPct = row && diff !== null && row.price > 0 ? (diff / row.price) * 100 : null
              const isApplied = appliedIds.has(r.productId)
              const isApplying = applyingId === r.productId
              const canApply = r.medianEstimate !== null && !isApplied
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors',
                    isApplied
                      ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-border/60 bg-card',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate flex items-center gap-1.5">
                      {r.productName}
                      {isApplied && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{r.reasoning}</div>
                  </div>
                  <div className="text-right flex-none">
                    {r.medianEstimate !== null ? (
                      <>
                        <div className="text-xs text-muted-foreground">mediana</div>
                        <div className="font-semibold tabular-nums">{currency(r.medianEstimate)}</div>
                        {diffPct !== null && (
                          <div
                            className={cn(
                              'text-[10px] tabular-nums',
                              diffPct > 5
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : diffPct < -5
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-muted-foreground',
                            )}
                          >
                            {diffPct > 0 ? '+' : ''}
                            {diffPct.toFixed(0)}% vs tu precio
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">sin comparables</span>
                    )}
                  </div>
                  {canApply && (
                    <Button
                      size="sm"
                      variant={r.confidence === 'low' ? 'ghost' : 'outline'}
                      onClick={() => applyOne(r.productId, r.medianEstimate!)}
                      disabled={isApplying || applyAllMutation.isPending}
                      className="h-8 gap-1 text-xs flex-none"
                    >
                      {isApplying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Aplicar
                    </Button>
                  )}
                  {isApplied && (
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex-none">
                      Aplicado
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <DialogFooter className="p-4 border-t border-border/40 flex-none bg-card flex-row justify-between sm:justify-between gap-2">
            <div className="text-xs text-muted-foreground flex-1">
              {totalAppliable > 0 && (
                <>
                  Solo se aplican sugerencias con confianza media o alta ({totalAppliable} disponibles).
                </>
              )}
            </div>
            <div className="flex gap-2 flex-none">
              <Button variant="outline" onClick={handleClose} disabled={applyAllMutation.isPending || !!applyingId}>
                Cerrar
              </Button>
              {applyAllCount > 0 && (
                <Button
                  onClick={() => applyAllMutation.mutate()}
                  disabled={applyAllMutation.isPending || !!applyingId}
                  className="gap-1.5"
                >
                  {applyAllMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Aplicar todos ({applyAllCount})
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // ── Selection state ──────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={mutation.isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] p-0 gap-0 flex flex-col" hasTitle>
        <DialogHeader className="p-6 pb-3 border-b border-border/40 flex-none">
          <DialogTitle className="text-lg tracking-tight flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            Benchmark masivo con IA
          </DialogTitle>
          <DialogDescription>
            Analiza varios productos contra restaurantes cercanos. Consume tokens del mismo budget del asistente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <button
            type="button"
            onClick={toggleAll}
            disabled={eligibleRows.length === 0}
            className={cn(
              'w-full flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors cursor-pointer',
              allSelected
                ? 'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30'
                : 'border-border hover:border-border/80 hover:bg-muted/30',
            )}
          >
            <div className="flex items-center gap-3">
              <CheckMark checked={allSelected} />
              <div className="text-left">
                <div className="text-sm font-medium">
                  {allSelected ? 'Deseleccionar todos' : `Seleccionar todos (${eligibleRows.length})`}
                </div>
                <div className="text-xs text-muted-foreground">
                  Solo productos con costo definido entran al análisis.
                </div>
              </div>
            </div>
          </button>

          <ul className="space-y-1">
            {eligibleRows.map(row => {
              const isSelected = selected.has(row.productId)
              const Icon = row.type === 'RECIPE' ? ChefHat : Package
              return (
                <li key={row.productId}>
                  <button
                    type="button"
                    onClick={() => toggleOne(row.productId)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors cursor-pointer',
                      isSelected
                        ? 'border-violet-300 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20'
                        : 'border-transparent hover:bg-muted/30',
                    )}
                  >
                    <CheckMark checked={isSelected} />
                    <Icon
                      className={cn(
                        'h-3.5 w-3.5 flex-none',
                        row.type === 'RECIPE' ? 'text-violet-600 dark:text-violet-400' : 'text-sky-600 dark:text-sky-400',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{row.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{row.category ?? 'Sin categoría'}</div>
                    </div>
                    <div className="text-right flex-none">
                      <div className="text-xs tabular-nums">{currency(row.price)}</div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>

          {eligibleRows.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No hay productos con costo definido para analizar.
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border/40 flex-none bg-card space-y-3">
          {/* Token cost preview */}
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <Coins className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                Costo estimado: ~
                <span className="font-semibold tabular-nums text-foreground">
                  {estimatedTokens.toLocaleString()} tokens
                </span>
              </span>
            </div>
            <span className="text-muted-foreground">
              {tokenBudget && (
                <>
                  Disponible:{' '}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatTokenCount(tokenStatus.available)}
                  </span>{' '}
                  ·{' '}
                </>
              )}
              {selected.size} seleccionados
            </span>
          </div>

          {/* Warning banner — only shown when projection is meaningful vs available */}
          {tokenStatus.level === 'warn' && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30 p-2.5 text-xs">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-amber-700 dark:text-amber-400 flex-none" />
              <span className="text-amber-800 dark:text-amber-300">
                Este análisis consumirá más del 50% de tus tokens disponibles. Considera comprar más si planeas seguir usando el asistente este mes.
              </span>
            </div>
          )}

          {tokenStatus.level === 'exceed' && (
            <div className="flex items-start gap-3 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 p-3 text-xs">
              <AlertCircle className="h-4 w-4 mt-0.5 text-rose-700 dark:text-rose-400 flex-none" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-rose-800 dark:text-rose-300">
                  Te faltan ~{formatTokenCount(tokenStatus.deficit)} tokens
                </div>
                {tokenStatus.autoRecharge ? (
                  <div className="text-rose-700/90 dark:text-rose-400/90 mt-0.5">
                    Tu <strong>auto-recharge</strong> se disparará automáticamente (compra ~$
                    {tokenStatus.autoRechargeAmountUSD.toFixed(2)} USD) cuando se acabe tu balance.
                  </div>
                ) : (
                  <div className="text-rose-700/90 dark:text-rose-400/90 mt-0.5">
                    Si continúas, entrarás en overage (sin cobro automático hoy). Compra tokens antes para evitarlo.
                  </div>
                )}
              </div>
              <div className="flex-none">
                {hasPaymentMethod ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAddTokensOpen(true)}
                    className="h-8 gap-1 text-xs border-rose-300 dark:border-rose-800 hover:bg-rose-100/50 dark:hover:bg-rose-950/40"
                  >
                    <Zap className="h-3 w-3" />
                    Comprar
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="outline" className="h-8 gap-1 text-xs">
                    <Link to={`${fullBasePath}/settings/billing/tokens`} target="_blank">
                      <CreditCard className="h-3 w-3" />
                      Agregar pago
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}

          {selected.size > 50 && (
            <div className="text-xs text-rose-600 dark:text-rose-400 px-1">
              Máximo 50 productos por análisis. Selecciona menos.
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={!canRun}
              className="gap-1.5"
              variant={tokenStatus.level === 'exceed' && !tokenStatus.autoRecharge ? 'outline' : 'default'}
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Sparkles className="h-4 w-4" />
              {tokenStatus.level === 'exceed' && !tokenStatus.autoRecharge
                ? 'Continuar de todos modos'
                : `Analizar ${selected.size > 0 ? `${selected.size} ` : ''}productos`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>

      {/* Inline token purchase — fires Stripe payment intent via venue's saved card */}
      <AddTokensDialog
        open={addTokensOpen}
        onOpenChange={setAddTokensOpen}
        tokenBudget={tokenBudget}
        onPurchase={(amount, paymentMethodId) => purchaseMutation.mutate({ tokenAmount: amount, paymentMethodId })}
        isPurchasing={purchaseMutation.isPending}
        defaultPaymentMethod={defaultPaymentMethod}
      />
    </Dialog>
  )
}
