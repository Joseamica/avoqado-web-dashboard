import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { SearchCombobox, type SearchComboboxItem } from '@/components/search-combobox'
import { SatKeyPicker } from '@/components/SatKeyPicker'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useImageUploader } from '@/hooks/use-image-uploader'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import {
  productWizardApi,
  rawMaterialsApi,
  recipesApi,
  productInventoryApi,
  type InventoryMethod,
  type ProductType,
} from '@/services/inventory.service'
import { getMenuCategories, getModifierGroups, IVA_QUERY_KEY, type BloqueoIva } from '@/services/menu.service'
import {
  bloqueosDelError,
  esperaDelIva,
  ConfirmarEncendidoIva,
  SelectorIva,
  useEstadoIva,
  type TratamientoElegible,
} from '@/pages/Menu/Products/components/SelectorIva'
import {
  Loader2,
  Check,
  Package,
  Beef,
  Plus,
  Trash2,
  Info,
  UtensilsCrossed,
  Calendar,
  Ticket,
  Download,
  Heart,
  Users,
  ImagePlus,
  Grid3X3,
  Pencil,
  ChefHat,
  ChevronDown,
  Receipt,
  Crown,
  Layers,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Currency } from '@/utils/currency'
import Cropper from 'react-easy-crop'
import { AddIngredientDialog } from './AddIngredientDialog'
import { SimpleConfirmDialog } from './SimpleConfirmDialog'
import { ProductOptionalSection } from './ProductOptionalSection'
import { usePrintStations } from '@/hooks/use-print-stations'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { PrintStationField } from '@/components/PrintStationField'
import api from '@/api'
import { cn, includesNormalized } from '@/lib/utils'
import { useMasterCatalogError } from '@/features/master-catalog/use-master-catalog-error'
import { PRODUCT_TYPE_LABELS } from '@/lib/product-types'
import { VenueTierBadge } from '@/components/venue-tier-badge'
import { VARIANTES_INICIALES, VariantsSection, type ValorVariantes } from '@/features/product-variants/components/VariantsSection'
import {
  filaParaServidor,
  limpiarOpciones,
  validarFilas,
  validarOpciones,
} from '@/features/product-variants/combinations'
import { mensajeDeVariantes } from '@/features/product-variants/errors'
import { VariantNotice } from '@/features/product-variants/components/VariantNotice'
import { sinCamposDelPadre } from '@/features/product-variants/families'
import { useInvalidarCatalogo } from '@/features/product-variants/hooks'
import { createProductGroup } from '@/services/productGroups.service'
import { ALLOWED_GROUP_TYPES, type CreateGroupBody } from '@/types/productGroup'

// Icon mapping for product types
const PRODUCT_TYPE_ICONS: Record<ProductType, React.ElementType> = {
  REGULAR: Package,
  FOOD_AND_BEV: UtensilsCrossed,
  APPOINTMENTS_SERVICE: Calendar,
  CLASS: Users,
  EVENT: Ticket,
  DIGITAL: Download,
  DONATION: Heart,
  OTHER: Package,
}

// Product type labels: los mismos de la ficha de edición (`@/lib/product-types`, W1).

// Types that don't use inventory tracking
const NO_INVENTORY_TYPES: ProductType[] = ['APPOINTMENTS_SERVICE', 'CLASS', 'DIGITAL', 'DONATION']

// Types that don't use category (digital goods, donations)
// Note: services/classes DO use categories (e.g. "Hair", "Nails", "Yoga", "Spinning")
const NO_CATEGORY_TYPES: ProductType[] = ['DIGITAL', 'DONATION']

// Types that don't use modifier groups (services, classes, digital goods, donations)
const NO_MODIFIER_GROUP_TYPES: ProductType[] = ['APPOINTMENTS_SERVICE', 'CLASS', 'DIGITAL', 'DONATION']

type OptionalSectionId = 'variants' | 'inventory' | 'codes' | 'weight' | 'modifiers' | 'preparation' | 'description' | 'fiscal'
type OptionalOpener = OptionalSectionId | 'recipe'

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
  // Venta por peso: price pasa a ser precio/kg y el backend fuerza unit=KILOGRAM.
  soldByWeight?: boolean
  categoryId?: string
  imageUrl?: string
  modifierGroups?: Array<{ label: string; value: string }>
  type?: ProductType
  duration?: number | null
  maxParticipants?: number | null
  // Optional inventory codes — SKU auto-generated by backend if left empty.
  sku?: string
  gtin?: string
  // Optional SAT fiscal codes (CFDI). Only shown/sent when the venue has the
  // CFDI feature; products inherit their category's keys when left empty.
  satProductKey?: string | null
  satUnitKey?: string | null
  // Optional print-station override — where this item's kitchen/service ticket
  // prints. null (or omitted) inherits from the product's category.
  printStationId?: string | null
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

interface InventoryConfiguration {
  inventoryMethod: InventoryMethod
  simpleStock?: Step3SimpleStockFormData
  recipe?: Step3RecipeFormData
}

interface InventoryRequest {
  venueId: string | null
  productId?: string
  sesion: number
  configuration: InventoryConfiguration
}

interface InventoryConversionRequest extends InventoryRequest {
  direction: 'toRecipe' | 'toQuantity' | null
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
  const { t: tCfdi } = useTranslation('cfdi')
  const { t: tMenu } = useTranslation('menu') // el texto del toast de los bloqueos del IVA vive con el selector (menu.json)
  const { hasAccess: hasCfdi } = useTierFeatureAccess('CFDI')
  // Recipe-based products belong to the advanced-inventory feature (INVENTORY_TRACKING = Premium 👑),
  // exactly like the Recipes page. Free venues without an explicit grant cannot build recipe products.
  const { hasAccess: hasInventoryTracking } = useTierFeatureAccess('INVENTORY_TRACKING')
  const { venue, venueId, venueSlug, fullBasePath } = useCurrentVenue()
  const handleMasterCatalogError = useMasterCatalogError(venue?.organizationId)
  const navigate = useNavigate()
  const isSpanish = i18n.language.startsWith('es')
  const { toast } = useToast()
  const { getShortLabel } = useUnitTranslation()
  const queryClient = useQueryClient()

  const [openSections, setOpenSections] = useState<Set<OptionalSectionId>>(new Set())
  const removedSections = useRef(new Set<OptionalSectionId>())
  const fiscalInitialized = useRef(false)
  const [sectionToRemove, setSectionToRemove] = useState<OptionalSectionId | null>(null)
  const { data: printStations } = usePrintStations(open ? venueId : null)
  const hasPrintStations = (printStations ?? []).some(station => station.active)

