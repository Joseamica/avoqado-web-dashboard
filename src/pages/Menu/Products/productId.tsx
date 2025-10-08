import {
  getProduct,
  updateProduct,
  getMenuCategories,
  getModifierGroups,
  deleteProduct as deleteProductService,
} from '@/services/menu.service'
import AlertDialogWrapper from '@/components/alert-dialog'
import MultipleSelector from '@/components/multi-selector'
import { LoadingButton } from '@/components/loading-button'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useImageUploader } from '@/hooks/use-image-uploader'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ImageIcon } from 'lucide-react'
import Cropper from 'react-easy-crop' // <-- Import del Cropper
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import api from '@/api'

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
  const { t } = useTranslation()
  const { productId } = useParams()
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()

  // State to handle broken images
  const [imageError, setImageError] = useState(false)

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

  const from = (location.state as any)?.from || '/'

  const saveProduct = useMutation({
    mutationFn: async (formValues: any) => {
      const payload = {
        name: formValues.name,
        description: formValues.description || undefined,
        price: Number(formValues.price),
        type: formValues.type,
        imageUrl: imageUrl || formValues.imageUrl || data?.imageUrl || undefined,
        sku: formValues.sku,
        categoryId: formValues.categoryId,
        modifierGroupIds: Array.isArray(formValues.modifierGroups) ? formValues.modifierGroups.map((o: any) => o?.value ?? o) : [],
      }
      return await updateProduct(venueId!, productId!, payload)
    },
    onSuccess: () => {
      toast({
        title: t('menu.products.detail.toasts.saved'),
        description: t('menu.products.detail.toasts.savedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['product', venueId, productId] }) // Refetch product data
    },
    onError: (error: any) => {
      toast({
        title: t('menu.products.detail.toasts.saveError'),
        description: error.message || t('menu.products.detail.toasts.saveErrorDesc'),
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
        title: t('menu.products.detail.toasts.imageDeleted'),
        description: t('menu.products.detail.toasts.imageDeletedDesc'),
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
        title: t('menu.products.detail.toasts.deleted'),
        description: t('menu.products.detail.toasts.deletedDesc'),
      })
      navigate(from)
    },
  })

  // Configuración del formulario
  const form = useForm({
    defaultValues: {
      sku: '',
      name: '',
      description: '',
      price: '',
      type: 'FOOD',
      imageUrl: '',
      categoryId: '',
      modifierGroups: [],
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
    `venues/${venueId}/productos`,
    form.watch('name') || '',
    { minWidth: 320, minHeight: 320 }, // Aquí pasas tu configuración
  )

  // Reset image error when product data changes
  useEffect(() => {
    setImageError(false)
  }, [data?.imageUrl])

  // Sincronizar datos del producto con el formulario cuando carguen
  useEffect(() => {
    // Only proceed if we have both product data AND categories loaded
    if (!data || !categories) return
    
    const mappedModifierGroups = Array.isArray(data.modifierGroups)
      ? data.modifierGroups
          .map((mg: any) => ({
            label: mg?.name || mg?.group?.name || '',
            value: mg?.id || mg?.groupId || mg?.group?.id,
            disabled: false,
          }))
          .filter((opt: any) => !!opt.value)
      : []

    const categoryId = data.categoryId ?? data.category?.id ?? ''

    form.reset({
      sku: data.sku || '',
      name: data.name || '',
      description: data.description || '',
      price: (data.price ?? '').toString(),
      type: data.type || 'FOOD',
      imageUrl: data.imageUrl || '',
      categoryId: categoryId,
      modifierGroups: mappedModifierGroups,
    })
  }, [data, categories, form])

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
    return <div>{t('menu.forms.messages.loading')}</div>
  }

  if (!data) {
    return <div>{t('menu.products.detail.notFound')}</div>
  }

  const displayedImageUrl = imageUrl || data.imageUrl
  return (
    <div className="">
      {/* Barra superior */}
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-background border-b-2 top-14">
        <div className="space-x-4 flex-row-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>{form.watch('name') || data.name}</span>
        </div>
        <div className="space-x-3 flex-row-center ">
          <AlertDialogWrapper
            triggerTitle={t('menu.products.detail.delete')}
            title={t('menu.products.detail.deleteTitle')}
            // description="Al eliminar el producto, no podrás recuperarlo."
            message={t('menu.products.detail.deleteMessage')}
            rightButtonLabel={t('menu.products.detail.deleteConfirm')}
            rightButtonVariant="default"
            onRightButtonClick={() => deleteProduct.mutate()}
          />
          <Button variant="outline">{t('menu.products.detail.duplicate')}</Button>
          <LoadingButton
            loading={saveProduct.isPending}
            onClick={form.handleSubmit(onSubmit)}
            variant="default"
            disabled={!form.formState.isDirty || saveProduct.isPending}
          >
            {saveProduct.isPending ? t('menu.products.detail.saving') : t('menu.modifiers.forms.save')}
          </LoadingButton>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 space-y-6 pb-20 ">
          <FormField
            control={form.control}
            name="sku"
            rules={{
              required: { value: true, message: t('menu.products.create.skuRequired') },
              pattern: {
                value: /^[A-Za-z0-9_-]+$/,
                message: t('menu.products.detail.skuPattern'),
              },
            }}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>{t('menu.products.create.sku')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('menu.products.detail.skuPlaceholder')}
                      className="max-w-96"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />

          {/* Nombre */}
          <FormField
            control={form.control}
            name="name"
            rules={{
              required: { value: true, message: t('menu.forms.validation.nameRequired') },
              minLength: { value: 3, message: t('menu.forms.validation.nameMinLength') },
              maxLength: { value: 30, message: t('menu.forms.validation.nameMaxLength') },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('menu.forms.name')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('menu.products.create.namePlaceholder')} className="max-w-96" {...field} />
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
                <FormLabel>{t('menu.products.create.descriptionOptional')}</FormLabel>
                <FormControl>
                  <Textarea placeholder={t('menu.products.create.descriptionPlaceholder')} className="max-w-96" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            rules={{
              required: t('menu.products.create.priceRequired'),
              validate: {
                esNumero: value => !isNaN(parseFloat(value)) || t('menu.products.create.priceValid'),
                esPositivo: value => parseFloat(value) > 0 || t('menu.products.create.pricePositive'),
                tieneDosDecimales: value => /^\d+(\.\d{1,2})?$/.test(value) || t('menu.products.create.priceDecimals'),
                // Opcional: valor máximo
                // max: value =>
                //   parseFloat(value) <= 10000 || 'El precio no debe exceder $10,000.'
              },
            }}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>{t('menu.forms.price')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('menu.products.create.pricePlaceholder')} className="max-w-96" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          <FormField
            control={form.control}
            name="type"
            rules={{
              required: t('menu.products.create.typeRequired'),
            }}
            render={({ field }) => {
              return (
                <FormItem className="max-w-96">
                  <FormLabel>{t('menu.products.create.type')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('menu.products.create.typePlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>{t('menu.products.create.selectType')}</SelectLabel>
                        <SelectItem value="FOOD">{t('menu.products.create.types.food')}</SelectItem>
                        <SelectItem value="BEVERAGE">{t('menu.products.create.types.beverage')}</SelectItem>
                        <SelectItem value="ALCOHOL">{t('menu.products.create.types.alcohol')}</SelectItem>
                        <SelectItem value="RETAIL">{t('menu.products.create.types.retail')}</SelectItem>
                        <SelectItem value="SERVICE">{t('menu.products.create.types.service')}</SelectItem>
                        <SelectItem value="OTHER">{t('menu.products.create.types.other')}</SelectItem>
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
                <FormLabel>{t('menu.products.create.photo')}</FormLabel>
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
                            {t('menu.forms.buttons.cancel')}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              handleCropConfirm()
                              form.setValue('imageUrl', imageUrl, { shouldDirty: true })
                            }}
                            disabled={uploading}
                          >
                            {t('menu.products.create.confirm')}
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
                            alt={t('menu.products.imageAlt')}
                            className="object-cover w-full h-auto rounded-md"
                            onError={() => setImageError(true)}
                          />
                        </div>

                        {/* Sección Derecha: Texto y Botones */}
                        <div className="flex-1 space-y-2">
                          <p className="text-base">{t('menu.products.create.photoVisible')}</p>
                          <p className="text-sm text-green-600">
                            <a href="https://www.ubereats.com" target="_blank" rel="noreferrer">
                              {t('menu.products.create.photoGuidelines')}
                            </a>
                            .
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t('menu.products.create.photoRequirements')}
                          </p>

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
                              {t('menu.products.create.replace')}
                            </Button>
                            <Button variant="destructive" type="button" disabled={uploading} onClick={handleDeleteImage}>
                              {t('menu.products.create.delete')}
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
                          <p className="text-sm text-muted-foreground text-center">{t('menu.products.detail.imageUnavailable')}</p>
                          <p className="text-xs text-muted-foreground text-center mt-1">{t('menu.products.detail.imageCouldNotLoad')}</p>
                        </div>

                        {/* Sección Derecha: Texto y Botones */}
                        <div className="flex-1 space-y-2">
                          <p className="text-base">{t('menu.products.create.photoVisible')}</p>
                          <p className="text-sm text-green-600">
                            <a href="https://www.ubereats.com" target="_blank" rel="noreferrer">
                              {t('menu.products.create.photoGuidelines')}
                            </a>
                            .
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t('menu.products.create.photoRequirements')}
                          </p>

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
                              {t('menu.products.create.replace')}
                            </Button>
                            <Button variant="destructive" type="button" disabled={uploading} onClick={handleDeleteImage}>
                              {t('menu.products.create.delete')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // 3) Si no hay nada de imagen y no estamos recortando, mostramos input normal
                      <div className="relative flex space-x-4">
                        {/* Sección Izquierda: recuadro para subir imagen */}
                        <div className="relative flex flex-col items-center justify-center w-64 h-64 border-2 border-border border-dashed rounded-md ">
                          <p className="text-sm text-center text-muted-foreground">{t('menu.products.create.dropImage')}</p>
                          <p className="text-muted-foreground">{t('menu.products.create.or')}</p>

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
                          <p className="font-[400] text-sm text-green-600">{t('menu.products.create.browseFile')}</p>
                        </div>

                        {/* Sección Derecha: descripción y botones */}
                        <div className="flex-1 space-y-2 ">
                          <p className="text-base">{t('menu.products.create.photoHelp')}</p>
                          <p className="text-sm text-green-600">
                            <a href="https://www.ubereats.com" target="_blank" rel="noreferrer">
                              {t('menu.products.create.photoGuidelines')}
                            </a>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t('menu.products.create.photoRequirements')}
                          </p>

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
                              {t('menu.products.create.addPhoto')}
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
            rules={{
              required: { value: true, message: t('menu.products.create.categoryRequired') },
            }}
            render={({ field }) => (
              <FormItem className="max-w-96">
                <FormLabel>{t('menu.products.create.category')}</FormLabel>
                <FormControl>
                  <Select
                    onValueChange={value => {
                      field.onChange(value)
                      form.clearErrors('categoryId')
                    }}
                    value={field.value || ''}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('menu.products.create.categoryPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>{t('menu.products.create.selectCategory')}</SelectLabel>
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
          <FormField
            control={form.control}
            name="modifierGroups"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('menu.products.create.modifierGroups')}</FormLabel>
                <FormControl>
                  <MultipleSelector
                    {...field}
                    options={modifierGroups?.map(mg => ({ label: mg.name, value: mg.id, disabled: false })) || []}
                    hidePlaceholderWhenSelected
                    placeholder={t('menu.products.create.selectGroups')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  )
}
