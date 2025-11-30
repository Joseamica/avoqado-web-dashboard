import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { recipesApi, rawMaterialsApi, type Recipe, type CreateRecipeDto } from '@/services/inventory.service'
import { Loader2, Plus, Trash2, Package, Info, RefreshCw } from 'lucide-react'
import { Currency } from '@/utils/currency'
import { AddIngredientDialog } from './AddIngredientDialog'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface ProductWithRecipe {
  id: string
  name: string
  price: number
  recipe?: Recipe
}

interface RecipeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  product: ProductWithRecipe | null
}

export function RecipeDialog({ open, onOpenChange, mode, product }: RecipeDialogProps) {
  const { t } = useTranslation('inventory')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [addIngredientOpen, setAddIngredientOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  // Track ingredients for create mode
  const [tempIngredients, setTempIngredients] = useState<
    Array<{
      rawMaterialId: string
      quantity: number
      unit: string
      isOptional?: boolean
      substituteNotes?: string
      isVariable?: boolean
      linkedModifierGroupId?: string | null
      linkedModifierGroupName?: string
    }>
  >([])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<Omit<CreateRecipeDto, 'lines'>>({
    defaultValues: {
      portionYield: 1,
      prepTime: undefined,
      cookTime: undefined,
      notes: '',
    },
  })

  // Fetch recipe for edit mode
  const { data: recipe, isLoading: recipeLoading } = useQuery({
    queryKey: ['recipe', venueId, product?.id],
    queryFn: async () => {
      if (!product) return null
      const response = await recipesApi.get(venueId, product.id)
      return response.data.data as Recipe
    },
    enabled: !!venueId && !!product && mode === 'edit' && open,
  })

  // Fetch raw materials to show names in create mode (use same cache as AddIngredientDialog)
  const { data: rawMaterialsData } = useQuery({
    queryKey: ['rawMaterials', venueId, ''],
    queryFn: async () => {
      const response = await rawMaterialsApi.getAll(venueId, { active: true })
      return response.data.data
    },
    enabled: !!venueId && open && mode === 'create',
  })

  // Reset form when dialog opens
  useEffect(() => {
    if (open && mode === 'edit' && recipe) {
      reset({
        portionYield: recipe.portionYield,
        prepTime: recipe.prepTime || undefined,
        cookTime: recipe.cookTime || undefined,
        notes: recipe.notes || '',
      })
    } else if (open && mode === 'create') {
      reset({
        portionYield: 1,
        prepTime: undefined,
        cookTime: undefined,
        notes: '',
      })
      setTempIngredients([]) // Clear temp ingredients
    }
  }, [open, mode, recipe, reset])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateRecipeDto) => recipesApi.create(venueId, product!.id, data),
    onSuccess: () => {
      // Invalidate all products-with-recipes queries (includes all filter combinations)
      queryClient.invalidateQueries({
        queryKey: ['products-with-recipes'],
        refetchType: 'active',
      })
      queryClient.invalidateQueries({ queryKey: ['recipe', venueId, product?.id] })
      // Invalidate raw materials to update usage count
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })
      toast({
        title: t('recipes.messages.created'),
        variant: 'default',
      })
      onOpenChange(false)
      reset()
      // Clear temp ingredients after successful creation
      setTempIngredients([])
    },
    onError: (error: any) => {
      // Always invalidate cache on error to sync with backend state
      queryClient.invalidateQueries({
        queryKey: ['products-with-recipes'],
        refetchType: 'active',
      })
      queryClient.invalidateQueries({ queryKey: ['recipe', venueId, product?.id] })
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })

      const errorMessage = error.response?.data?.message || 'Failed to create recipe'

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })

      // If recipe already exists, close dialog and let user see updated state
      if (errorMessage.toLowerCase().includes('already exists')) {
        onOpenChange(false)
      }
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: CreateRecipeDto) => recipesApi.update(venueId, product!.id, data),
    onSuccess: () => {
      // Invalidate all products-with-recipes queries (includes all filter combinations)
      queryClient.invalidateQueries({
        queryKey: ['products-with-recipes'],
        refetchType: 'active',
      })
      queryClient.invalidateQueries({ queryKey: ['recipe', venueId, product?.id] })
      // Invalidate raw materials to update usage count
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })
      toast({
        title: t('recipes.messages.updated'),
        variant: 'default',
      })
    },
    onError: (error: any) => {
      // Always invalidate cache on error to sync with backend state
      queryClient.invalidateQueries({
        queryKey: ['products-with-recipes'],
        refetchType: 'active',
      })
      queryClient.invalidateQueries({ queryKey: ['recipe', venueId, product?.id] })
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })

      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update recipe',
        variant: 'destructive',
      })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => recipesApi.delete(venueId, product!.id),
    onSuccess: () => {
      // Invalidate all products-with-recipes queries (includes all filter combinations)
      queryClient.invalidateQueries({
        queryKey: ['products-with-recipes'],
        refetchType: 'active',
      })
      queryClient.invalidateQueries({ queryKey: ['recipe', venueId, product?.id] })
      // Invalidate raw materials to update usage count
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })
      toast({
        title: t('recipes.messages.deleted'),
        variant: 'default',
      })
      onOpenChange(false)
      reset()
    },
    onError: (error: any) => {
      // Always invalidate cache on error to sync with backend state
      queryClient.invalidateQueries({
        queryKey: ['products-with-recipes'],
        refetchType: 'active',
      })
      queryClient.invalidateQueries({ queryKey: ['recipe', venueId, product?.id] })
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })

      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete recipe',
        variant: 'destructive',
      })
    },
  })

  // Remove ingredient mutation
  const removeIngredientMutation = useMutation({
    mutationFn: (recipeLineId: string) => recipesApi.removeLine(venueId, product!.id, recipeLineId),
    onSuccess: () => {
      // Invalidate all products-with-recipes queries (includes all filter combinations)
      queryClient.invalidateQueries({
        queryKey: ['products-with-recipes'],
        refetchType: 'active',
      })
      queryClient.invalidateQueries({ queryKey: ['recipe', venueId, product?.id] })
      // Invalidate raw materials to update usage count
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })
      toast({
        title: t('recipes.messages.ingredientRemoved'),
        variant: 'default',
      })
    },
    onError: (error: any) => {
      // Always invalidate cache on error to sync with backend state
      queryClient.invalidateQueries({
        queryKey: ['products-with-recipes'],
        refetchType: 'active',
      })
      queryClient.invalidateQueries({ queryKey: ['recipe', venueId, product?.id] })
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })

      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to remove ingredient',
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: Omit<CreateRecipeDto, 'lines'>) => {
    if (mode === 'create') {
      // For create mode, validate we have at least one ingredient
      if (tempIngredients.length === 0) {
        toast({
          title: 'Error',
          description: 'At least one ingredient is required',
          variant: 'destructive',
        })
        return
      }
      const payload: CreateRecipeDto = {
        ...data,
        lines: tempIngredients,
      }
      createMutation.mutate(payload)
    } else {
      // For edit mode, we update the recipe metadata
      // Lines are managed separately via add/remove ingredient
      const payload: CreateRecipeDto = {
        ...data,
        lines:
          recipe?.lines.map(line => ({
            rawMaterialId: line.rawMaterialId,
            quantity: Number(line.quantity),
            unit: line.unit,
            isOptional: line.isOptional,
            substituteNotes: line.substituteNotes || undefined,
            isVariable: line.isVariable,
            linkedModifierGroupId: line.linkedModifierGroupId,
          })) || [],
      }
      updateMutation.mutate(payload)
    }
  }

  const handleDeleteRecipe = () => {
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = () => {
    deleteMutation.mutate()
  }

  if (!product) return null

  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const ingredients = recipe?.lines || []
  const totalCost = recipe ? Number(recipe.totalCost) : 0
  const portionYield = watch('portionYield') || 1
  const costPerServing = totalCost / portionYield

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? t('recipes.add') : t('recipes.edit')} - {product.name}
            </DialogTitle>
            <DialogDescription>{mode === 'create' ? t('recipes.subtitle') : `${t('common.edit')} ${product.name}`}</DialogDescription>
          </DialogHeader>

          {recipeLoading && mode === 'edit' ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Recipe Metadata */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="portionYield">{t('recipes.fields.portionYield')} *</Label>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm bg-popover text-popover-foreground border border-border" side="right">
                          <div className="space-y-2 text-sm">
                            <p className="font-semibold">{t('recipes.portionYieldHelp.title')}</p>
                            <p>{t('recipes.portionYieldHelp.description')}</p>
                            <div className="space-y-1 text-xs">
                              <p className="font-medium">{t('recipes.portionYieldHelp.examples')}</p>
                              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                                <li>{t('recipes.portionYieldHelp.example1')}</li>
                                <li>{t('recipes.portionYieldHelp.example2')}</li>
                                <li>{t('recipes.portionYieldHelp.example3')}</li>
                              </ul>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="portionYield"
                    type="number"
                    step="1"
                    min="1"
                    {...register('portionYield', { required: true, valueAsNumber: true, min: 1 })}
                  />
                  {errors.portionYield && <p className="text-xs text-destructive">{t('validation.requiredMinValue', { value: '1' })}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prepTime">{t('recipes.fields.prepTime')}</Label>
                  <Input id="prepTime" type="number" step="1" {...register('prepTime', { valueAsNumber: true })} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cookTime">{t('recipes.fields.cookTime')}</Label>
                  <Input id="cookTime" type="number" step="1" {...register('cookTime', { valueAsNumber: true })} />
                </div>
              </div>

              {/* Cost Summary */}
              {mode === 'edit' && recipe && (
                <div className="p-4 rounded-lg bg-muted border border-border">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{t('recipes.fields.totalCost')}</p>
                      <p className="text-lg font-bold text-foreground">{Currency(totalCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('recipes.fields.costPerServing')}</p>
                      <p className="text-lg font-bold text-foreground">{Currency(costPerServing)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('pricing.fields.foodCostPercentage')}</p>
                      <p className="text-lg font-bold text-foreground">{((totalCost / Number(product.price)) * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Ingredients List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t('recipes.ingredients.title')}</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setAddIngredientOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t('recipes.addIngredient')}
                  </Button>
                </div>

                {(mode === 'create' && tempIngredients.length === 0) || (mode === 'edit' && ingredients.length === 0) ? (
                  <Alert>
                    <AlertDescription>
                      {t('recipes.messages.noRecipe')} - {t('recipes.addIngredient').toLowerCase()}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="max-h-[330px] overflow-y-auto rounded-md border border-border">
                    <div className="space-y-2 p-3">
                      {mode === 'create'
                        ? tempIngredients.map((line, index) => {
                            // Find the raw material name from the fetched data
                            const rawMaterial = rawMaterialsData?.find(rm => rm.id === line.rawMaterialId)
                            const ingredientName = rawMaterial?.name || line.rawMaterialId
                            const costPerUnit = rawMaterial ? Number(rawMaterial.costPerUnit) : 0
                            const lineCost = costPerUnit * Number(line.quantity)

                            return (
                              <div
                                key={index}
                                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                              >
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 border border-border">
                                  {line.isVariable ? (
                                    <RefreshCw className="h-5 w-5 text-amber-500" />
                                  ) : (
                                    <Package className="h-5 w-5 text-primary" />
                                  )}
                                </div>

                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-foreground">
                                      {ingredientName}
                                      {line.isOptional && (
                                        <span className="ml-2 text-xs text-muted-foreground">({t('recipes.ingredients.optional')})</span>
                                      )}
                                    </p>
                                    {line.isVariable && (
                                      <TooltipProvider delayDuration={200}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                              <RefreshCw className="h-3 w-3" />
                                              {t('recipes.ingredients.variableIngredient')}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top">
                                            <p className="text-xs">
                                              {t('recipes.ingredients.variableIngredientDesc')}
                                              {line.linkedModifierGroupName && (
                                                <>
                                                  <br />
                                                  <strong>{t('recipes.ingredients.linkedModifierGroup')}:</strong> {line.linkedModifierGroupName}
                                                </>
                                              )}
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {Number(line.quantity).toFixed(2)} {line.unit}
                                    {rawMaterial && (
                                      <>
                                        {' '}
                                        × {Currency(costPerUnit)} = {Currency(lineCost)}
                                      </>
                                    )}
                                  </p>
                                </div>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setTempIngredients(prev => prev.filter((_, i) => i !== index))}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            )
                          })
                        : ingredients.map(line => {
                            const lineCost = Number(line.costPerServing) * portionYield
                            return (
                              <div
                                key={line.id}
                                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                              >
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 border border-border">
                                  {line.isVariable ? (
                                    <RefreshCw className="h-5 w-5 text-amber-500" />
                                  ) : (
                                    <Package className="h-5 w-5 text-primary" />
                                  )}
                                </div>

                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-foreground">
                                      {line.rawMaterial.name}
                                      {line.isOptional && (
                                        <span className="ml-2 text-xs text-muted-foreground">({t('recipes.ingredients.optional')})</span>
                                      )}
                                    </p>
                                    {line.isVariable && (
                                      <TooltipProvider delayDuration={200}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                              <RefreshCw className="h-3 w-3" />
                                              {t('recipes.ingredients.variableIngredient')}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top">
                                            <p className="text-xs">
                                              {t('recipes.ingredients.variableIngredientDesc')}
                                              {line.linkedModifierGroup && (
                                                <>
                                                  <br />
                                                  <strong>{t('recipes.ingredients.linkedModifierGroup')}:</strong> {line.linkedModifierGroup.name}
                                                </>
                                              )}
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {Number(line.quantity).toFixed(2)} {line.unit} × {Currency(Number(line.rawMaterial.costPerUnit))} ={' '}
                                    {Currency(lineCost)}
                                  </p>
                                </div>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeIngredientMutation.mutate(line.id)}
                                  disabled={removeIngredientMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            )
                          })}
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">{t('recipes.fields.notes')}</Label>
                <Textarea id="notes" rows={3} {...register('notes')} />
              </div>

              <DialogFooter className="flex justify-between">
                <div>
                  {mode === 'edit' && (
                    <Button type="button" variant="destructive" onClick={handleDeleteRecipe} disabled={isLoading}>
                      {t('recipes.delete')}
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                    {t('cancel')}
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('save')}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Ingredient Dialog */}
      <AddIngredientDialog
        open={addIngredientOpen}
        onOpenChange={setAddIngredientOpen}
        product={product}
        mode={mode}
        onAddTempIngredient={ingredient => {
          if (mode === 'create') {
            setTempIngredients(prev => [...prev, ingredient])
          }
        }}
      />

      {/* Delete Recipe Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t('recipes.delete')}
        description={`${t('common.confirm')}? ${t('recipes.delete')} "${product.name}"`}
        confirmText={t('common.delete')}
        cancelText={t('cancel')}
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </>
  )
}
