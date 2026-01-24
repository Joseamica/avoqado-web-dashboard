import { useQuery } from '@tanstack/react-query'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Badge } from '@/components/ui/badge'
import { productInventoryApi } from '@/services/inventory.service'
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ShoppingCart } from 'lucide-react'

interface YieldStatusHoverCardProps {
  productId: string
  currentYield?: number
  triggerClassName?: string
}

export function YieldStatusHoverCard({ productId, currentYield, triggerClassName }: YieldStatusHoverCardProps) {
  const { t } = useTranslation('inventory')
  const { t: tCommon } = useTranslation('common')
  const { venueId, fullBasePath } = useCurrentVenue()
  const { formatUnitWithQuantity } = useUnitTranslation()
  const navigate = useNavigate()

  const { data: status, isLoading } = useQuery({
    queryKey: ['product-inventory-status', venueId, productId],
    queryFn: async () => {
      const response = await productInventoryApi.getStatus(venueId!, productId)
      // Backend wraps response in { success, data }, extract the actual status
      const responseData = response.data as unknown as { success: boolean; data: typeof response.data }
      return responseData.data
    },
    enabled: !!venueId && !!productId,
    staleTime: 1000 * 60, // Cache for 1 minute
  })

  // Determine status color based on availability
  // For recipes, backend might return available=false if physical stock is 0, but we want to show available if we can produce portions.
  const maxPortions = status?.maxPortions ?? currentYield ?? 0
  const isAvailable = (status?.available ?? false) || maxPortions > 0
  const lowStock = status?.lowStock ?? false

  // Detect unconfigured recipe state
  const isNotConfigured = status && !status.limitingIngredient && !status.insufficientIngredients?.length && maxPortions === 0 && !status.available

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <div className={`flex items-center gap-2 cursor-help ${triggerClassName}`}>
          {isNotConfigured ? (
             <Badge variant="outline" className="text-[10px] h-6 px-2 text-muted-foreground border-dashed">
                {t('yieldStatus.noRecipeBadge', { defaultValue: 'Sin Receta' })}
             </Badge>
          ) : (
            <>
              <span className={`font-medium ${!isAvailable ? 'text-destructive' : lowStock ? 'text-yellow-600 dark:text-yellow-500' : ''}`}>
                {maxPortions}
              </span>
              <Badge 
                variant="secondary" 
                className={`text-[10px] h-5 px-1.5 border ${
                  !isAvailable 
                    ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900'
                    : lowStock
                      ? 'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-900'
                      : 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900'
                }`}
              >
                {isAvailable ? 'Auto' : '0'}
              </Badge>
            </>
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-0 overflow-hidden border-border" align="start">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-semibold">{t('yieldStatus.title', { defaultValue: 'Capacidad de Producción' })}</h4>
              <p className="text-xs text-muted-foreground">
                {t('yieldStatus.subtitle', { defaultValue: 'Basado en inventario actual' })}
              </p>
            </div>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : isAvailable ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
          </div>

          {/* Main Stat */}
          <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between">
            <span className="text-sm font-medium">{t('yieldStatus.maxPortions', { defaultValue: 'Máximo posible' })}:</span>
            <span className="text-xl font-bold">{isLoading ? '...' : maxPortions}</span>
          </div>

          {!isLoading && status && (
            <div className="space-y-3">
              {/* Priority 1: Max Portions 0? */}
              {maxPortions === 0 && (
                 <div className="flex items-center gap-2 text-xs text-destructive font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    {status.limitingIngredient 
                        ? t('yieldStatus.outOfStock', { defaultValue: 'Sin stock disponible' })
                        : t('yieldStatus.noRecipe', { defaultValue: 'No se puede producir (Revisar Receta)' })
                    }
                 </div>
              )}

              {/* Bottleneck Ingredient Logic (The "WHY") */}
              {status.limitingIngredient ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/80">
                    <AlertTriangle className={`h-3 w-3 ${maxPortions === 0 ? 'text-destructive' : 'text-yellow-600'}`} />
                    {t('yieldStatus.limitingFactor', { defaultValue: 'Ingrediente Limitante' })}
                  </div>

                  {/* Show bottleneck item */}
                  <div className={`rounded-md border p-3 space-y-2 ${maxPortions === 0 ? 'border-destructive/20 bg-destructive/5' : 'border-yellow-200/50 bg-yellow-50/50 dark:border-yellow-900/50 dark:bg-yellow-950/20'}`}>
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{status.limitingIngredient.name}</span>
                         <Button
                         variant="outline"
                         size="icon"
                         className="h-6 w-6 ml-auto cursor-pointer"
                            title={tCommon('restock', { defaultValue: 'Reponer Stock' })}
                            onClick={() => navigate(`${fullBasePath}/inventory/raw-materials?search=${encodeURIComponent(status.limitingIngredient!.name)}&openRestock=true`)}
                         >
                            <ShoppingCart className="h-3 w-3" />
                         </Button>
                    </div>

                    {/* Clear explanation message */}
                    <div className={`text-xs font-medium ${maxPortions === 0 ? 'text-destructive' : 'text-yellow-700 dark:text-yellow-400'}`}>
                      {maxPortions === 0
                        ? t('yieldStatus.cantProduce', { defaultValue: 'No alcanza para producir ni 1 porción' })
                        : t('yieldStatus.onlyEnoughFor', { count: maxPortions, defaultValue: `Solo alcanza para ${maxPortions} ${maxPortions === 1 ? 'porción' : 'porciones'}` })
                      }
                    </div>

                    {/* Stock details in a clear grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
                        <div>
                          <span className="text-muted-foreground">{t('yieldStatus.currentStock', { defaultValue: 'Stock actual' })}:</span>
                          <span className="ml-1 font-medium">{status.limitingIngredient.available} {formatUnitWithQuantity(status.limitingIngredient.available, status.limitingIngredient.unit)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('yieldStatus.perPortion', { defaultValue: 'Por porción' })}:</span>
                          <span className="ml-1 font-medium">{status.limitingIngredient.required} {formatUnitWithQuantity(status.limitingIngredient.required, status.limitingIngredient.unit)}</span>
                        </div>
                    </div>

                    {/* Show remaining after production */}
                    {maxPortions > 0 && (
                      <div className="text-xs text-muted-foreground italic">
                        {t('yieldStatus.afterProduction', {
                          remaining: (status.limitingIngredient.available - (maxPortions * status.limitingIngredient.required)).toFixed(1),
                          unit: formatUnitWithQuantity(status.limitingIngredient.available - (maxPortions * status.limitingIngredient.required), status.limitingIngredient.unit),
                          defaultValue: `Después de producir ${maxPortions}: quedan ${(status.limitingIngredient.available - (maxPortions * status.limitingIngredient.required)).toFixed(1)} ${formatUnitWithQuantity(status.limitingIngredient.available - (maxPortions * status.limitingIngredient.required), status.limitingIngredient.unit)}`
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : maxPortions > 0 ? (
                <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    {t('yieldStatus.fullStock', { defaultValue: 'Todos los ingredientes tienen stock suficiente' })}
                </div>
              ) : (
                /* Fallback if no limiting ingredient found (e.g. no recipe) */
                 <div className="text-xs text-muted-foreground italic">
                    {t('yieldStatus.recipeNotConfigured', { defaultValue: 'Receta no configurada o sin ingredientes' })}
                 </div>
              )}
            </div>
          )}
          
          {/* Edit Filter Link */}
          <div className="pt-2 border-t border-border flex justify-end">
             <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs text-muted-foreground hover:text-foreground p-0"
                onClick={() => navigate(`${fullBasePath}/inventory/recipes?productId=${productId}`)}
             >
                {t('recipes.edit')} <ArrowRight className="ml-1 h-3 w-3" />
             </Button>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
