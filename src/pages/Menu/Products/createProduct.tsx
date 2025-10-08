import { LoadingButton } from '@/components/loading-button'
import MultipleSelector from '@/components/multi-selector'
import { LoadingScreen } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useImageUploader } from '@/hooks/use-image-uploader'
import { useToast } from '@/hooks/use-toast'
import { createProduct as createProductService, getMenuCategories, getModifierGroups } from '@/services/menu.service'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import Cropper from 'react-easy-crop' // <-- Import del Cropper
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Product, ProductType } from '@/types'

type CreateProductPayload = {
  sku: string
  name: string
  description?: string | null
  categoryId: string
  type: ProductType
  price: number
  imageUrl?: string | null
  modifierGroupIds?: string[]
}

export default function CreateProduct() {
  const { t } = useTranslation()
  const { venueId } = useCurrentVenue()
  // const [selectedCategories, setSelectedCategories] = useState<Option[]>([])

  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()

  const {
    data: categories,
    isLoading: isCategoriesLoading,
  } = useQuery({
    queryKey: ['menu-categories', venueId],
    queryFn: () => getMenuCategories(venueId!),
    enabled: !!venueId,
  })

  const {
    data: modifierGroups,
    isLoading: isModifierGroupsLoading,
  } = useQuery({
    queryKey: ['modifier-groups', venueId],
    queryFn: () => getModifierGroups(venueId!),
    enabled: !!venueId,
  })

  const from = (location.state as any)?.from || '/'

  const createProductMutation = useMutation<Product, unknown, CreateProductPayload>({
    mutationFn: async (payload: CreateProductPayload) => {
      return await createProductService(venueId!, payload)
    },
    onSuccess: (product: Product) => {
      toast({
        title: t('menu.products.create.toasts.created', { name: product.name }),
        description: t('menu.products.create.toasts.createdDesc'),
      })
      navigate(from)
    },
    onError: (error: any) => {
      toast({
        title: t('menu.products.create.toasts.createError'),
        description: error.message || t('menu.products.create.toasts.createErrorDesc'),
        variant: 'destructive',
      })
    },
  })

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
    // values: {
    //   name: data?.avoqadoProduct.name || '',
    //   description: data?.avoqadoProduct.description || '',
    //   imageUrl: data?.avoqadoProduct.imageUrl || '',
    //   categories: [],
    // },
  })

  useEffect(() => {
    if (categories && categories.length > 0 && location.search) {
      const params = new URLSearchParams(location.search)
      const categoryIdFromQuery = params.get('categoryId')
      if (categoryIdFromQuery && categories.some(cat => cat.id === categoryIdFromQuery)) {
        form.setValue('categoryId', categoryIdFromQuery)
      }
    }
  }, [categories, location.search, form])

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
  const handleDeleteImage = async () => {
    try {
      // Descomenta si requieres borrar la imagen del servidor:
      // await api.delete(`v1/dashboard/${venueId}/products/${productId}/image`)

      // Luego removemos cualquier referencia local:
      handleFileRemove()
      form.setValue('imageUrl', '') // Seteamos en el form a vacío
    } catch (error) {
      console.error('Error al borrar la imagen:', error)
    }
  }

  // Manejador del submit
  // function onSubmit(formValues: z.infer<typeof FormSchema>) {
  function onSubmit(formValues) {
    const modifierGroupIds = Array.isArray(formValues.modifierGroups)
      ? formValues.modifierGroups.map((m: any) => m.value)
      : []

    const priceNumber = typeof formValues.price === 'string' ? parseFloat(formValues.price) : formValues.price

    createProductMutation.mutate({
      sku: formValues.sku,
      name: formValues.name,
      description: formValues.description,
      categoryId: formValues.categoryId,
      type: formValues.type,
      price: priceNumber,
      imageUrl: imageUrl || formValues.imageUrl || undefined,
      modifierGroupIds,
    })
  }

  if (isCategoriesLoading || isModifierGroupsLoading) {
    return <LoadingScreen message={t('menu.forms.messages.loading')} />
  }
  return (
    <div className="">
      {/* Barra superior */}
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-background border-b-2 top-14">
        <div className="space-x-4 flex-row-center">
          <button type="button" onClick={() => history.back()} className="cursor-pointer bg-transparent">
            <ArrowLeft />
          </button>
          <span>{form.watch('name', '')}</span>
        </div>
        <div className="space-x-3 flex-row-center">
          <LoadingButton
            loading={createProductMutation.isPending}
            onClick={form.handleSubmit(onSubmit)}
            variant="default"
            disabled={!form.formState.isDirty || createProductMutation.isPending}
          >
            {createProductMutation.isPending ? t('menu.products.create.saving') : t('menu.modifiers.forms.save')}
          </LoadingButton>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 space-y-6 pb-20 ">
          <h1 className="text-xl font-semibold">{t('menu.products.create.title')}</h1>

          {/* SKU */}
          <FormField
            control={form.control}
            name="sku"
            rules={{
              required: { value: true, message: t('menu.products.create.skuRequired') },
              pattern: {
                value: /^[A-Z0-9_-]+$/,
                message: t('menu.products.create.skuPattern'),
              },
            }}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>{t('menu.products.create.sku')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('menu.products.create.skuPlaceholder')}
                      className="max-w-96 uppercase"
                      {...field}
                      onChange={e => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />

          <FormField
            control={form.control}
            name="name"
            rules={{
              required: { value: true, message: t('menu.forms.validation.nameRequired') },
              minLength: { value: 3, message: t('menu.forms.validation.nameMinLength') },
              maxLength: { value: 30, message: t('menu.forms.validation.nameMaxLength') },
            }}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>{t('menu.forms.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('menu.products.create.namePlaceholder')} className="max-w-96" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    ) : imageUrl ? (
                      // 2) Si ya hay una imagen (de la BD o subida) y NO estamos recortando:
                      <div className="relative flex space-x-4">
                        {/* Sección Izquierda: Imagen */}
                        <div className="w-1/3">
                          <img src={imageUrl} alt={t('menu.products.imageAlt')} className="object-cover w-full h-auto rounded-md" />
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
                            onChange={e => handleFileUpload(e.target.files?.[0])}
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
                  <Select onValueChange={value => { field.onChange(value); form.clearErrors('categoryId') }} defaultValue={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('menu.products.create.categoryPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>{t('menu.products.create.selectCategory')}</SelectLabel>
                        {(categories ?? []).map(category => (
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
                    options={(modifierGroups ?? []).map(modifierGroup => ({
                      label: modifierGroup.name,
                      value: modifierGroup.id,
                      disabled: false,
                    }))}
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