  // Single-step wizard - no step navigation needed
  const [createdProductId, setCreatedProductId] = useState<string | undefined>(productId)
  const sesion = useRef(0) // sube cada vez que el asistente se cierra (ver handleWizardComplete)
  const sesionGuardando = useRef<number | null>(null) // de qué apertura es el guardado en camino (ver pedirCerrar)
  const marcarEnvio = () => {
    sesionGuardando.current = sesion.current
    return { sesion: sesion.current }
  }
  const [selectedInventoryMethod, setSelectedInventoryMethod] = useState<InventoryMethod | null>(null)
  const [addIngredientOpen, setAddIngredientOpen] = useState(false)
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false)
  const [conversionDirection, setConversionDirection] = useState<'toRecipe' | 'toQuantity' | null>(null)
  const [pendingInventoryConfig, setPendingInventoryConfig] = useState<InventoryRequest | null>(null)

  // Store wizard data in state (only submit on final step)
  const [step1Data, setStep1Data] = useState<Step1FormData | null>(null)
  const [_step2Data, setStep2Data] = useState<Step2FormData | null>(null)
  const [highlightAddButton, setHighlightAddButton] = useState(false)
  const [advancedRecipeOpen, setAdvancedRecipeOpen] = useState(false)

  // Track if we've already loaded existing data to prevent overwriting user changes
  const [hasLoadedExistingData, setHasLoadedExistingData] = useState(false)
  const [hasLoadedProductDetails, setHasLoadedProductDetails] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')
  const [modifierGroupSearch, setModifierGroupSearch] = useState('')

  // IVA por producto (6b), sólo en modo edición: lo elegido (si el dueño lo tocó), los bloqueos del 409 y el guardado en espera
  // del aviso de primer encendido. `resetWizard` los limpia: un IVA elegido y abandonado no viaja en otro guardado.
  const [iva, setIva] = useState<TratamientoElegible | undefined>()
  const [bloqueosIva, setBloqueosIva] = useState<BloqueoIva[] | undefined>()
  const [porConfirmarIva, setPorConfirmarIva] = useState<Step1FormData | null>(null)

  // Step 1 Form
  const step1Form = useForm<Step1FormData>({
    defaultValues: {
      name: '',
      description: '',
      price: undefined,
      soldByWeight: false,
      categoryId: '',
      imageUrl: '',
      modifierGroups: [],
      sku: '',
      gtin: '',
      satProductKey: null,
      satUnitKey: null,
      printStationId: null,
    },
  })

  // In edit mode, productType prop may be null — resolve from loaded product data
  // step1Form 'type' is populated by useEffect from existingProduct
  const effectiveProductType: ProductType | null = productType ?? (step1Form.watch('type') as ProductType | undefined) ?? null

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
    resetImage,
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
  // Otras pantallas abren el asistente por id: si es una variante, nombre, descripción, categoría, foto, extras, impresora, claves SAT e
  // IVA son del padre — se ven deshabilitados y NO se mandan (deshabilitar no basta: `description: ''` cuenta como cambio ⇒ 409).
  const esVariante = mode === 'edit' && !!existingProduct?.productGroupId

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
  const { data: categories, isLoading: isCategoriesLoading } = useQuery({
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

  // Memoized category options for SearchCombobox
  const categoryOptions = useMemo<SearchComboboxItem[]>(
    () =>
      (categories || []).map(cat => ({
        id: cat.id,
        label: cat.name,
      })),
    [categories],
  )

  // Filtered category options based on search
  const filteredCategoryOptions = useMemo(
    () => (categorySearch.trim() ? categoryOptions.filter(opt => includesNormalized(opt.label ?? '', categorySearch)) : categoryOptions),
    [categoryOptions, categorySearch],
  )

  // Selected category label for display
  const watchedCategoryId = step1Form.watch('categoryId')
  const selectedCategoryLabel = useMemo(
    () => categoryOptions.find(c => c.id === watchedCategoryId)?.label || '',
    [categoryOptions, watchedCategoryId],
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
    onMutate: marcarEnvio,
    onSettled: (_data, _error, _variables, contexto) => {
      if (contexto?.sesion === sesion.current) sesionGuardando.current = null
    },
    onSuccess: (response, _variables, contexto) => {
      const productId = response.data.data.productId
      if (contexto?.sesion === sesion.current) setCreatedProductId(productId) // el de un alta anterior no se cuela en la siguiente

      toast({
        title: t('wizard.success'),
        description: t('wizard.successMessage'),
        variant: 'default',
      })

      handleWizardComplete(contexto?.sesion, venueId, productId)
    },
    onError: (error: any) => {
      if (handleMasterCatalogError(error)) return
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || t('wizard.error'),
        variant: 'destructive',
      })
    },
  })

  // Producto con variantes (Tarea 5): sólo en el alta y en los tipos que admiten familia. Con el plan sin resolver, la casilla
  // sale apagada (nunca se abre lo de pago con estado desconocido); en Gratis, además, con la etiqueta Pro.
  const { t: tv } = useTranslation('variants')
  const accesoVariantes = useTierFeatureAccess('PRODUCT_VARIANTS')
  const puedeVariantes = accesoVariantes.hasAccess && accesoVariantes.isResolved
  const tipoAdmiteVariantes = (ALLOWED_GROUP_TYPES as readonly string[]).includes(String(effectiveProductType ?? ''))
  const [conVariantes, setConVariantes] = useState(false)
  const [variantes, setVariantes] = useState<ValorVariantes>(VARIANTES_INICIALES)
  const [confirmarDescartar, setConfirmarDescartar] = useState(false) // «¿Descartar cambios?» (ver pedirCerrar)
  const conVariantesActiva = mode === 'create' && tipoAdmiteVariantes && conVariantes
  const enviando = useRef(false) // isPending no cambia entre dos clics del mismo instante
  const invalidarCatalogo = useInvalidarCatalogo()
  const crearFamilia = useMutation({
    mutationFn: (body: CreateGroupBody) => createProductGroup(venueId!, body),
    onMutate: marcarEnvio,
    onSuccess: (_data, _body, contexto) => {
      toast({ title: tv('alta.creada') })
      handleWizardComplete(contexto?.sesion) // el mismo cierre que el alta normal (invalida ['products', venueId], lo mismo que useInvalidarCatalogo)
    },
    onError: error => {
      // Tras CUALQUIER error se relee: el reintento automático de src/api.ts pudo haber creado la familia (409 nombre ya usado).
      void invalidarCatalogo(venueId!)
      if (handleMasterCatalogError(error)) return
      toast({ title: tCommon('error'), description: mensajeDeVariantes(error, tv), variant: 'destructive' })
    },
    onSettled: (_data, _error, _variables, contexto) => {
      if (contexto?.sesion !== sesion.current) return
      enviando.current = false
      sesionGuardando.current = null
    },
  })

  // Mutation for configuring inventory on existing product (edit mode)
  const configureInventoryMutation = useMutation({
    onMutate: ({ sesion: sesionDelEnvio }) => {
      sesionGuardando.current = sesionDelEnvio
      return { sesion: sesionDelEnvio }
    },
    // TanStack puede reemplazar las closures mientras espera red: el destino viaja con la captura.
    mutationFn: async ({ venueId: targetVenueId, productId: targetProductId, configuration: data }: InventoryRequest) => {
      if (!targetProductId) {
        throw new Error('Product ID is required')
      }

      // ✅ FIX: First update product with trackInventory + inventoryMethod
      // This ensures atomic commit of all changes together
      await api.put(`/api/v1/dashboard/venues/${targetVenueId}/products/${targetProductId}`, {
        trackInventory: true,
        inventoryMethod: data.inventoryMethod,
      })

      // Then configure the inventory details
      if (data.inventoryMethod === 'QUANTITY' && data.simpleStock) {
        // ✅ FIX: In edit mode, backend should handle upsert automatically
        // Wrap in try-catch to handle potential conflicts gracefully
        try {
          return await productWizardApi.configureSimpleStock(targetVenueId, targetProductId, data.simpleStock)
        } catch (error: any) {
          // If inventory already exists, try to update via product endpoint
          if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
            return api.put(`/api/v1/dashboard/venues/${targetVenueId}/products/${targetProductId}/inventory`, {
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
        const updatePayload = {
          ...data.recipe,
          lines: data.recipe.ingredients,
        }

        try {
          return await recipesApi.update(targetVenueId, targetProductId, updatePayload)
        } catch (error: any) {
          // Recipe doesn't exist (404), use CREATE
          if (error.response?.status === 404) {
            return productWizardApi.configureRecipe(targetVenueId, targetProductId, data.recipe)
          }
          throw error
        }
      }
      throw new Error('Invalid inventory configuration')
    },
    onSuccess: (_response, variables, contexto) => {
      // ✅ FIX: In edit mode, don't show toast here - let parent handle it
      // This prevents double toasts (wizard + parent onSuccess callback)
      if (contexto?.sesion === sesion.current && mode !== 'edit') {
        toast({
          title: t('wizard.success'),
          description: t('wizard.successMessage'),
          variant: 'default',
        })
      }

      handleWizardComplete(contexto?.sesion, variables.venueId)
    },
    onError: (error: any, variables, contexto) => {
      if (contexto?.sesion !== sesion.current) return
      if (handleMasterCatalogError(error)) return
      // Check for 409 conflict error
      if (error.response?.status === 409) {
        // Store the pending configuration to retry after conversion
        setPendingInventoryConfig({
          ...variables,
          configuration: {
            inventoryMethod: error.config?.data ? JSON.parse(error.config.data).inventoryMethod : variables.configuration.inventoryMethod,
            simpleStock: error.config?.data ? JSON.parse(error.config.data).simpleStock : undefined,
            recipe: error.config?.data ? JSON.parse(error.config.data).recipe : undefined,
          },
        })

        // Determine conversion direction based on what we're trying to configure
        const targetType = variables.configuration.inventoryMethod
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
    onSettled: (_data, _error, _variables, contexto) => {
      if (contexto?.sesion === sesion.current) sesionGuardando.current = null
    },
  })

  // Mutation to switch inventory method (auto-conversion)
  const switchInventoryMethodMutation = useMutation({
    onMutate: ({ sesion: sesionDelEnvio }) => {
      sesionGuardando.current = sesionDelEnvio
      return { sesion: sesionDelEnvio }
    },
    mutationFn: ({ venueId: targetVenueId, productId: targetProductId, direction }: InventoryConversionRequest) => {
      if (!targetProductId || !direction) {
        throw new Error('Missing required data for conversion')
      }

      const newMethod: InventoryMethod = direction === 'toRecipe' ? 'RECIPE' : 'QUANTITY'
      return productInventoryApi.switchInventoryMethod(targetVenueId, targetProductId, newMethod)
    },
    onSuccess: (_response, variables, contexto) => {
      if (contexto?.sesion !== sesion.current) return
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['products-with-recipes'] })
      queryClient.invalidateQueries({ queryKey: ['products', variables.venueId] })
      queryClient.invalidateQueries({ queryKey: ['product-wizard-progress', variables.venueId, variables.productId] })

      toast({
        title: t(`conversion.${variables.direction}.success`),
        variant: 'default',
      })

      // Close conversion dialog
      setConversionDialogOpen(false)

      // Retry the original configuration with pending data
      configureInventoryMutation.mutate(variables)
      setPendingInventoryConfig(null)
    },
    onError: (error: any, variables, contexto) => {
      if (contexto?.sesion !== sesion.current) return
      if (handleMasterCatalogError(error)) return
      toast({
        title: t(`conversion.${variables.direction}.error`),
        description: error.response?.data?.message || 'Failed to switch inventory method',
        variant: 'destructive',
      })
    },
    onSettled: (_data, _error, _variables, contexto) => {
      if (contexto?.sesion === sesion.current) sesionGuardando.current = null
    },
  })

  // Handle wizard completion. `sesionDelEnvio` (de onMutate): si el asistente se cerró desde que se envió, el guardado sólo refresca la
  // lista; NO cierra ni limpia el alta que se haya abierto después (Codex r3 #3).
  const handleWizardComplete = (sesionDelEnvio?: number, venueDelEnvio = venueId, productoCompletado = createdProductId) => {
    queryClient.invalidateQueries({ queryKey: ['products', venueDelEnvio] })
    queryClient.invalidateQueries({ queryKey: ['products-with-recipes', venueDelEnvio] })
    queryClient.invalidateQueries({ queryKey: IVA_QUERY_KEY(venueDelEnvio) }) // el primer encendido pudo prender el IVA por producto
    if (sesionDelEnvio !== undefined && sesionDelEnvio !== sesion.current) return

    if (onSuccess && productoCompletado) {
      onSuccess(productoCompletado)
    }

    // Reset flag before closing so next opening loads fresh data
    setHasLoadedExistingData(false)

    // Reset and close
    resetWizard()
    onOpenChange(false)
  }

  // Reset wizard state - wrapped in useCallback to prevent infinite loop
  const resetWizard = useCallback(() => {
    setOpenSections(new Set())
    removedSections.current.clear()
    fiscalInitialized.current = false
    setSectionToRemove(null)
    setCreatedProductId(productId)
    setSelectedInventoryMethod(null)
    setConversionDialogOpen(false)
    setConversionDirection(null)
    setPendingInventoryConfig(null)
    setStep1Data(null)
    setStep2Data(null)
    setHighlightAddButton(false)
    setAdvancedRecipeOpen(false)
    setHasLoadedExistingData(false)
    setHasLoadedProductDetails(false)
    setIva(undefined)
    setBloqueosIva(undefined)
    setPorConfirmarIva(null)
    setConVariantes(false) // el asistente sigue montado al cerrarse: el siguiente alta arranca sin la casilla
    enviando.current = false
    setVariantes(VARIANTES_INICIALES)
    setConfirmarDescartar(false) // la X durante el guardado no deja la pregunta abierta tras cerrar
    resetImage()
    step1Form.reset()
    step2Form.reset()
    step3SimpleForm.reset()
    step3RecipeForm.reset()
  }, [productId, step1Form, step2Form, step3SimpleForm, step3RecipeForm, resetImage])

  // Handle dialog close
  useEffect(() => {
    if (!open) {
      sesion.current += 1
      resetWizard()
    }
  }, [open, resetWizard])

  // Load existing product data into step1Form in edit mode
  // Uses its own flag (hasLoadedProductDetails) independent from inventory data loading
  useEffect(() => {
    if (open && mode === 'edit' && existingProduct && !isLoadingProduct && !hasLoadedProductDetails) {
      // Populate step1Form with existing product data
      step1Form.setValue('name', existingProduct.name || '')
      step1Form.setValue('description', existingProduct.description || '')
      step1Form.setValue('price', Number(existingProduct.price) || 0)
      step1Form.setValue('soldByWeight', (existingProduct as any).soldByWeight ?? false)
      step1Form.setValue('categoryId', existingProduct.categoryId || '')
      step1Form.setValue('imageUrl', existingProduct.imageUrl || '')
      step1Form.setValue('sku', (existingProduct as any).sku || '')
      step1Form.setValue('gtin', (existingProduct as any).gtin || '')

      // SAT fiscal codes (CFDI) — prefill so the picker shows the saved key.
      step1Form.setValue('satProductKey', (existingProduct as any).satProductKey ?? null)
      step1Form.setValue('satUnitKey', (existingProduct as any).satUnitKey ?? null)

      // Print-station override — prefill so the selector shows the saved station.
      step1Form.setValue('printStationId', (existingProduct as any).printStationId ?? null)

      // Load modifier groups if available
      // modifierGroups is the junction table (ProductModifierGroup[]), each with a .group relation
      if (existingProduct.modifierGroups && existingProduct.modifierGroups.length > 0) {
        const modifierGroupsForForm = existingProduct.modifierGroups.map((mg: any) => ({
          label: mg.group?.name ?? mg.name,
          value: mg.group?.id ?? mg.groupId ?? mg.id,
        }))
        step1Form.setValue('modifierGroups', modifierGroupsForForm)
      }

      // Set product type if available
      if (existingProduct.type) {
        step1Form.setValue('type', existingProduct.type as ProductType)
      }

      // Load service/class specific fields
      if (existingProduct.duration != null) {
        step1Form.setValue('duration', existingProduct.duration)
      }
      if (existingProduct.maxParticipants != null) {
        step1Form.setValue('maxParticipants', existingProduct.maxParticipants)
      }

      setHasLoadedProductDetails(true)
    }
  }, [open, mode, existingProduct, isLoadingProduct, hasLoadedProductDetails, step1Form])

  // Load existing inventory data in edit mode
  useEffect(() => {
    // Only load data ONCE when first opening the wizard
    // This prevents overwriting user changes when they modify inventory settings
    if (open && mode === 'edit' && existingProductData && !isLoadingExistingData && !hasLoadedExistingData && !removedSections.current.has('inventory')) {
      const { inventoryMethod, details } = existingProductData

      // ✅ WORLD-CLASS: inventoryMethod column is the SOURCE OF TRUTH
      // Recipe data should only be loaded if inventoryMethod === 'RECIPE'
      // This ensures the UI matches the database state, not orphaned recipe data

      if (inventoryMethod) {
        step2Form.setValue('useInventory', true)
        step2Form.setValue('inventoryMethod', inventoryMethod as InventoryMethod)
        setSelectedInventoryMethod(inventoryMethod as InventoryMethod)

        // Load QUANTITY data
        if (inventoryMethod === 'QUANTITY' && details) {
          step3SimpleForm.setValue('initialStock', details.currentStock || 0)
          step3SimpleForm.setValue('costPerUnit', details.costPerUnit || 0)
          step3SimpleForm.setValue('reorderPoint', details.reorderPoint || 10)
        }

        // Load RECIPE data (only if inventoryMethod is RECIPE)
        if (inventoryMethod === 'RECIPE' && existingRecipeData && existingRecipeData.lines && existingRecipeData.lines.length > 0) {
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

          step3RecipeForm.setValue('ingredients', ingredients)
        }
      } else {
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
    if (open && mode === 'edit' && selectedInventoryMethod === 'RECIPE' && existingRecipeData && !removedSections.current.has('inventory')) {
      // Check if ingredients are already loaded
      const currentIngredients = step3RecipeForm.getValues('ingredients')

      // Only load if ingredients are empty AND recipe data exists
      if ((!currentIngredients || currentIngredients.length === 0) && existingRecipeData.lines && existingRecipeData.lines.length > 0) {
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

        step3RecipeForm.setValue('ingredients', ingredients)
      }
    }
  }, [open, mode, selectedInventoryMethod, existingRecipeData, step3RecipeForm])

  useEffect(() => {
    if (!open) return
    const saved: OptionalSectionId[] = []
    if (hasCfdi && !fiscalInitialized.current) {
      saved.push('fiscal')
      fiscalInitialized.current = true
    }
    if (mode === 'edit' && hasLoadedProductDetails && existingProduct) {
      if (existingProduct.sku || existingProduct.gtin) saved.push('codes')
      if (existingProduct.description) saved.push('description')
      if (existingProduct.soldByWeight) saved.push('weight')
      if (existingProduct.modifierGroups?.length) saved.push('modifiers')
      if (existingProduct.printStationId) saved.push('preparation')
      if (hasCfdi && (existingProduct.satProductKey || existingProduct.satUnitKey)) saved.push('fiscal')
    }
    if (mode === 'edit' && hasLoadedExistingData && existingProductData?.inventoryMethod) saved.push('inventory')
    setOpenSections(current => {
      const additions = saved.filter(id => !current.has(id) && !removedSections.current.has(id))
      return additions.length ? new Set([...current, ...additions]) : current
    })
  }, [open, mode, hasCfdi, hasLoadedProductDetails, existingProduct, hasLoadedExistingData, existingProductData, existingRecipeData])

  // Helper function to clean recipe data for backend (remove rawMaterialName)
  const cleanRecipeDataForBackend = (recipeData: Step3RecipeFormData) => {
    // ✅ FIX: Clean optional fields (prepTime, cookTime, notes) to avoid sending null/undefined/NaN
    // ✅ FIX: Explicitly map ingredients to ensure all required fields are present
    // ✅ FIX: Filter out ingredients with invalid rawMaterialId

    const validIngredients = recipeData.ingredients
      .filter(ingredient => {
        // Only include ingredients with valid rawMaterialId
        return ingredient.rawMaterialId && typeof ingredient.rawMaterialId === 'string' && ingredient.rawMaterialId.trim().length > 0
      })
      .map(ingredient => ({
        rawMaterialId: ingredient.rawMaterialId.trim(),
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        isOptional: ingredient.isOptional ?? false,
        ...(ingredient.substituteNotes && { substituteNotes: ingredient.substituteNotes }),
      }))

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
    const sesionDelEnvio = sesion.current
    // Use imageUrl from uploader hook if available, otherwise use form value
    const finalImageUrl = imageUrl || data.imageUrl

    // Extract modifier group IDs from the form
    const modifierGroupIds = Array.isArray(data.modifierGroups) ? data.modifierGroups.map(m => m.value) : []

    // Producto con variantes: se crea la FAMILIA (nunca el producto suelto). Precio, SKU, código y existencias van por variante;
    // sin IVA (nace al 16 %, P4).
    if (conVariantesActiva) {
      if (enviando.current) return
      const opciones = limpiarOpciones(variantes.opciones)
      const problema = validarOpciones(opciones) ?? validarFilas(data.name, variantes.filas, variantes.conInventario)
      if (problema) {
        revealSection('variants', section => {
          const rowFields: Record<string, string> = { sinPrecio: 'price', precioInvalido: 'price', costoInvalido: 'cost', skuInvalido: 'sku', codigoLargo: 'gtin', existenciasInvalidas: 'initialStock' }
          if ('nombre' in problema) {
            // El nombre visible puede coincidir entre combinaciones; la misma regla localiza la fila por su key.
            const failed = variantes.filas.find(row => row.incluida && validarFilas(data.name, [row], variantes.conInventario)?.code === problema.code)
            const row = Array.from(section.querySelectorAll<HTMLElement>('[data-variant-key]')).find(node => node.dataset.variantKey === failed?.key)
            return row?.querySelector<HTMLElement>(`[data-variant-field="${rowFields[problema.code]}"]`) ?? null
          }
          if (problema.code === 'skuRepetido') return Array.from(section.querySelectorAll<HTMLInputElement>('[data-variant-field="sku"]')).filter(input => !input.disabled && input.value.trim() === problema.sku)[1] ?? null
          if (problema.code === 'sinFilas') return section.querySelector<HTMLElement>('[data-variant-field="included"]')
          let index = 'name' in problema ? opciones.findIndex(option => option.name === problema.name) : 0
          let field = problema.code === 'opcionSinValores' || problema.code === 'demasiadosValores' ? 'option-values' : 'option-name'
          if (problema.code === 'opcionSinNombre') index = opciones.findIndex(option => !option.name)
          if (problema.code === 'textoLargo') {
            index = opciones.findIndex(option => option.name === problema.text || option.values.includes(problema.text))
            field = opciones[index]?.name === problema.text ? 'option-name' : 'option-values'
          }
          if (problema.code === 'demasiadasCombinaciones' || problema.code === 'demasiadasOpciones') {
            index = opciones.length - 1
            field = problema.code === 'demasiadasOpciones' ? 'remove-option' : 'option-values'
          }
          const control = section.querySelector<HTMLElement>(`[data-variant-option-index="${Math.max(0, index)}"] [data-variant-field="${field}"]`)
          return control?.matches('input, button') ? control : control?.querySelector<HTMLElement>('input') ?? section.querySelector<HTMLElement>('[data-tour="product-variants-add-option"]')
        })
        toast({ title: tv(`validacion.${problema.code}`, problema), variant: 'destructive' })
        return
      }
      enviando.current = true
      crearFamilia.mutate({
        name: data.name.trim(),
        categoryId: data.categoryId,
        type: String(effectiveProductType),
        ...(data.description?.trim() ? { description: data.description.trim() } : {}),
        ...(finalImageUrl?.trim() ? { imageUrl: finalImageUrl } : {}),
        printStationId: data.printStationId ?? null,
        ...(hasCfdi ? { satProductKey: data.satProductKey || null, satUnitKey: data.satUnitKey || null } : {}),
        modifierGroupIds,
        trackInventory: variantes.conInventario,
        options: opciones,
        variants: variantes.filas.filter(f => f.incluida).map(f => filaParaServidor(f, variantes.conInventario)),
      })
      return
    }

    // Create product data without imageUrl field initially
    const needsCategory = effectiveProductType ? !NO_CATEGORY_TYPES.includes(effectiveProductType as ProductType) : true
    const needsModifiers = effectiveProductType ? !NO_MODIFIER_GROUP_TYPES.includes(effectiveProductType as ProductType) : true
    const trimmedSku = data.sku?.trim()
    const trimmedGtin = data.gtin?.trim()
    let productData: any = {
      name: data.name,
      description: data.description,
      price: data.price,
      // Venta por peso: flag + unidad KILOGRAM (el backend también la fuerza).
      soldByWeight: data.soldByWeight === true,
      ...(data.soldByWeight === true ? { unit: 'KILOGRAM' } : {}),
      ...(needsCategory && data.categoryId ? { categoryId: data.categoryId } : {}),
      ...(needsModifiers ? { modifierGroupIds } : {}),
      ...(effectiveProductType === 'APPOINTMENTS_SERVICE' && data.duration != null ? { duration: data.duration } : {}),
      ...(effectiveProductType === 'CLASS' && data.maxParticipants != null ? { maxParticipants: data.maxParticipants } : {}),
      // Only include SKU/GTIN if user actually entered something — backend
      // auto-generates SKU when omitted/empty.
      ...(trimmedSku ? { sku: trimmedSku } : {}),
      ...(trimmedGtin ? { gtin: trimmedGtin } : {}),
      // SAT fiscal codes (CFDI). Only sent for CFDI venues; null clears so the
      // product falls back to its category's keys.
      ...(hasCfdi
        ? {
            satProductKey: data.satProductKey || null,
            satUnitKey: data.satUnitKey || null,
          }
        : {}),
      // IVA por producto (6b): UNA sola vez, aquí — lo llevan las dos ediciones (sin inventario y con inventario/`updateProductFirst`);
      // el PUT de inventario no. Sólo si cambió; en el alta no (el producto nace al 16 %).
      ...(mode === 'edit' && iva && iva !== existingProduct?.ivaTratamiento ? { ivaTratamiento: iva } : {}),
      // Print-station override. null clears it so the product falls back to
      // its category's station. Always sent (unlike SKU/CFDI) since undefined
      // vs null both mean "no override" here — sending null is harmless.
      ...(data.printStationId !== undefined ? { printStationId: data.printStationId } : {}),
    }

    // Only add imageUrl if it's a non-empty string (backend requires valid URL or field omitted)
    if (finalImageUrl && finalImageUrl.trim() !== '') {
      productData.imageUrl = finalImageUrl
    }
    if (esVariante) productData = sinCamposDelPadre(productData)

    setStep1Data(productData)

    // Get inventory selection from step2Form (now part of step 1)
    const inventoryData = step2Form.getValues()
    setStep2Data(inventoryData)

    // Non-inventoriable types never use inventory — treat as "no inventory" path
    if (effectiveProductType && NO_INVENTORY_TYPES.includes(effectiveProductType)) {
      inventoryData.useInventory = false
    }

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
            queryClient.invalidateQueries({ queryKey: IVA_QUERY_KEY(venueId) })

            if (sesionDelEnvio !== sesion.current) return

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
            if (sesionDelEnvio !== sesion.current) return
            const bloqueos = bloqueosDelError(error)
            setBloqueosIva(bloqueos)
            toast({
              title: tCommon('error'),
              // Con bloqueos del IVA, el toast manda a la lista de junto al selector (el texto del servidor termina en «…esto:» sin la lista).
              description: bloqueos ? tMenu('iva.bloqueos.toast') : error.response?.data?.message || 'Failed to update product',
              variant: bloqueos || esperaDelIva(error) ? 'default' : 'destructive', // bloqueos y esperas del IVA: nunca en rojo
            })
          })
        return
      }

      // In create mode, submit product without inventory
      createProductWithInventoryMutation.mutate({
        product: { ...productData, type: effectiveProductType ?? undefined },
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
            if (sesionDelEnvio !== sesion.current) throw error
            const bloqueos = bloqueosDelError(error)
            setBloqueosIva(bloqueos)
            toast({
              title: tCommon('error'),
              description: bloqueos ? tMenu('iva.bloqueos.toast') : error.response?.data?.message || 'Failed to update product',
              variant: bloqueos || esperaDelIva(error) ? 'default' : 'destructive',
            })
            throw error
          }
        }
      }

      if (inventoryMethod === 'QUANTITY') {
        const simpleStockData = step3SimpleForm.getValues()
        updateProductFirst()
          .then(() => {
            if (sesionDelEnvio !== sesion.current) return
            configureInventoryMutation.mutate({
              venueId,
              productId: productId || createdProductId,
              sesion: sesionDelEnvio,
              configuration: { inventoryMethod: 'QUANTITY', simpleStock: simpleStockData },
            })
          })
          .catch(() => {
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

          revealSection('inventory', section => section.querySelector<HTMLElement>('[data-tour="product-wizard-add-ingredient"]'))
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

        updateProductFirst()
          .then(() => {
            if (sesionDelEnvio !== sesion.current) return
            configureInventoryMutation.mutate({
              venueId,
              productId: productId || createdProductId,
              sesion: sesionDelEnvio,
              configuration: { inventoryMethod: 'RECIPE', recipe: cleanedRecipe },
            })
          })
          .catch(() => {
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
        product: { ...productData, type: effectiveProductType ?? undefined },
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

        revealSection('inventory', section => section.querySelector<HTMLElement>('[data-tour="product-wizard-add-ingredient"]'))
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
        product: { ...productData, type: effectiveProductType ?? undefined },
        inventory: inventoryData,
        recipe: cleanedRecipe,
      })
    }
  }

  // IVA por producto (6b): un estado que no dice `encendido: true` (apagado, cargando o con error) nunca se salta el aviso del
  // primer encendido — «Guardar» lo abre y sólo «Continuar» deja seguir.
  const estadoIva = useEstadoIva(mode === 'edit' && open ? venueId : null)
  const ivaCambio = mode === 'edit' && iva !== undefined && iva !== existingProduct?.ivaTratamiento
  const pideAvisoIva = ivaCambio && iva !== 'IVA_16' && estadoIva.data?.encendido !== true
  const scrollToCategoryError = () => requestAnimationFrame(() => {
    // Enfocarlo abriría las sugerencias encima del mensaje de error.
    document.querySelector<HTMLInputElement>('[data-tour="product-wizard-category"] input')?.scrollIntoView?.({ block: 'center' })
  })
  const handleStep1Intercept = (data: Step1FormData) => {
    if (!esVariante && !NO_CATEGORY_TYPES.includes(effectiveProductType as ProductType) && !data.categoryId) {
      step1Form.setError('categoryId', { type: 'required', message: t('wizard.step1.categoryRequired') })
      toast({ title: t('wizard.step1.categoryRequired'), variant: 'destructive' })
      scrollToCategoryError()
      return
    }
    if (pideAvisoIva) {
      setPorConfirmarIva(data)
      return
    }
    handleStep1Submit(data)
  }

  const isLoading = createProductWithInventoryMutation.isPending || configureInventoryMutation.isPending || crearFamilia.isPending

  // True while edit-mode wizard is fetching the product to prefill the form.
  // During this window we render a skeleton and lock the action buttons so the
  // user can't submit empty data or close mid-fetch.
  const isInitialLoadingEdit = mode === 'edit' && open && !!productId && (isLoadingProduct || isLoadingExistingData)

  // En el alta, Cancelar, la X y Esc preguntan antes de tirar lo capturado (guardar con éxito cierra por handleWizardComplete, sin
  // preguntar). Cuenta un campo que el usuario tocó (`dirtyFields`), no `isDirty`: éste compara contra los valores iniciales y sale
  // `true` sin tocar nada (QA en navegador, 19-oct). En variantes cuenta lo escrito, no el identificador interno de cada opción
  // (agregar y quitar opciones vacías no es captura), y también un valor en las fichas que aún no es ficha (`data-por-confirmar`).
  // Mientras se guarda cierra directo, sin «descartar»: el guardado sigue (Codex r3) y sin red no se queda sin salida (Codex r2).
  const tocado = (f: { formState: { dirtyFields: object } }) => Object.keys(f.formState.dirtyFields).length > 0
  const hayCaptura =
    mode === 'create' &&
    (tocado(step1Form) ||
      tocado(step2Form) ||
      tocado(step3SimpleForm) ||
      tocado(step3RecipeForm) ||
      variantes.filas.length > 0 ||
      variantes.conInventario ||
      variantes.opciones.some(o => o.name.trim() !== '' || o.values.length > 0) ||
      !!imageForCrop) // una foto elegida que aún no se recorta
  const pedirCerrar = () => {
    // Guardando ESTA apertura: lo que va en camino sí se guarda (y sin red no se queda sin salida). Un guardado de una apertura
    // anterior no cuenta: el alta de ahora pregunta como siempre (Codex r4).
    if (isLoading && sesionGuardando.current === sesion.current) return onOpenChange(false)
    const textoPorConfirmar =
      mode === 'create' &&
      Array.from(document.querySelectorAll<HTMLInputElement>('input[data-por-confirmar]')).some(i => i.value.trim() !== '')
    if (hayCaptura || textoPorConfirmar) setConfirmarDescartar(true)
    else onOpenChange(false)
  }

  // Render action buttons - single step, always show "Finish"
  const renderActions = () => {
    return (
      <>
        <Button type="button" className="min-h-11 px-2 sm:px-4" variant="outline" onClick={pedirCerrar} disabled={isLoading || isInitialLoadingEdit}>
          {tCommon('cancel')}
        </Button>
        <Button
          type="submit"
          form="step1-form"
          data-tour="product-wizard-finish"
          className="min-h-11 px-2 sm:px-4"
          disabled={isLoading || isInitialLoadingEdit || (mode === 'create' && (uploading || !!imageForCrop))}
        >
          {(isLoading || isInitialLoadingEdit) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'edit' ? tCommon('save') : t('wizard.finish')}
          <Check className="ml-2 h-4 w-4" />
        </Button>
      </>
    )
  }

  const revealSection = (id: OptionalSectionId, correctionTarget?: (section: HTMLElement) => HTMLElement | null) => {
    setOpenSections(current => new Set([...current, id]))
    requestAnimationFrame(() => {
      const node = document.querySelector<HTMLElement>(`[data-tour="product-wizard-optional-${id}"]`)
      if (!node) return
      const field = correctionTarget?.(node) ?? node.querySelector<HTMLElement>('[aria-invalid="true"]')
      field?.focus({ preventScroll: true })
      ;(field ?? node).scrollIntoView?.({ block: field ? 'center' : 'nearest', behavior: 'smooth' })
    })
  }
  const openOptional = (opener: OptionalOpener) => {
    const id = opener === 'recipe' ? 'inventory' : opener
    if (id === 'inventory') {
      if (!recommendations?.hasInventoryFeature || (opener === 'recipe' && !hasInventoryTracking)) return
      const method = opener === 'recipe' ? 'RECIPE' : 'QUANTITY'
      step2Form.setValue('useInventory', true)
      step2Form.setValue('inventoryMethod', method)
      setSelectedInventoryMethod(method)
    }
    if (id === 'variants' && !puedeVariantes) return
    removedSections.current.delete(id)
    revealSection(id)
  }
  const hasSectionData = (id: OptionalSectionId) => {
    const data = step1Form.getValues()
    switch (id) {
      case 'codes': return !!(data.sku?.trim() || data.gtin?.trim())
      case 'description': return !!data.description?.trim()
      case 'weight': return data.soldByWeight === true
      case 'preparation': return !!data.printStationId
      case 'modifiers': return !!data.modifierGroups?.length
      case 'fiscal': return !!(data.satProductKey || data.satUnitKey)
      case 'variants': return variantes.filas.length > 0 || variantes.conInventario || variantes.opciones.some(o => o.name.trim() || o.values.length) ||
        Array.from(document.querySelectorAll<HTMLInputElement>('[data-tour="product-wizard-variants"] input[data-por-confirmar]')).some(i => i.value.trim())
      case 'inventory': {
        const stock = step3SimpleForm.getValues()
        const recipe = step3RecipeForm.getValues()
        const entered = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
        return (mode === 'edit' && !!existingProductData?.inventoryMethod) || entered(stock.initialStock) || entered(stock.costPerUnit) ||
          stock.reorderPoint !== 10 || (entered(stock.lowStockThreshold) && stock.lowStockThreshold !== 10) || recipe.ingredients.length > 0 ||
          recipe.portionYield !== 1 || entered(recipe.prepTime) || entered(recipe.cookTime) || !!recipe.notes?.trim() ||
          (entered(recipe.lowStockThreshold) && recipe.lowStockThreshold !== 5)
      }
    }
  }
  const removeOptional = (id: OptionalSectionId) => {
    removedSections.current.add(id)
    setOpenSections(current => { const next = new Set(current); next.delete(id); return next })
    if (id === 'inventory') {
      step2Form.setValue('useInventory', false, { shouldDirty: mode === 'edit' })
      step2Form.setValue('inventoryMethod', undefined)
      setSelectedInventoryMethod(null)
      if (mode === 'create') {
        // Con cuatro RHF dentro del mismo <form>, reset() sin valores reinicia también los campos de las otras secciones.
        step3SimpleForm.reset({ unit: 'UNIT', initialStock: undefined, costPerUnit: undefined, reorderPoint: 10 })
        step3RecipeForm.reset({ portionYield: 1, prepTime: undefined, cookTime: undefined, notes: '', ingredients: [] })
        setAdvancedRecipeOpen(false)
      }
    } else if (mode === 'create') {
      switch (id) {
        case 'variants': setConVariantes(false); setVariantes(VARIANTES_INICIALES); break
        case 'codes': step1Form.resetField('sku'); step1Form.resetField('gtin'); break
        case 'description': step1Form.resetField('description'); break
        case 'weight': step1Form.setValue('soldByWeight', false, { shouldDirty: true }); break
        case 'preparation': step1Form.setValue('printStationId', null, { shouldDirty: true }); break
        case 'modifiers': step1Form.setValue('modifierGroups', [], { shouldDirty: true }); setModifierGroupSearch(''); break
        case 'fiscal': step1Form.setValue('satProductKey', null, { shouldDirty: true }); step1Form.setValue('satUnitKey', null, { shouldDirty: true }); break
      }
    }
    setSectionToRemove(null)
  }
  const requestRemoval = (id: OptionalSectionId) => {
    if (hasSectionData(id)) setSectionToRemove(id)
    else removeOptional(id)
  }
  const inventoryAllowed = !NO_INVENTORY_TYPES.includes(effectiveProductType as ProductType) && !conVariantesActiva
  const allowedOptions: OptionalOpener[] = [
    ...(mode === 'create' && tipoAdmiteVariantes ? ['variants' as const] : []),
    ...(inventoryAllowed ? ['inventory' as const, 'recipe' as const] : []),
    ...(!conVariantesActiva ? ['codes' as const, 'weight' as const] : []),
    ...(!NO_MODIFIER_GROUP_TYPES.includes(effectiveProductType as ProductType) ? ['modifiers' as const] : []),
    ...(hasPrintStations ? ['preparation' as const] : []),
    'description', ...(hasCfdi ? ['fiscal' as const] : []),
  ]
  const recommended: OptionalOpener[] = effectiveProductType === 'FOOD_AND_BEV' || !effectiveProductType
    ? ['modifiers', 'recipe', 'preparation']
    : effectiveProductType === 'EVENT' ? ['inventory', 'description']
      : effectiveProductType === 'DIGITAL' || effectiveProductType === 'DONATION' ? ['description']
        : ['variants', 'inventory', 'codes']
  // Quantity and recipe are two entrances to the same form; show its open content only once.
  const primaryOptions = recommended.filter(id => allowedOptions.includes(id))
  const preferredInventory = primaryOptions.includes('recipe') ? 'recipe' : 'inventory'
  const moreOptions = allowedOptions.filter(id => !primaryOptions.includes(id) && !((id === 'recipe' || id === 'inventory') && openSections.has('inventory')))
  const icons: Record<OptionalSectionId, React.ElementType> = { variants: Layers, inventory: Package, codes: Grid3X3, weight: Package, modifiers: Plus, preparation: ChefHat, description: Pencil, fiscal: Receipt }
  const renderOptional = (opener: OptionalOpener) => {
    const id = opener === 'recipe' ? 'inventory' : opener
    const isOpen = openSections.has(id)
    if (isOpen && id === 'inventory' && opener !== preferredInventory) return null
    const copyId = isOpen && id === 'inventory'
      ? step2Form.watch('inventoryMethod') === 'RECIPE' ? 'recipe' : 'inventory'
      : opener
    const disabledReason = id === 'variants' && !puedeVariantes ? (accesoVariantes.isResolved ? tv('alta.casillaBloqueada') : tCommon('loading'))
      : id === 'inventory' && !recommendations?.hasInventoryFeature ? (recommendations ? t(recommendations.recommendation || 'wizard.step2.useInventoryDesc') : tCommon('loading'))
        : opener === 'recipe' && !hasInventoryTracking ? t('wizard.step2.recipePremiumLocked') : undefined
    const tierBadge = id === 'variants' && accesoVariantes.isResolved && !accesoVariantes.hasAccess ? <VenueTierBadge tier="PRO" />
      : copyId === 'recipe' && !hasInventoryTracking ? <Badge variant="outline">{t('wizard.step2.premiumBadge')}</Badge> : undefined
    return <div key={opener} data-tour={id === 'inventory' && opener === preferredInventory ? 'product-wizard-track-inventory' : undefined} className="min-w-0">
      <ProductOptionalSection id={isOpen ? id : opener} title={t(`wizard.optional.${copyId}.title`)} description={t(`wizard.optional.${copyId}.description`)}
        icon={icons[id]} open={isOpen} onOpen={() => openOptional(opener)} disabledReason={disabledReason} tierBadge={tierBadge}
        onRemove={mode === 'create' || id === 'inventory' ? () => requestRemoval(id) : undefined}>
        {optionalFields[id]}
      </ProductOptionalSection>
    </div>
  }

  const coreType = <>                  {/* Product Type Display (read-only, shows selected type) */}
                  {effectiveProductType && (
                    <section className="bg-card rounded-2xl border border-border/50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-muted">
                          {(() => {
                            const TypeIcon = PRODUCT_TYPE_ICONS[effectiveProductType] || Package
                            return <TypeIcon className="h-5 w-5 text-muted-foreground" />
                          })()}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t('productTypes.label', { defaultValue: 'Tipo de artículo' })}</p>
                          <p className="font-medium">
                            {isSpanish ? PRODUCT_TYPE_LABELS[effectiveProductType]?.es : PRODUCT_TYPE_LABELS[effectiveProductType]?.en}
                          </p>
                        </div>
                      </div>
                    </section>
                  )}

</>
  const coreName = <>                      {/* Name */}
                      <div data-tour="product-wizard-name">
                        <FieldLabel htmlFor="name" label={t('wizard.step1.name')} required />
                        <Input
                          id="name"
                          aria-invalid={!!step1Form.formState.errors.name}
                          {...step1Form.register('name', { required: true })}
                          placeholder={t('wizard.step1.namePlaceholder')}
                          className="h-12 scroll-mt-24 text-base"
                          disabled={esVariante}
                        />
                        {step1Form.formState.errors.name && (
                          <p className="text-xs text-destructive mt-1">{t('wizard.step1.nameRequired')}</p>
                        )}
                      </div>

</>
  const corePrice = <>{!conVariantesActiva && <>                          {/* Price */}
                          <div data-tour="product-wizard-price">
                            <FieldLabel htmlFor="price" label={t('wizard.step1.price')} required />
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-base">$</span>
                              <Input
                                id="price"
                                aria-invalid={!!step1Form.formState.errors.price}
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
                            {step1Form.watch('soldByWeight') && (
                              <p className="text-xs text-muted-foreground mt-1">{t('wizard.step1.soldByWeightDesc')}</p>
                            )}
                          </div>

                          {/* IVA por producto (6b): sólo al editar; el alta nace al 16 %. Del mismo ancho y alto (h-12) que el precio y los demás campos. */}
                          {mode === 'edit' && (
                            <SelectorIva
                              venueId={venueId}
                              actual={existingProduct?.ivaTratamiento}
                              ajusteDeliveryAlgunaVez={existingProduct?.ajusteDeliveryAlgunaVez}
                              value={iva}
                              onChange={v => {
                                setIva(v)
                                setBloqueosIva(undefined)
                              }}
                              bloqueos={bloqueosIva}
                              disabled={esVariante}
                              className="max-w-none"
                              triggerClassName="h-12 text-base"
                            />
                          )}

</>}</>
  const coreCategory = <>                  {/* Category Section — hidden for digital/donation types */}
                  {!NO_CATEGORY_TYPES.includes(effectiveProductType as ProductType) && (
                    <section data-tour="product-wizard-category" className="min-w-0">
                      <SectionHeader icon={Grid3X3} title={t('wizard.step1.category')} className="mb-4" />
                      <p className="text-xs text-muted-foreground mb-3">
                        {t('wizard.step1.categoryHelp', {
                          defaultValue: 'Organiza tus productos en categorías para facilitar la navegación.',
                        })}
                      </p>
                      <SearchCombobox
                        items={filteredCategoryOptions}
                        value={categorySearch || selectedCategoryLabel}
                        onChange={val => {
                          setCategorySearch(val)
                          if (!val) step1Form.setValue('categoryId', '', { shouldValidate: true })
                        }}
                        onSelect={item => {
                          step1Form.setValue('categoryId', item.id, { shouldValidate: true, shouldDirty: true })
                          // El combobox no registra el campo en RHF: su error manual se limpia al elegir.
                          step1Form.clearErrors('categoryId')
                          setCategorySearch('')
                        }}
                        placeholder={t('wizard.step1.categoryPlaceholder')}
                        className={step1Form.formState.errors.categoryId ? '[&_input]:border-destructive' : undefined}
                        isLoading={isCategoriesLoading}
                        disabled={esVariante}
                      />
                      {step1Form.formState.errors.categoryId && (
                        <p role="alert" className="text-xs text-destructive mt-2">{t('wizard.step1.categoryRequired')}</p>
                      )}
                    </section>
                  )}

</>
  const corePhoto = <>                  {/* Image Upload Section */}
                  <section className="min-w-0">
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
                          <Button variant="outline" type="button" onClick={() => setImageForCrop(null)} disabled={uploading || esVariante}>
                            {tCommon('cancel')}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              handleCropConfirm()
                              step1Form.setValue('imageUrl', imageUrl, { shouldDirty: true })
                            }}
                            disabled={uploading || esVariante}
                          >
                            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('wizard.step1.confirm')}
                          </Button>
                        </div>
                      </div>
                    ) : imageUrl || step1Form.watch('imageUrl') ? (
                      /* Image Preview Mode - Modern hover overlay design */
                      <div className="group relative w-full max-w-xs aspect-[4/3] rounded-xl overflow-hidden bg-muted border border-border/50">
                        <img
                          src={imageUrl || step1Form.watch('imageUrl')}
                          alt={t('wizard.step1.imageUrl')}
                          className="object-cover w-full h-full"
                        />
                        {/* Overlay with actions - appears on hover */}
                        <div className="absolute inset-0 bg-foreground/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-3">
                          <Button
                            variant="secondary"
                            type="button"
                            size="sm"
                            disabled={uploading || esVariante}
                            className="h-11 w-32"
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
                            disabled={uploading || esVariante}
                            className="h-11 w-32"
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
                        className={cn(
                          'relative flex flex-col items-center justify-center h-40 border-2 border-border border-dashed rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer',
                          esVariante && 'pointer-events-none opacity-50',
                        )}
                        role="button"
                        tabIndex={esVariante ? -1 : 0}
                        aria-label={t('wizard.step1.browseFile')}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click() } }}
                        aria-disabled={esVariante || undefined}
                        onClick={() => {
                          if (esVariante) return
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

</>
  const typeFields = <>                  {/* CLASS: maxParticipants field */}
                  {effectiveProductType === 'CLASS' && (
                    <section className="min-w-0">
                      <SectionHeader icon={Users} title={isSpanish ? 'Configuración de clase' : 'Class configuration'} className="mb-4" />
                      <div className="space-y-2">
                        <Label htmlFor="maxParticipants">
                          {isSpanish ? 'Cupo máximo de participantes' : 'Max participants'}
                          <span className="text-muted-foreground text-xs ml-1">({isSpanish ? 'opcional' : 'optional'})</span>
                        </Label>
                        <Input
                          id="maxParticipants"
                          type="number"
                          min={1}
                          placeholder={isSpanish ? 'Ej. 15' : 'e.g. 15'}
                          className="h-12 max-w-48 text-base"
                          {...step1Form.register('maxParticipants', { valueAsNumber: true })}
                        />
                        <p className="text-xs text-muted-foreground">
                          {isSpanish
                            ? 'El cupo puede ajustarse por sesión al crear el calendario de clases.'
                            : 'Capacity can be adjusted per session when scheduling classes.'}
                        </p>
                      </div>
                    </section>
                  )}

                  {/* APPOINTMENTS_SERVICE: duration field */}
                  {effectiveProductType === 'APPOINTMENTS_SERVICE' && (
                    <section className="min-w-0">
                      <SectionHeader
                        icon={Calendar}
                        title={isSpanish ? 'Configuración del servicio' : 'Service configuration'}
                        className="mb-4"
                      />
                      <div className="space-y-2">
                        <Label htmlFor="duration">
                          {isSpanish ? 'Duración (minutos)' : 'Duration (minutes)'}
                          <span className="text-muted-foreground text-xs ml-1">({isSpanish ? 'opcional' : 'optional'})</span>
                        </Label>
                        <Input
                          id="duration"
                          type="number"
                          min={1}
                          max={1440}
                          placeholder={isSpanish ? 'Ej. 60' : 'e.g. 60'}
                          className="h-12 max-w-48 text-base"
                          {...step1Form.register('duration', { valueAsNumber: true })}
                        />
                        <p className="text-xs text-muted-foreground">
                          {isSpanish
                            ? 'Se usa para calcular automáticamente la hora de fin al crear una cita.'
                            : 'Used to automatically calculate end time when booking an appointment.'}
                        </p>
                      </div>
                    </section>
                  )}

</>
  const optionalFields: Record<OptionalSectionId, React.ReactNode> = {
    variants: <>                      {/* Producto con variantes (Tarea 5): sólo en el alta y en los tipos que admiten familia; antes del precio */}
                      {mode === 'create' && tipoAdmiteVariantes && (
                        <div
                          className="flex items-start gap-3 rounded-lg border border-input p-4"
                          data-tour="product-wizard-variants-toggle"
                        >
                          <Checkbox
                            id="producto-con-variantes"
                            checked={conVariantes}
                            disabled={!puedeVariantes || crearFamilia.isPending}
                            onCheckedChange={v => {
                              // El precio va por variante: sale del form (conserva lo tecleado) y no depende de que RHF salte un campo
                              // desmontado. Al desmarcar, el campo se vuelve a registrar con `required`.
                              if (v === true) step1Form.unregister('price', { keepValue: true, keepDefaultValue: true })
                              setConVariantes(v === true)
                            }}
                            className="relative mt-0.5 before:absolute before:-inset-3 before:content-['']"
                          />
                          <div className="space-y-1">
                            <Label htmlFor="producto-con-variantes" className="flex items-center gap-2 text-base">
                              {tv('alta.casilla')}
                              {accesoVariantes.isResolved && !accesoVariantes.hasAccess && <VenueTierBadge tier="PRO" />}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {accesoVariantes.isResolved && !accesoVariantes.hasAccess
                                ? tv('alta.casillaBloqueada')
                                : tv('alta.casillaAyuda')}
                            </p>
                          </div>
                        </div>
                      )}

                   {/* Variantes (Tarea 5). Vive dentro del <form>: Enter en un campo de la sección no guarda el asistente (los botones sí actúan). */}
                  {conVariantesActiva && (
                    <section
                      data-tour="product-wizard-variants"
                      className="min-w-0"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault()
                      }}
                    >
                      <SectionHeader icon={Layers} title={tv('alta.seccion')} className="mb-2" />
                      <p className="text-sm text-muted-foreground mb-6">{tv('alta.seccionAyuda')}</p>
                      <VariantsSection
                        venueId={venueId!}
                        nombrePadre={step1Form.watch('name') ?? ''}
                        value={variantes}
                        onChange={setVariantes}
                        disabled={crearFamilia.isPending}
                      />
                    </section>
                  )}

</>,
    inventory: <>                  {/* Inventory Selection Section - hidden for non-inventoriable types (and with variants: stock goes per variant) */}
                  {!NO_INVENTORY_TYPES.includes(effectiveProductType as ProductType) && !conVariantesActiva && (
                    <section className="min-w-0">
                      <SectionHeader icon={Package} title={t('wizard.step2.title', { defaultValue: 'Inventario' })} className="mb-4" />

                      {/* Recommendations - compact version */}
                      {recommendations && (
                        <div
                          className={cn(
                            'text-xs p-2 rounded-lg mb-4',
                            recommendations.hasInventoryFeature
                              ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                              : 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300',
                          )}
                        >
                          <strong>{t('wizard.step2.recommendation')}:</strong> {t(recommendations.recommendation)}
                        </div>
                      )}

                      <div className="space-y-3">
                        {/* Inventory Method Selection (conditional) */}
                        {step2Form.watch('useInventory') && (
                          <div className="space-y-2 pt-3 border-t border-border/50">
                            <p className="text-xs text-muted-foreground">{t('wizard.step2.inventoryMethodQuestion')}</p>

                            <RadioGroup
                              value={step2Form.watch('inventoryMethod') || ''}
                              onValueChange={value => {
                                // RECIPE is a Premium (INVENTORY_TRACKING) capability — block selection
                                // for Free venues without access (the option is also disabled below).
                                if (value === 'RECIPE' && !hasInventoryTracking) return
                                step2Form.setValue('inventoryMethod', value as InventoryMethod, { shouldDirty: true })
                                setSelectedInventoryMethod(value as InventoryMethod)
                              }}
                              className="grid grid-cols-1 md:grid-cols-2 gap-3"
                            >
                              <Label
                                htmlFor="quantity-tracking-left"
                                data-tour="product-wizard-method-quantity"
                                className={cn(
                                  'flex items-center gap-3 p-4 rounded-lg border transition-colors cursor-pointer',
                                  step2Form.watch('inventoryMethod') === 'QUANTITY'
                                    ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                                    : 'border-border hover:bg-accent/50',
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
                                data-tour="product-wizard-method-recipe"
                                aria-disabled={!hasInventoryTracking}
                                title={!hasInventoryTracking ? t('wizard.step2.recipePremiumLocked') : undefined}
                                className={cn(
                                  'flex items-center gap-3 p-4 rounded-lg border transition-colors',
                                  !hasInventoryTracking ? 'cursor-not-allowed opacity-60 border-input' : 'cursor-pointer',
                                  hasInventoryTracking && step2Form.watch('inventoryMethod') === 'RECIPE'
                                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                                    : hasInventoryTracking
                                      ? 'border-border hover:bg-accent/50'
                                      : '',
                                )}
                              >
                                <RadioGroupItem value="RECIPE" id="recipe-based-left" disabled={!hasInventoryTracking} />
                                <Beef className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-medium">{t('wizard.step2.recipeBased')}</p>
                                    {!hasInventoryTracking && (
                                      <Badge
                                        variant="outline"
                                        className="h-4 shrink-0 gap-0.5 border-amber-400/40 px-1.5 text-[10px] text-amber-500"
                                      >
                                        <Crown className="h-2.5 w-2.5" />
                                        {t('wizard.step2.premiumBadge')}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{t('wizard.step2.recipeBasedDesc')}</p>
                                </div>
                              </Label>
                            </RadioGroup>

                            {/* Inventory Configuration (inline after method selection) */}
                            {step2Form.watch('inventoryMethod') === 'QUANTITY' && (
                              <div className="space-y-4 pt-4 border-t border-border/50">
                                <Alert className="bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800">
                                  <Package className="h-4 w-4 text-green-600 dark:text-green-400" />
                                  <AlertDescription className="text-green-800 dark:text-green-200">
                                    {t('wizard.step3.simpleStockInfo')}
                                  </AlertDescription>
                                </Alert>

                                <div className="space-y-2" data-tour="product-wizard-initial-stock">
                                  <Label htmlFor="initialStock">{t('wizard.step3.initialStock')} *</Label>
                                  <Input
                                    id="initialStock"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0"
                                    className="h-12 scroll-mt-24 text-base"
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

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="costPerUnit">{t('wizard.step3.costPerUnit')} *</Label>
                                    <Input
                                      id="costPerUnit"
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      placeholder="0.00"
                                      className="h-12 scroll-mt-24 text-base"
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
                                      className="h-12 scroll-mt-24 text-base"
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
                                            <p className="text-sm text-muted-foreground">
                                              {t('lowStockThreshold.defaultNote', { value: 10 })}
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
                                    className="h-12 scroll-mt-24 text-base"
                                    {...step3SimpleForm.register('lowStockThreshold', { valueAsNumber: true, min: 0 })}
                                  />
                                  <p className="text-xs text-muted-foreground">{t('lowStockThreshold.separateFromReorder')}</p>
                                </div>
                              </div>
                            )}

                            {/* Grandfathered-edit fallback: the product is already RECIPE-based but this
                              venue lost INVENTORY_TRACKING (e.g. downgraded to Free). Don't hard-crash
                              and don't expose the editable recipe form — show a subtle Premium upsell hint. */}
                            {step2Form.watch('inventoryMethod') === 'RECIPE' && !hasInventoryTracking && (
                              <div className="space-y-3 pt-4 border-t border-border/50">
                                <div className="flex items-start gap-3 rounded-lg border border-amber-400/40 bg-amber-400/10 p-4">
                                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-400/15">
                                    <Crown className="h-4 w-4 text-amber-500" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground">{t('wizard.step2.recipePremiumTitle')}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{t('wizard.step2.recipePremiumBody')}</p>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="mt-3 h-11 cursor-pointer gap-1.5 border-amber-400/40 text-amber-600 hover:bg-amber-400/10 dark:text-amber-400"
                                      onClick={() => navigate(`${fullBasePath}/settings/billing/subscriptions`)}
                                    >
                                      <Crown className="h-3.5 w-3.5" />
                                      {t('wizard.step2.recipePremiumUpgrade')}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {step2Form.watch('inventoryMethod') === 'RECIPE' && hasInventoryTracking && (
                              <div className="space-y-4 pt-4 border-t border-border/50" data-tour="product-wizard-recipe-section">
                                {/* Portion Yield */}
                                <div className="space-y-2" data-tour="product-wizard-portion-yield">
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
                                    className="h-12 scroll-mt-24 text-base"
                                    {...step3RecipeForm.register('portionYield', { required: true, valueAsNumber: true, min: 1 })}
                                  />
                                  <p className="text-xs text-muted-foreground">{t('recipes.portionYieldHelp.description')}</p>
                                </div>

                                {/* Advanced Options - Collapsible */}
                                <Collapsible open={advancedRecipeOpen} onOpenChange={setAdvancedRecipeOpen}>
                                  <CollapsibleTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-between text-muted-foreground"
                                    >
                                      <span>{t('common:advancedOptions', { defaultValue: 'Opciones avanzadas' })}</span>
                                      <ChevronDown className={cn('h-4 w-4 transition-transform', advancedRecipeOpen && 'rotate-180')} />
                                    </Button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="space-y-4 pt-2">
                                    {/* Prep Time & Cook Time */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="prepTime">{t('recipes.fields.prepTime')}</Label>
                                        <Input
                                          id="prepTime"
                                          type="number"
                                          step="1"
                                          min="0"
                                          placeholder="0"
                                          className="h-12 scroll-mt-24 text-base"
                                          {...step3RecipeForm.register('prepTime', { valueAsNumber: true })}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                          {t('recipes.prepTimeHelp', { defaultValue: 'Tiempo de preparación en minutos' })}
                                        </p>
                                      </div>

                                      <div className="space-y-2">
                                        <Label htmlFor="cookTime">{t('recipes.fields.cookTime')}</Label>
                                        <Input
                                          id="cookTime"
                                          type="number"
                                          step="1"
                                          min="0"
                                          placeholder="0"
                                          className="h-12 scroll-mt-24 text-base"
                                          {...step3RecipeForm.register('cookTime', { valueAsNumber: true })}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                          {t('recipes.cookTimeHelp', { defaultValue: 'Tiempo de cocción en minutos' })}
                                        </p>
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
                                      <p className="text-xs text-muted-foreground">
                                        {t('recipes.notesHelp', { defaultValue: 'Instrucciones o notas adicionales para la preparación' })}
                                      </p>
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
                                                <p className="text-sm text-muted-foreground">
                                                  {t('lowStockThreshold.defaultNotePortions', { value: 5 })}
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
                                        className="h-12 scroll-mt-24 text-base"
                                        {...step3RecipeForm.register('lowStockThreshold', { valueAsNumber: true, min: 0 })}
                                      />
                                      <p className="text-xs text-muted-foreground">{t('lowStockThreshold.alertWhenBelow')}</p>
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>

                                {/* Ingredients List */}
                                <div className="space-y-3" data-tour="product-wizard-ingredients">
                                  <div className="flex items-center justify-between">
                                    <Label>{t('recipes.ingredients.title')} *</Label>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      data-tour="product-wizard-add-ingredient"
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
                                                    <span className="ml-2 text-xs text-muted-foreground">
                                                      ({t('recipes.ingredients.optional')})
                                                    </span>
                                                  )}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                  {Number(ingredient.quantity).toFixed(2)} {getShortLabel(ingredient.unit)}
                                                  {rawMaterial && (
                                                    <>
                                                      {' '}
                                                      × {Currency(costPerUnit)} ={' '}
                                                      <span className="text-green-600 dark:text-green-400 font-medium">
                                                        {Currency(lineCost)}
                                                      </span>
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
                                                    { shouldDirty: true },
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
                                        <span className="text-sm font-semibold">
                                          {t('recipes.totalCost', { defaultValue: 'Costo total de receta' })}
                                        </span>
                                        <span className="text-base font-bold text-green-600 dark:text-green-400">
                                          {Currency(
                                            step3RecipeForm.watch('ingredients').reduce((sum, ing) => {
                                              const rm = rawMaterialsData?.find(r => r.id === ing.rawMaterialId)
                                              const cost = rm ? Number(rm.costPerUnit) * Number(ing.quantity) : 0
                                              return sum + cost
                                            }, 0),
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    {t('recipes.ingredientsHelp', {
                                      defaultValue:
                                        'Los ingredientes se descontarán automáticamente del inventario al vender este producto',
                                    })}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </section>
                  )}
</>,
    codes: <>                          {/* SKU + GTIN — both optional. SKU auto-generated if empty. */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-tour="product-wizard-codes">
                            <div data-tour="product-wizard-sku">
                              <FieldLabel htmlFor="sku" label="SKU" tooltip={t('wizard.step1.skuTooltip')} />
                              <Input
                                id="sku"
                                {...step1Form.register('sku')}
                                placeholder={t('wizard.step1.skuPlaceholder')}
                                className="h-12 scroll-mt-24 text-base"
                                autoComplete="off"
                              />
                            </div>
                            <div data-tour="product-wizard-gtin">
                              <FieldLabel
                                htmlFor="gtin"
                                label={`GTIN / ${t('wizard.step1.barcode')}`}
                                tooltip={t('wizard.step1.gtinTooltip')}
                              />
                              <Input
                                id="gtin"
                                {...step1Form.register('gtin')}
                                placeholder={t('wizard.step1.optional')}
                                className="h-12 scroll-mt-24 text-base"
                                autoComplete="off"
                                inputMode="numeric"
                              />
                            </div>
                          </div>
</>,
    weight: <>                          {/* Venta por peso (charcutería/granel) */}
                          <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FieldLabel htmlFor="soldByWeight" label={t('wizard.step1.soldByWeight')} />
                              <p className="text-xs text-muted-foreground">{t('wizard.step1.soldByWeightDesc')}</p>
                            </div>
                            <Switch
                              id="soldByWeight"
                              className="relative before:absolute before:-inset-3 before:content-['']"
                              checked={!!step1Form.watch('soldByWeight')}
                              onCheckedChange={checked => step1Form.setValue('soldByWeight', checked, { shouldDirty: true })}
                            />
                          </div>

</>,
    description: <>                      {/* Description */}
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
                          disabled={esVariante}
                        />
                      </div>
</>,
    preparation: <>                  {/* Print station override — self-hides (incl. its own card) when the venue has no active stations */}
                  <PrintStationField
                    venueId={venueId}
                    namespace="inventory"
                    value={step1Form.watch('printStationId')}
                    onChange={val => step1Form.setValue('printStationId', val, { shouldDirty: true })}
                    disabled={esVariante}
                  />

</>,
    fiscal: <>                  {/* Datos fiscales (CFDI) — only for venues with the CFDI feature */}
                  {hasCfdi && (
                    <section data-tour="product-sat-keys" className="min-w-0">
                      <SectionHeader icon={Receipt} title={tCfdi('satKeys.sectionTitle')} className="mb-4" />
                      <p className="text-xs text-muted-foreground mb-4">{tCfdi('satKeys.sectionDescription')}</p>

                      <div className="space-y-4">
                        {/* SAT product key (ClaveProdServ) */}
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">{tCfdi('satKeys.productKey')}</Label>
                          <SatKeyPicker
                            type="product"
                            venueId={venueId}
                            value={step1Form.watch('satProductKey') ?? null}
                            onChange={key => step1Form.setValue('satProductKey', key, { shouldDirty: true })}
                            disabled={esVariante}
                          />
                          <p className="text-xs text-muted-foreground">{tCfdi('satKeys.productKeyHint')}</p>
                        </div>

                        {/* SAT unit key (ClaveUnidad) */}
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">{tCfdi('satKeys.unitKey')}</Label>
                          <SatKeyPicker
                            type="unit"
                            venueId={venueId}
                            value={step1Form.watch('satUnitKey') ?? null}
                            onChange={key => step1Form.setValue('satUnitKey', key, { shouldDirty: true })}
                            disabled={esVariante}
                          />
                        </div>
                      </div>
                    </section>
                  )}

</>,
    modifiers: <>                  {/* Modifier Groups Section — hidden for service/class/digital/donation types */}
                  {!NO_MODIFIER_GROUP_TYPES.includes(effectiveProductType as ProductType) && (
                    <section className="min-w-0">
                      <SectionHeader icon={Plus} title={t('wizard.step1.modifierGroups')} className="mb-4" />
                      <p className="text-xs text-muted-foreground mb-3">
                        {t('wizard.step1.modifierGroupsHelp', { defaultValue: 'Agrega opciones y extras que los clientes pueden elegir.' })}
                      </p>

                      {/* Searchable multiselect via SearchCombobox */}
                      {(() => {
                        const selectedModifierGroups = step1Form.watch('modifierGroups') || []
                        const selectedIds = new Set(selectedModifierGroups.map(g => g.value))
                        const availableOptions: SearchComboboxItem[] = (modifierGroups ?? [])
                          .filter(mg => !selectedIds.has(mg.id))
                          .filter(mg => !modifierGroupSearch.trim() || includesNormalized(mg.name ?? '', modifierGroupSearch))
                          .map(mg => ({ id: mg.id, label: mg.name }))
                        const hasModifierGroups = (modifierGroups ?? []).length > 0

                        return hasModifierGroups ? (
                          <SearchCombobox
                            items={availableOptions}
                            value={modifierGroupSearch}
                            onChange={setModifierGroupSearch}
                            onSelect={item => {
                              const current = step1Form.watch('modifierGroups') || []
                              step1Form.setValue('modifierGroups', [...current, { label: item.label, value: item.id }], {
                                shouldDirty: true,
                              })
                              setModifierGroupSearch('')
                            }}
                            placeholder={t('wizard.step1.selectModifierGroups')}
                            isLoading={isModifierGroupsLoading}
                            disabled={esVariante}
                          />
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            {t('wizard.step1.noModifierGroupsAvailable', { defaultValue: 'No hay grupos de modificadores disponibles' })}
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
                              ? fullGroupData.required
                                ? t('wizard.step1.modifierRequired', {
                                    min: fullGroupData.minSelections,
                                    max: fullGroupData.maxSelections || '∞',
                                    defaultValue: `Requerido: ${fullGroupData.minSelections}-${fullGroupData.maxSelections || '∞'}`,
                                  })
                                : t('wizard.step1.modifierOptional', { defaultValue: 'Opcional' })
                              : ''

                            return (
                              <div
                                key={selectedGroup.value}
                                className="flex items-start justify-between p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm">{selectedGroup.label}</p>
                                  {modifiersList && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{modifiersList}</p>}
                                  {minMax && <p className="text-xs text-muted-foreground mt-0.5">{minMax}</p>}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-11 w-11 cursor-pointer text-muted-foreground hover:text-destructive shrink-0"
                                  disabled={esVariante}
                                  onClick={() => {
                                    const currentValues = step1Form.watch('modifierGroups') || []
                                    step1Form.setValue(
                                      'modifierGroups',
                                      currentValues.filter(g => g.value !== selectedGroup.value),
                                      { shouldDirty: true },
                                    )
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
                  )}

</>,
  }

  return (
    <>
      <FullScreenModal
        open={open}
        onClose={pedirCerrar}
        title={
          // Show product name if available, otherwise show wizard title
          // For edit mode, also check existingProductData in case form hasn't loaded yet
          step1Form.watch('name') ||
          existingProductData?.name ||
          (mode === 'create' ? t('wizard.title') : t('products.detail.configureInventory'))
        }
        actions={renderActions()}
        contentClassName="bg-muted/30"
        titleClassName="max-sm:sr-only pointer-events-none left-20 right-[13.5rem] translate-x-0 min-w-0 text-left sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:max-w-[calc(100%-28rem)] sm:text-center [&>*]:truncate"
      >
        <div className="mx-auto max-w-5xl min-w-0 p-3 sm:p-6 space-y-4 sm:space-y-6">
          {isInitialLoadingEdit ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" aria-busy="true" aria-live="polite">
              <div className="lg:col-span-8 space-y-6">
                <section className="bg-card rounded-2xl border border-border/50 p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </div>
                </section>
                <section className="bg-card rounded-2xl border border-border/50 p-6 space-y-5">
                  <Skeleton className="h-5 w-48" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                </section>
                <section className="bg-card rounded-2xl border border-border/50 p-6 space-y-4">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-32 w-full" />
                </section>
                <section className="bg-card rounded-2xl border border-border/50 p-6 space-y-4">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-20 w-full" />
                </section>
              </div>
              <div className="lg:col-span-4 space-y-6">
                <section className="bg-card rounded-2xl border border-border/50 p-6 space-y-3">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-12 w-full" />
                </section>
                <section className="bg-card rounded-2xl border border-border/50 p-6 space-y-3">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-12 w-full" />
                </section>
              </div>
            </div>
          ) : (
            /* Single step wizard - product configuration form */
            <form id="step1-form" onSubmit={step1Form.handleSubmit(handleStep1Intercept, errors => {
              if (errors.categoryId && !errors.name && !errors.price) {
                scrollToCategoryError()
                return
              }
              const optionalErrors: Array<[keyof Step1FormData, OptionalSectionId]> = [['sku', 'codes'], ['gtin', 'codes'], ['description', 'description'], ['satProductKey', 'fiscal'], ['satUnitKey', 'fiscal']]
              const target = optionalErrors.find(([field]) => errors[field])
              if (target) revealSection(target[1])
              requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.scrollIntoView?.({ block: 'nearest' }))
            })}>
              {esVariante && (
                <div className="mb-6">
                  <VariantNotice
                    product={existingProduct}
                    onOpenFamily={() => {
                      onOpenChange(false)
                      navigate(`${fullBasePath}/menumaker/products?familia=${existingProduct.productGroupId}`)
                    }}
                  />
                </div>
              )}
              <div className="min-w-0 space-y-4 sm:space-y-6 [&_button:not([role=switch]):not([role=checkbox]):not([role=radio])]:min-h-11">
                {coreType}
                <section data-tour="product-wizard-core" className="rounded-2xl border border-input bg-card p-4 sm:p-6">
                  <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="min-w-0">{coreName}</div>
                    <div className="min-w-0 space-y-4">{corePrice}</div>
                    <div className="min-w-0">{coreCategory}</div>
                    <div className="min-w-0">{corePhoto}</div>
                  </div>
                </section>
                {typeFields}
                <div data-tour="product-wizard-primary-options" className="min-w-0 space-y-3">{primaryOptions.map(renderOptional)}</div>
                {moreOptions.length > 0 && <div className="min-w-0 space-y-3">
                  <h2 className="text-sm font-medium text-muted-foreground">{t('wizard.optional.more')}</h2>
                  {moreOptions.map(renderOptional)}
                </div>}
              </div>
            </form>
          )}
        </div>
      </FullScreenModal>

      <AlertDialog open={sectionToRemove !== null} onOpenChange={value => { if (!value) setSectionToRemove(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('wizard.optional.removeTitle', { section: sectionToRemove ? t(`wizard.optional.${sectionToRemove}.title`) : '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('wizard.optional.removeDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (sectionToRemove) removeOptional(sectionToRemove) }}>{t('wizard.optional.confirmRemove')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SimpleConfirmDialog
        open={confirmarDescartar}
        onOpenChange={setConfirmarDescartar}
        title={t('wizard.discard.title')}
        message={t('wizard.discard.description')}
        confirmLabel={t('wizard.discard.confirm')}
        cancelLabel={t('wizard.discard.keepEditing')}
        variant="destructive"
        onConfirm={() => {
          setConfirmarDescartar(false)
          onOpenChange(false)
        }}
      />

      {/* Primer encendido del IVA por producto (decisión del founder, 12-oct): sin «Continuar» no se guarda */}
      <ConfirmarEncendidoIva
        open={porConfirmarIva !== null}
        onContinuar={() => {
          if (porConfirmarIva) handleStep1Submit(porConfirmarIva)
          setPorConfirmarIva(null)
        }}
        onCancelar={() => setPorConfirmarIva(null)}
      />

      {/* Conversion Dialog */}
      {conversionDirection && (
        <SimpleConfirmDialog
          open={conversionDialogOpen}
          onOpenChange={setConversionDialogOpen}
          title={t(`conversion.${conversionDirection}.title`)}
          message={t(`conversion.${conversionDirection}.message`)}
          confirmLabel={t(`conversion.${conversionDirection}.confirm`)}
          cancelLabel={t(`conversion.${conversionDirection}.cancel`)}
          onConfirm={() => {
            if (pendingInventoryConfig) {
              switchInventoryMethodMutation.mutate({
                ...pendingInventoryConfig,
                direction: conversionDirection,
              })
            }
          }}
          isLoading={switchInventoryMethodMutation.isPending}
        />
      )}

      {/* Add Ingredient Dialog - works in both create and edit modes */}
      <AddIngredientDialog
        open={addIngredientOpen}
        onOpenChange={setAddIngredientOpen}
        product={{
          id: createdProductId || productId || 'temp-product',
          name: step1Form.watch('name') || step1Data?.name || t('wizard.newProduct', { defaultValue: 'Nuevo Producto' }),
        }}
        mode="create"
        onAddTempIngredient={ingredient => {
          const current = step3RecipeForm.getValues('ingredients')
          step3RecipeForm.setValue('ingredients', [...current, { ...ingredient, isOptional: ingredient.isOptional ?? false }], {
            shouldDirty: true,
          })
          toast({
            title: t('recipes.messages.ingredientAdded'),
            variant: 'default',
          })
        }}
      />
    </>
  )
}
