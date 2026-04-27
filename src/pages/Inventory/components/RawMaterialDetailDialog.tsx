import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Box,
  ChefHat,
  Clock,
  DollarSign,
  Edit,
  ExternalLink,
  History,
  Hash,
  Package,
  PiggyBank,
  Tag,
  Timer,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { rawMaterialsApi, type RawMaterial } from '@/services/inventory.service'
import { Currency } from '@/utils/currency'

interface RawMaterialDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rawMaterial: RawMaterial | null
  onEdit?: (material: RawMaterial) => void
  onAdjustStock?: (material: RawMaterial) => void
  onViewMovements?: (material: RawMaterial) => void
  onViewRecipes?: (material: RawMaterial) => void
}

function fmtDate(iso?: string) {
  if (!iso) return '—'
  try {
    return format(new Date(iso), "d 'de' MMM 'de' yyyy, HH:mm", { locale: es })
  } catch {
    return iso
  }
}

function fmtRelative(iso?: string) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'hoy'
  if (days === 1) return 'hace 1 día'
  if (days < 30) return `hace ${days} días`
  if (days < 365) return `hace ${Math.floor(days / 30)} meses`
  return `hace ${Math.floor(days / 365)} años`
}

export function RawMaterialDetailDialog({
  open,
  onOpenChange,
  rawMaterial,
  onEdit,
  onAdjustStock,
  onViewMovements,
  onViewRecipes,
}: RawMaterialDetailDialogProps) {
  const { t } = useTranslation('inventory')
  const { venueId, fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()

  // Lazy-fetch the recipes that use this material (for the "Used in" section)
  const { data: recipesData, isLoading: loadingRecipes } = useQuery({
    queryKey: ['rawMaterialDetail:recipes', venueId, rawMaterial?.id],
    queryFn: async () => {
      const response = await rawMaterialsApi.getRecipes(venueId, rawMaterial!.id)
      return (response.data?.data ?? []) as Array<{
        id: string
        name: string
        price: number
        recipe?: { id: string; totalCost: number; portionYield: number; lines: Array<{ quantity: number; unit: string }> }
      }>
    },
    enabled: open && !!venueId && !!rawMaterial,
  })

  if (!rawMaterial) return null

  // Prisma Decimals come back from the API as strings to preserve precision.
  // The TypeScript types declare them as `number`, but at runtime they're often
  // strings. Coerce defensively up-front so all arithmetic + .toFixed are safe.
  const num = (v: unknown) => Number(v ?? 0)
  const currentStock = num(rawMaterial.currentStock)
  const minimumStock = num(rawMaterial.minimumStock)
  const reorderPoint = num(rawMaterial.reorderPoint)
  const maximumStock = rawMaterial.maximumStock != null ? num(rawMaterial.maximumStock) : null
  const costPerUnit = num(rawMaterial.costPerUnit)
  const avgCostPerUnit = num(rawMaterial.avgCostPerUnit)

  const totalInvested = currentStock * avgCostPerUnit
  const isLow = currentStock <= minimumStock
  const isBelowReorder = currentStock <= reorderPoint
  const stockPctOfMax =
    maximumStock != null && maximumStock > 0 ? Math.min(100, Math.round((currentStock / maximumStock) * 100)) : null

  const recipes = recipesData ?? []
  const recipeCount = rawMaterial._count?.recipeLines ?? recipes.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-5 border-b space-y-2">
          <DialogTitle className="text-xl leading-tight flex items-start gap-2.5 min-w-0">
            <Package className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
            <span className="truncate">{rawMaterial.name}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detalle del ingrediente {rawMaterial.name}: stock, costos, recetas que lo usan e historial.
          </DialogDescription>
          <div className="flex items-center gap-2 flex-wrap pl-7">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
              <Hash className="h-3 w-3" />
              {rawMaterial.sku}
            </span>
            <span className="text-muted-foreground/40" aria-hidden>·</span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Tag className="h-3 w-3" />
              {rawMaterial.category}
            </span>
            {rawMaterial.gtin && (
              <>
                <span className="text-muted-foreground/40" aria-hidden>·</span>
                <span className="text-xs text-muted-foreground tabular-nums">GTIN {rawMaterial.gtin}</span>
              </>
            )}
            {!rawMaterial.active && (
              <Badge variant="secondary" className="ml-auto">
                {t('rawMaterials.inactive', { defaultValue: 'Inactivo' })}
              </Badge>
            )}
            {isLow && (
              <Badge variant="destructive" className={`gap-1 ${!rawMaterial.active ? '' : 'ml-auto'}`}>
                <AlertTriangle className="h-3 w-3" />
                Stock bajo
              </Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-6">
            {/* Description */}
            {rawMaterial.description && (
              <p className="text-sm text-muted-foreground italic border-l-2 pl-3 py-1">{rawMaterial.description}</p>
            )}

            {/* Stock section */}
            <section>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Box className="h-4 w-4" />
                Stock
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat
                  label="Actual"
                  value={`${currentStock.toFixed(2)} ${rawMaterial.unit}`}
                  highlight={isLow ? 'danger' : isBelowReorder ? 'warning' : undefined}
                />
                <Stat label="Mínimo" value={`${minimumStock.toFixed(2)} ${rawMaterial.unit}`} />
                <Stat label="Punto de reorden" value={`${reorderPoint.toFixed(2)} ${rawMaterial.unit}`} />
                <Stat
                  label="Máximo"
                  value={maximumStock != null ? `${maximumStock.toFixed(2)} ${rawMaterial.unit}` : '—'}
                  hint={stockPctOfMax !== null ? `${stockPctOfMax}% del máx.` : undefined}
                />
              </div>

              {/* Stock relative to min/reorder/max — visual anchor that reads at a glance */}
              {maximumStock != null && maximumStock > 0 && (
                <StockBar
                  current={currentStock}
                  minimum={minimumStock}
                  reorder={reorderPoint}
                  maximum={maximumStock}
                  unit={rawMaterial.unit}
                />
              )}

              {isLow && (
                <div className="mt-3 flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-medium text-destructive">
                      {currentStock <= 0 ? 'Sin stock' : 'Stock por debajo del mínimo'}
                    </p>
                    <p className="text-xs text-destructive/80 tabular-nums">
                      {currentStock <= 0
                        ? `Necesitas reponer al menos ${minimumStock.toFixed(2)} ${rawMaterial.unit} para alcanzar el mínimo.`
                        : `Faltan ${(minimumStock - currentStock).toFixed(2)} ${rawMaterial.unit} para llegar al mínimo.`}
                    </p>
                  </div>
                </div>
              )}
            </section>

            <Separator />

            {/* Cost section */}
            <section>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Costos
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Stat label="Costo unitario" value={`${Currency(costPerUnit)} / ${rawMaterial.unit}`} />
                <Stat
                  label="Costo promedio"
                  value={`${Currency(avgCostPerUnit)} / ${rawMaterial.unit}`}
                  hint={
                    Math.abs(avgCostPerUnit - costPerUnit) > 0.01
                      ? avgCostPerUnit > costPerUnit
                        ? 'Promedio mayor al actual (compras recientes a mejor precio)'
                        : 'Promedio menor al actual (precios al alza)'
                      : 'Sin cambios respecto al costo actual'
                  }
                  hintIcon={
                    avgCostPerUnit > costPerUnit ? (
                      <TrendingDown className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    ) : avgCostPerUnit < costPerUnit ? (
                      <TrendingUp className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                    ) : null
                  }
                />
                <Stat
                  label="Inversión actual"
                  value={Currency(totalInvested)}
                  hint={`${currentStock.toFixed(2)} × ${Currency(avgCostPerUnit)}`}
                  hintIcon={<PiggyBank className="h-3 w-3" />}
                />
              </div>
            </section>

            <Separator />

            {/* Perishable section */}
            {rawMaterial.perishable && (
              <>
                <section>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Caducidad
                  </h3>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="gap-1">
                      <Timer className="h-3 w-3" />
                      Perecedero
                    </Badge>
                    {rawMaterial.shelfLifeDays && (
                      <span className="text-muted-foreground">
                        Vida útil: {rawMaterial.shelfLifeDays} {rawMaterial.shelfLifeDays === 1 ? 'día' : 'días'}
                      </span>
                    )}
                  </div>
                </section>
                <Separator />
              </>
            )}

            {/* Used in recipes */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ChefHat className="h-4 w-4" />
                  Uso en recetas
                  {recipeCount > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {recipeCount}
                    </Badge>
                  )}
                </h3>
                {onViewRecipes && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false)
                      onViewRecipes(rawMaterial)
                    }}
                  >
                    Ver detalles <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>
              {loadingRecipes ? (
                <p className="text-sm text-muted-foreground">Cargando recetas…</p>
              ) : recipes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este ingrediente aún no se usa en ninguna receta.
                </p>
              ) : (
                <ul className="rounded-md border divide-y divide-border overflow-hidden">
                  {recipes.slice(0, 5).map(p => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenChange(false)
                          navigate(`${fullBasePath}/inventory/recipes?productId=${p.id}`)
                        }}
                        className="flex w-full items-center justify-between gap-3 text-sm px-3 py-2.5 text-left hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none transition-colors"
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{Currency(p.price)}</span>
                      </button>
                    </li>
                  ))}
                  {recipes.length > 5 && (
                    <li className="px-3 py-2 text-xs text-muted-foreground bg-muted/20">
                      y {recipes.length - 5} {recipes.length - 5 === 1 ? 'receta más' : 'recetas más'}
                    </li>
                  )}
                </ul>
              )}
            </section>

            <Separator />

            {/* Audit / timestamps */}
            <section>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <History className="h-4 w-4" />
                Historial
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <KV label="Creado" value={fmtDate(rawMaterial.createdAt)} hint={fmtRelative(rawMaterial.createdAt)} />
                <KV
                  label="Última actualización"
                  value={fmtDate(rawMaterial.updatedAt)}
                  hint={fmtRelative(rawMaterial.updatedAt)}
                />
                <KV
                  label="Último conteo"
                  value={fmtDate(rawMaterial.lastCountAt)}
                  hint={fmtRelative(rawMaterial.lastCountAt)}
                />
                <KV
                  label="Último restock"
                  value={fmtDate(rawMaterial.lastRestockAt)}
                  hint={fmtRelative(rawMaterial.lastRestockAt)}
                />
                <KV
                  label="Notificar bajo stock"
                  value={
                    rawMaterial.notifyOnLowStock ? (
                      <Badge variant="outline" className="text-xs">
                        Sí
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground italic">No</span>
                    )
                  }
                />
              </dl>
            </section>
          </div>
        </ScrollArea>

        {/* Footer actions — hierarchy ramps left to right: dismiss → secondary → secondary → primary */}
        <div className="flex flex-wrap items-center justify-end gap-2 px-6 py-4 border-t bg-muted/30">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {onViewMovements && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false)
                onViewMovements(rawMaterial)
              }}
            >
              <History className="h-4 w-4 mr-1.5" />
              Movimientos
            </Button>
          )}
          {onAdjustStock && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false)
                onAdjustStock(rawMaterial)
              }}
            >
              <Box className="h-4 w-4 mr-1.5" />
              Ajustar stock
            </Button>
          )}
          {onEdit && (
            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false)
                onEdit(rawMaterial)
              }}
            >
              <Edit className="h-4 w-4 mr-1.5" />
              Editar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Stat({
  label,
  value,
  hint,
  hintIcon,
  highlight,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  hintIcon?: React.ReactNode
  highlight?: 'danger' | 'warning'
}) {
  const valueClass =
    highlight === 'danger'
      ? 'text-destructive font-semibold'
      : highlight === 'warning'
        ? 'text-amber-600 dark:text-amber-400 font-semibold'
        : 'font-semibold text-foreground'
  return (
    <div className="rounded-md border bg-card px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</div>
      <div className={`text-sm mt-1 tabular-nums ${valueClass}`}>{value}</div>
      {hint && (
        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
          {hintIcon}
          {hint.length > 60 ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="truncate cursor-help">{hint.slice(0, 60)}…</span>
                </TooltipTrigger>
                <TooltipContent>{hint}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span>{hint}</span>
          )}
        </div>
      )}
    </div>
  )
}

