import {
  AlertCircle,
  ChefHat,
  DollarSign,
  Edit,
  Hash,
  History,
  Layers,
  Lightbulb,
  Package,
  Percent,
  Sparkles,
  Tag,
  Timer,
  Utensils,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useNavigate } from 'react-router-dom'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { Currency } from '@/utils/currency'

interface RecipeDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: {
    id: string
    name: string
    price: number
    active?: boolean
    type?: string
    trackInventory?: boolean
    inventoryMethod?: 'QUANTITY' | 'RECIPE' | null
    category: { id: string; name: string }
    recipe?: {
      id: string
      portionYield: number
      totalCost: number
      prepTime?: number
      cookTime?: number
      notes?: string
      createdAt: string
      updatedAt: string
      lines: Array<{
        id: string
        rawMaterialId: string
        rawMaterial: {
          id: string
          name: string
          sku: string
          unit: string
          currentStock: number
          minimumStock: number
          avgCostPerUnit: number
          active: boolean
        }
        quantity: number
        unit: string
        costPerServing: number
        displayOrder: number
        isOptional: boolean
        substituteNotes?: string
        isVariable?: boolean
        linkedModifierGroup?: { id: string; name: string } | null
      }>
    }
  } | null
  onEdit?: () => void
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

export function RecipeDetailDialog({ open, onOpenChange, product, onEdit }: RecipeDetailDialogProps) {
  const { getShortLabel } = useUnitTranslation()
  const { fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()

  function openIngredient(rawMaterialId: string) {
    onOpenChange(false)
    navigate(`${fullBasePath}/inventory/raw-materials?highlight=${rawMaterialId}`)
  }

  if (!product) return null

  const recipe = product.recipe
  const hasRecipe = !!recipe && recipe.lines.length > 0

  const totalCost = recipe?.totalCost ?? 0
  const portionYield = recipe?.portionYield ?? 1
  const costPerPortion = totalCost / Math.max(1, portionYield)
  const margin = product.price > 0 ? ((product.price - costPerPortion) / product.price) * 100 : 0
  const totalTime = (recipe?.prepTime ?? 0) + (recipe?.cookTime ?? 0)
  // Hide the "Tipo" column entirely when no line uses it — avoids a strip of dashes.
  const showTypeColumn = !!recipe?.lines.some(l => l.isOptional || l.isVariable)

  // Detect missing or low-stock ingredients (the audit case the user mentioned).
  // Prisma Decimals deserialize as strings — `"203" <= "40"` is true via lexicographic
  // comparison, so coerce to Number before comparing.
  const missingLines = recipe?.lines.filter(l => !l.rawMaterial?.active) ?? []
  const lowStockLines =
    recipe?.lines.filter(l => l.rawMaterial?.active && Number(l.rawMaterial.currentStock) <= Number(l.rawMaterial.minimumStock)) ?? []

  // Per-ingredient yield: how many portions of THIS recipe each ingredient can support today.
  // The minimum (excluding optional/variable lines) determines the production ceiling.
  const yieldsByLineId = new Map<string, number>()
  let bottleneckLineId: string | null = null
  const outOfStockLineIds = new Set<string>()
  let maxProducible = 0

  if (hasRecipe) {
    const evaluated = recipe.lines
      .filter(l => !l.isOptional && !l.isVariable)
      .map(l => {
        const stock = Number(l.rawMaterial?.currentStock ?? 0)
        const needed = Number(l.quantity ?? 0)
        const portions = needed > 0 ? Math.floor(stock / needed) : Number.POSITIVE_INFINITY
        if (stock === 0 && needed > 0) outOfStockLineIds.add(l.id)
        yieldsByLineId.set(l.id, portions)
        return { id: l.id, portions }
      })
    if (evaluated.length > 0) {
      const min = Math.min(...evaluated.map(e => e.portions))
      maxProducible = Number.isFinite(min) ? min : 0
      bottleneckLineId = evaluated.find(e => e.portions === min)?.id ?? null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-5 border-b space-y-2">
          <DialogTitle className="text-xl leading-tight flex items-start gap-2.5 min-w-0">
            <ChefHat className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
            <span className="truncate">{product.name}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detalle de la receta de {product.name}: capacidad de producción, ingredientes, costos y notas.
          </DialogDescription>
          <div className="flex items-center gap-2 flex-wrap pl-7">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Tag className="h-3 w-3" />
              {product.category.name}
            </span>
            <span className="text-muted-foreground/40" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
              <DollarSign className="h-3 w-3" />
              Precio {Currency(product.price)}
            </span>
            {product.inventoryMethod && (
              <>
                <span className="text-muted-foreground/40" aria-hidden>
                  ·
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Package className="h-3 w-3" />
                  {product.inventoryMethod === 'RECIPE' ? 'por receta' : 'por cantidad'}
                </span>
              </>
            )}
            <div className="flex items-center gap-1.5 ml-auto">
              {!product.active && <Badge variant="secondary">Inactivo</Badge>}
              {!hasRecipe && (
                <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/60">
                  Sin receta
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-8">
            {!hasRecipe ? (
              <div className="flex flex-col items-center justify-center text-center py-8 gap-3">
                <ChefHat className="h-12 w-12 text-muted-foreground/40" />
                <div>
                  <h3 className="font-medium">Este producto no tiene receta configurada</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md">
                    Agrega una receta para rastrear costos por porción, descontar inventario automáticamente y obtener métricas de margen.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Production capacity — the headline answer to "can I sell this right now?" */}
                <section
                  className={`rounded-md border p-4 flex items-start gap-3.5 ${
                    maxProducible > 0
                      ? 'border-emerald-300/70 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20'
                      : 'border-destructive/40 bg-destructive/5'
                  }`}
                >
                  <div
                    className={`shrink-0 rounded-md p-1.5 ${
                      maxProducible > 0 ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-destructive/10'
                    }`}
                  >
                    {maxProducible > 0 ? (
                      <Sparkles className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p
                      className={`text-sm font-semibold ${
                        maxProducible > 0 ? 'text-emerald-900 dark:text-emerald-100' : 'text-destructive'
                      }`}
                    >
                      {maxProducible > 0
                        ? `Puedes producir ${maxProducible} ${maxProducible === 1 ? 'porción' : 'porciones'} con el inventario actual`
                        : 'No puedes producir esta receta ahora mismo'}
                    </p>
                    {bottleneckLineId && (
                      <p
                        className={`text-xs ${maxProducible > 0 ? 'text-emerald-800/80 dark:text-emerald-200/70' : 'text-destructive/80'}`}
                      >
                        Limitado por{' '}
                        <strong className="font-semibold">{recipe.lines.find(l => l.id === bottleneckLineId)?.rawMaterial?.name}</strong>
                        {outOfStockLineIds.has(bottleneckLineId) && ' — en cero'}
                      </p>
                    )}
                  </div>
                </section>

                {/* Out-of-stock ingredients — the SPECIFIC audit case (the user's "missing X" scenario) */}
                {outOfStockLineIds.size > 0 && (
                  <section className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      Ingredientes en cero ({outOfStockLineIds.size})
                    </h3>
                    <p className="text-xs text-destructive/85">
                      <strong className="font-semibold">
                        {recipe.lines
                          .filter(l => outOfStockLineIds.has(l.id))
                          .map(l => l.rawMaterial?.name)
                          .filter(Boolean)
                          .join(', ')}
                      </strong>{' '}
                      bloquean la producción.
                    </p>
                  </section>
                )}

                {/* Audit alerts (inactive / low stock — non-blocking warnings) */}
                {(missingLines.length > 0 || lowStockLines.length > 0) && (
                  <section className="rounded-md border border-amber-300/70 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-1.5">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-amber-900 dark:text-amber-200">
                      <AlertCircle className="h-4 w-4" />
                      Atención
                    </h3>
                    {missingLines.length > 0 && (
                      <p className="text-xs text-amber-900/85 dark:text-amber-200/85">
                        {missingLines.length} ingrediente{missingLines.length > 1 ? 's' : ''} inactivo
                        {missingLines.length > 1 ? 's' : ''}:{' '}
                        <strong className="font-semibold">
                          {missingLines
                            .map(l => l.rawMaterial?.name)
                            .filter(Boolean)
                            .join(', ')}
                        </strong>
                      </p>
                    )}
                    {lowStockLines.length > 0 && (
                      <p className="text-xs text-amber-900/85 dark:text-amber-200/85">
                        {lowStockLines.length} con stock bajo:{' '}
                        <strong className="font-semibold">
                          {lowStockLines
                            .map(l => l.rawMaterial?.name)
                            .filter(Boolean)
                            .join(', ')}
                        </strong>
                      </p>
                    )}
                  </section>
                )}

                {/* KPI strip */}
                <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat
                    label="Costo total"
                    value={Currency(totalCost)}
                    hint={`${recipe.lines.length} ingrediente${recipe.lines.length === 1 ? '' : 's'}`}
                    hintIcon={<Layers className="h-3 w-3" />}
                  />
                  <Stat
                    label="Porciones"
                    value={portionYield.toString()}
                    hint={portionYield === 1 ? 'una porción' : `${portionYield} porciones`}
                    hintIcon={<Utensils className="h-3 w-3" />}
                  />
                  <Stat
                    label="Costo por porción"
                    value={Currency(costPerPortion)}
                    hint={
                      product.price > 0
                        ? `${(((product.price - costPerPortion) / product.price) * 100).toFixed(1)}% de margen`
                        : 'sin precio de venta'
                    }
                    hintIcon={<Percent className="h-3 w-3" />}
                    highlight={margin < 30 && product.price > 0 ? 'warning' : undefined}
                  />
                  <Stat
                    label="Tiempo total"
                    value={totalTime > 0 ? `${totalTime} min` : '—'}
                    hint={recipe.prepTime || recipe.cookTime ? `prep ${recipe.prepTime ?? 0}m + coc ${recipe.cookTime ?? 0}m` : undefined}
                    hintIcon={<Timer className="h-3 w-3" />}
                  />
                </section>

                {/* Ingredients table */}
                <section>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Ingredientes
                  </h3>
                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-sm border-separate border-spacing-0">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          <th className="text-left px-3 pb-2 font-medium border-b border-border/40">Ingrediente</th>
                          <th className="text-right px-3 pb-2 font-medium border-b border-border/40">Cantidad</th>
                          <th className="text-right px-3 pb-2 font-medium border-b border-border/40">Aporta</th>
                          <th className="text-right px-3 pb-2 font-medium border-b border-border/40">Costo / porción</th>
                          {showTypeColumn && (
                            <th className="text-center px-3 pb-2 font-medium border-b border-border/40">Tipo</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {recipe.lines
                          .slice()
                          .sort((a, b) => a.displayOrder - b.displayOrder)
                          .map((line, idx, arr) => {
                            const rm = line.rawMaterial
                            const rmCurrent = rm ? Number(rm.currentStock) : 0
                            const rmMin = rm ? Number(rm.minimumStock) : 0
                            const stockLow = rm?.active && rmCurrent <= rmMin
                            const stockMissing = !rm?.active
                            const isOutOfStock = outOfStockLineIds.has(line.id)
                            const isBottleneck = bottleneckLineId === line.id && !line.isOptional && !line.isVariable
                            const portions = yieldsByLineId.get(line.id)
                            // Subtle row state — bg conveys urgency, no heavy borders.
                            const rowClass = isOutOfStock
                              ? 'bg-destructive/[0.04]'
                              : isBottleneck
                                ? 'bg-amber-50/40 dark:bg-amber-950/10'
                                : 'hover:bg-muted/30 transition-colors'
                            const isLastRow = idx === arr.length - 1
                            const cellBorder = isLastRow ? '' : 'border-b border-border/20'
                            return (
                              <tr key={line.id} className={rowClass}>
                                <td className={`px-3 py-2.5 ${cellBorder}`}>
                                  <div className="flex items-center gap-2">
                                    {rm && !stockMissing ? (
                                      <button
                                        type="button"
                                        onClick={() => openIngredient(rm.id)}
                                        className="text-left underline-offset-4 decoration-muted-foreground/40 hover:underline hover:text-foreground focus-visible:underline focus-visible:outline-none transition-colors"
                                        title="Ver detalle del ingrediente"
                                      >
                                        {rm.name}
                                      </button>
                                    ) : (
                                      <span className={stockMissing ? 'text-muted-foreground line-through' : ''}>
                                        {rm?.name ?? 'Ingrediente eliminado'}
                                      </span>
                                    )}
                                    {stockMissing && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                                          </TooltipTrigger>
                                          <TooltipContent>Ingrediente inactivo o eliminado</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                    {stockLow && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <AlertCircle className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Stock bajo: {rmCurrent.toFixed(2)} {getShortLabel(rm.unit)} (mín {rmMin.toFixed(2)})
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                  {rm && (
                                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5 tabular-nums">
                                      <span className="flex items-center gap-1">
                                        <Hash className="h-2.5 w-2.5" />
                                        {rm.sku}
                                      </span>
                                      {!stockMissing && (
                                        <span className={stockLow ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
                                          en stock {rmCurrent.toFixed(2)} {getShortLabel(rm.unit)}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className={`px-3 py-2.5 text-right tabular-nums ${cellBorder}`}>
                                  {Number(line.quantity).toFixed(2)} {getShortLabel(line.unit)}
                                </td>
                                <td className={`px-3 py-2.5 text-right tabular-nums ${cellBorder}`}>
                                  {line.isOptional || line.isVariable ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : portions === undefined ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : !Number.isFinite(portions) ? (
                                    <span className="text-muted-foreground">∞</span>
                                  ) : (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <span
                                        className={
                                          isOutOfStock
                                            ? 'text-destructive font-semibold'
                                            : isBottleneck
                                              ? 'text-amber-700 dark:text-amber-400 font-semibold'
                                              : ''
                                        }
                                      >
                                        {portions}
                                      </span>
                                      {isBottleneck && portions > 0 && (
                                        <Badge
                                          variant="outline"
                                          className="text-[9px] py-0 px-1 border-amber-400 text-amber-700 dark:text-amber-400"
                                        >
                                          mín
                                        </Badge>
                                      )}
                                      {isOutOfStock && (
                                        <Badge variant="destructive" className="text-[9px] py-0 px-1">
                                          0
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className={`px-3 py-2.5 text-right tabular-nums ${cellBorder}`}>{Currency(line.costPerServing)}</td>
                                {showTypeColumn && (
                                  <td className={`px-3 py-2.5 text-center ${cellBorder}`}>
                                    <div className="flex flex-col items-center gap-1">
                                      {line.isOptional && (
                                        <Badge variant="outline" className="text-[10px] py-0">
                                          Opcional
                                        </Badge>
                                      )}
                                      {line.isVariable && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger>
                                              <Badge
                                                variant="outline"
                                                className="text-[10px] py-0 gap-1 border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300"
                                              >
                                                <Sparkles className="h-2.5 w-2.5" />
                                                Variable
                                              </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              {line.linkedModifierGroup
                                                ? `Vinculado a grupo: ${line.linkedModifierGroup.name}`
                                                : 'Ingrediente variable'}
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                      {!line.isOptional && !line.isVariable && (
                                        <span className="text-[10px] text-muted-foreground">—</span>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td
                            colSpan={3}
                            className="px-3 pt-3 pb-1 text-right text-[10px] uppercase tracking-wider font-medium text-muted-foreground border-t border-border/40"
                          >
                            Total
                          </td>
                          <td className="px-3 pt-3 pb-1 text-right tabular-nums text-base font-semibold border-t border-border/40">
                            {Currency(totalCost)}
                          </td>
                          {showTypeColumn && <td className="border-t border-border/40" />}
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Substitute notes per line */}
                  {recipe.lines.some(l => l.substituteNotes) && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Lightbulb className="h-3 w-3" />
                        Notas de sustitución
                      </p>
                      {recipe.lines
                        .filter(l => l.substituteNotes)
                        .map(l => (
                          <p key={l.id} className="text-xs text-muted-foreground italic pl-4">
                            <span className="font-medium not-italic">{l.rawMaterial?.name}:</span> {l.substituteNotes}
                          </p>
                        ))}
                    </div>
                  )}
                </section>

                {/* Notes */}
                {recipe.notes && (
                  <section>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Notas de preparación
                    </h3>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground border-l-2 border-border/60 pl-3 py-0.5">
                      {recipe.notes}
                    </p>
                  </section>
                )}

                {/* Audit timestamps */}
                <section>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Historial
                  </h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <KV label="Receta creada" value={fmtDate(recipe.createdAt)} hint={fmtRelative(recipe.createdAt)} />
                    <KV label="Última actualización" value={fmtDate(recipe.updatedAt)} hint={fmtRelative(recipe.updatedAt)} />
                  </dl>
                </section>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer actions — ghost dismiss on the left, primary action on the right */}
        <div className="flex flex-wrap items-center justify-end gap-2 px-6 py-4 border-t bg-muted/30">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {onEdit && (
            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false)
                onEdit()
              }}
            >
              <Edit className="h-4 w-4 mr-1.5" />
              {hasRecipe ? 'Editar receta' : 'Crear receta'}
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
          <span>{hint}</span>
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
