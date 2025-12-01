import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { pricingApi, type CreatePricingPolicyDto, type PricingPolicy, type UpdatePricingPolicyDto } from '@/services/inventory.service'
import { Currency } from '@/utils/currency'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

interface ProductWithPricing {
  id: string
  name: string
  price: number
  recipe?: {
    id: string
    totalCost: number
    portionYield: number
  }
  pricingPolicy?: PricingPolicy
}

interface PricingPolicyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: ProductWithPricing | null
}

interface PricingPolicyForm {
  pricingStrategy: 'MANUAL' | 'AUTO_MARKUP' | 'AUTO_TARGET_MARGIN'
  targetFoodCostPercentage?: number
  targetMarkupPercentage?: number
  minimumPrice?: number
}

export function PricingPolicyDialog({ open, onOpenChange, product }: PricingPolicyDialogProps) {
  const { t } = useTranslation('inventory')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PricingPolicyForm>({
    defaultValues: {
      pricingStrategy: 'MANUAL',
      targetFoodCostPercentage: 30,
      targetMarkupPercentage: 200,
      minimumPrice: 0,
    },
  })

  const pricingStrategy = watch('pricingStrategy')
  const targetFoodCostPercentage = watch('targetFoodCostPercentage')
  const targetMarkupPercentage = watch('targetMarkupPercentage')
  const minimumPrice = watch('minimumPrice')

  // Fetch existing pricing policy
  const { data: existingPolicy } = useQuery({
    queryKey: ['pricing-policy', venueId, product?.id],
    queryFn: async () => {
      if (!product) return null
      try {
        const response = await pricingApi.getPolicy(venueId, product.id)
        return response.data.data as PricingPolicy
      } catch (error: any) {
        if (error.response?.status === 404) {
          return null
        }
        throw error
      }
    },
    enabled: !!venueId && !!product && open,
  })

  // Calculate suggested price
  const { data: calculatedPrice } = useQuery({
    queryKey: ['calculate-price', venueId, product?.id, pricingStrategy, targetFoodCostPercentage, targetMarkupPercentage],
    queryFn: async () => {
      if (!product) return null
      const response = await pricingApi.calculatePrice(venueId, product.id)
      return response.data.data
    },
    enabled: !!venueId && !!product && open && pricingStrategy !== 'MANUAL',
  })

  // Reset form when dialog opens or existing policy changes
  useEffect(() => {
    if (open && product) {
      if (existingPolicy) {
        reset({
          pricingStrategy: existingPolicy.pricingStrategy,
          targetFoodCostPercentage: existingPolicy.targetFoodCostPercentage || 30,
          targetMarkupPercentage: existingPolicy.targetMarkupPercentage || 200,
          minimumPrice: existingPolicy.minimumPrice ? Number(existingPolicy.minimumPrice) : 0,
        })
      } else {
        reset({
          pricingStrategy: 'MANUAL',
          targetFoodCostPercentage: 30,
          targetMarkupPercentage: 200,
          minimumPrice: 0,
        })
      }
    }
  }, [open, product, existingPolicy, reset])

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: PricingPolicyForm) => {
      if (!product) throw new Error('No product selected')

      const payload: CreatePricingPolicyDto | UpdatePricingPolicyDto = {
        pricingStrategy: data.pricingStrategy,
        ...(data.pricingStrategy === 'AUTO_TARGET_MARGIN' && {
          targetFoodCostPercentage: data.targetFoodCostPercentage,
        }),
        ...(data.pricingStrategy === 'AUTO_MARKUP' && {
          targetMarkupPercentage: data.targetMarkupPercentage,
        }),
        ...(data.minimumPrice && { minimumPrice: data.minimumPrice }),
      }

      if (existingPolicy) {
        return pricingApi.updatePolicy(venueId, product.id, payload)
      } else {
        return pricingApi.createPolicy(venueId, product.id, payload as CreatePricingPolicyDto)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-pricing', venueId] })
      queryClient.invalidateQueries({ queryKey: ['pricing-policy', venueId, product?.id] })
      toast({
        title: existingPolicy ? t('pricing.messages.policyUpdated') : t('pricing.messages.policyCreated'),
        variant: 'default',
      })
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to save pricing policy',
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: PricingPolicyForm) => {
    saveMutation.mutate(data)
  }

  if (!product) return null

  const recipeCost = product.recipe ? Number(product.recipe.totalCost) : 0
  const currentPrice = Number(product.price)
  const currentFoodCostPercentage = recipeCost > 0 ? (recipeCost / currentPrice) * 100 : 0

  // Calculate suggested price based on strategy
  let suggestedPrice = currentPrice
  if (pricingStrategy === 'AUTO_TARGET_MARGIN' && targetFoodCostPercentage) {
    suggestedPrice = recipeCost / (targetFoodCostPercentage / 100)
  } else if (pricingStrategy === 'AUTO_MARKUP' && targetMarkupPercentage) {
    suggestedPrice = recipeCost * (1 + targetMarkupPercentage / 100)
  }

  // Apply minimum price constraint
  if (minimumPrice && suggestedPrice < minimumPrice) {
    suggestedPrice = minimumPrice
  }

  const suggestedFoodCostPercentage = recipeCost > 0 ? (recipeCost / suggestedPrice) * 100 : 0
  const priceDifference = suggestedPrice - currentPrice
  const priceChangePercentage = currentPrice > 0 ? (priceDifference / currentPrice) * 100 : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingPolicy ? t('pricing.updatePolicy') : t('pricing.createPolicy')}</DialogTitle>
          <DialogDescription>{product.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Current Metrics */}
          <div className="p-4 rounded-lg border border-border bg-muted/50">
            <h3 className="text-sm font-semibold text-foreground mb-3">{t('recipes.fields.currentPrice')}</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">{t('pricing.fields.currentPrice')}</p>
                <p className="text-lg font-bold text-foreground">{Currency(currentPrice)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('pricing.fields.recipeCost')}</p>
                <p className="text-lg font-bold text-foreground">{Currency(recipeCost)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('pricing.fields.foodCostPercentage')}</p>
                <p className="text-lg font-bold text-foreground">{currentFoodCostPercentage.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* Pricing Strategy */}
          <div className="space-y-2">
            <Label htmlFor="pricingStrategy">{t('pricing.fields.strategy')} *</Label>
            <Select value={pricingStrategy} onValueChange={(value: any) => setValue('pricingStrategy', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANUAL">{t('pricing.strategies.MANUAL')}</SelectItem>
                <SelectItem value="AUTO_MARKUP">{t('pricing.strategies.AUTO_MARKUP')}</SelectItem>
                <SelectItem value="AUTO_TARGET_MARGIN">{t('pricing.strategies.AUTO_TARGET_MARGIN')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {pricingStrategy === 'MANUAL' && t('pricingStrategy.manualDescription')}
              {pricingStrategy === 'AUTO_MARKUP' && t('pricingStrategy.autoMarkupDescription')}
              {pricingStrategy === 'AUTO_TARGET_MARGIN' && t('pricingStrategy.autoTargetMarginDescription')}
            </p>
          </div>

          {/* Strategy-specific fields */}
          {pricingStrategy === 'AUTO_TARGET_MARGIN' && (
            <div className="space-y-2">
              <Label htmlFor="targetFoodCostPercentage">{t('pricing.fields.targetFoodCost')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="targetFoodCostPercentage"
                  type="number"
                  step="0.1"
                  min="1"
                  max="100"
                  {...register('targetFoodCostPercentage', { required: true, valueAsNumber: true, min: 1, max: 100 })}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              {errors.targetFoodCostPercentage && <p className="text-xs text-destructive">{t('validation.requiredRange', { min: 1, max: 100 })}</p>}
            </div>
          )}

          {pricingStrategy === 'AUTO_MARKUP' && (
            <div className="space-y-2">
              <Label htmlFor="targetMarkupPercentage">{t('pricing.fields.targetMarkup')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="targetMarkupPercentage"
                  type="number"
                  step="1"
                  min="0"
                  {...register('targetMarkupPercentage', { required: true, valueAsNumber: true, min: 0 })}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              {errors.targetMarkupPercentage && <p className="text-xs text-destructive">{t('validation.requiredMinValue', { value: '0%' })}</p>}
            </div>
          )}

          {/* Minimum Price */}
          <div className="space-y-2">
            <Label htmlFor="minimumPrice">{t('pricing.fields.minimumPrice')}</Label>
            <Input id="minimumPrice" type="number" step="0.01" min="0" {...register('minimumPrice', { valueAsNumber: true, min: 0 })} />
            <p className="text-xs text-muted-foreground">{t('validation.optionalPriceFloor')}</p>
          </div>

          {/* Suggested Price Preview */}
          {pricingStrategy !== 'MANUAL' && (
            <>
              <div className="p-4 rounded-lg border border-border bg-primary/5">
                <h3 className="text-sm font-semibold text-foreground mb-3">{t('pricing.fields.suggestedPrice')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('pricing.fields.suggestedPrice')}</p>
                    <p className="text-2xl font-bold text-primary">{Currency(suggestedPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('pricing.fields.foodCostPercentage')}</p>
                    <p className="text-2xl font-bold text-primary">{suggestedFoodCostPercentage.toFixed(1)}%</p>
                  </div>
                </div>

                {/* Price Change Indicator */}
                {Math.abs(priceDifference) > 0.01 && (
                  <div className="mt-4 flex items-center gap-2">
                    {priceDifference > 0 ? (
                      <>
                        <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-medium text-green-600 dark:text-green-400">
                          +{Currency(priceDifference)} ({priceChangePercentage > 0 ? '+' : ''}
                          {priceChangePercentage.toFixed(1)}%)
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span className="text-sm font-medium text-red-600 dark:text-red-400">
                          {Currency(priceDifference)} ({priceChangePercentage.toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Warning if price is too low */}
              {suggestedFoodCostPercentage > 40 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Food cost percentage is too high ({suggestedFoodCostPercentage.toFixed(1)}%). Consider increasing the price or reducing
                    recipe costs.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