function KV({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string | null }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground flex items-baseline gap-1.5">
        <span>{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </dd>
    </div>
  )
}

/**
 * Visual stock indicator: a single bar with markers for minimum and reorder thresholds.
 * Reads at a glance — no labels needed, color carries the state.
 */
function StockBar({
  current,
  minimum,
  reorder,
  maximum,
  unit,
}: {
  current: number
  minimum: number
  reorder: number
  maximum: number
  unit: string
}) {
  // Clamp percentages so over-stocked items still render sanely
  const pct = (v: number) => Math.max(0, Math.min(100, (v / maximum) * 100))
  const currentPct = pct(current)
  const minPct = pct(minimum)
  const reorderPct = pct(reorder)
  const tone =
    current <= minimum
      ? 'bg-destructive'
      : current <= reorder
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-emerald-500 dark:bg-emerald-400'

  return (
    <div className="mt-4 space-y-1.5">
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${tone}`} style={{ width: `${currentPct}%` }} />
        {/* Threshold markers — vertical hairlines on top of the bar */}
        <div
          className="absolute top-0 bottom-0 w-px bg-foreground/40"
          style={{ left: `${minPct}%` }}
          aria-hidden
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-foreground/25"
          style={{ left: `${reorderPct}%` }}
          aria-hidden
        />
      </div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">
        <span>0 {unit}</span>
        <span className="flex items-center gap-3">
          <span title="Mínimo" className="flex items-center gap-1">
            <span className="inline-block h-2 w-px bg-foreground/40" />
            mín {minimum.toFixed(0)}
          </span>
          <span title="Reorden" className="flex items-center gap-1">
            <span className="inline-block h-2 w-px bg-foreground/25" />
            reorden {reorder.toFixed(0)}
          </span>
        </span>
        <span>{maximum.toFixed(0)} {unit}</span>
      </div>
    </div>
  )
}
