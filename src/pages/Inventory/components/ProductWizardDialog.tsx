import { useState, useEffect, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useImageUploader } from '@/hooks/use-image-uploader'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { productWizardApi, rawMaterialsApi, recipesApi, productInventoryApi, type InventoryMethod, type ProductType } from '@/services/inventory.service'
import { getMenuCategories, getModifierGroups } from '@/services/menu.service'
import { Loader2, Check, Package, Beef, Plus, Trash2, Info, UtensilsCrossed, Calendar, Ticket, Download, Heart, ImagePlus, Grid3X3, Pencil, ChefHat, ChevronDown, Sparkles } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Currency } from '@/utils/currency'
import Cropper from 'react-easy-crop'
import { AddIngredientDialog } from './AddIngredientDialog'
import MultipleSelector from '@/components/multi-selector'
import { SimpleConfirmDialog } from './SimpleConfirmDialog'
import api from '@/api'
import { cn } from '@/lib/utils'

// Icon mapping for product types
const PRODUCT_TYPE_ICONS: Record<ProductType, React.ElementType> = {
  REGULAR: Package,
  FOOD_AND_BEV: UtensilsCrossed,
  APPOINTMENTS_SERVICE: Calendar,
  EVENT: Ticket,
  DIGITAL: Download,
  DONATION: Heart,
  OTHER: Package,
}

// Product type labels
const PRODUCT_TYPE_LABELS: Record<ProductType, { en: string; es: string }> = {
  REGULAR: { en: 'Regular Item', es: 'Artículo Regular' },
  FOOD_AND_BEV: { en: 'Food & Beverage', es: 'Bebidas y alimentos preparados' },
  APPOINTMENTS_SERVICE: { en: 'Appointment/Service', es: 'Servicio con cita' },
  EVENT: { en: 'Event', es: 'Evento' },
  DIGITAL: { en: 'Digital Good', es: 'Producto Digital' },
  DONATION: { en: 'Donation', es: 'Donación' },
  OTHER: { en: 'Other', es: 'Otro' },
}

interface ProductWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (productId: string) => void
  mode: 'create' | 'edit'
  productId?: string
  productType?: ProductType | null
}

interface Step1FormData {
  name: string
  description?: string
  price: number
  categoryId: string
  imageUrl?: string
  modifierGroups?: Array<{ label: string; value: string }>
  type?: ProductType
}

interface Step2FormData {
  useInventory: boolean
  inventoryMethod?: InventoryMethod
}

interface Step3SimpleStockFormData {
  unit: string // Unit of measurement (UNIT, KILOGRAM, etc.)
  initialStock: number
  costPerUnit: number
  reorderPoint: number
  lowStockThreshold?: number // Alert threshold for low stock warnings
}

interface Step3RecipeFormData {
  portionYield: number
  prepTime?: number
  cookTime?: number
  notes?: string
  lowStockThreshold?: number // Alert threshold for low stock warnings
  ingredients: Array<{
    rawMaterialId: string
    rawMaterialName?: string
    quantity: number
    unit: string
    isOptional: boolean // Always boolean, not optional
    substituteNotes?: string
  }>
}

// Emoji map for raw material categories (used in preview)
const CATEGORY_EMOJIS: Record<string, string> = {
  MEAT: '🥩',
  POULTRY: '🍗',
  SEAFOOD: '🦐',
  DAIRY: '🥛',
  CHEESE: '🧀',
  EGGS: '🥚',
  VEGETABLES: '🥬',
  FRUITS: '🍎',
  GRAINS: '🌾',
  BREAD: '🍞',
  PASTA: '🍝',
  RICE: '🍚',
  BEANS: '🫘',
  SPICES: '🧂',
  HERBS: '🌿',
  OILS: '🫒',
  SAUCES: '🥫',
  CONDIMENTS: '🍯',
  BEVERAGES: '🥤',
  ALCOHOL: '🍷',
  CLEANING: '🧹',
  PACKAGING: '📦',
  OTHER: '📋',
}

const getCategoryEmoji = (category: string | null | undefined): string => {
  if (!category) return '📋'
  return CATEGORY_EMOJIS[category] || '📋'
}

// Section header component (from RawMaterialDialog style)
const SectionHeader = ({ icon: Icon, title, className }: { icon: React.ElementType; title: string; className?: string }) => (
  <div className={cn('flex items-center gap-3 mb-6', className)}>
    <div className="p-2.5 rounded-xl bg-primary/10">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <h2 className="text-lg font-semibold">{title}</h2>
  </div>
)

// Field with tooltip component
const FieldLabel = ({ htmlFor, label, required, tooltip }: { htmlFor: string; label: string; required?: boolean; tooltip?: string }) => (
  <div className="flex items-center gap-2 mb-2">
    <Label htmlFor={htmlFor} className="text-sm font-medium">
      {label} {required && <span className="text-destructive">*</span>}
    </Label>
    {tooltip && (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-sm bg-popover text-popover-foreground border border-border">
            <p className="text-sm">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )}
  </div>
)

