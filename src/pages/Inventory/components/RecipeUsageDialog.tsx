import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { rawMaterialsApi, type RawMaterial } from '@/services/inventory.service'
import { Loader2, ChefHat, ExternalLink } from 'lucide-react'
import { Currency } from '@/utils/currency'

interface RecipeUsageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rawMaterial: RawMaterial | null
  onRecipeClick: (productId: string, productName: string, productPrice: number) => void
}

interface ProductWithRecipe {
  id: string
  name: string
  price: number
  recipe: {
    id: string
    totalCost: number
    portionYield: number
    lines: Array<{
      id: string
      quantity: number
      unit: string
    }>
  }
}

export function RecipeUsageDialog({ open, onOpenChange, rawMaterial, onRecipeClick }: RecipeUsageDialogProps) {
  const { t } = useTranslation('inventory')
  const { venueId } = useCurrentVenue()

  const { data: recipesData, isLoading } = useQuery({
    queryKey: ['rawMaterialRecipes', venueId, rawMaterial?.id],
    queryFn: async () => {
      const response = await rawMaterialsApi.getRecipes(venueId, rawMaterial!.id)
      return response.data.data as ProductWithRecipe[]
    },
    enabled: !!venueId && !!rawMaterial && open,
  })

  const recipes = recipesData || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('rawMaterials.usage.title')}</DialogTitle>
          <DialogDescription>
            {rawMaterial?.name} - {recipes.length > 0 ? t('rawMaterials.usage.usedIn', { count: recipes.length }) : t('rawMaterials.usage.notUsed')}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : recipes.length === 0 ? (
          <Alert>
            <AlertDescription>
              {t('rawMaterials.usage.noRecipes')}
            </AlertDescription>
          </Alert>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {recipes.map((product) => {
                const _recipeLine = product.recipe.lines.find(line => line.id)
                const foodCostPercentage = (Number(product.recipe.totalCost) / Number(product.price)) * 100

                return (
                  <button
                    key={product.id}
                    onClick={() => {
                      onRecipeClick(product.id, product.name, product.price)
                      onOpenChange(false)
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 border border-border">
                      <ChefHat className="h-6 w-6 text-primary" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{product.name}</p>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span>{t('recipes.fields.currentPrice')}: {Currency(Number(product.price))}</span>
                        <span>{t('recipes.fields.totalCost')}: {Currency(Number(product.recipe.totalCost))}</span>
                        <span className={`font-medium ${foodCostPercentage > 35 ? 'text-destructive' : foodCostPercentage > 30 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                          {t('pricing.fields.foodCostPercentage')}: {foodCostPercentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
