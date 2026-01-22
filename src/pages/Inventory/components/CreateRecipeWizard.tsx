import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChefHat,
  Search,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Package,
  DollarSign,
  TrendingUp,
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Info,
  Sparkles,
} from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { useToast } from '@/hooks/use-toast'
import { recipesApi, rawMaterialsApi, type RawMaterial, type CreateRecipeDto } from '@/services/inventory.service'
import api from '@/api'
import { Currency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { AddIngredientDialog } from './AddIngredientDialog'

interface ProductWithRecipe {
  id: string
  name: string
  price: number
  active: boolean
  category: {
    id: string
    name: string
  }
  recipe?: {
    id: string
  }
  inventoryMethod?: 'QUANTITY' | 'RECIPE' | null
}

interface TempIngredient {
  rawMaterialId: string
  rawMaterialName?: string
  quantity: number
  unit: string
  isOptional?: boolean
  substituteNotes?: string
  isVariable?: boolean
  linkedModifierGroupId?: string | null
  linkedModifierGroupName?: string
}

interface CreateRecipeWizardProps {
  open: boolean
  onClose: () => void
}

export function CreateRecipeWizard({ open, onClose }: CreateRecipeWizardProps) {
  const { t } = useTranslation('inventory')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatUnit } = useUnitTranslation()

  // Wizard state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [selectedProduct, setSelectedProduct] = useState<ProductWithRecipe | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Recipe data state
  const [portionYield, setPortionYield] = useState(1)
  const [prepTime, setPrepTime] = useState<number | undefined>(undefined)
  const [cookTime, setCookTime] = useState<number | undefined>(undefined)
  const [notes, setNotes] = useState('')
  const [ingredients, setIngredients] = useState<TempIngredient[]>([])
  const [addIngredientOpen, setAddIngredientOpen] = useState(false)

  // Reset wizard when closed
  useEffect(() => {
    if (!open) {
      setCurrentStep(1)
      setSelectedProduct(null)
      setSearchTerm('')
      setPortionYield(1)
      setPrepTime(undefined)
      setCookTime(undefined)
      setNotes('')
      setIngredients([])
    }
  }, [open])

  // Fetch products without recipes
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products-without-recipes', venueId, debouncedSearchTerm],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/products`, {
        params: { includeRecipe: true },
      })
      let productsData = response.data.data as ProductWithRecipe[]

      // Filter to only products without recipes
      productsData = productsData.filter(p => !p.recipe)

      // Apply search filter
      if (debouncedSearchTerm) {
        const lowerSearch = debouncedSearchTerm.toLowerCase()
        productsData = productsData.filter(
          p => p.name.toLowerCase().includes(lowerSearch) || p.category.name.toLowerCase().includes(lowerSearch)
        )
      }

      return productsData
    },
    enabled: !!venueId && open && currentStep === 1,
  })

  // Fetch raw materials for cost calculation
  const { data: rawMaterialsData } = useQuery({
    queryKey: ['rawMaterials', venueId, ''],
    queryFn: async () => {
      const response = await rawMaterialsApi.getAll(venueId, { active: true })
      return response.data.data as RawMaterial[]
    },
    enabled: !!venueId && open && currentStep >= 2,
  })

  // Create recipe mutation
  const createRecipeMutation = useMutation({
    mutationFn: (data: CreateRecipeDto) => recipesApi.create(venueId, selectedProduct!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-with-recipes'] })
      queryClient.invalidateQueries({ queryKey: ['products-without-recipes'] })
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })
      toast({
        title: t('recipes.messages.created'),
        variant: 'default',
      })
      onClose()
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: ['products-with-recipes'] })
      queryClient.invalidateQueries({ queryKey: ['products-without-recipes'] })
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || t('recipeWizard.createError'),
        variant: 'destructive',
      })
    },
  })

  // Calculate costs
  const costCalculations = useMemo(() => {
    if (!selectedProduct || ingredients.length === 0) {
      return { totalCost: 0, costPerPortion: 0, foodCostPercentage: 0, marginPerUnit: 0, marginPercentage: 0 }
    }

    let totalCost = 0
    ingredients.forEach(ing => {
      const rawMaterial = rawMaterialsData?.find(rm => rm.id === ing.rawMaterialId)
      if (rawMaterial) {
        totalCost += Number(rawMaterial.costPerUnit) * ing.quantity
      }
    })

    const costPerPortion = totalCost / portionYield
    const price = Number(selectedProduct.price)
    const foodCostPercentage = price > 0 ? (costPerPortion / price) * 100 : 0
    const marginPerUnit = price - costPerPortion
    const marginPercentage = price > 0 ? (marginPerUnit / price) * 100 : 0

    return { totalCost, costPerPortion, foodCostPercentage, marginPerUnit, marginPercentage }
  }, [ingredients, rawMaterialsData, selectedProduct, portionYield])

  // Get food cost color class
  const getFoodCostColorClass = (percentage: number) => {
    if (percentage > 40) return 'text-red-600 dark:text-red-400'
    if (percentage > 30) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-green-600 dark:text-green-400'
  }

  // Handle ingredient removal
  const handleRemoveIngredient = (index: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== index))
  }

  // Handle recipe creation
  const handleCreateRecipe = () => {
    if (!selectedProduct || ingredients.length === 0) return

    const payload: CreateRecipeDto = {
      portionYield,
      prepTime: prepTime || undefined,
      cookTime: cookTime || undefined,
      notes: notes || undefined,
      lines: ingredients.map(ing => ({
        rawMaterialId: ing.rawMaterialId,
        quantity: ing.quantity,
        unit: ing.unit,
        isOptional: ing.isOptional,
        substituteNotes: ing.substituteNotes,
        isVariable: ing.isVariable,
        linkedModifierGroupId: ing.linkedModifierGroupId || null,
      })),
    }

    createRecipeMutation.mutate(payload)
  }

  // Navigation
  const canGoNext = () => {
    if (currentStep === 1) return !!selectedProduct
    if (currentStep === 2) return ingredients.length > 0 && portionYield >= 1
    return true
  }

  const handleNext = () => {
    if (currentStep === 1 && selectedProduct) setCurrentStep(2)
    else if (currentStep === 2 && ingredients.length > 0) setCurrentStep(3)
  }

  const handleBack = () => {
    if (currentStep === 2) setCurrentStep(1)
    else if (currentStep === 3) setCurrentStep(2)
  }

  const progressPercentage = (currentStep / 3) * 100

  // Step titles
  const stepTitles = {
    1: t('recipeWizard.step1.title'),
    2: t('recipeWizard.step2.title'),
    3: t('recipeWizard.step3.title'),
  }

  return (
    <>
      <FullScreenModal
        open={open}
        onClose={onClose}
        title={t('recipeWizard.title')}
        actions={
          currentStep === 3 ? (
            <Button
              onClick={handleCreateRecipe}
              disabled={createRecipeMutation.isPending}
              className="gap-2"
            >
              {createRecipeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle2 className="h-4 w-4" />
              {t('recipeWizard.createRecipe')}
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col h-full">
          {/* Progress Header */}
          <div className="border-b border-border/30 bg-muted/30">
            <div className="max-w-4xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  {t('recipeWizard.stepProgress', { current: currentStep, total: 3 })}
                </span>
                <span className="text-sm font-medium">{stepTitles[currentStep]}</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />

              {/* Step indicators */}
              <div className="flex justify-between mt-4">
                {[1, 2, 3].map(step => (
                  <div key={step} className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                        currentStep >= step
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {step}
                    </div>
                    <span
                      className={cn(
                        'text-sm hidden sm:inline',
                        currentStep >= step ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {stepTitles[step as 1 | 2 | 3]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-6 py-8">
              {/* Step 1: Select Product */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  {/* Educational Header */}
                  <div className="flex items-start gap-4 p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                    <div className="p-3 rounded-xl bg-primary/20">
                      <ChefHat className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold">{t('recipeWizard.step1.header')}</h2>
                      <p className="text-sm text-muted-foreground">
                        {t('recipeWizard.step1.description')}
                      </p>
                    </div>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('recipeWizard.step1.searchPlaceholder')}
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Products List */}
                  <ScrollArea className="h-[400px]">
                    {productsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : products && products.length > 0 ? (
                      <div className="space-y-2">
                        {products.map(product => (
                          <div
                            key={product.id}
                            onClick={() => setSelectedProduct(product)}
                            className={cn(
                              'flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all',
                              selectedProduct?.id === product.id
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border hover:border-border/80 hover:bg-muted/30'
                            )}
                          >
                            <div
                              className={cn(
                                'flex items-center justify-center w-12 h-12 rounded-lg border',
                                selectedProduct?.id === product.id
                                  ? 'bg-primary/20 border-primary/30'
                                  : 'bg-muted border-border'
                              )}
                            >
                              <ChefHat
                                className={cn(
                                  'h-6 w-6',
                                  selectedProduct?.id === product.id ? 'text-primary' : 'text-muted-foreground'
                                )}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{product.name}</p>
                              <p className="text-sm text-muted-foreground">{product.category.name}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-foreground">{Currency(Number(product.price))}</p>
                              <Badge variant="secondary" className="text-xs">
                                {t('recipes.messages.noRecipeShort')}
                              </Badge>
                            </div>
                            {selectedProduct?.id === product.id && (
                              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="p-4 rounded-full bg-muted mb-4">
                          <Sparkles className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-medium text-foreground mb-1">{t('recipeWizard.step1.allHaveRecipes')}</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                          {t('recipeWizard.step1.allHaveRecipesDesc')}
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}

              {/* Step 2: Add Ingredients */}
              {currentStep === 2 && selectedProduct && (
                <div className="space-y-6">
                  {/* Selected Product Card */}
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 border border-primary/20">
                      <ChefHat className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{selectedProduct.name}</p>
                      <p className="text-sm text-muted-foreground">{selectedProduct.category.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{Currency(Number(selectedProduct.price))}</p>
                      <p className="text-xs text-muted-foreground">{t('recipes.fields.currentPrice')}</p>
                    </div>
                  </div>

                  {/* Recipe Configuration */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="portionYield">{t('recipes.fields.portionYield')} *</Label>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm" side="right">
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
                        min={1}
                        value={portionYield}
                        onChange={e => setPortionYield(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prepTime" className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {t('recipes.fields.prepTime')}
                      </Label>
                      <Input
                        id="prepTime"
                        type="number"
                        min={0}
                        placeholder="0"
                        value={prepTime || ''}
                        onChange={e => setPrepTime(parseInt(e.target.value) || undefined)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cookTime" className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {t('recipes.fields.cookTime')}
                      </Label>
                      <Input
                        id="cookTime"
                        type="number"
                        min={0}
                        placeholder="0"
                        value={cookTime || ''}
                        onChange={e => setCookTime(parseInt(e.target.value) || undefined)}
                      />
                    </div>
                  </div>

                  {/* Ingredients Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base">{t('recipes.ingredients.title')}</Label>
                      <Button variant="outline" size="sm" onClick={() => setAddIngredientOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        {t('recipes.addIngredient')}
                      </Button>
                    </div>

                    {ingredients.length === 0 ? (
                      <Alert>
                        <AlertDescription className="flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          {t('recipeWizard.step2.noIngredients')}
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-2 max-h-[250px] overflow-y-auto rounded-lg border border-border p-2">
                        {ingredients.map((ing, index) => {
                          const rawMaterial = rawMaterialsData?.find(rm => rm.id === ing.rawMaterialId)
                          const costPerUnit = rawMaterial ? Number(rawMaterial.costPerUnit) : 0
                          const lineCost = costPerUnit * ing.quantity

                          return (
                            <div
                              key={index}
                              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 border border-border">
                                <Package className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {ing.rawMaterialName || rawMaterial?.name || ing.rawMaterialId}
                                  {ing.isOptional && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      ({t('recipes.ingredients.optional')})
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {ing.quantity.toFixed(2)} {formatUnit(ing.unit)}
                                  {rawMaterial && (
                                    <>
                                      {' '}× {Currency(costPerUnit)} = {Currency(lineCost)}
                                    </>
                                  )}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveIngredient(index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {t('recipes.fields.notes')}
                    </Label>
                    <Textarea
                      id="notes"
                      rows={2}
                      placeholder={t('recipeWizard.step2.notesPlaceholder')}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>

                  {/* Cost Summary - Sticky Bottom */}
                  {ingredients.length > 0 && (
                    <div className="p-4 rounded-xl border border-border bg-muted/50 space-y-3">
                      <h3 className="font-medium text-sm text-muted-foreground">{t('recipeWizard.step2.costSummary')}</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">{t('recipes.fields.totalCost')}</p>
                          <p className="text-lg font-bold">{Currency(costCalculations.totalCost)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t('recipes.fields.costPerServing')}</p>
                          <p className="text-lg font-bold">{Currency(costCalculations.costPerPortion)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t('pricing.fields.foodCostPercentage')}</p>
                          <p className={cn('text-lg font-bold', getFoodCostColorClass(costCalculations.foodCostPercentage))}>
                            {costCalculations.foodCostPercentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Review & Confirm */}
              {currentStep === 3 && selectedProduct && (
                <div className="space-y-6">
                  {/* Success Preview */}
                  <div className="flex items-start gap-4 p-6 rounded-2xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
                    <div className="p-3 rounded-xl bg-green-500/20">
                      <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold">{t('recipeWizard.step3.header')}</h2>
                      <p className="text-sm text-muted-foreground">
                        {t('recipeWizard.step3.description')}
                      </p>
                    </div>
                  </div>

                  {/* Product Summary */}
                  <div className="p-4 rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 border border-primary/20">
                        <ChefHat className="h-7 w-7 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">{selectedProduct.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedProduct.category.name} • {t('recipes.fields.portionYield')}: {portionYield}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{Currency(Number(selectedProduct.price))}</p>
                        <p className="text-xs text-muted-foreground">{t('recipes.fields.currentPrice')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Ingredients Table */}
                  <div className="space-y-3">
                    <h3 className="font-medium">{t('recipes.ingredients.title')} ({ingredients.length})</h3>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <div className="bg-muted/50 px-4 py-2 grid grid-cols-[1fr_auto_auto_auto] gap-4 text-sm font-medium text-muted-foreground">
                        <span>{t('recipes.ingredients.ingredient')}</span>
                        <span className="text-right">{t('recipes.ingredients.quantity')}</span>
                        <span className="text-right">{t('rawMaterials.fields.costPerUnit')}</span>
                        <span className="text-right">{t('recipes.ingredients.cost')}</span>
                      </div>
                      <div className="divide-y divide-border">
                        {ingredients.map((ing, index) => {
                          const rawMaterial = rawMaterialsData?.find(rm => rm.id === ing.rawMaterialId)
                          const costPerUnit = rawMaterial ? Number(rawMaterial.costPerUnit) : 0
                          const lineCost = costPerUnit * ing.quantity

                          return (
                            <div key={index} className="px-4 py-3 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
                              <span className="font-medium truncate">
                                {ing.rawMaterialName || rawMaterial?.name || ing.rawMaterialId}
                              </span>
                              <span className="text-right text-muted-foreground">
                                {ing.quantity.toFixed(2)} {formatUnit(ing.unit)}
                              </span>
                              <span className="text-right text-muted-foreground">{Currency(costPerUnit)}</span>
                              <span className="text-right font-medium">{Currency(lineCost)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Cost Analysis Bento Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-border bg-card">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-blue-500/20">
                          <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-xs text-muted-foreground">{t('recipes.fields.totalCost')}</span>
                      </div>
                      <p className="text-2xl font-bold">{Currency(costCalculations.totalCost)}</p>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-card">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-purple-500/20">
                          <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="text-xs text-muted-foreground">{t('recipes.fields.costPerServing')}</span>
                      </div>
                      <p className="text-2xl font-bold">{Currency(costCalculations.costPerPortion)}</p>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-card">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn(
                          'p-2 rounded-lg',
                          costCalculations.foodCostPercentage > 40 ? 'bg-red-500/20' :
                          costCalculations.foodCostPercentage > 30 ? 'bg-yellow-500/20' : 'bg-green-500/20'
                        )}>
                          <TrendingUp className={cn(
                            'h-4 w-4',
                            getFoodCostColorClass(costCalculations.foodCostPercentage)
                          )} />
                        </div>
                        <span className="text-xs text-muted-foreground">{t('pricing.fields.foodCostPercentage')}</span>
                      </div>
                      <p className={cn('text-2xl font-bold', getFoodCostColorClass(costCalculations.foodCostPercentage))}>
                        {costCalculations.foodCostPercentage.toFixed(1)}%
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-card">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-green-500/20">
                          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-xs text-muted-foreground">{t('recipeWizard.step3.marginPerUnit')}</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {Currency(costCalculations.marginPerUnit)}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-card col-span-2 md:col-span-2">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-green-500/20">
                          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-xs text-muted-foreground">{t('recipeWizard.step3.marginPercentage')}</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {costCalculations.marginPercentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Warning Alert if Food Cost > 40% */}
                  {costCalculations.foodCostPercentage > 40 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        {t('recipeWizard.step3.highFoodCostWarning')}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Notes Preview */}
                  {notes && (
                    <div className="p-4 rounded-xl border border-border bg-muted/30">
                      <p className="text-sm text-muted-foreground mb-1">{t('recipes.fields.notes')}</p>
                      <p className="text-sm">{notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="border-t border-border/30 bg-background">
            <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={currentStep === 1 ? onClose : handleBack}
                disabled={createRecipeMutation.isPending}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {currentStep === 1 ? tCommon('cancel') : tCommon('back')}
              </Button>

              {currentStep < 3 && (
                <Button
                  onClick={handleNext}
                  disabled={!canGoNext() || createRecipeMutation.isPending}
                >
                  {tCommon('next')}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </FullScreenModal>

      {/* Add Ingredient Dialog */}
      {selectedProduct && (
        <AddIngredientDialog
          open={addIngredientOpen}
          onOpenChange={setAddIngredientOpen}
          product={selectedProduct}
          mode="create"
          onAddTempIngredient={ingredient => {
            setIngredients(prev => [...prev, ingredient])
          }}
        />
      )}
    </>
  )
}
