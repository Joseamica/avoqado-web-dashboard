import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useImageUploader } from '@/hooks/use-image-uploader'
import { productWizardApi, rawMaterialsApi, recipesApi, productInventoryApi, type InventoryMethod } from '@/services/inventory.service'
import { getMenuCategories, getModifierGroups } from '@/services/menu.service'
import { Loader2, ChevronRight, ChevronLeft, AlertCircle, Check, Package, Beef, Store, Plus, Trash2, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Currency } from '@/utils/currency'
import Cropper from 'react-easy-crop'
import { AddIngredientDialog } from './AddIngredientDialog'
import MultipleSelector from '@/components/multi-selector'
import { SimpleConfirmDialog } from './SimpleConfirmDialog'
import api from '@/api'

interface ProductWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (productId: string) => void
  mode: 'create' | 'edit'
  productId?: string
}

type WizardStep = 1 | 2 | 3

interface Step1FormData {
  name: string
  description?: string
  price: number
  categoryId: string
  imageUrl?: string
  modifierGroups?: Array<{ label: string; value: string }>
}

interface Step2FormData {
  useInventory: boolean
  inventoryMethod?: InventoryMethod
}

interface Step3SimpleStockFormData {
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

export function ProductWizardDialog({ open, onOpenChange, onSuccess, mode, productId }: ProductWizardDialogProps) {
  const { t } = useTranslation('inventory')
  const { venueId, venueSlug } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Start at step 2 when in edit mode (product already exists)
  const [currentStep, setCurrentStep] = useState<WizardStep>(mode === 'edit' ? 2 : 1)
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
  const [step2Data, setStep2Data] = useState<Step2FormData | null>(null)
  const [highlightAddButton, setHighlightAddButton] = useState(false)

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
    enabled: !!venueId && open && currentStep === 2,
  })

  // Fetch raw materials for recipe ingredients
  const { data: rawMaterialsData } = useQuery({
    queryKey: ['raw-materials', venueId],
    queryFn: async () => {
      const response = await rawMaterialsApi.getAll(venueId)
      return response.data.data
    },
    enabled: !!venueId && open && currentStep === 3 && selectedInventoryMethod === 'RECIPE',
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
    enabled: !!venueId && open && currentStep === 1,
  })

  // Fetch modifier groups for modifier groups dropdown
  const { data: modifierGroups, isLoading: isModifierGroupsLoading } = useQuery({
    queryKey: ['modifier-groups', venueId],
    queryFn: () => getModifierGroups(venueId!),
    enabled: !!venueId && open && currentStep === 1,
  })

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
        title: t('common.error'),
        description: error.response?.data?.message || t('wizard.error'),
        variant: 'destructive',
      })
    },
  })

  // Mutation for configuring inventory on existing product (edit mode)
  const configureInventoryMutation = useMutation({
    mutationFn: async (data: { inventoryMethod: InventoryMethod; simpleStock?: Step3SimpleStockFormData; recipe?: Step3RecipeFormData }) => {
      if (!createdProductId) {
        throw new Error('Product ID is required')
      }

      // ✅ FIX: First update product with trackInventory + inventoryMethod
      // This ensures atomic commit of all changes together
      await api.put(`/api/v1/dashboard/venues/${venueId}/products/${createdProductId}`, {
        trackInventory: true,
        inventoryMethod: data.inventoryMethod,
      })

      // Then configure the inventory details
      if (data.inventoryMethod === 'QUANTITY' && data.simpleStock) {
        // ✅ FIX: In edit mode, backend should handle upsert automatically
        // Wrap in try-catch to handle potential conflicts gracefully
        try {
          return await productWizardApi.configureSimpleStock(venueId, createdProductId, data.simpleStock)
        } catch (error: any) {
          // If inventory already exists, try to update via product endpoint
          if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
            return api.put(`/api/v1/dashboard/venues/${venueId}/products/${createdProductId}/inventory`, {
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
          return await recipesApi.update(venueId, createdProductId, updatePayload)
        } catch (error: any) {
          // Recipe doesn't exist (404), use CREATE
          if (error.response?.status === 404) {
            console.log('🔍 DEBUG [MUTATION] - Recipe not found (404), creating new recipe')
            console.log('🔍 DEBUG [MUTATION] - CREATE payload:', data.recipe)
            return productWizardApi.configureRecipe(venueId, createdProductId, data.recipe)
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
        title: t('common.error'),
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
    setCurrentStep(mode === 'edit' ? 2 : 1)
    setCreatedProductId(productId)
    setSelectedInventoryMethod(null)
    setStep1Data(null)
    setStep2Data(null)
    setHighlightAddButton(false)
    setHasLoadedExistingData(false) // ✅ Reset flag so next opening loads fresh data
    step1Form.reset()
    step2Form.reset()
    step3SimpleForm.reset()
    step3RecipeForm.reset()
  }, [mode, productId, step1Form, step2Form, step3SimpleForm, step3RecipeForm])

  // Handle dialog close
  useEffect(() => {
    if (!open) {
      resetWizard()
    }
  }, [open, resetWizard])

  // Load existing data in edit mode
  useEffect(() => {
    // ✅ FIX: Only load data ONCE when first opening the wizard
    // This prevents overwriting user changes when they modify inventory settings
    if (open && mode === 'edit' && currentStep === 2 && existingProductData && !isLoadingExistingData && !hasLoadedExistingData) {
      const { inventoryMethod, details } = existingProductData

      console.log('🔄 Loading existing product data (first time only):', { inventoryMethod, details })

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
  }, [open, mode, currentStep, existingProductData, existingRecipeData, isLoadingExistingData, hasLoadedExistingData])
  // Note: step2Form, step3SimpleForm, step3RecipeForm removed from deps - they're stable refs from useForm

  // ✅ FIX: Separate effect to load recipe data when it becomes available
  // This handles the case where existingRecipeData loads AFTER existingProductData
  // OR when navigating to step 3 and ingredients haven't been loaded yet
  useEffect(() => {
    if (open && mode === 'edit' && currentStep === 3 && selectedInventoryMethod === 'RECIPE' && existingRecipeData) {
      console.log('🔍 DEBUG [LATE LOAD] - Checking recipe data on step 3')
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
  }, [open, mode, currentStep, selectedInventoryMethod, existingRecipeData, step3RecipeForm])

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
        const isValid = ingredient.rawMaterialId &&
               typeof ingredient.rawMaterialId === 'string' &&
               ingredient.rawMaterialId.trim().length > 0

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

  // Step 1 Submit Handler - Store data and move to Step 2
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
    setCurrentStep(2)
  }

  // Step 2 Submit Handler - Store data and move to Step 3 or complete
  const handleStep2Submit = (data: Step2FormData) => {
    console.log('📝 Step 2 Submit:', {
      data,
      mode,
      productId,
      useInventory: data.useInventory,
      inventoryMethod: data.inventoryMethod,
    })
    setStep2Data(data)

    // If not using inventory
    if (!data.useInventory) {
      if (mode === 'edit') {
        // In edit mode, disable inventory tracking
        if (!productId) {
          toast({
            title: t('common.error'),
            description: 'Missing product ID',
            variant: 'destructive',
          })
          return
        }

        // Call API to disable inventory tracking
        api
          .put(`/api/v1/dashboard/venues/${venueId}/products/${productId}`, {
            trackInventory: false,
          })
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['products', venueId] })
            queryClient.invalidateQueries({ queryKey: ['product', venueId, productId] })
            queryClient.invalidateQueries({ queryKey: ['product-wizard-progress', venueId, productId] })

            // Don't show toast here - let the parent's onSuccess handler show it
            // Just close the wizard
            resetWizard()
            onOpenChange(false)

            // Call parent's onSuccess to trigger their toast
            if (onSuccess && productId) {
              onSuccess(productId)
            }
          })
          .catch((error: any) => {
            toast({
              title: t('common.error'),
              description: error.response?.data?.message || 'Failed to disable inventory tracking',
              variant: 'destructive',
            })
          })
        return
      }

      // In create mode, submit product without inventory
      if (!step1Data) {
        toast({
          title: t('common.error'),
          description: 'Missing product data',
          variant: 'destructive',
        })
        return
      }

      createProductWithInventoryMutation.mutate({
        product: step1Data,
        inventory: { useInventory: false },
      })
      return
    }

    // If using inventory, set method and move to Step 3
    if (data.inventoryMethod) {
      setSelectedInventoryMethod(data.inventoryMethod)
    }

    // ✅ FIX: Don't save to backend yet - keep in local state
    // All changes will be committed atomically when user completes Step 3
    // This prevents inconsistent state if user abandons the wizard
    setCurrentStep(3)
  }

  // Step 3 Submit Handler - Collect all data and submit
  const handleStep3Submit = () => {
    // In edit mode, we only need step2Data and the inventory configuration
    if (mode === 'edit') {
      if (!selectedInventoryMethod) {
        toast({
          title: t('common.error'),
          description: 'Missing inventory method',
          variant: 'destructive',
        })
        return
      }

      if (selectedInventoryMethod === 'QUANTITY') {
        const simpleStockData = step3SimpleForm.getValues()
        configureInventoryMutation.mutate({
          inventoryMethod: 'QUANTITY',
          simpleStock: simpleStockData,
        })
      } else if (selectedInventoryMethod === 'RECIPE') {
        const recipeData = step3RecipeForm.getValues()

        // Validate that at least one ingredient is added
        if (!recipeData.ingredients || recipeData.ingredients.length === 0) {
          toast({
            title: t('common.error'),
            description: t('recipes.messages.noRecipe'),
            variant: 'destructive',
          })

          // Highlight the "Add Ingredient" button
          setHighlightAddButton(true)
          setTimeout(() => setHighlightAddButton(false), 4000)

          return
        }

        // ✅ FIX: Validate that all ingredients have valid rawMaterialId
        const invalidIngredients = recipeData.ingredients.filter(
          ingredient => !ingredient.rawMaterialId || typeof ingredient.rawMaterialId !== 'string' || ingredient.rawMaterialId.trim().length === 0
        )

        if (invalidIngredients.length > 0) {
          toast({
            title: t('common.error'),
            description: 'Some ingredients are missing or invalid. Please check your recipe.',
            variant: 'destructive',
          })
          return
        }

        // 🔍 DEBUG: Log data before sending to backend
        console.log('🔍 DEBUG [EDIT MODE] - Original recipeData:', recipeData)
        console.log('🔍 DEBUG [EDIT MODE] - Original ingredients:', recipeData.ingredients)

        const cleanedRecipe = cleanRecipeDataForBackend(recipeData)
        console.log('🔍 DEBUG [EDIT MODE] - Cleaned recipe:', cleanedRecipe)
        console.log('🔍 DEBUG [EDIT MODE] - Cleaned ingredients:', cleanedRecipe.ingredients)
        console.log('🔍 DEBUG [EDIT MODE] - Ingredients count:', cleanedRecipe.ingredients?.length || 0)

        // Clean data before sending to backend
        configureInventoryMutation.mutate({
          inventoryMethod: 'RECIPE',
          recipe: cleanedRecipe,
        })
      }
      return
    }

    // In create mode, we need all wizard data
    if (!step1Data || !step2Data) {
      toast({
        title: t('common.error'),
        description: 'Missing wizard data',
        variant: 'destructive',
      })
      return
    }

    if (selectedInventoryMethod === 'QUANTITY') {
      const simpleStockData = step3SimpleForm.getValues()
      createProductWithInventoryMutation.mutate({
        product: step1Data,
        inventory: step2Data,
        simpleStock: simpleStockData,
      })
    } else if (selectedInventoryMethod === 'RECIPE') {
      const recipeData = step3RecipeForm.getValues()

      // Validate that at least one ingredient is added
      if (!recipeData.ingredients || recipeData.ingredients.length === 0) {
        toast({
          title: t('common.error'),
          description: t('recipes.messages.noRecipe'),
          variant: 'destructive',
        })

        // Highlight the "Add Ingredient" button
        setHighlightAddButton(true)
        setTimeout(() => setHighlightAddButton(false), 4000)

        return
      }

      // ✅ FIX: Validate that all ingredients have valid rawMaterialId
      const invalidIngredients = recipeData.ingredients.filter(
        ingredient => !ingredient.rawMaterialId || typeof ingredient.rawMaterialId !== 'string' || ingredient.rawMaterialId.trim().length === 0
      )

      if (invalidIngredients.length > 0) {
        toast({
          title: t('common.error'),
          description: 'Some ingredients are missing or invalid. Please check your recipe.',
          variant: 'destructive',
        })
        return
      }

      // 🔍 DEBUG: Log data before sending to backend
      console.log('🔍 DEBUG [CREATE MODE] - Original recipeData:', recipeData)
      console.log('🔍 DEBUG [CREATE MODE] - Original ingredients:', recipeData.ingredients)

      const cleanedRecipe = cleanRecipeDataForBackend(recipeData)
      console.log('🔍 DEBUG [CREATE MODE] - Cleaned recipe:', cleanedRecipe)
      console.log('🔍 DEBUG [CREATE MODE] - Cleaned ingredients:', cleanedRecipe.ingredients)
      console.log('🔍 DEBUG [CREATE MODE] - Ingredients count:', cleanedRecipe.ingredients?.length || 0)

      // Clean data before sending to backend
      createProductWithInventoryMutation.mutate({
        product: step1Data,
        inventory: step2Data,
        recipe: cleanedRecipe,
      })
    }
  }

  // Handle back button
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => (prev - 1) as WizardStep)
    }
  }

  // Calculate progress
  const progressPercentage = (currentStep / 3) * 100

  const isLoading = createProductWithInventoryMutation.isPending || configureInventoryMutation.isPending

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? t('wizard.title') : t('products.detail.configureInventory')}</DialogTitle>
            <DialogDescription>{mode === 'create' ? t('wizard.subtitle') : t('products.detail.configureInventoryDesc')}</DialogDescription>
          </DialogHeader>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{t(`wizard.step${currentStep}.title`)}</span>
              <span>{t('wizard.progress', { current: currentStep, total: 3 })}</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Step 1: Basic Product Information */}
          {currentStep === 1 && (
            <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('wizard.step1.name')} *</Label>
                <Input id="name" {...step1Form.register('name', { required: true })} placeholder={t('wizard.step1.namePlaceholder')} />
                {step1Form.formState.errors.name && <p className="text-xs text-destructive">{t('wizard.step1.nameRequired')}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('wizard.step1.description')}</Label>
                <Textarea
                  id="description"
                  {...step1Form.register('description')}
                  placeholder={t('wizard.step1.descriptionPlaceholder')}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">{t('wizard.step1.price')} *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    {...step1Form.register('price', { required: true, valueAsNumber: true, min: 0 })}
                    placeholder="0.00"
                  />
                  {step1Form.formState.errors.price && <p className="text-xs text-destructive">{t('wizard.step1.priceRequired')}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoryId">{t('wizard.step1.category')} *</Label>
                  <Select
                    value={step1Form.watch('categoryId')}
                    onValueChange={value => step1Form.setValue('categoryId', value, { shouldValidate: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('wizard.step1.categoryPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {step1Form.formState.errors.categoryId && (
                    <p className="text-xs text-destructive">{t('wizard.step1.categoryRequired')}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="modifierGroups">{t('wizard.step1.modifierGroups')}</Label>
                <MultipleSelector
                  value={step1Form.watch('modifierGroups') || []}
                  onChange={value => step1Form.setValue('modifierGroups', value)}
                  options={(modifierGroups ?? []).map(modifierGroup => ({
                    label: modifierGroup.name,
                    value: modifierGroup.id,
                    disabled: false,
                  }))}
                  hidePlaceholderWhenSelected
                  placeholder={t('wizard.step1.selectModifierGroups')}
                  disabled={isModifierGroupsLoading}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('wizard.step1.imageUrl')}</Label>
                <div className="pb-4">
                  {/* 1) Si el usuario ya seleccionó una imagen pero todavía no la recorta, mostramos el Cropper */}
                  {imageForCrop ? (
                    <div>
                      <div className="relative w-full h-64 bg-muted">
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
                      <div className="flex justify-between mt-4">
                        <Button variant="outline" type="button" onClick={() => setImageForCrop(null)} disabled={uploading}>
                          {t('cancel')}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            handleCropConfirm()
                            step1Form.setValue('imageUrl', imageUrl, { shouldDirty: true })
                          }}
                          disabled={uploading}
                        >
                          {t('wizard.step1.confirm')}
                        </Button>
                      </div>
                    </div>
                  ) : imageUrl ? (
                    // 2) Si ya hay una imagen (de la BD o subida) y NO estamos recortando:
                    <div className="relative flex space-x-4">
                      {/* Sección Izquierda: Imagen */}
                      <div className="w-1/3">
                        <img src={imageUrl} alt={t('wizard.step1.imageUrl')} className="object-cover w-full h-auto rounded-md" />
                      </div>

                      {/* Sección Derecha: Texto y Botones */}
                      <div className="flex-1 space-y-2">
                        <p className="text-base">{t('wizard.step1.photoVisible')}</p>
                        <p className="text-sm text-green-600">
                          <a href="https://www.ubereats.com" target="_blank" rel="noreferrer">
                            {t('wizard.step1.photoGuidelines')}
                          </a>
                          .
                        </p>
                        <p className="text-sm text-muted-foreground">{t('wizard.step1.photoRequirements')}</p>

                        <div className="absolute bottom-0 flex mt-2 space-x-2">
                          <Button
                            variant="outline"
                            type="button"
                            disabled={uploading}
                            onClick={() => {
                              const fileInput = document.createElement('input')
                              fileInput.type = 'file'
                              fileInput.accept = 'image/*'
                              fileInput.onchange = (e: any) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  handleFileUpload(file)
                                }
                              }
                              fileInput.click()
                            }}
                          >
                            {t('wizard.step1.replace')}
                          </Button>
                          <Button variant="destructive" type="button" disabled={uploading} onClick={handleDeleteImage}>
                            {t('wizard.step1.delete')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // 3) Si no hay nada de imagen y no estamos recortando, mostramos input normal
                    <div className="relative flex space-x-4">
                      {/* Sección Izquierda: recuadro para subir imagen */}
                      <div className="relative flex flex-col items-center justify-center w-64 h-64 border-2 border-border border-dashed rounded-md ">
                        <p className="text-sm text-center text-muted-foreground">{t('wizard.step1.dropImage')}</p>
                        <p className="text-muted-foreground">{t('wizard.step1.or')}</p>

                        {/* Input "invisible" sobre la zona de drag & drop para que sea clickeable */}
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={e => handleFileUpload(e.target.files?.[0])}
                          className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer "
                          disabled={uploading}
                        />

                        {/* Texto que se ve (debajo del input invisible) */}
                        <p className="font-normal text-sm text-green-600">{t('wizard.step1.browseFile')}</p>
                      </div>

                      {/* Sección Derecha: descripción y botones */}
                      <div className="flex-1 space-y-2 ">
                        <p className="text-base">{t('wizard.step1.photoHelp')}</p>
                        <p className="text-sm text-green-600">
                          <a href="https://www.ubereats.com" target="_blank" rel="noreferrer">
                            {t('wizard.step1.photoGuidelines')}
                          </a>
                        </p>
                        <p className="text-sm text-muted-foreground">{t('wizard.step1.photoRequirements')}</p>

                        <div className="absolute bottom-0 flex mt-2 space-x-2">
                          <Button
                            type="button"
                            disabled={uploading}
                            onClick={() => {
                              const fileInput = document.createElement('input')
                              fileInput.type = 'file'
                              fileInput.accept = 'image/*'
                              fileInput.onchange = (e: any) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  handleFileUpload(file)
                                }
                              }
                              fileInput.click()
                            }}
                          >
                            {t('wizard.step1.addPhoto')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={isLoading || uploading || !!imageForCrop}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('common.next')}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </DialogFooter>
            </form>
          )}

          {/* Step 2: Inventory Type Selection */}
          {currentStep === 2 && (
            <form onSubmit={step2Form.handleSubmit(handleStep2Submit)} className="space-y-6">
              {/* Edit Mode Info Alert */}
              {mode === 'edit' && (
                <Alert className="bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800">
                  <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-800 dark:text-blue-200">
                    <strong>{t('wizard.editMode.title')}:</strong> {t('wizard.editMode.description')}
                  </AlertDescription>
                </Alert>
              )}

              {/* Recommendations */}
              {recommendations && (
                <Alert
                  className={
                    recommendations.hasInventoryFeature
                      ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800'
                      : 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800'
                  }
                >
                  <AlertCircle
                    className={
                      recommendations.hasInventoryFeature
                        ? 'h-4 w-4 text-blue-600 dark:text-blue-400'
                        : 'h-4 w-4 text-orange-600 dark:text-orange-400'
                    }
                  />
                  <AlertDescription
                    className={
                      recommendations.hasInventoryFeature ? 'text-blue-800 dark:text-blue-200' : 'text-orange-800 dark:text-orange-200'
                    }
                  >
                    <strong>{t('wizard.step2.recommendation')}:</strong> {t(recommendations.recommendation)}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <Label>{t('wizard.step2.question')}</Label>

                <RadioGroup
                  value={step2Form.watch('useInventory') ? 'true' : 'false'}
                  onValueChange={value => {
                    const useInventory = value === 'true'
                    step2Form.setValue('useInventory', useInventory)
                    if (!useInventory) {
                      step2Form.setValue('inventoryMethod', undefined)
                    }
                  }}
                >
                  <div className="flex items-center space-x-2 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="false" id="no-inventory" />
                    <Label htmlFor="no-inventory" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                          <Store className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{t('wizard.step2.noInventory')}</p>
                          <p className="text-xs text-muted-foreground">{t('wizard.step2.noInventoryDesc')}</p>
                        </div>
                      </div>
                    </Label>
                  </div>

                  {recommendations?.hasInventoryFeature && (
                    <div className="flex items-center space-x-2 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                      <RadioGroupItem value="true" id="use-inventory" />
                      <Label htmlFor="use-inventory" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                            <Package className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{t('wizard.step2.useInventory')}</p>
                            <p className="text-xs text-muted-foreground">{t('wizard.step2.useInventoryDesc')}</p>
                          </div>
                        </div>
                      </Label>
                    </div>
                  )}
                </RadioGroup>
              </div>

              {/* Inventory Method Selection (conditional) */}
              {step2Form.watch('useInventory') && (
                <div className="space-y-4 pl-4 border-l-2 border-primary">
                  <div className="flex items-center gap-2">
                    <Label>{t('wizard.step2.inventoryMethodQuestion')}</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md" side="right">
                          <div className="space-y-3">
                            <div>
                              <p className="font-semibold">{t('wizard.step2.inventoryMethodHelp.title')}</p>
                              <p className="text-sm text-muted-foreground mt-1">{t('wizard.step2.inventoryMethodHelp.description')}</p>
                            </div>

                            <div className="space-y-2">
                              <div className="bg-green-50 dark:bg-green-950/30 p-2 rounded-md border border-green-200 dark:border-green-800">
                                <p className="font-medium text-sm text-green-900 dark:text-green-100 flex items-center gap-2">
                                  <Package className="h-4 w-4" />
                                  {t('wizard.step2.inventoryMethodHelp.quantity.title')}
                                </p>
                                <p className="text-xs font-medium mt-1">{t('wizard.step2.inventoryMethodHelp.quantity.when')}</p>
                                <ul className="list-disc list-inside space-y-0.5 mt-1 text-xs">
                                  <li>{t('wizard.step2.inventoryMethodHelp.quantity.example1')}</li>
                                  <li>{t('wizard.step2.inventoryMethodHelp.quantity.example2')}</li>
                                  <li>{t('wizard.step2.inventoryMethodHelp.quantity.example3')}</li>
                                </ul>
                                <p className="text-xs italic mt-1 text-muted-foreground">{t('wizard.step2.inventoryMethodHelp.quantity.note')}</p>
                              </div>

                              <div className="bg-orange-50 dark:bg-orange-950/30 p-2 rounded-md border border-orange-200 dark:border-orange-800">
                                <p className="font-medium text-sm text-orange-900 dark:text-orange-100 flex items-center gap-2">
                                  <Beef className="h-4 w-4" />
                                  {t('wizard.step2.inventoryMethodHelp.recipe.title')}
                                </p>
                                <p className="text-xs font-medium mt-1">{t('wizard.step2.inventoryMethodHelp.recipe.when')}</p>
                                <ul className="list-disc list-inside space-y-0.5 mt-1 text-xs">
                                  <li>{t('wizard.step2.inventoryMethodHelp.recipe.example1')}</li>
                                  <li>{t('wizard.step2.inventoryMethodHelp.recipe.example2')}</li>
                                  <li>{t('wizard.step2.inventoryMethodHelp.recipe.example3')}</li>
                                </ul>
                                <p className="text-xs italic mt-1 text-muted-foreground">{t('wizard.step2.inventoryMethodHelp.recipe.note')}</p>
                              </div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <RadioGroup
                    value={step2Form.watch('inventoryMethod') || ''}
                    onValueChange={value => {
                      step2Form.setValue('inventoryMethod', value as InventoryMethod)
                      setSelectedInventoryMethod(value as InventoryMethod)
                    }}
                  >
                    <div className="flex items-center space-x-2 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                      <RadioGroupItem value="QUANTITY" id="quantity-tracking" />
                      <Label htmlFor="quantity-tracking" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 dark:bg-green-950/50">
                            <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{t('wizard.step2.quantityTracking')}</p>
                            <p className="text-xs text-muted-foreground">{t('wizard.step2.quantityTrackingDesc')}</p>
                          </div>
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                      <RadioGroupItem value="RECIPE" id="recipe-based" />
                      <Label htmlFor="recipe-based" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-950/50">
                            <Beef className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{t('wizard.step2.recipeBased')}</p>
                            <p className="text-xs text-muted-foreground">{t('wizard.step2.recipeBasedDesc')}</p>
                          </div>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              <DialogFooter className="flex justify-between">
                <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  {t('common.back')}
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                    {t('cancel')}
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {step2Form.watch('useInventory') ? t('common.next') : t('wizard.finish')}
                    {step2Form.watch('useInventory') ? <ChevronRight className="ml-2 h-4 w-4" /> : <Check className="ml-2 h-4 w-4" />}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}

          {/* Step 3: Setup Inventory (Quantity Tracking or Recipe) */}
          {currentStep === 3 && (
            <>
              {selectedInventoryMethod === 'QUANTITY' && (
                <form onSubmit={step3SimpleForm.handleSubmit(handleStep3Submit)} className="space-y-4">
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
                        {...step3SimpleForm.register('reorderPoint', { required: true, valueAsNumber: true, min: 0 })}
                      />
                      <p className="text-xs text-muted-foreground">{t('wizard.step3.reorderPointHelp')}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="lowStockThreshold">Low Stock Alert Threshold</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="space-y-2">
                              <p className="font-semibold">What is Low Stock Threshold?</p>
                              <p className="text-sm">Stock level that triggers a low stock alert in your dashboard. When stock falls below this number, the product will be highlighted.</p>
                              <p className="text-sm text-muted-foreground">
                                Default: 10 units. Adjust based on your sales volume and reorder frequency.
                              </p>
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
                      {...step3SimpleForm.register('lowStockThreshold', { valueAsNumber: true, min: 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Alert when stock falls below this level (separate from reorder point)
                    </p>
                  </div>

                  <DialogFooter className="flex justify-between">
                    <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading}>
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      {t('common.back')}
                    </Button>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        {t('cancel')}
                      </Button>
                      <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('wizard.finish')}
                        <Check className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </DialogFooter>
                </form>
              )}

              {selectedInventoryMethod === 'RECIPE' && (
                <form onSubmit={step3RecipeForm.handleSubmit(handleStep3Submit)} className="space-y-4">
                  <Alert className="bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800">
                    <Beef className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <AlertDescription className="text-orange-800 dark:text-orange-200">{t('wizard.step3.recipeInfo')}</AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-3 gap-4">
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
                        {...step3RecipeForm.register('portionYield', { required: true, valueAsNumber: true, min: 1 })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="prepTime">{t('recipes.fields.prepTime')}</Label>
                      <Input id="prepTime" type="number" step="1" {...step3RecipeForm.register('prepTime', { valueAsNumber: true })} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cookTime">{t('recipes.fields.cookTime')}</Label>
                      <Input id="cookTime" type="number" step="1" {...step3RecipeForm.register('cookTime', { valueAsNumber: true })} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">{t('recipes.fields.notes')}</Label>
                    <Textarea id="notes" rows={3} {...step3RecipeForm.register('notes')} placeholder={t('wizard.step3.notesPlaceholder')} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="lowStockThresholdRecipe">Low Stock Alert Threshold (portions)</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="space-y-2">
                              <p className="font-semibold">What is Low Stock Threshold?</p>
                              <p className="text-sm">Number of portions that triggers a low stock alert. When available portions fall below this number, the product will be highlighted in your dashboard.</p>
                              <p className="text-sm text-muted-foreground">
                                Default: 5 portions. Adjust based on your daily sales and preparation time.
                              </p>
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
                      {...step3RecipeForm.register('lowStockThreshold', { valueAsNumber: true, min: 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Alert when available portions fall below this level
                    </p>
                  </div>

                  {/* Ingredients List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>{t('recipes.ingredients.title')}</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAddIngredientOpen(true)
                          setHighlightAddButton(false)
                        }}
                        className={
                          highlightAddButton
                            ? 'animate-bounce bg-orange-500 hover:bg-orange-600 text-primary-foreground border-orange-600 shadow-[0_0_20px_rgba(249,115,22,0.6)] ring-4 ring-orange-300'
                            : ''
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
                      <ScrollArea className="max-h-[300px]">
                        <div className="space-y-2">
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
                                    {Number(ingredient.quantity).toFixed(2)} {ingredient.unit}
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
                      </ScrollArea>
                    )}
                  </div>

                  <DialogFooter className="flex justify-between">
                    <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading}>
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      {t('common.back')}
                    </Button>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        {t('cancel')}
                      </Button>
                      <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('wizard.finish')}
                        <Check className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </DialogFooter>
                </form>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

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

      {/* Add Ingredient Dialog */}
      {createdProductId && (
        <AddIngredientDialog
          open={addIngredientOpen}
          onOpenChange={setAddIngredientOpen}
          product={{ id: createdProductId, name: step1Data?.name || 'Product' }}
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
      )}
    </>
  )
}
