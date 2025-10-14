import { useState, useEffect } from 'react'
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
import { productWizardApi, rawMaterialsApi, type InventoryType } from '@/services/inventory.service'
import { getMenuCategories } from '@/services/menu.service'
import { Loader2, ChevronRight, ChevronLeft, AlertCircle, Check, Package, Beef, Store } from 'lucide-react'
import { Currency } from '@/utils/currency'
import Cropper from 'react-easy-crop'

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
}

interface Step2FormData {
  useInventory: boolean
  inventoryType?: InventoryType
}

interface Step3SimpleStockFormData {
  initialStock: number
  costPerUnit: number
  reorderPoint: number
}

interface Step3RecipeFormData {
  portionYield: number
  prepTime?: number
  cookTime?: number
  notes?: string
  ingredients: Array<{
    rawMaterialId: string
    quantity: number
    unit: string
    isOptional: boolean
    substituteNotes?: string
  }>
}

export function ProductWizardDialog({ open, onOpenChange, onSuccess, mode, productId }: ProductWizardDialogProps) {
  const { t } = useTranslation('inventory')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Start at step 2 when in edit mode (product already exists)
  const [currentStep, setCurrentStep] = useState<WizardStep>(mode === 'edit' ? 2 : 1)
  const [createdProductId, setCreatedProductId] = useState<string | undefined>(productId)
  const [selectedInventoryType, setSelectedInventoryType] = useState<InventoryType | null>(null)

  // Store wizard data in state (only submit on final step)
  const [step1Data, setStep1Data] = useState<Step1FormData | null>(null)
  const [step2Data, setStep2Data] = useState<Step2FormData | null>(null)

  // Step 1 Form
  const step1Form = useForm<Step1FormData>({
    defaultValues: {
      name: '',
      description: '',
      price: undefined,
      categoryId: '',
      imageUrl: '',
    },
  })

  // Step 2 Form
  const step2Form = useForm<Step2FormData>({
    defaultValues: {
      useInventory: false,
      inventoryType: undefined,
    },
  })

  // Step 3 Simple Stock Form
  const step3SimpleForm = useForm<Step3SimpleStockFormData>({
    defaultValues: {
      initialStock: 0,
      costPerUnit: 0,
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
  } = useImageUploader(
    `venues/${venueId}/productos`,
    step1Form.watch('name') || '',
    { minWidth: 320, minHeight: 320 }
  )

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
      const response = await rawMaterialsApi.list(venueId)
      return response.data.data
    },
    enabled: !!venueId && open && currentStep === 3 && selectedInventoryType === 'RECIPE_BASED',
  })

  // Fetch menu categories for category dropdown
  const { data: categories } = useQuery({
    queryKey: ['menu-categories', venueId],
    queryFn: () => getMenuCategories(venueId),
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
    onSuccess: (response) => {
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

  // Handle wizard completion
  const handleWizardComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['products', venueId] })
    queryClient.invalidateQueries({ queryKey: ['products-with-recipes', venueId] })

    if (onSuccess && createdProductId) {
      onSuccess(createdProductId)
    }

    // Reset and close
    resetWizard()
    onOpenChange(false)
  }

  // Reset wizard state
  const resetWizard = () => {
    setCurrentStep(mode === 'edit' ? 2 : 1)
    setCreatedProductId(productId)
    setSelectedInventoryType(null)
    setStep1Data(null)
    setStep2Data(null)
    step1Form.reset()
    step2Form.reset()
    step3SimpleForm.reset()
    step3RecipeForm.reset()
  }

  // Handle dialog close
  useEffect(() => {
    if (!open) {
      resetWizard()
    }
  }, [open])

  // Step 1 Submit Handler - Store data and move to Step 2
  const handleStep1Submit = (data: Step1FormData) => {
    // Use imageUrl from uploader hook if available, otherwise use form value
    const finalImageUrl = imageUrl || data.imageUrl

    // Create product data without imageUrl field initially
    const productData: Step1FormData = {
      name: data.name,
      description: data.description,
      price: data.price,
      categoryId: data.categoryId,
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
    setStep2Data(data)

    // If not using inventory, submit everything now
    if (!data.useInventory) {
      if (!step1Data) {
        toast({
          title: t('common.error'),
          description: 'Missing product data',
          variant: 'destructive',
        })
        return
      }

      // Submit product without inventory
      createProductWithInventoryMutation.mutate({
        product: step1Data,
        inventory: { useInventory: false },
      })
      return
    }

    // If using inventory, set type and move to Step 3
    if (data.inventoryType) {
      setSelectedInventoryType(data.inventoryType)
    }
    setCurrentStep(3)
  }

  // Step 3 Submit Handler - Collect all data and submit
  const handleStep3Submit = () => {
    if (!step1Data || !step2Data) {
      toast({
        title: t('common.error'),
        description: 'Missing wizard data',
        variant: 'destructive',
      })
      return
    }

    if (selectedInventoryType === 'SIMPLE_STOCK') {
      const simpleStockData = step3SimpleForm.getValues()
      createProductWithInventoryMutation.mutate({
        product: step1Data,
        inventory: step2Data,
        simpleStock: simpleStockData,
      })
    } else if (selectedInventoryType === 'RECIPE_BASED') {
      const recipeData = step3RecipeForm.getValues()
      createProductWithInventoryMutation.mutate({
        product: step1Data,
        inventory: step2Data,
        recipe: recipeData,
      })
    }
  }

  // Handle back button
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep)
    }
  }

  // Calculate progress
  const progressPercentage = (currentStep / 3) * 100

  const isLoading = createProductWithInventoryMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('wizard.title') : t('products.detail.configureInventory')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' ? t('wizard.subtitle') : t('products.detail.configureInventoryDesc')}
          </DialogDescription>
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
              <Input
                id="name"
                {...step1Form.register('name', { required: true })}
                placeholder={t('wizard.step1.namePlaceholder')}
              />
              {step1Form.formState.errors.name && (
                <p className="text-xs text-destructive">{t('wizard.step1.nameRequired')}</p>
              )}
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
                {step1Form.formState.errors.price && (
                  <p className="text-xs text-destructive">{t('wizard.step1.priceRequired')}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoryId">{t('wizard.step1.category')} *</Label>
                <Select
                  value={step1Form.watch('categoryId')}
                  onValueChange={(value) => step1Form.setValue('categoryId', value, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('wizard.step1.categoryPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((category) => (
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
                        {t('common.cancel')}
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
                      <p className="text-sm text-muted-foreground">
                        {t('wizard.step1.photoRequirements')}
                      </p>

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
                      <p className="font-[400] text-sm text-green-600">{t('wizard.step1.browseFile')}</p>
                    </div>

                    {/* Sección Derecha: descripción y botones */}
                    <div className="flex-1 space-y-2 ">
                      <p className="text-base">{t('wizard.step1.photoHelp')}</p>
                      <p className="text-sm text-green-600">
                        <a href="https://www.ubereats.com" target="_blank" rel="noreferrer">
                          {t('wizard.step1.photoGuidelines')}
                        </a>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('wizard.step1.photoRequirements')}
                      </p>

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
                {t('common.cancel')}
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
            {/* Recommendations */}
            {recommendations && (
              <Alert className={recommendations.hasInventoryFeature
                ? "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800"
                : "bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800"
              }>
                <AlertCircle className={recommendations.hasInventoryFeature
                  ? "h-4 w-4 text-blue-600 dark:text-blue-400"
                  : "h-4 w-4 text-orange-600 dark:text-orange-400"
                } />
                <AlertDescription className={recommendations.hasInventoryFeature
                  ? "text-blue-800 dark:text-blue-200"
                  : "text-orange-800 dark:text-orange-200"
                }>
                  <strong>{t('wizard.step2.recommendation')}:</strong> {t(recommendations.recommendation)}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <Label>{t('wizard.step2.question')}</Label>

              <RadioGroup
                defaultValue="false"
                onValueChange={(value) => {
                  const useInventory = value === 'true'
                  step2Form.setValue('useInventory', useInventory)
                  if (!useInventory) {
                    step2Form.setValue('inventoryType', undefined)
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

            {/* Inventory Type Selection (conditional) */}
            {step2Form.watch('useInventory') && (
              <div className="space-y-4 pl-4 border-l-2 border-primary">
                <Label>{t('wizard.step2.inventoryTypeQuestion')}</Label>

                <RadioGroup
                  onValueChange={(value) => {
                    step2Form.setValue('inventoryType', value as InventoryType)
                  }}
                >
                  <div className="flex items-center space-x-2 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="SIMPLE_STOCK" id="simple-stock" />
                    <Label htmlFor="simple-stock" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 dark:bg-green-950/50">
                          <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{t('wizard.step2.simpleStock')}</p>
                          <p className="text-xs text-muted-foreground">{t('wizard.step2.simpleStockDesc')}</p>
                        </div>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="RECIPE_BASED" id="recipe-based" />
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
                  {t('common.cancel')}
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

        {/* Step 3: Setup Inventory (Simple Stock or Recipe) */}
        {currentStep === 3 && (
          <>
            {selectedInventoryType === 'SIMPLE_STOCK' && (
              <form onSubmit={step3SimpleForm.handleSubmit(handleStep3Submit)} className="space-y-4">
                <Alert className="bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800">
                  <Package className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    {t('wizard.step3.simpleStockInfo')}
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="initialStock">{t('wizard.step3.initialStock')} *</Label>
                  <Input
                    id="initialStock"
                    type="number"
                    step="0.01"
                    min="0"
                    {...step3SimpleForm.register('initialStock', { required: true, valueAsNumber: true, min: 0 })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">{t('wizard.step3.initialStockHelp')}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="costPerUnit">{t('wizard.step3.costPerUnit')} *</Label>
                    <Input
                      id="costPerUnit"
                      type="number"
                      step="0.01"
                      min="0"
                      {...step3SimpleForm.register('costPerUnit', { required: true, valueAsNumber: true, min: 0 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reorderPoint">{t('wizard.step3.reorderPoint')} *</Label>
                    <Input
                      id="reorderPoint"
                      type="number"
                      step="1"
                      min="0"
                      {...step3SimpleForm.register('reorderPoint', { required: true, valueAsNumber: true, min: 0 })}
                    />
                  </div>
                </div>

                <DialogFooter className="flex justify-between">
                  <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    {t('common.back')}
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                      {t('common.cancel')}
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

            {selectedInventoryType === 'RECIPE_BASED' && (
              <form onSubmit={step3RecipeForm.handleSubmit(handleStep3Submit)} className="space-y-4">
                <Alert className="bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800">
                  <Beef className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <AlertDescription className="text-orange-800 dark:text-orange-200">
                    {t('wizard.step3.recipeInfo')}
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="portionYield">{t('recipes.fields.portionYield')} *</Label>
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
                    <Input
                      id="prepTime"
                      type="number"
                      step="1"
                      {...step3RecipeForm.register('prepTime', { valueAsNumber: true })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cookTime">{t('recipes.fields.cookTime')}</Label>
                    <Input
                      id="cookTime"
                      type="number"
                      step="1"
                      {...step3RecipeForm.register('cookTime', { valueAsNumber: true })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{t('recipes.fields.notes')}</Label>
                  <Textarea
                    id="notes"
                    rows={3}
                    {...step3RecipeForm.register('notes')}
                    placeholder={t('wizard.step3.notesPlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('recipes.ingredients.title')}</Label>
                  <Alert>
                    <AlertDescription>
                      {t('wizard.step3.ingredientsNote')}
                    </AlertDescription>
                  </Alert>
                </div>

                <DialogFooter className="flex justify-between">
                  <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    {t('common.back')}
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                      {t('common.cancel')}
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
  )
}
