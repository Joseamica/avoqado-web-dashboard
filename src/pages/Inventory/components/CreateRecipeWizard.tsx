import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChefHat,
  ArrowRight,
  ChevronDown,
  Trash2,
  Package,
  TrendingUp,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Info,
  Settings2,
  X,
} from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { SearchCombobox, type SearchComboboxItem } from '@/components/search-combobox'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { useToast } from '@/hooks/use-toast'
import { recipesApi, rawMaterialsApi, type RawMaterial, type CreateRecipeDto } from '@/services/inventory.service'
import api from '@/api'
import { Currency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { QuickCreateRawMaterialSheet } from './QuickCreateRawMaterialSheet'

interface ProductWithRecipe {
  id: string
  name: string
  price: number
  active: boolean
  sku?: string | null
  gtin?: string | null
  imageUrl?: string | null
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
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Inline ingredient adding state
  const [ingredientSearchTerm, setIngredientSearchTerm] = useState('')
  const [pendingMaterial, setPendingMaterial] = useState<RawMaterial | null>(null)
  const [pendingQuantity, setPendingQuantity] = useState('')
  const [pendingIsOptional, setPendingIsOptional] = useState(false)
  const [pendingSubstituteNotes, setPendingSubstituteNotes] = useState('')
  const [showPendingOptions, setShowPendingOptions] = useState(false)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)

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

      // Apply search filter
      if (debouncedSearchTerm) {
        const lowerSearch = debouncedSearchTerm.toLowerCase()
        productsData = productsData.filter(
          p =>
            p.name.toLowerCase().includes(lowerSearch) ||
            p.category.name.toLowerCase().includes(lowerSearch) ||
            (p.sku && p.sku.toLowerCase().includes(lowerSearch)) ||
            (p.gtin && p.gtin.toLowerCase().includes(lowerSearch))
        )
      }

      // Sort: products without recipes first, then with recipes
      productsData.sort((a, b) => {
        if (!a.recipe && b.recipe) return -1
        if (a.recipe && !b.recipe) return 1
        return 0
      })

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

  // Map products to combobox items
  const productComboboxItems = useMemo<SearchComboboxItem[]>(() => {
    if (!products) return []
    return products.map(p => {
      const parts = [p.category.name]
      if (p.sku) parts.push(`SKU: ${p.sku}`)
      if (p.gtin) parts.push(`GTIN: ${p.gtin}`)
      return {
        id: p.id,
        label: p.name,
        description: parts.join(' • '),
        endLabel: Currency(Number(p.price)),
        disabled: !!p.recipe,
        disabledLabel: p.recipe ? t('recipeWizard.step1.hasRecipe') : undefined,
      }
    })
  }, [products, t])

  // Map raw materials to combobox items for ingredient search
  const ingredientComboboxItems = useMemo<SearchComboboxItem[]>(() => {
    if (!rawMaterialsData) return []
    const lowerSearch = ingredientSearchTerm.toLowerCase()
    return rawMaterialsData
      .filter(rm => !ingredientSearchTerm || rm.name.toLowerCase().includes(lowerSearch))
      .map(rm => {
        const isAdded = ingredients.some(ing => ing.rawMaterialId === rm.id)
        return {
          id: rm.id,
          label: rm.name,
          description: formatUnit(rm.unit),
          endLabel: Currency(Number(rm.costPerUnit)),
          disabled: isAdded,
          disabledLabel: isAdded ? t('recipeWizard.step2.alreadyAdded') : undefined,
        }
      })
  }, [rawMaterialsData, ingredientSearchTerm, ingredients, formatUnit, t])

  // Handle adding an ingredient from the inline form
  const handleAddInlineIngredient = () => {
    if (!pendingMaterial || !pendingQuantity || Number(pendingQuantity) <= 0) return

    const newIngredient: TempIngredient = {
      rawMaterialId: pendingMaterial.id,
      rawMaterialName: pendingMaterial.name,
      quantity: Number(pendingQuantity),
      unit: pendingMaterial.unit,
      isOptional: pendingIsOptional || undefined,
      substituteNotes: pendingSubstituteNotes || undefined,
    }

    setIngredients(prev => [...prev, newIngredient])

    // Reset inline form
    setPendingMaterial(null)
    setPendingQuantity('')
    setPendingIsOptional(false)
    setPendingSubstituteNotes('')
    setShowPendingOptions(false)
    setIngredientSearchTerm('')
  }

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
          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="h-10 px-6"
              >
                {tCommon('back')}
              </Button>
            )}
            {currentStep < 3 ? (
              <Button
                onClick={handleNext}
                disabled={!canGoNext() || createRecipeMutation.isPending}
                className="h-10 px-6"
              >
                {tCommon('next')}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleCreateRecipe}
                disabled={createRecipeMutation.isPending}
                className="h-10 px-6 gap-2"
              >
                {createRecipeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('recipeWizard.createRecipe')}
              </Button>
            )}
          </div>
        }
      >
        <div className="max-w-4xl mx-auto p-6 space-y-8">
          {/* Progress Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t('recipeWizard.stepProgress', { current: currentStep, total: 3 })}
              </span>
              <span className="text-sm font-medium">{stepTitles[currentStep]}</span>
            </div>
            <Progress value={progressPercentage} className="h-1.5" />
            <div className="flex justify-between">
              {[1, 2, 3].map(step => (
                <div key={step} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                      currentStep >= step
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {currentStep > step ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      step
                    )}
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
              {/* Step 1: Select Product */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  {/* Search Combobox */}
                  <SearchCombobox
                    placeholder={t('recipeWizard.step1.searchPlaceholder')}
                    value={searchTerm}
                    onChange={setSearchTerm}
                    items={productComboboxItems}
                    isLoading={productsLoading}
                    onSelect={item => {
                      const product = products?.find(p => p.id === item.id)
                      if (product) {
                        setSelectedProduct(product)
                        setSearchTerm('')
                      }
                    }}
                    onCreateNew={(term) => {
                      // TODO: open create product flow
                    }}
                    createNewLabel={(term) => t('recipeWizard.step1.createProduct', { name: term })}
                  />

                  {/* Selected Product Card */}
                  {selectedProduct && (
                    <div className="flex items-center gap-4 p-5 rounded-xl border border-primary/30 bg-primary/5">
                      {selectedProduct.imageUrl ? (
                        <img
                          src={selectedProduct.imageUrl}
                          alt={selectedProduct.name}
                          className="w-12 h-12 rounded-xl object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">{selectedProduct.name}</p>
                        <p className="text-sm text-muted-foreground">{selectedProduct.category.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold tabular-nums">{Currency(Number(selectedProduct.price))}</p>
                        <p className="text-xs text-muted-foreground">{t('recipes.fields.currentPrice')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(null)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Add Ingredients */}
              {currentStep === 2 && selectedProduct && (
                <div className="space-y-8">
                  {/* Recipe Configuration Section */}
                  <section className="bg-card rounded-2xl border border-border/50 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2.5 rounded-xl bg-primary/10">
                        <ChefHat className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">{selectedProduct.name}</h2>
                        <p className="text-sm text-muted-foreground">
                          {selectedProduct.category.name} • {Currency(Number(selectedProduct.price))}
                        </p>
                      </div>
                    </div>

                    <div className="max-w-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <Label htmlFor="portionYield" className="text-sm font-medium">
                          {t('recipes.fields.portionYield')} <span className="text-destructive">*</span>
                        </Label>
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
                      <p className="text-xs text-muted-foreground mb-2">{t('recipes.portionYieldHelp.hint')}</p>
                      <Input
                        id="portionYield"
                        type="number"
                        min={1}
                        value={portionYield}
                        onChange={e => setPortionYield(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-12 text-base"
                      />
                    </div>

                    {/* Advanced config toggle */}
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(prev => !prev)}
                      className="flex items-center gap-2 mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Settings2 className="h-4 w-4" />
                      <span>{t('recipeWizard.step2.advancedConfig')}</span>
                      <ChevronDown className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')} />
                    </button>

                    {showAdvanced && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 pt-4 border-t border-border/50">
                        <div>
                          <Label htmlFor="prepTime" className="text-sm font-medium mb-2 block">{t('recipes.fields.prepTime')}</Label>
                          <Input
                            id="prepTime"
                            type="number"
                            min={0}
                            placeholder="0"
                            value={prepTime || ''}
                            onChange={e => setPrepTime(parseInt(e.target.value) || undefined)}
                            className="h-12 text-base"
                          />
                        </div>
                        <div>
                          <Label htmlFor="cookTime" className="text-sm font-medium mb-2 block">{t('recipes.fields.cookTime')}</Label>
                          <Input
                            id="cookTime"
                            type="number"
                            min={0}
                            placeholder="0"
                            value={cookTime || ''}
                            onChange={e => setCookTime(parseInt(e.target.value) || undefined)}
                            className="h-12 text-base"
                          />
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Ingredients Section */}
                  <section className="bg-card rounded-2xl border border-border/50 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2.5 rounded-xl bg-primary/10">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-lg font-semibold">{t('recipes.ingredients.title')}</h2>
                    </div>

                    {/* Inline Search Combobox */}
                    <SearchCombobox
                      placeholder={t('recipeWizard.step2.searchIngredientPlaceholder')}
                      value={ingredientSearchTerm}
                      onChange={setIngredientSearchTerm}
                      items={ingredientComboboxItems}
                      isLoading={!rawMaterialsData}
                      onSelect={item => {
                        const material = rawMaterialsData?.find(rm => rm.id === item.id)
                        if (material) {
                          setPendingMaterial(material)
                          setIngredientSearchTerm('')
                        }
                      }}
                      onCreateNew={() => setQuickCreateOpen(true)}
                      createNewLabel={() => t('recipeWizard.step2.createRawMaterial')}
                    />

                    {/* Pending material configuration row */}
                    {pendingMaterial && (
                      <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                        {/* Material info + quantity + add button */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{pendingMaterial.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {Currency(Number(pendingMaterial.costPerUnit))} / {formatUnit(pendingMaterial.unit)}
                            </p>
                          </div>
                          <div className="relative w-36">
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="0"
                              value={pendingQuantity}
                              onChange={e => setPendingQuantity(e.target.value)}
                              className="h-10 pr-12 text-base"
                              autoFocus
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none">
                              {formatUnit(pendingMaterial.unit)}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            onClick={handleAddInlineIngredient}
                            disabled={!pendingQuantity || Number(pendingQuantity) <= 0}
                            className="shrink-0"
                          >
                            {t('recipeWizard.step2.addToRecipe')}
                          </Button>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingMaterial(null)
                              setPendingQuantity('')
                              setPendingIsOptional(false)
                              setPendingSubstituteNotes('')
                              setShowPendingOptions(false)
                            }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Estimated cost hint */}
                        {pendingQuantity && Number(pendingQuantity) > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {t('recipes.ingredients.cost')}: <span className="font-semibold text-foreground">{Currency(Number(pendingMaterial.costPerUnit) * Number(pendingQuantity))}</span>
                          </p>
                        )}

                        {/* More options toggle */}
                        <button
                          type="button"
                          onClick={() => setShowPendingOptions(prev => !prev)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showPendingOptions && 'rotate-180')} />
                          <span>{t('recipeWizard.step2.moreOptions')}</span>
                        </button>

                        {showPendingOptions && (
                          <div className="space-y-3 pt-1">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="pendingOptional"
                                checked={pendingIsOptional}
                                onCheckedChange={checked => setPendingIsOptional(checked as boolean)}
                              />
                              <Label htmlFor="pendingOptional" className="text-sm cursor-pointer">
                                {t('recipes.ingredients.optional')}
                              </Label>
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="pendingSubNotes" className="text-xs">
                                {t('recipes.ingredients.substituteNotes')}
                              </Label>
                              <Textarea
                                id="pendingSubNotes"
                                rows={2}
                                value={pendingSubstituteNotes}
                                onChange={e => setPendingSubstituteNotes(e.target.value)}
                                className="text-sm resize-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ingredients list */}
                    {ingredients.length === 0 && !pendingMaterial ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="p-3 rounded-full bg-muted mb-3">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">{t('recipeWizard.step2.noIngredients')}</p>
                      </div>
                    ) : ingredients.length > 0 ? (
                      <div className="space-y-2 mt-4">
                        {ingredients.map((ing, index) => {
                          const rawMaterial = rawMaterialsData?.find(rm => rm.id === ing.rawMaterialId)
                          const costPerUnit = rawMaterial ? Number(rawMaterial.costPerUnit) : 0
                          const lineCost = costPerUnit * ing.quantity

                          return (
                            <div
                              key={index}
                              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {ing.rawMaterialName || rawMaterial?.name || ing.rawMaterialId}
                                  {ing.isOptional && (
                                    <Badge variant="secondary" className="ml-2 text-[10px] h-4 px-1.5">
                                      {t('recipes.ingredients.optional')}
                                    </Badge>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {ing.quantity.toFixed(2)} {formatUnit(ing.unit)}
                                  {rawMaterial && (
                                    <> × {Currency(costPerUnit)}</>
                                  )}
                                </p>
                              </div>
                              <span className="text-sm font-semibold tabular-nums shrink-0">
                                {Currency(lineCost)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveIngredient(index)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}

                    {/* Cost Summary inline */}
                    {ingredients.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-3 gap-4">
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
                    )}
                  </section>

                  {/* Notes Section */}
                  <section className="bg-card rounded-2xl border border-border/50 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2.5 rounded-xl bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-lg font-semibold">{t('recipes.fields.notes')}</h2>
                    </div>
                    <Textarea
                      id="notes"
                      rows={3}
                      placeholder={t('recipeWizard.step2.notesPlaceholder')}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="text-base resize-none"
                    />
                  </section>
                </div>
              )}

              {/* Step 3: Review & Confirm */}
              {currentStep === 3 && selectedProduct && (
                <div className="space-y-8">
                  {/* Product Summary Section */}
                  <section className="bg-card rounded-2xl border border-border/50 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2.5 rounded-xl bg-green-500/10">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">{t('recipeWizard.step3.header')}</h2>
                        <p className="text-sm text-muted-foreground">{t('recipeWizard.step3.description')}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
                      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                        <ChefHat className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">{selectedProduct.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedProduct.category.name} • {t('recipes.fields.portionYield')}: {portionYield}
                          {prepTime ? ` • ${t('recipes.fields.prepTime')}: ${prepTime}min` : ''}
                          {cookTime ? ` • ${t('recipes.fields.cookTime')}: ${cookTime}min` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold tabular-nums">{Currency(Number(selectedProduct.price))}</p>
                        <p className="text-xs text-muted-foreground">{t('recipes.fields.currentPrice')}</p>
                      </div>
                    </div>
                  </section>

                  {/* Ingredients Table Section */}
                  <section className="bg-card rounded-2xl border border-border/50 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2.5 rounded-xl bg-primary/10">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-lg font-semibold">
                        {t('recipes.ingredients.title')}
                        <span className="ml-1.5 text-sm font-normal text-muted-foreground">({ingredients.length})</span>
                      </h2>
                    </div>

                    <div className="rounded-xl border border-border/50 overflow-hidden">
                      <div className="bg-muted/40 px-4 py-2.5 grid grid-cols-[1fr_auto_auto_auto] gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <span>{t('recipes.ingredients.ingredient')}</span>
                        <span className="text-right">{t('recipes.ingredients.quantity')}</span>
                        <span className="text-right">{t('rawMaterials.fields.costPerUnit')}</span>
                        <span className="text-right">{t('recipes.ingredients.cost')}</span>
                      </div>
                      <div className="divide-y divide-border/50">
                        {ingredients.map((ing, index) => {
                          const rawMaterial = rawMaterialsData?.find(rm => rm.id === ing.rawMaterialId)
                          const costPerUnit = rawMaterial ? Number(rawMaterial.costPerUnit) : 0
                          const lineCost = costPerUnit * ing.quantity

                          return (
                            <div key={index} className="px-4 py-3 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center text-sm">
                              <span className="font-medium truncate">
                                {ing.rawMaterialName || rawMaterial?.name || ing.rawMaterialId}
                                {ing.isOptional && (
                                  <Badge variant="secondary" className="ml-2 text-[10px] h-4 px-1.5">
                                    {t('recipes.ingredients.optional')}
                                  </Badge>
                                )}
                              </span>
                              <span className="text-right text-muted-foreground tabular-nums">
                                {ing.quantity.toFixed(2)} {formatUnit(ing.unit)}
                              </span>
                              <span className="text-right text-muted-foreground tabular-nums">{Currency(costPerUnit)}</span>
                              <span className="text-right font-semibold tabular-nums">{Currency(lineCost)}</span>
                            </div>
                          )
                        })}
                      </div>
                      {/* Total row */}
                      <div className="bg-muted/40 px-4 py-3 grid grid-cols-[1fr_auto] gap-4 items-center">
                        <span className="text-sm font-semibold">{t('recipes.fields.totalCost')}</span>
                        <span className="text-right text-base font-bold tabular-nums">{Currency(costCalculations.totalCost)}</span>
                      </div>
                    </div>
                  </section>

                  {/* Cost Analysis Section */}
                  <section className="bg-card rounded-2xl border border-border/50 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2.5 rounded-xl bg-primary/10">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-lg font-semibold">{t('recipeWizard.step2.costSummary')}</h2>
                    </div>

                    {costCalculations.foodCostPercentage > 40 && (
                      <Alert variant="destructive" className="mb-6">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{t('recipeWizard.step3.highFoodCostWarning')}</AlertDescription>
                      </Alert>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">{t('recipes.fields.costPerServing')}</p>
                        <p className="text-xl font-bold tabular-nums">{Currency(costCalculations.costPerPortion)}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">{t('pricing.fields.foodCostPercentage')}</p>
                        <p className={cn('text-xl font-bold tabular-nums', getFoodCostColorClass(costCalculations.foodCostPercentage))}>
                          {costCalculations.foodCostPercentage.toFixed(1)}%
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">{t('recipeWizard.step3.marginPerUnit')}</p>
                        <p className="text-xl font-bold tabular-nums text-green-600 dark:text-green-400">
                          {Currency(costCalculations.marginPerUnit)}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">{t('recipeWizard.step3.marginPercentage')}</p>
                        <p className="text-xl font-bold tabular-nums text-green-600 dark:text-green-400">
                          {costCalculations.marginPercentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Notes Preview */}
                  {notes && (
                    <section className="bg-card rounded-2xl border border-border/50 p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 rounded-xl bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <h2 className="text-lg font-semibold">{t('recipes.fields.notes')}</h2>
                      </div>
                      <p className="text-sm text-muted-foreground">{notes}</p>
                    </section>
                  )}

                  {/* Bottom padding */}
                  <div className="h-8" />
                </div>
              )}
        </div>
      </FullScreenModal>

      {/* Quick Create Raw Material Sheet */}
      <QuickCreateRawMaterialSheet
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        initialName={ingredientSearchTerm}
        onSuccess={material => {
          setPendingMaterial(material)
          setIngredientSearchTerm('')
        }}
      />
    </>
  )
}