export function ProductWizardDialog({ open, onOpenChange, onSuccess, mode, productId, productType }: ProductWizardDialogProps) {
  const { t, i18n } = useTranslation('inventory')
  const { t: tCommon } = useTranslation('common')
  const { venueId, venueSlug } = useCurrentVenue()
  const isSpanish = i18n.language.startsWith('es')
  const { toast } = useToast()
  const { getShortLabel } = useUnitTranslation()
  const queryClient = useQueryClient()

  // Single-step wizard - no step navigation needed
  const [createdProductId, setCreatedProductId] = useState<string | undefined>(productId)
  const [selectedInventoryMethod, setSelectedInventoryMethod] = useState<InventoryMethod | null>(null)
  const [addIngredientOpen, setAddIngredientOpen] = useState(false)
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false)
  const [conversionDirection, setConversionDirection] = useState<'toRecipe' | 'toQuantity' | null>(null)
  const [pendingInventoryConfig, setPendingInventoryConfig] = useState<{
    inventoryMethod: InventoryMethod
    simpleStock?: Step3SimpleStockFormData
    recipe?: Step3RecipeFormData
  } | null>(null)

  // Store wizard data in state (only submit on final step)
  const [step1Data, setStep1Data] = useState<Step1FormData | null>(null)
  const [_step2Data, setStep2Data] = useState<Step2FormData | null>(null)
  const [highlightAddButton, setHighlightAddButton] = useState(false)
  const [advancedRecipeOpen, setAdvancedRecipeOpen] = useState(false)

  // ✅ FIX: Track if we've already loaded existing data to prevent overwriting user changes
  const [hasLoadedExistingData, setHasLoadedExistingData] = useState(false)

  // Step 1 Form
  const step1Form = useForm<Step1FormData>({
    defaultValues: {
      name: '',
      description: '',
      price: undefined,
      categoryId: '',
      imageUrl: '',
      modifierGroups: [],
    },
  })

  // Step 2 Form (always start with default values, will be updated by useEffect)
  const step2Form = useForm<Step2FormData>({
    defaultValues: {
      useInventory: false,
      inventoryMethod: 'QUANTITY' as InventoryMethod, // Default to avoid undefined
    },
  })

  // Step 3 Simple Stock Form
  const step3SimpleForm = useForm<Step3SimpleStockFormData>({
    defaultValues: {
      unit: 'UNIT', // Default to pieces
      initialStock: undefined, // No default value - user must enter
      costPerUnit: undefined,
      reorderPoint: 10,
    },
  })

  // Step 3 Recipe Form
  const step3RecipeForm = useForm<Step3RecipeFormData>({
    defaultValues: {
      portionYield: 1,
      prepTime: undefined,
      cookTime: undefined,
      notes: '',
      ingredients: [],
    },
  })

  // Image uploader hook
  const {
    uploading,
    imageUrl,
    imageForCrop,
    crop,
    zoom,
    onCropComplete,
    handleFileUpload,
    handleCropConfirm,
    handleFileRemove,
    setImageForCrop,
    setCrop,
    setZoom,
  } = useImageUploader(`venues/${venueSlug}/productos`, step1Form.watch('name') || '', { minWidth: 320, minHeight: 320 })

  // Handle image delete
  const handleDeleteImage = () => {
    handleFileRemove()
    step1Form.setValue('imageUrl', '')
  }

  // Fetch recommendations for inventory usage
  const { data: recommendations } = useQuery({
    queryKey: ['inventory-recommendations', venueId],
    queryFn: async () => {
      const response = await productWizardApi.shouldUseInventory(venueId)
      return response.data.data
    },
    enabled: !!venueId && open,
  })

  // Fetch raw materials for recipe ingredients
  const { data: rawMaterialsData } = useQuery({
    queryKey: ['raw-materials', venueId],
    queryFn: async () => {
      const response = await rawMaterialsApi.getAll(venueId)
      return response.data.data
    },
    enabled: !!venueId && open && selectedInventoryMethod === 'RECIPE',
  })

  // Fetch existing product data in edit mode
  const { data: existingProductData, isLoading: isLoadingExistingData } = useQuery({
    queryKey: ['product-wizard-progress', venueId, productId],
    queryFn: async () => {
      if (!productId) return null
      const response = await productWizardApi.getWizardProgress(venueId, productId)
      return response.data.data
    },
    enabled: !!venueId && !!productId && mode === 'edit' && open,
  })

  // Fetch full product details in edit mode (for name, price, description, etc.)
  const { data: existingProduct, isLoading: isLoadingProduct } = useQuery({
    queryKey: ['product-detail', venueId, productId],
    queryFn: async () => {
      if (!productId) return null
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/products/${productId}`)
      return response.data.data
    },
    enabled: !!venueId && !!productId && mode === 'edit' && open,
  })

  // Fetch full recipe data - always try to load in edit mode (recipe existence overrides inventoryMethod)
  const { data: existingRecipeData } = useQuery({
    queryKey: ['product-recipe', venueId, productId],
    queryFn: async () => {
      if (!productId) return null
      try {
        const response = await recipesApi.get(venueId, productId)
        return response.data.data
      } catch {
        // Recipe might not exist yet, that's ok
        return null
      }
    },
    enabled: !!venueId && !!productId && mode === 'edit' && open,
  })

  // Fetch menu categories for category dropdown
  const { data: categories } = useQuery({
    queryKey: ['menu-categories', venueId],
    queryFn: () => getMenuCategories(venueId),
    enabled: !!venueId && open,
  })

  // Fetch modifier groups for modifier groups dropdown
  const { data: modifierGroups, isLoading: isModifierGroupsLoading } = useQuery({
    queryKey: ['modifier-groups', venueId],
    queryFn: () => getModifierGroups(venueId!),
    enabled: !!venueId && open,
  })

  // Memoized category options for SearchableSelect
  const categoryOptions = useMemo<SearchableSelectOption[]>(
    () =>
      (categories || []).map(cat => ({
        value: cat.id,
        label: cat.name,
      })),
    [categories]
  )

  // Single mutation: Create product with inventory in one call
  const createProductWithInventoryMutation = useMutation({
    mutationFn: (data: {
      product: Step1FormData
      inventory: Step2FormData
      simpleStock?: Step3SimpleStockFormData
      recipe?: Step3RecipeFormData
    }) => {
      return productWizardApi.createProductWithInventory(venueId, data)
    },
    onSuccess: response => {
      const productId = response.data.data.productId
      setCreatedProductId(productId)

      toast({
        title: t('wizard.success'),
        description: t('wizard.successMessage'),
        variant: 'default',
      })

      handleWizardComplete()
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || t('wizard.error'),
        variant: 'destructive',
      })
    },
  })

  // Mutation for configuring inventory on existing product (edit mode)
  const configureInventoryMutation = useMutation({
    mutationFn: async (data: {
      inventoryMethod: InventoryMethod
      simpleStock?: Step3SimpleStockFormData
      recipe?: Step3RecipeFormData
    }) => {
      // Use productId (from props) in edit mode, or createdProductId (from create flow)
      const targetProductId = productId || createdProductId
      if (!targetProductId) {
        throw new Error('Product ID is required')
      }

      // ✅ FIX: First update product with trackInventory + inventoryMethod
      // This ensures atomic commit of all changes together
      await api.put(`/api/v1/dashboard/venues/${venueId}/products/${targetProductId}`, {
        trackInventory: true,
        inventoryMethod: data.inventoryMethod,
      })

      // Then configure the inventory details
      if (data.inventoryMethod === 'QUANTITY' && data.simpleStock) {
        // ✅ FIX: In edit mode, backend should handle upsert automatically
        // Wrap in try-catch to handle potential conflicts gracefully
        try {
          return await productWizardApi.configureSimpleStock(venueId, targetProductId, data.simpleStock)
        } catch (error: any) {
          // If inventory already exists, try to update via product endpoint
          if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
            return api.put(`/api/v1/dashboard/venues/${venueId}/products/${targetProductId}/inventory`, {
              currentStock: data.simpleStock.initialStock,
              reorderPoint: data.simpleStock.reorderPoint,
              costPerUnit: data.simpleStock.costPerUnit,
            })
          }
          throw error
        }
      } else if (data.inventoryMethod === 'RECIPE' && data.recipe) {
        // ✅ FIX: Try UPDATE first, fallback to CREATE if recipe doesn't exist
        // This is more robust than checking existence first (EAFP pattern)

        console.log('🔍 DEBUG [MUTATION] - Recipe data received:', data.recipe)
        console.log('🔍 DEBUG [MUTATION] - Recipe ingredients:', data.recipe.ingredients)
        console.log('🔍 DEBUG [MUTATION] - Recipe ingredients count:', data.recipe.ingredients?.length || 0)

        const updatePayload = {
          ...data.recipe,
          lines: data.recipe.ingredients,
        }
        console.log('🔍 DEBUG [MUTATION] - UPDATE payload:', updatePayload)
        console.log('🔍 DEBUG [MUTATION] - UPDATE payload.lines:', updatePayload.lines)

        try {
          return await recipesApi.update(venueId, targetProductId, updatePayload)
        } catch (error: any) {
          // Recipe doesn't exist (404), use CREATE
          if (error.response?.status === 404) {
            console.log('🔍 DEBUG [MUTATION] - Recipe not found (404), creating new recipe')
            console.log('🔍 DEBUG [MUTATION] - CREATE payload:', data.recipe)
            return productWizardApi.configureRecipe(venueId, targetProductId, data.recipe)
          }
          throw error
        }
      }
      throw new Error('Invalid inventory configuration')
    },
    onSuccess: () => {
      // ✅ FIX: In edit mode, don't show toast here - let parent handle it
      // This prevents double toasts (wizard + parent onSuccess callback)
      if (mode !== 'edit') {
        toast({
          title: t('wizard.success'),
          description: t('wizard.successMessage'),
          variant: 'default',
        })
      }

      handleWizardComplete()
    },
    onError: (error: any) => {
      // Check for 409 conflict error
      if (error.response?.status === 409) {
        // Store the pending configuration to retry after conversion
        setPendingInventoryConfig({
          inventoryMethod: error.config?.data ? JSON.parse(error.config.data).inventoryMethod : selectedInventoryMethod!,
          simpleStock: error.config?.data ? JSON.parse(error.config.data).simpleStock : undefined,
          recipe: error.config?.data ? JSON.parse(error.config.data).recipe : undefined,
        })

        // Determine conversion direction based on what we're trying to configure
        const targetType = selectedInventoryMethod
        if (targetType === 'RECIPE') {
          setConversionDirection('toRecipe')
        } else if (targetType === 'QUANTITY') {
          setConversionDirection('toQuantity')
        }

        // Show conversion dialog
        setConversionDialogOpen(true)
        return
      }

      // For other errors, show error toast
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || t('wizard.error'),
        variant: 'destructive',
      })
    },
  })

  // Mutation to switch inventory method (auto-conversion)
  const switchInventoryMethodMutation = useMutation({
    mutationFn: () => {
      if (!createdProductId || !conversionDirection) {
        throw new Error('Missing required data for conversion')
      }

      const newMethod: InventoryMethod = conversionDirection === 'toRecipe' ? 'RECIPE' : 'QUANTITY'
      return productInventoryApi.switchInventoryMethod(venueId, createdProductId, newMethod)
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['products-with-recipes'] })
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
      queryClient.invalidateQueries({ queryKey: ['product-wizard-progress', venueId, createdProductId] })

      toast({
        title: t(`conversion.${conversionDirection}.success`),
        variant: 'default',
      })

      // Close conversion dialog
      setConversionDialogOpen(false)

      // Retry the original configuration with pending data
      if (pendingInventoryConfig) {
        configureInventoryMutation.mutate(pendingInventoryConfig)
        setPendingInventoryConfig(null)
      }
    },
    onError: (error: any) => {
      toast({
        title: t(`conversion.${conversionDirection}.error`),
        description: error.response?.data?.message || 'Failed to switch inventory method',
        variant: 'destructive',
      })
    },
  })

  // Handle wizard completion
  const handleWizardComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['products', venueId] })
    queryClient.invalidateQueries({ queryKey: ['products-with-recipes', venueId] })

    if (onSuccess && createdProductId) {
      onSuccess(createdProductId)
    }

    // Reset flag before closing so next opening loads fresh data
    setHasLoadedExistingData(false)

    // Reset and close
    resetWizard()
    onOpenChange(false)
  }

  // Reset wizard state - wrapped in useCallback to prevent infinite loop
  const resetWizard = useCallback(() => {
    setCreatedProductId(productId)
    setSelectedInventoryMethod(null)
    setStep1Data(null)
    setStep2Data(null)
    setHighlightAddButton(false)
    setAdvancedRecipeOpen(false)
    setHasLoadedExistingData(false) // ✅ Reset flag so next opening loads fresh data
    step1Form.reset()
    step2Form.reset()
    step3SimpleForm.reset()
    step3RecipeForm.reset()
  }, [productId, step1Form, step2Form, step3SimpleForm, step3RecipeForm])

  // Handle dialog close
  useEffect(() => {
    if (!open) {
      resetWizard()
    }
  }, [open, resetWizard])

  // Load existing product data into step1Form in edit mode
  useEffect(() => {
    if (open && mode === 'edit' && existingProduct && !isLoadingProduct && !hasLoadedExistingData) {
      console.log('🔄 Loading existing product into step1Form:', existingProduct)

      // Populate step1Form with existing product data
      step1Form.setValue('name', existingProduct.name || '')
      step1Form.setValue('description', existingProduct.description || '')
      step1Form.setValue('price', Number(existingProduct.price) || 0)
      step1Form.setValue('categoryId', existingProduct.categoryId || '')
      step1Form.setValue('imageUrl', existingProduct.imageUrl || '')

      // Load modifier groups if available
      if (existingProduct.modifierGroups && existingProduct.modifierGroups.length > 0) {
        const modifierGroupsForForm = existingProduct.modifierGroups.map((mg: any) => ({
          label: mg.name,
          value: mg.id,
        }))
        step1Form.setValue('modifierGroups', modifierGroupsForForm)
      }

      // Set product type if available
      if (existingProduct.type) {
        step1Form.setValue('type', existingProduct.type as ProductType)
      }
    }
  }, [open, mode, existingProduct, isLoadingProduct, hasLoadedExistingData, step1Form])

  // Load existing inventory data in edit mode
  useEffect(() => {
    // ✅ FIX: Only load data ONCE when first opening the wizard
    // This prevents overwriting user changes when they modify inventory settings
    if (open && mode === 'edit' && existingProductData && !isLoadingExistingData) {
      const { inventoryMethod, details } = existingProductData

      console.log('🔄 Loading existing inventory data:', { inventoryMethod, details })

      // ✅ WORLD-CLASS: inventoryMethod column is the SOURCE OF TRUTH
      // Recipe data should only be loaded if inventoryMethod === 'RECIPE'
      // This ensures the UI matches the database state, not orphaned recipe data

      if (inventoryMethod) {
        console.log('✅ Setting useInventory=true, inventoryMethod=', inventoryMethod)
        step2Form.setValue('useInventory', true)
        step2Form.setValue('inventoryMethod', inventoryMethod as InventoryMethod)
        setSelectedInventoryMethod(inventoryMethod as InventoryMethod)

        // Load QUANTITY data
        if (inventoryMethod === 'QUANTITY' && details) {
          console.log('📦 Loading QUANTITY data:', details)
          step3SimpleForm.setValue('initialStock', details.currentStock || 0)
          step3SimpleForm.setValue('costPerUnit', details.costPerUnit || 0)
          step3SimpleForm.setValue('reorderPoint', details.reorderPoint || 10)
        }

        // Load RECIPE data (only if inventoryMethod is RECIPE)
        if (inventoryMethod === 'RECIPE' && existingRecipeData && existingRecipeData.lines && existingRecipeData.lines.length > 0) {
          console.log('🍔 Loading RECIPE data')
          console.log('🔍 DEBUG [LOAD] - existingRecipeData:', existingRecipeData)
          console.log('🔍 DEBUG [LOAD] - existingRecipeData.lines:', existingRecipeData.lines)
          console.log('🔍 DEBUG [LOAD] - existingRecipeData.lines.length:', existingRecipeData.lines.length)

          step3RecipeForm.setValue('portionYield', existingRecipeData.portionYield || 1)
          step3RecipeForm.setValue('prepTime', existingRecipeData.prepTime)
          step3RecipeForm.setValue('cookTime', existingRecipeData.cookTime)
          step3RecipeForm.setValue('notes', existingRecipeData.notes || '')
          step3RecipeForm.setValue('lowStockThreshold', existingRecipeData.lowStockThreshold)

          const ingredients = existingRecipeData.lines.map((line: any) => ({
            rawMaterialId: line.rawMaterialId,
            rawMaterialName: line.rawMaterial?.name,
            quantity: Number(line.quantity),
            unit: line.unit,
            isOptional: line.isOptional || false,
            substituteNotes: line.substituteNotes,
          }))

          console.log('🔍 DEBUG [LOAD] - Mapped ingredients:', ingredients)
          console.log('🔍 DEBUG [LOAD] - Ingredients count:', ingredients.length)

          step3RecipeForm.setValue('ingredients', ingredients)

          // Verify it was set
          const verifyIngredients = step3RecipeForm.getValues('ingredients')
          console.log('🔍 DEBUG [LOAD] - Form ingredients after setValue:', verifyIngredients)
          console.log('🔍 DEBUG [LOAD] - Form ingredients count after setValue:', verifyIngredients?.length || 0)
        } else {
          console.log('🔍 DEBUG [LOAD] - RECIPE data NOT loaded. Conditions:')
          console.log('  - inventoryMethod === RECIPE:', inventoryMethod === 'RECIPE')
          console.log('  - existingRecipeData:', !!existingRecipeData)
          console.log('  - existingRecipeData?.lines:', !!existingRecipeData?.lines)
          console.log('  - existingRecipeData?.lines?.length:', existingRecipeData?.lines?.length)
        }
      } else {
        console.log('❌ Setting useInventory=false (no inventory method)')
        step2Form.setValue('useInventory', false)
        step2Form.setValue('inventoryMethod', 'QUANTITY' as InventoryMethod) // Keep a default to avoid undefined
      }

      // Mark that we've loaded the data once
      setHasLoadedExistingData(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- step2Form, step3SimpleForm, step3RecipeForm are stable refs from useForm
  }, [open, mode, existingProductData, existingRecipeData, isLoadingExistingData, hasLoadedExistingData])

  // ✅ FIX: Separate effect to load recipe data when it becomes available
  // This handles the case where existingRecipeData loads AFTER existingProductData
  // (single-step wizard - recipe config is inline with the rest of the form)
  useEffect(() => {
    if (open && mode === 'edit' && selectedInventoryMethod === 'RECIPE' && existingRecipeData) {
      console.log('🔍 DEBUG [LATE LOAD] - Checking recipe data')
      console.log('🔍 DEBUG [LATE LOAD] - existingRecipeData:', existingRecipeData)
      console.log('🔍 DEBUG [LATE LOAD] - existingRecipeData.lines:', existingRecipeData.lines)

      // Check if ingredients are already loaded
      const currentIngredients = step3RecipeForm.getValues('ingredients')
      console.log('🔍 DEBUG [LATE LOAD] - Current form ingredients:', currentIngredients)
      console.log('🔍 DEBUG [LATE LOAD] - Current form ingredients length:', currentIngredients?.length || 0)

      // Only load if ingredients are empty AND recipe data exists
      if ((!currentIngredients || currentIngredients.length === 0) && existingRecipeData.lines && existingRecipeData.lines.length > 0) {
        console.log('🔍 DEBUG [LATE LOAD] - Form is empty, loading recipe data now')

        step3RecipeForm.setValue('portionYield', existingRecipeData.portionYield || 1)
        step3RecipeForm.setValue('prepTime', existingRecipeData.prepTime)
        step3RecipeForm.setValue('cookTime', existingRecipeData.cookTime)
        step3RecipeForm.setValue('notes', existingRecipeData.notes || '')
        step3RecipeForm.setValue('lowStockThreshold', existingRecipeData.lowStockThreshold)

        const ingredients = existingRecipeData.lines.map((line: any) => ({
          rawMaterialId: line.rawMaterialId,
          rawMaterialName: line.rawMaterial?.name,
          quantity: Number(line.quantity),
          unit: line.unit,
          isOptional: line.isOptional || false,
          substituteNotes: line.substituteNotes,
        }))

        console.log('🔍 DEBUG [LATE LOAD] - Mapped ingredients:', ingredients)
        console.log('🔍 DEBUG [LATE LOAD] - Mapped ingredients length:', ingredients.length)

        step3RecipeForm.setValue('ingredients', ingredients)

        const verifyIngredients = step3RecipeForm.getValues('ingredients')
        console.log('🔍 DEBUG [LATE LOAD] - Verified ingredients after setValue:', verifyIngredients)
        console.log('🔍 DEBUG [LATE LOAD] - Verified ingredients length:', verifyIngredients?.length || 0)
      } else {
        console.log('🔍 DEBUG [LATE LOAD] - Skipping load. Reasons:')
        console.log('  - currentIngredients exists:', !!currentIngredients)
        console.log('  - currentIngredients.length:', currentIngredients?.length || 0)
        console.log('  - existingRecipeData.lines exists:', !!existingRecipeData.lines)
        console.log('  - existingRecipeData.lines.length:', existingRecipeData.lines?.length || 0)
      }
    }
  }, [open, mode, selectedInventoryMethod, existingRecipeData, step3RecipeForm])

  // Helper function to clean recipe data for backend (remove rawMaterialName)
  const cleanRecipeDataForBackend = (recipeData: Step3RecipeFormData) => {
    // ✅ FIX: Clean optional fields (prepTime, cookTime, notes) to avoid sending null/undefined/NaN
    // ✅ FIX: Explicitly map ingredients to ensure all required fields are present
    // ✅ FIX: Filter out ingredients with invalid rawMaterialId

    console.log('🔍 DEBUG [CLEAN FUNCTION] - Input ingredients:', recipeData.ingredients)
    console.log('🔍 DEBUG [CLEAN FUNCTION] - Input ingredients count:', recipeData.ingredients?.length || 0)

    const validIngredients = recipeData.ingredients
      .filter(ingredient => {
        // Only include ingredients with valid rawMaterialId
        const isValid =
          ingredient.rawMaterialId && typeof ingredient.rawMaterialId === 'string' && ingredient.rawMaterialId.trim().length > 0

        if (!isValid) {
          console.log('🔍 DEBUG [CLEAN FUNCTION] - Invalid ingredient filtered out:', ingredient)
        }

        return isValid
      })
      .map(ingredient => {
        const mapped = {
          rawMaterialId: ingredient.rawMaterialId.trim(),
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          isOptional: ingredient.isOptional ?? false,
          ...(ingredient.substituteNotes && { substituteNotes: ingredient.substituteNotes }),
        }
        console.log('🔍 DEBUG [CLEAN FUNCTION] - Mapped ingredient:', mapped)
        return mapped
      })

    console.log('🔍 DEBUG [CLEAN FUNCTION] - Valid ingredients after filter/map:', validIngredients)
    console.log('🔍 DEBUG [CLEAN FUNCTION] - Valid ingredients count:', validIngredients.length)

    const cleanedData: any = {
      portionYield: recipeData.portionYield,
      ingredients: validIngredients,
    }

    // Only include prepTime if it's a valid number
    if (recipeData.prepTime && !isNaN(recipeData.prepTime) && recipeData.prepTime > 0) {
      cleanedData.prepTime = recipeData.prepTime
    }

    // Only include cookTime if it's a valid number
    if (recipeData.cookTime && !isNaN(recipeData.cookTime) && recipeData.cookTime > 0) {
      cleanedData.cookTime = recipeData.cookTime
    }

    // Only include notes if it's not empty
    if (recipeData.notes && recipeData.notes.trim().length > 0) {
      cleanedData.notes = recipeData.notes
    }

    // Only include lowStockThreshold if it's a valid number
    if (recipeData.lowStockThreshold && !isNaN(recipeData.lowStockThreshold) && recipeData.lowStockThreshold > 0) {
      cleanedData.lowStockThreshold = recipeData.lowStockThreshold
    }

    return cleanedData
  }

  // Step 1 Submit Handler - Single step: product data + inventory selection + inventory config
  const handleStep1Submit = (data: Step1FormData) => {
    // Use imageUrl from uploader hook if available, otherwise use form value
    const finalImageUrl = imageUrl || data.imageUrl

    // Extract modifier group IDs from the form
    const modifierGroupIds = Array.isArray(data.modifierGroups) ? data.modifierGroups.map(m => m.value) : []

    // Create product data without imageUrl field initially
    const productData: any = {
      name: data.name,
      description: data.description,
      price: data.price,
      categoryId: data.categoryId,
      modifierGroupIds,
    }

    // Only add imageUrl if it's a non-empty string (backend requires valid URL or field omitted)
    if (finalImageUrl && finalImageUrl.trim() !== '') {
      productData.imageUrl = finalImageUrl
    }

    setStep1Data(productData)

    // Get inventory selection from step2Form (now part of step 1)
    const inventoryData = step2Form.getValues()
    setStep2Data(inventoryData)

    console.log('📝 Step 1 Submit (single step):', {
      mode,
      productId,
      useInventory: inventoryData.useInventory,
      inventoryMethod: inventoryData.inventoryMethod,
    })

    // If not using inventory, complete the wizard
    if (!inventoryData.useInventory) {
      if (mode === 'edit') {
        // In edit mode, update product and disable inventory tracking
        if (!productId) {
          toast({
            title: tCommon('error'),
            description: 'Missing product ID',
            variant: 'destructive',
          })
          return
        }

        // Call API to update product and disable inventory tracking
        api
          .put(`/api/v1/dashboard/venues/${venueId}/products/${productId}`, {
            ...productData,
            trackInventory: false,
          })
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['products', venueId] })
            queryClient.invalidateQueries({ queryKey: ['product', venueId, productId] })
            queryClient.invalidateQueries({ queryKey: ['product-detail', venueId, productId] })
            queryClient.invalidateQueries({ queryKey: ['product-wizard-progress', venueId, productId] })

            toast({
              title: t('wizard.success'),
              description: t('wizard.successMessage'),
              variant: 'default',
            })

            resetWizard()
            onOpenChange(false)

            if (onSuccess && productId) {
              onSuccess(productId)
            }
          })
          .catch((error: any) => {
            toast({
              title: tCommon('error'),
              description: error.response?.data?.message || 'Failed to update product',
              variant: 'destructive',
            })
          })
        return
      }

      // In create mode, submit product without inventory
      createProductWithInventoryMutation.mutate({
        product: { ...productData, type: productType ?? undefined },
        inventory: { useInventory: false },
      })
      return
    }

    // Using inventory - submit with inventory configuration directly
    const inventoryMethod = inventoryData.inventoryMethod

    if (mode === 'edit') {
      // In edit mode, update product data AND inventory configuration
      if (!inventoryMethod) {
        toast({
          title: tCommon('error'),
          description: 'Missing inventory method',
          variant: 'destructive',
        })
        return
      }

      // First update product data
      const updateProductFirst = async () => {
        if (productId) {
          try {
            await api.put(`/api/v1/dashboard/venues/${venueId}/products/${productId}`, productData)
          } catch (error: any) {
            toast({
              title: tCommon('error'),
              description: error.response?.data?.message || 'Failed to update product',
              variant: 'destructive',
            })
            throw error
          }
        }
      }

      if (inventoryMethod === 'QUANTITY') {
        const simpleStockData = step3SimpleForm.getValues()
        updateProductFirst().then(() => {
          configureInventoryMutation.mutate({
            inventoryMethod: 'QUANTITY',
            simpleStock: simpleStockData,
          })
        }).catch(() => {
          // Error already handled in updateProductFirst
        })
        return
      } else if (inventoryMethod === 'RECIPE') {
        const recipeData = step3RecipeForm.getValues()

        // Validate that at least one ingredient is added
        if (!recipeData.ingredients || recipeData.ingredients.length === 0) {
          toast({
            title: tCommon('error'),
            description: t('recipes.messages.noRecipe'),
            variant: 'destructive',
          })

          // Highlight the "Add Ingredient" button
          setHighlightAddButton(true)
          setTimeout(() => setHighlightAddButton(false), 4000)

          return
        }

        // Validate that all ingredients have valid rawMaterialId
        const invalidIngredients = recipeData.ingredients.filter(
          ingredient =>
            !ingredient.rawMaterialId || typeof ingredient.rawMaterialId !== 'string' || ingredient.rawMaterialId.trim().length === 0,
        )

        if (invalidIngredients.length > 0) {
          toast({
            title: tCommon('error'),
            description: 'Some ingredients are missing or invalid. Please check your recipe.',
            variant: 'destructive',
          })
          return
        }

        const cleanedRecipe = cleanRecipeDataForBackend(recipeData)

        updateProductFirst().then(() => {
          configureInventoryMutation.mutate({
            inventoryMethod: 'RECIPE',
            recipe: cleanedRecipe,
          })
        }).catch(() => {
          // Error already handled in updateProductFirst
        })
        return
      }
      return
    }

    // In create mode, submit product with inventory configuration
    if (inventoryMethod === 'QUANTITY') {
      const simpleStockData = step3SimpleForm.getValues()
      createProductWithInventoryMutation.mutate({
        product: { ...productData, type: productType ?? undefined },
        inventory: inventoryData,
        simpleStock: simpleStockData,
      })
    } else if (inventoryMethod === 'RECIPE') {
      const recipeData = step3RecipeForm.getValues()

      // Validate that at least one ingredient is added
      if (!recipeData.ingredients || recipeData.ingredients.length === 0) {
        toast({
          title: tCommon('error'),
          description: t('recipes.messages.noRecipe'),
          variant: 'destructive',
        })

        // Highlight the "Add Ingredient" button
        setHighlightAddButton(true)
        setTimeout(() => setHighlightAddButton(false), 4000)

        return
      }

      // Validate that all ingredients have valid rawMaterialId
      const invalidIngredients = recipeData.ingredients.filter(
        ingredient =>
          !ingredient.rawMaterialId || typeof ingredient.rawMaterialId !== 'string' || ingredient.rawMaterialId.trim().length === 0,
      )

      if (invalidIngredients.length > 0) {
        toast({
          title: tCommon('error'),
          description: 'Some ingredients are missing or invalid. Please check your recipe.',
          variant: 'destructive',
        })
        return
      }

      const cleanedRecipe = cleanRecipeDataForBackend(recipeData)

      createProductWithInventoryMutation.mutate({
        product: { ...productData, type: productType ?? undefined },
        inventory: inventoryData,
        recipe: cleanedRecipe,
      })
    }
  }

  const isLoading = createProductWithInventoryMutation.isPending || configureInventoryMutation.isPending

  // Render action buttons - single step, always show "Finish"
  const renderActions = () => {
    return (
      <>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
          {tCommon('cancel')}
        </Button>
        <Button
          type="submit"
          form="step1-form"
          disabled={isLoading || (mode === 'create' && (uploading || !!imageForCrop))}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'edit' ? tCommon('save') : t('wizard.finish')}
          <Check className="ml-2 h-4 w-4" />
        </Button>
      </>
    )
  }

  return (
    <>
      <FullScreenModal
        open={open}
        onClose={() => onOpenChange(false)}
        title={
          // Show product name if available, otherwise show wizard title
          // For edit mode, also check existingProductData in case form hasn't loaded yet
          step1Form.watch('name') || existingProductData?.name || (mode === 'create' ? t('wizard.title') : t('products.detail.configureInventory'))
        }
        actions={renderActions()}
        contentClassName="bg-muted/30"
      >
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {/* Single step wizard - product configuration form */}
          <form id="step1-form" onSubmit={step1Form.handleSubmit(handleStep1Submit)}>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column - Main Form (both create and edit modes) */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Product Type Display (read-only, shows selected type) */}
                  {productType && (
                    <section className="bg-card rounded-2xl border border-border/50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-muted">
                          {(() => {
                            const TypeIcon = PRODUCT_TYPE_ICONS[productType] || Package
                            return <TypeIcon className="h-5 w-5 text-muted-foreground" />
                          })()}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t('productTypes.label', { defaultValue: 'Tipo de artículo' })}</p>
                          <p className="font-medium">
                            {isSpanish
                              ? PRODUCT_TYPE_LABELS[productType]?.es
                              : PRODUCT_TYPE_LABELS[productType]?.en}
                          </p>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Basic Information Section */}
                  <section className="bg-card rounded-2xl border border-border/50 p-6">
                    <SectionHeader icon={Package} title={t('wizard.step1.basicInfo', { defaultValue: 'Información básica' })} />

                    <div className="space-y-5">
                      {/* Name */}
                      <div>
                        <FieldLabel htmlFor="name" label={t('wizard.step1.name')} required />
                        <Input
                          id="name"
                          {...step1Form.register('name', { required: true })}
                          placeholder={t('wizard.step1.namePlaceholder')}
                          className="h-12 text-base"
                        />
                        {step1Form.formState.errors.name && (
                          <p className="text-xs text-destructive mt-1">{t('wizard.step1.nameRequired')}</p>
                        )}
                      </div>

                      {/* Price */}
                      <div>
                        <FieldLabel htmlFor="price" label={t('wizard.step1.price')} required />
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-base">$</span>
                          <Input
                            id="price"
                            type="number"
                            step="0.01"
                            min="0"
                            {...step1Form.register('price', { required: true, valueAsNumber: true, min: 0 })}
                            placeholder="0.00"
                            className="h-12 text-base pl-8"
                          />
                        </div>
                        {step1Form.formState.errors.price && (
                          <p className="text-xs text-destructive mt-1">{t('wizard.step1.priceRequired')}</p>
                        )}
                      </div>

                      {/* Description */}
                      <div>
                        <FieldLabel
                          htmlFor="description"
                          label={t('wizard.step1.description')}
                          tooltip={t('wizard.step1.descriptionTooltip', { defaultValue: 'Descripción que verán los clientes al ordenar' })}
                        />
                        <Textarea
                          id="description"
                          {...step1Form.register('description')}
                          placeholder={t('wizard.step1.descriptionPlaceholder')}
                          rows={4}
                          className="text-base resize-none"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Image Upload Section */}
                  <section className="bg-card rounded-2xl border border-border/50 p-6">
                    <SectionHeader icon={ImagePlus} title={t('wizard.step1.imageUrl')} />

                    {/* Cropper Mode */}
                    {imageForCrop ? (
                      <div className="space-y-4">
                        <div className="relative w-full h-64 bg-muted rounded-xl overflow-hidden">
                          <Cropper
                            image={imageForCrop}
                            crop={crop}
                            zoom={zoom}
                            maxZoom={2}
                            aspect={4 / 3}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                          />
                        </div>
                        <div className="flex justify-between">
                          <Button variant="outline" type="button" onClick={() => setImageForCrop(null)} disabled={uploading}>
                            {tCommon('cancel')}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              handleCropConfirm()
                              step1Form.setValue('imageUrl', imageUrl, { shouldDirty: true })
                            }}
                            disabled={uploading}
                          >
                            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('wizard.step1.confirm')}
                          </Button>
                        </div>
                      </div>
                    ) : (imageUrl || step1Form.watch('imageUrl')) ? (
                      /* Image Preview Mode - Modern hover overlay design */
                      <div className="group relative w-full max-w-xs aspect-[4/3] rounded-xl overflow-hidden bg-muted border border-border/50">
                        <img src={imageUrl || step1Form.watch('imageUrl')} alt={t('wizard.step1.imageUrl')} className="object-cover w-full h-full" />
                        {/* Overlay with actions - appears on hover */}
                        <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-3">
                          <Button
                            variant="secondary"
                            type="button"
                            size="sm"
                            disabled={uploading}
                            className="w-32"
                            onClick={() => {
                              const fileInput = document.createElement('input')
                              fileInput.type = 'file'
                              fileInput.accept = 'image/*'
                              fileInput.onchange = (e: any) => {
                                const file = e.target.files?.[0]
                                if (file) handleFileUpload(file)
                              }
                              fileInput.click()
                            }}
                          >
                            <ImagePlus className="h-4 w-4 mr-2" />
                            {t('wizard.step1.replace')}
                          </Button>
                          <Button
                            variant="destructive"
                            type="button"
                            size="sm"
                            disabled={uploading}
                            className="w-32"
                            onClick={handleDeleteImage}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('wizard.step1.delete')}
                          </Button>
                        </div>
                        {/* Always visible edit indicator */}
                        <div className="absolute bottom-2 right-2 bg-foreground/50 backdrop-blur-sm rounded-full p-1.5 opacity-70 group-hover:opacity-0 transition-opacity">
                          <Pencil className="h-3 w-3 text-background" />
                        </div>
                      </div>
                    ) : (
                      /* Upload Zone */
                      <div
                        className="relative flex flex-col items-center justify-center h-40 border-2 border-border border-dashed rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => {
                          const fileInput = document.createElement('input')
                          fileInput.type = 'file'
                          fileInput.accept = 'image/*'
                          fileInput.onchange = (e: any) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileUpload(file)
                          }
                          fileInput.click()
                        }}
                      >
                        <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">{t('wizard.step1.dropImage')}</p>
                        <p className="text-xs text-primary mt-1">{t('wizard.step1.browseFile')}</p>
                      </div>
                    )}
                  </section>

                  {/* Inventory Selection Section - Now in left column for more space */}
                  <section className="bg-card rounded-2xl border border-border/50 p-6">
                    <SectionHeader icon={Package} title={t('wizard.step2.title', { defaultValue: 'Inventario' })} className="mb-4" />

                    {/* Recommendations - compact version */}
                    {recommendations && (
                      <div className={cn(
                        'text-xs p-2 rounded-lg mb-4',
                        recommendations.hasInventoryFeature
                          ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                          : 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300'
                      )}>
                        <strong>{t('wizard.step2.recommendation')}:</strong> {t(recommendations.recommendation)}
                      </div>
                    )}

                    <div className="space-y-3">
                      {/* Toggle Switch for Inventory */}
                      <div
                        className={cn(
                          'flex items-center gap-3 p-4 rounded-lg border transition-colors',
                          step2Form.watch('useInventory')
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border'
                        )}
                      >
                        <div className={cn(
                          'p-2 rounded-lg shrink-0',
                          step2Form.watch('useInventory')
                            ? 'bg-primary/10'
                            : 'bg-muted'
                        )}>
                          <Package className={cn(
                            'h-4 w-4',
                            step2Form.watch('useInventory')
                              ? 'text-primary'
                              : 'text-muted-foreground'
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Label htmlFor="track-inventory-left" className="text-sm font-medium cursor-pointer">
                            {t('wizard.step2.useInventory')}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {t('wizard.step2.useInventoryDesc')}
                          </p>
                        </div>
                        <Switch
                          id="track-inventory-left"
                          checked={step2Form.watch('useInventory')}
                          onCheckedChange={(checked) => {
                            step2Form.setValue('useInventory', checked)
                            if (!checked) {
                              step2Form.setValue('inventoryMethod', undefined)
                              setSelectedInventoryMethod(null)
                            }
                          }}
                          disabled={!recommendations?.hasInventoryFeature}
                          className="shrink-0 cursor-pointer"
                        />
                      </div>

                      {/* Inventory Method Selection (conditional) */}
                      {step2Form.watch('useInventory') && (
                        <div className="space-y-2 pt-3 border-t border-border/50">
                          <p className="text-xs text-muted-foreground">{t('wizard.step2.inventoryMethodQuestion')}</p>

                          <RadioGroup
                            value={step2Form.watch('inventoryMethod') || ''}
                            onValueChange={value => {
                              step2Form.setValue('inventoryMethod', value as InventoryMethod)
                              setSelectedInventoryMethod(value as InventoryMethod)
                            }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-3"
                          >
                            <Label
                              htmlFor="quantity-tracking-left"
                              className={cn(
                                'flex items-center gap-3 p-4 rounded-lg border transition-colors cursor-pointer',
                                step2Form.watch('inventoryMethod') === 'QUANTITY'
                                  ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                                  : 'border-border hover:bg-accent/50'
                              )}
                            >
                              <RadioGroupItem value="QUANTITY" id="quantity-tracking-left" />
                              <Package className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{t('wizard.step2.quantityTracking')}</p>
                                <p className="text-xs text-muted-foreground">{t('wizard.step2.quantityTrackingDesc')}</p>
                              </div>
                            </Label>

                            <Label
                              htmlFor="recipe-based-left"
                              className={cn(
                                'flex items-center gap-3 p-4 rounded-lg border transition-colors cursor-pointer',
                                step2Form.watch('inventoryMethod') === 'RECIPE'
                                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                                  : 'border-border hover:bg-accent/50'
                              )}
                            >
                              <RadioGroupItem value="RECIPE" id="recipe-based-left" />
                              <Beef className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{t('wizard.step2.recipeBased')}</p>
                                <p className="text-xs text-muted-foreground">{t('wizard.step2.recipeBasedDesc')}</p>
                              </div>
                            </Label>
                          </RadioGroup>

                          {/* Inventory Configuration (inline after method selection) */}
                          {step2Form.watch('inventoryMethod') === 'QUANTITY' && (
                            <div className="space-y-4 pt-4 border-t border-border/50">
                              <Alert className="bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800">
                                <Package className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <AlertDescription className="text-green-800 dark:text-green-200">{t('wizard.step3.simpleStockInfo')}</AlertDescription>
                              </Alert>

                              <div className="space-y-2">
                                <Label htmlFor="initialStock">{t('wizard.step3.initialStock')} *</Label>
                                <Input
                                  id="initialStock"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0"
                                  className="h-12 text-base"
                                  {...step3SimpleForm.register('initialStock', {
                                    required: t('wizard.step3.initialStockRequired'),
                                    valueAsNumber: true,
                                    min: { value: 0, message: t('wizard.step3.initialStockMinimum') },
                                  })}
                                />
                                {step3SimpleForm.formState.errors.initialStock && (
                                  <p className="text-xs text-destructive">{step3SimpleForm.formState.errors.initialStock.message}</p>
                                )}
                                <p className="text-xs text-muted-foreground">{t('wizard.step3.initialStockHelp')}</p>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="costPerUnit">{t('wizard.step3.costPerUnit')} *</Label>
                                  <Input
                                    id="costPerUnit"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="0.00"
                                    className="h-12 text-base"
                                    {...step3SimpleForm.register('costPerUnit', {
                                      required: t('wizard.step3.costPerUnitRequired'),
                                      valueAsNumber: true,
                                      min: { value: 0.01, message: t('wizard.step3.costPerUnitMinimum') },
                                    })}
                                  />
                                  {step3SimpleForm.formState.errors.costPerUnit && (
                                    <p className="text-xs text-destructive">{step3SimpleForm.formState.errors.costPerUnit.message}</p>
                                  )}
                                  <p className="text-xs text-muted-foreground">{t('wizard.step3.costPerUnitHelp')}</p>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="reorderPoint">{t('wizard.step3.reorderPoint')} *</Label>
                                  <Input
                                    id="reorderPoint"
                                    type="number"
                                    step="1"
                                    min="0"
                                    placeholder="10"
                                    className="h-12 text-base"
                                    {...step3SimpleForm.register('reorderPoint', { required: true, valueAsNumber: true, min: 0 })}
                                  />
                                  <p className="text-xs text-muted-foreground">{t('wizard.step3.reorderPointHelp')}</p>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label htmlFor="lowStockThreshold">{t('lowStockThreshold.label')}</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <div className="space-y-2">
                                          <p className="font-semibold">{t('lowStockThreshold.title')}</p>
                                          <p className="text-sm">{t('lowStockThreshold.description')}</p>
                                          <p className="text-sm text-muted-foreground">{t('lowStockThreshold.defaultNote', { value: 10 })}</p>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Input
                                  id="lowStockThreshold"
                                  type="number"
                                  step="1"
                                  min="0"
                                  placeholder="10"
                                  defaultValue={10}
                                  className="h-12 text-base"
                                  {...step3SimpleForm.register('lowStockThreshold', { valueAsNumber: true, min: 0 })}
                                />
                                <p className="text-xs text-muted-foreground">{t('lowStockThreshold.separateFromReorder')}</p>
                              </div>
                            </div>
                          )}

                          {step2Form.watch('inventoryMethod') === 'RECIPE' && (
                            <div className="space-y-4 pt-4 border-t border-border/50">
                              {/* Portion Yield */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label htmlFor="portionYield">{t('recipes.fields.portionYield')} *</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <div className="space-y-2">
                                          <p className="font-semibold">{t('recipes.portionYieldHelp.title')}</p>
                                          <p className="text-sm">{t('recipes.portionYieldHelp.description')}</p>
                                          <div className="text-sm">
                                            <p className="font-medium">{t('recipes.portionYieldHelp.examples')}</p>
                                            <ul className="list-disc list-inside space-y-1 mt-1">
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
                                  placeholder="1"
                                  className="h-12 text-base"
                                  {...step3RecipeForm.register('portionYield', { required: true, valueAsNumber: true, min: 1 })}
                                />
                                <p className="text-xs text-muted-foreground">{t('recipes.portionYieldHelp.description')}</p>
                              </div>

                              {/* Advanced Options - Collapsible */}
                              <Collapsible open={advancedRecipeOpen} onOpenChange={setAdvancedRecipeOpen}>
                                <CollapsibleTrigger asChild>
                                  <Button type="button" variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                                    <span>{t('common:advancedOptions', { defaultValue: 'Opciones avanzadas' })}</span>
                                    <ChevronDown className={cn('h-4 w-4 transition-transform', advancedRecipeOpen && 'rotate-180')} />
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="space-y-4 pt-2">
                                  {/* Prep Time & Cook Time */}
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="prepTime">{t('recipes.fields.prepTime')}</Label>
                                      <Input
                                        id="prepTime"
                                        type="number"
                                        step="1"
                                        min="0"
                                        placeholder="0"
                                        className="h-12 text-base"
                                        {...step3RecipeForm.register('prepTime', { valueAsNumber: true })}
                                      />
                                      <p className="text-xs text-muted-foreground">{t('recipes.prepTimeHelp', { defaultValue: 'Tiempo de preparación en minutos' })}</p>
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="cookTime">{t('recipes.fields.cookTime')}</Label>
                                      <Input
                                        id="cookTime"
                                        type="number"
                                        step="1"
                                        min="0"
                                        placeholder="0"
                                        className="h-12 text-base"
                                        {...step3RecipeForm.register('cookTime', { valueAsNumber: true })}
                                      />
                                      <p className="text-xs text-muted-foreground">{t('recipes.cookTimeHelp', { defaultValue: 'Tiempo de cocción en minutos' })}</p>
                                    </div>
                                  </div>

                                  {/* Notes */}
                                  <div className="space-y-2">
                                    <Label htmlFor="notes">{t('recipes.fields.notes')}</Label>
                                    <Textarea
                                      id="notes"
                                      rows={2}
                                      {...step3RecipeForm.register('notes')}
                                      placeholder={t('wizard.step3.notesPlaceholder')}
                                      className="resize-none"
                                    />
                                    <p className="text-xs text-muted-foreground">{t('recipes.notesHelp', { defaultValue: 'Instrucciones o notas adicionales para la preparación' })}</p>
                                  </div>

                                  {/* Low Stock Threshold */}
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <Label htmlFor="lowStockThresholdRecipe">{t('lowStockThreshold.labelPortions')}</Label>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-xs">
                                            <div className="space-y-2">
                                              <p className="font-semibold">{t('lowStockThreshold.title')}</p>
                                              <p className="text-sm">{t('lowStockThreshold.descriptionPortions')}</p>
                                              <p className="text-sm text-muted-foreground">{t('lowStockThreshold.defaultNotePortions', { value: 5 })}</p>
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                    <Input
                                      id="lowStockThresholdRecipe"
                                      type="number"
                                      step="1"
                                      min="0"
                                      placeholder="5"
                                      defaultValue={5}
                                      className="h-12 text-base"
                                      {...step3RecipeForm.register('lowStockThreshold', { valueAsNumber: true, min: 0 })}
                                    />
                                    <p className="text-xs text-muted-foreground">{t('lowStockThreshold.alertWhenBelow')}</p>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>

                              {/* Ingredients List */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label>{t('recipes.ingredients.title')} *</Label>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setAddIngredientOpen(true)
                                      setHighlightAddButton(false)
                                    }}
                                    className={
                                      highlightAddButton
                                        ? 'animate-bounce bg-orange-500 hover:bg-orange-600 text-primary-foreground border-orange-600 shadow-[0_0_20px_rgba(249,115,22,0.6)] ring-4 ring-orange-300'
                                        : 'border border-border'
                                    }
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    {t('recipes.addIngredient')}
                                  </Button>
                                </div>

                                {step3RecipeForm.watch('ingredients').length === 0 ? (
                                  <Alert>
                                    <AlertDescription>
                                      {t('recipes.messages.noRecipe')} - {t('recipes.addIngredient').toLowerCase()}
                                    </AlertDescription>
                                  </Alert>
                                ) : (
                                  <div className="space-y-2">
                                    {/* Scrollable ingredients list */}
                                    <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
                                      {step3RecipeForm.watch('ingredients').map((ingredient, index) => {
                                        const rawMaterial = rawMaterialsData?.find(rm => rm.id === ingredient.rawMaterialId)
                                        const ingredientName = ingredient.rawMaterialName || rawMaterial?.name || ingredient.rawMaterialId
                                        const costPerUnit = rawMaterial ? Number(rawMaterial.costPerUnit) : 0
                                        const lineCost = costPerUnit * Number(ingredient.quantity)

                                        return (
                                          <div
                                            key={index}
                                            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                                          >
                                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 border border-border">
                                              <Package className="h-5 w-5 text-primary" />
                                            </div>

                                            <div className="flex-1">
                                              <p className="text-sm font-medium text-foreground">
                                                {ingredientName}
                                                {ingredient.isOptional && (
                                                  <span className="ml-2 text-xs text-muted-foreground">({t('recipes.ingredients.optional')})</span>
                                                )}
                                              </p>
                                              <p className="text-xs text-muted-foreground">
                                                {Number(ingredient.quantity).toFixed(2)} {getShortLabel(ingredient.unit)}
                                                {rawMaterial && (
                                                  <>
                                                    {' '}
                                                    × {Currency(costPerUnit)} = <span className="text-green-600 dark:text-green-400 font-medium">{Currency(lineCost)}</span>
                                                  </>
                                                )}
                                              </p>
                                            </div>

                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                const current = step3RecipeForm.getValues('ingredients')
                                                step3RecipeForm.setValue(
                                                  'ingredients',
                                                  current.filter((_, i) => i !== index),
                                                )
                                              }}
                                            >
                                              <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                          </div>
                                        )
                                      })}
                                    </div>

                                    {/* Total Cost - Always visible outside scroll */}
                                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                                      <span className="text-sm font-semibold">{t('recipes.totalCost', { defaultValue: 'Costo total de receta' })}</span>
                                      <span className="text-base font-bold text-green-600 dark:text-green-400">
                                        {Currency(
                                          step3RecipeForm.watch('ingredients').reduce((sum, ing) => {
                                            const rm = rawMaterialsData?.find(r => r.id === ing.rawMaterialId)
                                            const cost = rm ? Number(rm.costPerUnit) * Number(ing.quantity) : 0
                                            return sum + cost
                                          }, 0)
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground">{t('recipes.ingredientsHelp', { defaultValue: 'Los ingredientes se descontarán automáticamente del inventario al vender este producto' })}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                {/* Right Column - Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Category Section */}
                  <section className="bg-card rounded-2xl border border-border/50 p-6">
                    <SectionHeader icon={Grid3X3} title={t('wizard.step1.category')} className="mb-4" />
                    <p className="text-xs text-muted-foreground mb-3">
                      {t('wizard.step1.categoryHelp', { defaultValue: 'Organiza tus productos en categorías para facilitar la navegación.' })}
                    </p>
                    <SearchableSelect
                      options={categoryOptions}
                      value={step1Form.watch('categoryId') || ''}
                      onValueChange={value => step1Form.setValue('categoryId', value, { shouldValidate: true })}
                      placeholder={t('wizard.step1.categoryPlaceholder')}
                      searchPlaceholder={t('wizard.step1.searchCategory', { defaultValue: 'Buscar categoría...' })}
                      emptyMessage={t('wizard.step1.noCategoryFound', { defaultValue: 'No se encontró categoría' })}
                      size="lg"
                    />
                    {step1Form.formState.errors.categoryId && (
                      <p className="text-xs text-destructive mt-2">{t('wizard.step1.categoryRequired')}</p>
                    )}
                  </section>

                  {/* Modifier Groups Section */}
                  <section className="bg-card rounded-2xl border border-border/50 p-6">
                    <SectionHeader icon={Plus} title={t('wizard.step1.modifierGroups')} className="mb-4" />
                    <p className="text-xs text-muted-foreground mb-3">
                      {t('wizard.step1.modifierGroupsHelp', { defaultValue: 'Agrega opciones y extras que los clientes pueden elegir.' })}
                    </p>

                    {/* MultipleSelector - only show unselected options */}
                    {(() => {
                      const selectedIds = (step1Form.watch('modifierGroups') || []).map(g => g.value)
                      const availableOptions = (modifierGroups ?? [])
                        .filter(mg => !selectedIds.includes(mg.id))
                        .map(modifierGroup => ({
                          label: modifierGroup.name,
                          value: modifierGroup.id,
                          disabled: false,
                        }))

                      return availableOptions.length > 0 ? (
                        <MultipleSelector
                          value={[]}
                          onChange={newValues => {
                            const currentValues = step1Form.watch('modifierGroups') || []
                            step1Form.setValue('modifierGroups', [...currentValues, ...newValues])
                          }}
                          options={availableOptions}
                          hidePlaceholderWhenSelected
                          placeholder={t('wizard.step1.selectModifierGroups')}
                          disabled={isModifierGroupsLoading}
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          {(modifierGroups ?? []).length === 0
                            ? t('wizard.step1.noModifierGroupsAvailable', { defaultValue: 'No hay grupos de modificadores disponibles' })
                            : t('wizard.step1.allModifierGroupsSelected', { defaultValue: 'Todos los grupos de modificadores han sido seleccionados' })}
                        </p>
                      )
                    })()}

                    {/* Selected Modifier Groups List */}
                    {(step1Form.watch('modifierGroups') || []).length > 0 && (
                      <div className="mt-4 space-y-2">
                        {(step1Form.watch('modifierGroups') || []).map(selectedGroup => {
                          // Find full modifier group data to show details
                          const fullGroupData = modifierGroups?.find(mg => mg.id === selectedGroup.value)
                          const modifiersList = fullGroupData?.modifiers?.map(m => m.name).join(', ') || ''
                          const minMax = fullGroupData
                            ? (fullGroupData.required
                                ? t('wizard.step1.modifierRequired', { min: fullGroupData.minSelections, max: fullGroupData.maxSelections || '∞', defaultValue: `Requerido: ${fullGroupData.minSelections}-${fullGroupData.maxSelections || '∞'}` })
                                : t('wizard.step1.modifierOptional', { defaultValue: 'Opcional' }))
                            : ''

                          return (
                            <div
                              key={selectedGroup.value}
                              className="flex items-start justify-between p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{selectedGroup.label}</p>
                                {modifiersList && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                    {modifiersList}
                                  </p>
                                )}
                                {minMax && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {minMax}
                                  </p>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() => {
                                  const currentValues = step1Form.watch('modifierGroups') || []
                                  step1Form.setValue('modifierGroups', currentValues.filter(g => g.value !== selectedGroup.value))
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>

                  {/* Live Preview Card */}
                  {(step1Form.watch('name') || (step1Form.watch('modifierGroups') || []).length > 0 || step2Form.watch('useInventory')) && (
                    <div className="rounded-xl border border-dashed bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                        <Sparkles className="h-4 w-4" />
                        <span>{t('wizard.preview.title', { defaultValue: 'Vista previa' })}</span>
                      </div>

                      <div className="space-y-3">
                        {/* Product Info with Image */}
                        <div className="flex items-start gap-3">
                          {/* Product Image Thumbnail */}
                          {step1Form.watch('imageUrl') ? (
                            <div className="w-12 h-12 rounded-lg overflow-hidden border border-border/50 shrink-0">
                              <img
                                src={step1Form.watch('imageUrl')}
                                alt={step1Form.watch('name') || 'Product'}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-muted/50 border border-dashed border-border/50 flex items-center justify-center shrink-0">
                              <ImagePlus className="h-5 w-5 text-muted-foreground/50" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">
                              {step1Form.watch('name') || t('wizard.preview.productName', { defaultValue: 'Nombre del producto' })}
                            </p>
                            {step1Form.watch('price') > 0 && (
                              <p className="text-sm text-muted-foreground">
                                {Currency(step1Form.watch('price'))}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Modifier Groups Preview */}
                        {(step1Form.watch('modifierGroups') || []).length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-dashed">
                            <p className="text-xs text-muted-foreground">
                              {t('wizard.preview.modifierGroups', { defaultValue: 'Grupos de modificadores' })}:
                            </p>
                            <div className="space-y-1.5">
                              {(step1Form.watch('modifierGroups') || []).map(group => {
                                const fullGroup = modifierGroups?.find(mg => mg.id === group.value)
                                const isRequired = fullGroup?.required
                                const minSelections = fullGroup?.minSelections ?? 0
                                const maxSelections = fullGroup?.maxSelections ?? 0

                                // Build requirement text
                                let requirementText = ''
                                if (isRequired) {
                                  requirementText = t('wizard.preview.required', { defaultValue: 'Obligatorio' })
                                }
                                if (minSelections > 0 || maxSelections > 0) {
                                  if (minSelections === maxSelections && minSelections > 0) {
                                    requirementText += (requirementText ? ' · ' : '') + t('wizard.preview.selectExact', { count: minSelections, defaultValue: 'Selecciona {{count}}' })
                                  } else if (minSelections > 0 && maxSelections > 0) {
                                    requirementText += (requirementText ? ' · ' : '') + t('wizard.preview.selectRange', { min: minSelections, max: maxSelections, defaultValue: 'Min {{min}}, Máx {{max}}' })
                                  } else if (minSelections > 0) {
                                    requirementText += (requirementText ? ' · ' : '') + t('wizard.preview.selectMin', { min: minSelections, defaultValue: 'Mínimo {{min}}' })
                                  } else if (maxSelections > 0) {
                                    requirementText += (requirementText ? ' · ' : '') + t('wizard.preview.selectMax', { max: maxSelections, defaultValue: 'Máximo {{max}}' })
                                  }
                                }

                                return (
                                  <div key={group.value} className="rounded-lg border px-3 py-2 bg-background/50">
                                    <div className="flex items-center gap-2">
                                      <p className="text-xs font-medium flex-1">{group.label}</p>
                                      {isRequired && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 font-medium">
                                          {t('wizard.preview.required', { defaultValue: 'Obligatorio' })}
                                        </span>
                                      )}
                                    </div>
                                    {requirementText && !isRequired && (
                                      <p className="text-[10px] text-muted-foreground mt-0.5">{requirementText}</p>
                                    )}
                                    {isRequired && (minSelections > 0 || maxSelections > 0) && (
                                      <p className="text-[10px] text-muted-foreground mt-0.5">
                                        {minSelections === maxSelections && minSelections > 0
                                          ? t('wizard.preview.selectExact', { count: minSelections, defaultValue: 'Selecciona {{count}}' })
                                          : minSelections > 0 && maxSelections > 0
                                            ? t('wizard.preview.selectRange', { min: minSelections, max: maxSelections, defaultValue: 'Min {{min}}, Máx {{max}}' })
                                            : minSelections > 0
                                              ? t('wizard.preview.selectMin', { min: minSelections, defaultValue: 'Mínimo {{min}}' })
                                              : t('wizard.preview.selectMax', { max: maxSelections, defaultValue: 'Máximo {{max}}' })}
                                      </p>
                                    )}
                                    {fullGroup?.modifiers && fullGroup.modifiers.length > 0 && (
                                      <div className="space-y-1 mt-1.5">
                                        {/* Modifiers with inventory tracking */}
                                        {fullGroup.modifiers.filter(mod => mod.rawMaterialId).length > 0 && (
                                          <div className="space-y-1">
                                            {fullGroup.modifiers.filter(mod => mod.rawMaterialId).map(mod => (
                                              <div
                                                key={mod.id}
                                                className={cn(
                                                  'flex items-center gap-1.5 px-2 py-1 rounded-md border',
                                                  mod.inventoryMode === 'SUBSTITUTION'
                                                    ? 'bg-blue-500/5 border-blue-500/20'
                                                    : 'bg-green-500/5 border-green-500/20'
                                                )}
                                              >
                                                <span className="text-[10px]">
                                                  {getCategoryEmoji(mod.rawMaterial?.unit ? 'OTHER' : undefined)}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-medium truncate">{mod.name}</span>
                                                    <span className={cn(
                                                      'text-[8px] px-1 py-0.5 rounded-full font-medium shrink-0',
                                                      mod.inventoryMode === 'SUBSTITUTION'
                                                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                        : 'bg-green-500/10 text-green-600 dark:text-green-400'
                                                    )}>
                                                      {mod.inventoryMode === 'SUBSTITUTION'
                                                        ? t('wizard.preview.modifierInventory.substitution', { defaultValue: 'Sustitución' })
                                                        : t('wizard.preview.modifierInventory.addition', { defaultValue: 'Adición' })}
                                                    </span>
                                                  </div>
                                                  <p className="text-[9px] text-muted-foreground truncate">
                                                    {t('wizard.preview.modifierInventory.uses', { defaultValue: 'Usa' })} {mod.quantityPerUnit || 1} {getShortLabel(mod.unit || mod.rawMaterial?.unit || 'UNIT')} {mod.rawMaterial?.name || ''}
                                                  </p>
                                                </div>
                                                {mod.rawMaterial?.costPerUnit && (
                                                  <span className="text-[9px] text-muted-foreground shrink-0">
                                                    {Currency(Number(mod.rawMaterial.costPerUnit) * (mod.quantityPerUnit || 1))}
                                                  </span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {/* Modifiers without inventory tracking */}
                                        {fullGroup.modifiers.filter(mod => !mod.rawMaterialId).length > 0 && (
                                          <div className="flex flex-wrap gap-1">
                                            {fullGroup.modifiers.filter(mod => !mod.rawMaterialId).slice(0, 3).map(mod => (
                                              <span key={mod.id} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                                {mod.name}
                                              </span>
                                            ))}
                                            {fullGroup.modifiers.filter(mod => !mod.rawMaterialId).length > 3 && (
                                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                                +{fullGroup.modifiers.filter(mod => !mod.rawMaterialId).length - 3}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Inventory Status */}
                        {step2Form.watch('useInventory') && (
                          <div className="pt-2 border-t border-dashed space-y-2">
                            {step2Form.watch('inventoryMethod') === 'RECIPE' ? (
                              <>
                                {/* Recipe Header */}
                                <div className="flex items-center gap-2">
                                  <ChefHat className="h-4 w-4 text-orange-500" />
                                  <span className="text-xs font-medium">{t('wizard.preview.recipe', { defaultValue: 'Receta' })}</span>
                                </div>

                                {/* Ingredients List */}
                                {step3RecipeForm.watch('ingredients').length > 0 ? (
                                  <div className="space-y-1.5">
                                    {step3RecipeForm.watch('ingredients').map((ingredient, idx) => {
                                      const rawMaterial = rawMaterialsData?.find((rm: any) => rm.id === ingredient.rawMaterialId)
                                      const ingredientCost = rawMaterial ? Number(rawMaterial.costPerUnit) * Number(ingredient.quantity) : 0

                                      return (
                                        <div
                                          key={ingredient.rawMaterialId || idx}
                                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-background/50 border border-border/50"
                                        >
                                          <span className="text-sm">{getCategoryEmoji(rawMaterial?.category)}</span>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-medium truncate">
                                              {ingredient.rawMaterialName || rawMaterial?.name || t('wizard.preview.unknownIngredient', { defaultValue: 'Ingrediente' })}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                              {ingredient.quantity} {getShortLabel(ingredient.unit)}
                                            </p>
                                          </div>
                                          <span className="text-[10px] font-medium text-muted-foreground shrink-0">
                                            {Currency(ingredientCost)}
                                          </span>
                                        </div>
                                      )
                                    })}

                                    {/* Total Cost */}
                                    <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                                      <span className="text-[11px] font-medium text-orange-600 dark:text-orange-400">
                                        {t('wizard.preview.recipeCost', { defaultValue: 'Costo de receta' })}
                                      </span>
                                      <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
                                        {Currency(
                                          step3RecipeForm.watch('ingredients').reduce((total, ing) => {
                                            const rm = rawMaterialsData?.find((r: any) => r.id === ing.rawMaterialId)
                                            return total + (rm ? Number(rm.costPerUnit) * Number(ing.quantity) : 0)
                                          }, 0)
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-muted-foreground px-2">
                                    {t('wizard.preview.noIngredients', { defaultValue: 'Sin ingredientes' })}
                                  </p>
                                )}
                              </>
                            ) : (
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 border border-border/50">
                                <Package className="h-4 w-4 text-blue-500" />
                                <div className="flex-1">
                                  <p className="text-xs font-medium">{t('wizard.preview.stock', { defaultValue: 'Stock directo' })}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {t('wizard.preview.stockValue', { value: step3SimpleForm.watch('initialStock') || 0, defaultValue: 'Stock: {{value}}' })}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </form>

        </div>
      </FullScreenModal>

      {/* Conversion Dialog */}
      {conversionDirection && (
        <SimpleConfirmDialog
          open={conversionDialogOpen}
          onOpenChange={setConversionDialogOpen}
          title={t(`conversion.${conversionDirection}.title`)}
          message={t(`conversion.${conversionDirection}.message`)}
          confirmLabel={t(`conversion.${conversionDirection}.confirm`)}
          cancelLabel={t(`conversion.${conversionDirection}.cancel`)}
          onConfirm={() => switchInventoryMethodMutation.mutate()}
          isLoading={switchInventoryMethodMutation.isPending}
        />
      )}

      {/* Add Ingredient Dialog - works in both create and edit modes */}
      <AddIngredientDialog
        open={addIngredientOpen}
        onOpenChange={setAddIngredientOpen}
        product={{
          id: createdProductId || productId || 'temp-product',
          name: step1Form.watch('name') || step1Data?.name || t('wizard.newProduct', { defaultValue: 'Nuevo Producto' })
        }}
        mode="create"
        onAddTempIngredient={ingredient => {
          const current = step3RecipeForm.getValues('ingredients')
          step3RecipeForm.setValue('ingredients', [...current, { ...ingredient, isOptional: ingredient.isOptional ?? false }])
          toast({
            title: t('recipes.messages.ingredientAdded'),
            variant: 'default',
          })
        }}
      />
    </>
  )
}
