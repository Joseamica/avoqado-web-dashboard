import {
  getProduct,
  updateProduct,
  getMenuCategories,
  getModifierGroups,
  deleteProduct as deleteProductService,
} from '@/services/menu.service'
import { recipesApi } from '@/services/inventory.service'
import AlertDialogWrapper from '@/components/alert-dialog'
import MultipleSelector from '@/components/multi-selector'
import { LoadingButton } from '@/components/loading-button'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { useImageUploader } from '@/hooks/use-image-uploader'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useBreadcrumb } from '@/context/BreadcrumbContext'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ImageIcon, Package, Store, Beef } from 'lucide-react'
import Cropper from 'react-easy-crop' // <-- Import del Cropper
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import api from '@/api'
import { ProductWizardDialog } from '@/pages/Inventory/components/ProductWizardDialog'
import { cn } from '@/lib/utils'
import {
  getSkuValidationRules,
  getNameValidationRules,
  getPriceValidationRules,
  getCategoryValidationRules,
  getTypeValidationRules,
  transformSkuToUppercase,
} from '@/lib/validators/product'

// Esquema de validación
// const FormSchema = z.object({
//   name: z
//     .string()
//     .min(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
//     .max(30, { message: 'El nombre no debe tener más de 30 caracteres.' }),
//   description: z
//     .string()
//     .min(10, { message: 'La descripción debe tener al menos 10 caracteres.' })
//     .max(160, { message: 'La descripción no debe tener más de 160 caracteres.' }),
//   imageUrl: z.string().optional(),
//   categories: z.array(z.string()).min(1, { message: 'Selecciona al menos una categoría.' }),
// })

