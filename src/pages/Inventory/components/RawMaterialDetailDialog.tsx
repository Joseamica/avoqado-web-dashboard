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

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl flex items-center gap-2 flex-wrap">
                <Package className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="truncate">{rawMaterial.name}</span>
                {!rawMaterial.active && (
                  <Badge variant="secondary" className="ml-1">
                    {t('rawMaterials.inactive', { defaultValue: 'Inactivo' })}
                  </Badge>
                )}
                {isLow && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Stock bajo
                  </Badge>
                )}
              </DialogTitle>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  {rawMaterial.sku}
                </span>
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {rawMaterial.category}
                </span>
                {rawMaterial.gtin && <span>GTIN: {rawMaterial.gtin}</span>}
              </div>
            </div>
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
                  value={`${Number(rawMaterial.currentStock).toFixed(2)} ${rawMaterial.unit}`}
                  highlight={isLow ? 'danger' : isBelowReorder ? 'warning' : undefined}
                />
                <Stat label="Mínimo" value={`${Number(rawMaterial.minimumStock).toFixed(2)} ${rawMaterial.unit}`} />
                <Stat label="Punto de reorden" value={`${Number(rawMaterial.reorderPoint).toFixed(2)} ${rawMaterial.unit}`} />
                <Stat
                  label="Máximo"
                  value={rawMaterial.maximumStock ? `${Number(rawMaterial.maximumStock).toFixed(2)} ${rawMaterial.unit}` : '—'}
                  hint={stockPctOfMax !== null ? `${stockPctOfMax}% del máx.` : undefined}
                />
              </div>
              {isLow && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Stock por debajo del mínimo</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Faltan {(rawMaterial.minimumStock - rawMaterial.currentStock).toFixed(2)} {rawMaterial.unit} para llegar al mínimo. Se
                      recomienda hacer un pedido pronto.
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
                <Stat label="Costo unitario" value={Currency(rawMaterial.costPerUnit) + ` / ${rawMaterial.unit}`} />
                <Stat
                  label="Costo promedio"
                  value={Currency(rawMaterial.avgCostPerUnit) + ` / ${rawMaterial.unit}`}
                  hint={
                    Math.abs(rawMaterial.avgCostPerUnit - rawMaterial.costPerUnit) > 0.01
                      ? rawMaterial.avgCostPerUnit > rawMaterial.costPerUnit
                        ? 'Promedio mayor al actual (compras a mejor precio recientemente)'
                        : 'Promedio menor al actual (precios subieron)'
                      : 'Igual al costo actual'
                  }
                  hintIcon={
                    rawMaterial.avgCostPerUnit > rawMaterial.costPerUnit ? (
                      <TrendingDown className="h-3 w-3 text-green-600" />
                    ) : rawMaterial.avgCostPerUnit < rawMaterial.costPerUnit ? (
                      <TrendingUp className="h-3 w-3 text-orange-600" />
                    ) : null
                  }
                />
                <Stat
                  label="Inversión actual"
                  value={Currency(totalInvested)}
                  hint={`${Number(rawMaterial.currentStock).toFixed(2)} × ${Currency(rawMaterial.avgCostPerUnit)}`}
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
                <p className="text-sm text-muted-foreground">Cargando recetas...</p>
              ) : recipes.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No se usa en ninguna receta todavía.</p>
              ) : (
                <ul className="space-y-1.5">
                  {recipes.slice(0, 5).map(p => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between text-sm rounded-md border bg-muted/20 px-3 py-2 hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => {
                        onOpenChange(false)
                        navigate(`${fullBasePath}/inventory/recipes?productId=${p.id}`)
                      }}
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-3">{Currency(p.price)}</span>
                    </li>
                  ))}
                  {recipes.length > 5 && (
                    <li className="text-xs text-muted-foreground italic">y {recipes.length - 5} más...</li>
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

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/20">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
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
        ? 'text-orange-600 dark:text-orange-400 font-semibold'
        : 'font-semibold'
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm mt-0.5 ${valueClass}`}>{value}</div>
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
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">
        {value}
        {hint && <span className="text-xs text-muted-foreground ml-1.5">({hint})</span>}
      </dd>
    </div>
  )
}