export default function ProductId() {
  const { t } = useTranslation('menu')
  const { productId } = useParams()
  const { venueId, venueSlug } = useCurrentVenue()
  const queryClient = useQueryClient()
  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { setCustomSegment, clearCustomSegment } = useBreadcrumb()

  // State to handle broken images
  const [imageError, setImageError] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)

  // State for inventory tracking
  const [trackInventory, setTrackInventory] = useState<boolean>(false)
  const [inventoryMethod, setInventoryMethod] = useState<'QUANTITY' | 'RECIPE' | null>(null)

  // Traemos la información del producto
  const { data, isLoading } = useQuery({
    queryKey: ['product', venueId, productId],
    queryFn: () => getProduct(venueId!, productId!),
    enabled: !!venueId && !!productId,
  })

  // Traemos las categorías disponibles para el selector
  const { data: categories } = useQuery({
    queryKey: ['menu-categories', venueId],
    queryFn: () => getMenuCategories(venueId!),
    enabled: !!venueId,
  })

  // Traemos los grupos de modificadores disponibles para el selector
  const { data: modifierGroups } = useQuery({
    queryKey: ['modifier-groups', venueId],
    queryFn: () => getModifierGroups(venueId!),
    enabled: !!venueId,
  })

  // Fetch recipe data if product has RECIPE inventory method
  const { data: recipeData } = useQuery({
    queryKey: ['product-recipe', venueId, productId],
    queryFn: async () => {
      if (!productId) return null
      try {
        const response = await recipesApi.get(venueId!, productId)
        return response.data.data
      } catch {
        return null
      }
    },
    enabled: !!venueId && !!productId && data?.inventoryMethod === 'RECIPE',
  })

  const from = (location.state as any)?.from || '/'

  const saveProduct = useMutation({
    mutationFn: async (formValues: any) => {
      // Filter out invalid modifier groups (ones deleted from database)
      const requestedModifierIds = Array.isArray(formValues.modifierGroups) ? formValues.modifierGroups.map((o: any) => o?.value ?? o) : []

      const validModifierIds = requestedModifierIds.filter((id: string) => modifierGroups?.some(mg => mg.id === id))

      const payload: any = {
        name: formValues.name,
        description: formValues.description || undefined,
        price: Number(formValues.price),
        type: formValues.type,
        imageUrl: imageUrl || formValues.imageUrl || data?.imageUrl || undefined,
        sku: formValues.sku,
        gtin: formValues.gtin || undefined,
        categoryId: formValues.categoryId,
        modifierGroupIds: validModifierIds, // Only send valid modifier groups
        // Inventory tracking configuration
        trackInventory: trackInventory,
        inventoryMethod: trackInventory ? inventoryMethod : null,
      }

      // Add unit if tracking inventory
      if (trackInventory && formValues.unit) {
        payload.unit = formValues.unit
      }

      return await updateProduct(venueId!, productId!, payload)
    },
    onSuccess: () => {
      toast({
        title: t('products.detail.toasts.saved'),
        description: t('products.detail.toasts.savedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['product', venueId, productId] }) // Refetch product data
    },
    onError: (error: any) => {
      toast({
        title: t('products.detail.toasts.saveError'),
        description: error.message || t('products.detail.toasts.saveErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  const deleteImage = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/v1/dashboard/venues/${venueId}/products/${productId}/image`)
    },
    onSuccess: () => {
      toast({
        title: t('products.detail.toasts.imageDeleted'),
        description: t('products.detail.toasts.imageDeletedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['product', venueId, productId] })
    },
  })
  const deleteProduct = useMutation({
    mutationFn: async () => {
      await deleteProductService(venueId!, productId!)
    },
    onSuccess: () => {
      toast({
        title: t('products.detail.toasts.deleted'),
        description: t('products.detail.toasts.deletedDesc'),
      })
      navigate(from)
    },
  })

  // Configuración del formulario
  const form = useForm({
    defaultValues: {
      sku: '',
      gtin: '',
      name: '',
      description: '',
      price: '',
      type: 'FOOD',
      imageUrl: '',
      categoryId: '',
      modifierGroups: [],
      // Inventory fields
      trackInventory: false,
      inventoryMethod: null as 'QUANTITY' | 'RECIPE' | null,
      unit: '',
      currentStock: '',
      costPerUnit: '',
      reorderPoint: '10',
    },
  })

  const {
    uploading,
    imageUrl, // Aquí se guarda la URL de la imagen nueva si se sube correctamente
    imageForCrop, // Aquí se guarda la imagen que se seleccionó pero no se recortó
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
    `venues/${venueSlug}/productos`,
    form.watch('name') || '',
    { minWidth: 320, minHeight: 320 }, // Aquí pasas tu configuración
  )

  // Reset image error when product data changes
  useEffect(() => {
    setImageError(false)
  }, [data?.imageUrl])

  // Clean up breadcrumb on unmount
  useEffect(() => {
    return () => {
      if (productId) {
        clearCustomSegment(productId)
      }
    }
  }, [productId, clearCustomSegment])

  // Mark form as dirty when inventory tracking changes
  useEffect(() => {
    if (data) {
      const hasChanged = trackInventory !== (data.trackInventory || false) || inventoryMethod !== (data.inventoryMethod || null)
      if (hasChanged) {
        form.setValue('trackInventory', trackInventory, { shouldDirty: true })
        form.setValue('inventoryMethod', inventoryMethod, { shouldDirty: true })
      }
    }
  }, [trackInventory, inventoryMethod, data, form])

  // Sincronizar datos del producto con el formulario cuando carguen
  useEffect(() => {
    // Only proceed if we have both product data AND categories loaded
    if (!data || !categories) return

    // Set custom breadcrumb with product name
    if (productId && data.name) {
      setCustomSegment(productId, data.name)
    }

    const mappedModifierGroups = Array.isArray(data.modifierGroups)
      ? data.modifierGroups
          .map((mg: any) => {
            // FIXED: Use groupId first (the actual ModifierGroup ID), not the join table ID
            const mapped = {
              label: mg?.group?.name || mg?.name || '',
              value: mg?.groupId || mg?.group?.id,
              disabled: false,
            }
            return mapped
          })
          .filter((opt: any) => {
            // Filter out invalid IDs only
            if (!opt.value) return false

            // If modifier groups query hasn't loaded yet, keep all items temporarily
            if (!modifierGroups) return true

            // Check if this modifier group still exists in the database
            const exists = modifierGroups.some(availableMg => availableMg.id === opt.value)
            return exists
          })
      : []

    const categoryId = data.categoryId ?? data.category?.id ?? ''

    // Sync inventory state
    const hasInventory = data.trackInventory || false
    const method = data.inventoryMethod || null
    setTrackInventory(hasInventory)
    setInventoryMethod(method)

    form.reset({
      sku: data.sku || '',
      gtin: data.gtin || '',
      name: data.name || '',
      description: data.description || '',
      price: (data.price ?? '').toString(),
      type: data.type || 'FOOD',
      imageUrl: data.imageUrl || '',
      categoryId: categoryId,
      modifierGroups: mappedModifierGroups,
      // Inventory fields
      trackInventory: hasInventory,
      inventoryMethod: method,
      unit: data.unit || '',
      currentStock: data.inventory?.currentStock?.toString() || '',
      costPerUnit: data.cost?.toString() || '',
      reorderPoint: data.inventory?.minimumStock?.toString() || '10',
    })
  }, [data, categories, modifierGroups, form, productId, setCustomSegment])

  // Esta función podría ser para borrar la imagen en el servidor.
  // Por simplicidad, aquí solo se hace el "remove" localmente.
  const handleDeleteImage = async () => {
    try {
      // Descomenta si requieres borrar la imagen del servidor:
      // await api.delete(`v1/dashboard/${venueId}/products/${productId}/image`)
      deleteImage.mutate() // Lanzamos la mutación
      // Luego removemos cualquier referencia local:
      handleFileRemove()
      form.setValue('imageUrl', '') // Seteamos en el form a vacío
    } catch (error) {
      console.error('Error al borrar la imagen:', error)
    }
  }

  // Manejador del submit
  // function onSubmit(formValues: z.infer<typeof FormSchema>) {
  function onSubmit(formValues: any) {
    saveProduct.mutate(formValues)
  }

  // Imagen a mostrar: si hay una nueva (subida) úsala, si no usa la de la BD
  if (!venueId || !productId || isLoading) {
    return <div>{t('forms.messages.loading')}</div>
  }

  if (!data) {
    return <div>{t('products.detail.notFound')}</div>
  }

  const displayedImageUrl = imageUrl || data.imageUrl

  // Get current tab from URL or default to "details"
  const currentTab = location.hash.replace('#', '') || 'details'

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex flex-row justify-between w-full px-4 py-3 bg-background/95 border-b shadow-md backdrop-blur-sm">
        <div className="space-x-3 flex items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate(from)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">{form.watch('name') || data.name}</h1>
        </div>
        <div className="space-x-2 flex items-center">
          <AlertDialogWrapper
            triggerTitle={t('products.detail.delete')}
            title={t('products.detail.deleteTitle')}
            message={t('products.detail.deleteMessage')}
            rightButtonLabel={t('products.detail.deleteConfirm')}
            rightButtonVariant="default"
            onRightButtonClick={() => deleteProduct.mutate()}
          />
          <Button variant="outline" size="sm">{t('products.detail.duplicate')}</Button>
          <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)} className="border-primary text-primary hover:bg-primary/10">
            <Package className="mr-2 h-4 w-4" />
            {t('products.detail.configureInventory')}
          </Button>
          <LoadingButton
            loading={saveProduct.isPending}
            onClick={form.handleSubmit(onSubmit)}
            variant="default"
            size="sm"
            disabled={!form.formState.isDirty || saveProduct.isPending}
          >
            {saveProduct.isPending ? t('products.detail.saving') : t('modifiers.forms.save')}
          </LoadingButton>
        </div>
      </div>

      {/* Horizontal Navigation - VenueEditLayout Pattern */}
      <nav className="sticky top-14 bg-card h-14 z-10 shadow-sm flex items-center space-x-6 lg:space-x-8 border-b border-border px-6">
        <a
          href="#details"
          className={cn(
            'text-sm font-medium transition-colors py-4 border-b-2',
            currentTab === 'details'
              ? 'text-foreground border-primary'
              : 'text-muted-foreground border-transparent hover:text-primary'
          )}
        >
          {t('products.tabs.details')}
        </a>
        <a
          href="#inventory"
          className={cn(
            'text-sm font-medium transition-colors py-4 border-b-2',
            currentTab === 'inventory'
              ? 'text-foreground border-primary'
              : 'text-muted-foreground border-transparent hover:text-primary'
          )}
        >
          {t('products.tabs.inventory')}
        </a>
        <a
          href="#modifiers"
          className={cn(
            'text-sm font-medium transition-colors py-4 border-b-2',
            currentTab === 'modifiers'
              ? 'text-foreground border-primary'
              : 'text-muted-foreground border-transparent hover:text-primary'
          )}
        >
          {t('products.tabs.modifiers')}
        </a>
      </nav>

      {/* Content */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="container mx-auto pt-6 pb-20 px-4 grow overflow-auto">
          <div className="max-w-4xl">
            {/* Details Section */}
            {currentTab === 'details' && (
              <div className="space-y-6">
          <FormField
            control={form.control}
            name="sku"
            rules={getSkuValidationRules(t)}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>{t('products.create.sku')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('products.detail.skuPlaceholder')}
                      className="max-w-96 uppercase"
                      {...field}
                      onChange={e => field.onChange(transformSkuToUppercase(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />

          {/* GTIN */}
          <FormField
            control={form.control}
            name="gtin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('products.create.gtin')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('products.create.gtinPlaceholder')}
                    className="max-w-96"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Nombre */}
          <FormField
            control={form.control}
            name="name"
            rules={getNameValidationRules(t)}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('forms.name')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('products.create.namePlaceholder')} className="max-w-96" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Campo Descripción */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('products.create.descriptionOptional')}</FormLabel>
                <FormControl>
                  <Textarea placeholder={t('products.create.descriptionPlaceholder')} className="max-w-96" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            rules={getPriceValidationRules(t)}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>{t('forms.price')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('products.create.pricePlaceholder')} className="max-w-96" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          <FormField
            control={form.control}
            name="type"
            rules={getTypeValidationRules(t)}
            render={({ field }) => {
              return (
                <FormItem className="max-w-96">
                  <FormLabel>{t('products.create.type')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('products.create.typePlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>{t('products.create.selectType')}</SelectLabel>
                        <SelectItem value="FOOD">{t('products.create.types.food')}</SelectItem>
                        <SelectItem value="BEVERAGE">{t('products.create.types.beverage')}</SelectItem>
                        <SelectItem value="ALCOHOL">{t('products.create.types.alcohol')}</SelectItem>
                        <SelectItem value="RETAIL">{t('products.create.types.retail')}</SelectItem>
                        <SelectItem value="SERVICE">{t('products.create.types.service')}</SelectItem>
                        <SelectItem value="OTHER">{t('products.create.types.other')}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <FormMessage />
                </FormItem>
              )
            }}
          />
          {/* Campo para subir imagen */}
          <FormField
            control={form.control}
            name="imageUrl"
            render={() => (
              <FormItem>
                <FormLabel>{t('products.create.photo')}</FormLabel>
                <FormControl>
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
                            {t('forms.buttons.cancel')}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              handleCropConfirm()
                              form.setValue('imageUrl', imageUrl, { shouldDirty: true })
                            }}
                            disabled={uploading}
                          >
                            {t('products.create.confirm')}
                          </Button>
                        </div>
                      </div>
                    ) : displayedImageUrl && !imageError ? (
                      // 2) Si ya hay una imagen (de la BD o subida) y NO estamos recortando:
                      <div className="relative flex space-x-4">
                        {/* Sección Izquierda: Imagen */}
                        <div className="w-1/3">
                          <img
                            src={displayedImageUrl}
                            alt={t('products.imageAlt')}
                            className="object-cover w-full h-auto rounded-md"
                            onError={() => setImageError(true)}
                          />
                        </div>

                        {/* Sección Derecha: Texto y Botones */}
                        <div className="flex-1 space-y-2">
                          <p className="text-base">{t('products.create.photoVisible')}</p>
                          <p className="text-sm text-green-600">
                            <a href="https://www.ubereats.com" target="_blank" rel="noreferrer">
                              {t('products.create.photoGuidelines')}
                            </a>
                            .
                          </p>
                          <p className="text-sm text-muted-foreground">{t('products.create.photoRequirements')}</p>

                          <div className="absolute bottom-0 flex mt-2 space-x-2">
                            <Button
                              variant="outline"
                              type="button"
                              disabled={uploading}
                              onClick={() => {
                                // Simulamos un click en un input "file" invisible
                                // o podrías usar un <Input type="file" hidden /> con ref
                                const fileInput = document.createElement('input')
                                fileInput.type = 'file'
                                fileInput.accept = 'image/*'
                                fileInput.onchange = (e: any) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    handleFileUpload(file)
                                    setImageError(false) // Reset error state when uploading new image
                                  }
                                }
                                fileInput.click()
                              }}
                            >
                              {t('products.create.replace')}
                            </Button>
                            <Button variant="destructive" type="button" disabled={uploading} onClick={handleDeleteImage}>
                              {t('products.create.delete')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : displayedImageUrl && imageError ? (
                      // 2b) Si hay una imagen pero falló al cargar, mostrar placeholder elegante
                      <div className="relative flex space-x-4">
                        {/* Sección Izquierda: Placeholder para imagen rota */}
                        <div className="w-64 h-64 flex flex-col items-center justify-center bg-muted border-2 border-border rounded-md">
                          <ImageIcon className="w-12 h-12 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground text-center">{t('products.detail.imageUnavailable')}</p>
                          <p className="text-xs text-muted-foreground text-center mt-1">{t('products.detail.imageCouldNotLoad')}</p>
                        </div>

                        {/* Sección Derecha: Texto y Botones */}
                        <div className="flex-1 space-y-2">
                          <p className="text-base">{t('products.create.photoVisible')}</p>
                          <p className="text-sm text-green-600">
                            <a href="https://www.ubereats.com" target="_blank" rel="noreferrer">
                              {t('products.create.photoGuidelines')}
                            </a>
                            .
                          </p>
                          <p className="text-sm text-muted-foreground">{t('products.create.photoRequirements')}</p>

                          <div className="absolute bottom-0 flex mt-2 space-x-2">
                            <Button
                              variant="outline"
                              type="button"
                              disabled={uploading}
                              onClick={() => {
                                // Simulamos un click en un input "file" invisible
                                // o podrías usar un <Input type="file" hidden /> con ref
                                const fileInput = document.createElement('input')
                                fileInput.type = 'file'
                                fileInput.accept = 'image/*'
                                fileInput.onchange = (e: any) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    handleFileUpload(file)
                                    setImageError(false) // Reset error state when uploading new image
                                  }
                                }
                                fileInput.click()
                              }}
                            >
                              {t('products.create.replace')}
                            </Button>
                            <Button variant="destructive" type="button" disabled={uploading} onClick={handleDeleteImage}>
                              {t('products.create.delete')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // 3) Si no hay nada de imagen y no estamos recortando, mostramos input normal
                      <div className="relative flex space-x-4">
                        {/* Sección Izquierda: recuadro para subir imagen */}
                        <div className="relative flex flex-col items-center justify-center w-64 h-64 border-2 border-border border-dashed rounded-md ">
                          <p className="text-sm text-center text-muted-foreground">{t('products.create.dropImage')}</p>
                          <p className="text-muted-foreground">{t('products.create.or')}</p>

                          {/* Input "invisible" sobre la zona de drag & drop para que sea clickeable */}
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={e => {
                              const file = e.target.files?.[0]
                              if (file) {
                                handleFileUpload(file)
                                setImageError(false) // Reset error state when uploading new image
                              }
                            }}
                            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer "
                            disabled={uploading}
                          />

                          {/* Texto que se ve (debajo del input invisible) */}
                          <p className="font-normal text-sm text-green-600">{t('products.create.browseFile')}</p>
                        </div>

                        {/* Sección Derecha: descripción y botones */}
                        <div className="flex-1 space-y-2 ">
                          <p className="text-base">{t('products.create.photoHelp')}</p>
                          <p className="text-sm text-green-600">
                            <a href="https://www.ubereats.com" target="_blank" rel="noreferrer">
                              {t('products.create.photoGuidelines')}
                            </a>
                          </p>
                          <p className="text-sm text-muted-foreground">{t('products.create.photoRequirements')}</p>

                          <div className="absolute bottom-0 flex mt-2 space-x-2">
                            <Button
                              type="button"
                              disabled={uploading}
                              onClick={() => {
                                // Puedes forzar a que se abra el input file manualmente
                                const fileInput = document.createElement('input')
                                fileInput.type = 'file'
                                fileInput.accept = 'image/*'
                                fileInput.onchange = (e: any) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    handleFileUpload(file)
                                    setImageError(false) // Reset error state when uploading new image
                                  }
                                }
                                fileInput.click()
                              }}
                            >
                              {t('products.create.addPhoto')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="categoryId"
            rules={getCategoryValidationRules(t)}
            render={({ field }) => (
              <FormItem className="max-w-96">
                <FormLabel>{t('products.create.category')}</FormLabel>
                <FormControl>
                  <Select
                    onValueChange={value => {
                      field.onChange(value)
                      form.clearErrors('categoryId')
                    }}
                    value={field.value || ''}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('products.create.categoryPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>{t('products.create.selectCategory')}</SelectLabel>
                        {(categories || []).map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
              </div>
            )}

            {/* Inventory Section */}
            {currentTab === 'inventory' && (
              <div className="space-y-6">
              {/* ✅ TOAST POS PATTERN: Progressive disclosure - radio group with conditional fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('products.detail.inventory.trackingMethod')}</Label>
                  <RadioGroup
                    value={trackInventory ? (inventoryMethod || 'QUANTITY') : 'none'}
                    onValueChange={(value) => {
                      if (value === 'none') {
                        setTrackInventory(false)
                        setInventoryMethod(null)
                      } else {
                        setTrackInventory(true)
                        setInventoryMethod(value as 'QUANTITY' | 'RECIPE')
                      }
                    }}
                  >
                    {/* No Tracking Option */}
                    <div className="flex items-center space-x-2 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                      <RadioGroupItem value="none" id="no-tracking" />
                      <Label htmlFor="no-tracking" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                            <Store className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{t('products.detail.inventory.noTracking')}</p>
                            <p className="text-xs text-muted-foreground">{t('products.detail.inventory.noTrackingDesc')}</p>
                          </div>
                        </div>
                      </Label>
                    </div>

                    {/* Quantity Tracking Option */}
                    <div className="flex items-center space-x-2 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                      <RadioGroupItem value="QUANTITY" id="track-quantity" />
                      <Label htmlFor="track-quantity" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 dark:bg-green-950/50">
                            <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{t('products.detail.inventory.trackByQuantity')}</p>
                            <p className="text-xs text-muted-foreground">{t('products.detail.inventory.trackByQuantityDesc')}</p>
                          </div>
                        </div>
                      </Label>
                    </div>

                    {/* Recipe Tracking Option */}
                    <div className="flex items-center space-x-2 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                      <RadioGroupItem value="RECIPE" id="track-recipe" />
                      <Label htmlFor="track-recipe" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-950/50">
                            <Beef className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{t('products.detail.inventory.trackByRecipe')}</p>
                            <p className="text-xs text-muted-foreground">{t('products.detail.inventory.trackByRecipeDesc')}</p>
                          </div>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* ✅ PROGRESSIVE DISCLOSURE: Show quantity fields only when tracking by quantity */}
                {trackInventory && inventoryMethod === 'QUANTITY' && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary">
                    <FormField
                      control={form.control}
                      name="unit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('products.detail.inventory.unit')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('products.detail.inventory.unitPlaceholder')} className="max-w-96" {...field} />
                          </FormControl>
                          <FormDescription>{t('products.detail.inventory.unitHelp')}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="currentStock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('products.detail.inventory.currentStock')}</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder={t('products.detail.inventory.currentStockPlaceholder')} className="max-w-96" {...field} />
                          </FormControl>
                          <FormDescription>{t('products.detail.inventory.currentStockHelp')}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4 max-w-96">
                      <FormField
                        control={form.control}
                        name="costPerUnit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('products.detail.inventory.costPerUnit')}</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" placeholder={t('products.detail.inventory.costPerUnitPlaceholder')} {...field} />
                            </FormControl>
                            <FormDescription className="text-xs">{t('products.detail.inventory.costPerUnitHelp')}</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="reorderPoint"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('products.detail.inventory.reorderPoint')}</FormLabel>
                            <FormControl>
                              <Input type="number" step="1" placeholder={t('products.detail.inventory.reorderPointPlaceholder')} {...field} />
                            </FormControl>
                            <FormDescription className="text-xs">{t('products.detail.inventory.reorderPointHelp')}</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* ✅ PROGRESSIVE DISCLOSURE: Show recipe ingredients when tracking by recipe */}
                {trackInventory && inventoryMethod === 'RECIPE' && (
                  <div className="pl-4 border-l-2 border-primary space-y-4">
                    {recipeData && recipeData.lines && recipeData.lines.length > 0 ? (
                      <>
                        <div className="space-y-2">
                          <Label>{t('products.detail.inventory.ingredients')}</Label>
                          <div className="rounded-lg border border-border overflow-hidden">
                            <table className="w-full">
                              <thead className="bg-muted">
                                <tr>
                                  <th className="text-left p-3 font-medium text-sm">{t('products.detail.inventory.ingredientName')}</th>
                                  <th className="text-right p-3 font-medium text-sm">{t('products.detail.inventory.quantity')}</th>
                                  <th className="text-right p-3 font-medium text-sm">{t('products.detail.inventory.unit')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {recipeData.lines.map((line: any, index: number) => (
                                  <tr key={index} className="hover:bg-muted/50">
                                    <td className="p-3 text-sm">{line.rawMaterial?.name || 'Unknown'}</td>
                                    <td className="p-3 text-sm text-right">{Number(line.quantity).toFixed(2)}</td>
                                    <td className="p-3 text-sm text-right">{line.unit}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-primary text-primary hover:bg-primary/10"
                          onClick={() => setWizardOpen(true)}
                        >
                          <Package className="mr-2 h-4 w-4" />
                          {t('products.detail.inventory.editRecipe')}
                        </Button>
                      </>
                    ) : (
                      <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800">
                        <p className="text-sm text-orange-800 dark:text-orange-200">
                          {t('products.detail.inventory.noIngredients')}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-3 border-primary text-primary hover:bg-primary/10"
                          onClick={() => setWizardOpen(true)}
                        >
                          <Package className="mr-2 h-4 w-4" />
                          {t('products.detail.inventory.addIngredient')}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              </div>
            )}

            {/* Modifiers Section */}
            {currentTab === 'modifiers' && (
              <div className="space-y-6">
          <FormField
            control={form.control}
            name="modifierGroups"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('products.create.modifierGroups')}</FormLabel>
                <FormControl>
                  <MultipleSelector
                    {...field}
                    options={modifierGroups?.map(mg => ({ label: mg.name, value: mg.id, disabled: false })) || []}
                    hidePlaceholderWhenSelected
                    placeholder={t('products.create.selectGroups')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
              </div>
            )}
          </div>
        </form>
      </Form>

      {/* Product Wizard Dialog */}
      <ProductWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        mode="edit"
        productId={productId}
        onSuccess={() => {
          toast({
            title: t('products.detail.toasts.saved'),
            description: t('products.detail.inventoryConfigured'),
          })
          queryClient.invalidateQueries({ queryKey: ['product', venueId, productId] })
        }}
      />
    </div>
  )
}
