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
        title: `Producto ${product.name} creado`,
        description: 'El producto se ha creado correctamente.',
      })
      navigate(from)
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar',
        description: error.message || 'Hubo un problema al guardar los cambios.',
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
    return <LoadingScreen message="Cargando..." />
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
            {createProductMutation.isPending ? 'Guardando...' : 'Guardar'}
          </LoadingButton>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 space-y-6 pb-20 ">
          <h1 className="text-xl font-semibold">Nuevo producto</h1>

          {/* SKU */}
          <FormField
            control={form.control}
            name="sku"
            rules={{
              required: { value: true, message: 'El SKU es requerido.' },
              pattern: {
                value: /^[A-Z0-9_-]+$/,
                message: 'El SKU solo puede contener letras mayúsculas, números, guiones y guiones bajos.',
              },
            }}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="SKU (p.ej., TACO-001)"
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
              required: { value: true, message: 'El nombre es requerido.' },
              minLength: { value: 3, message: 'El nombre debe tener al menos 3 caracteres.' },
              maxLength: { value: 30, message: 'El nombre no debe tener más de 30 caracteres.' },
            }}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Introduce un nombre" className="max-w-96" {...field} />
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
                <FormLabel>Descripción (opcional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Introduce una descripción" className="max-w-96" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="price"
            rules={{
              required: 'El precio es requerido.',
              validate: {
                esNumero: value => !isNaN(parseFloat(value)) || 'El precio debe ser un número válido.',
                esPositivo: value => parseFloat(value) > 0 || 'El precio debe ser mayor que cero.',
                tieneDosDecimales: value => /^\d+(\.\d{1,2})?$/.test(value) || 'El precio puede tener hasta dos decimales.',
              },
            }}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>Precio</FormLabel>
                  <FormControl>
                    <Input placeholder="Introduce un precio" className="max-w-96" {...field} />
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
              required: 'El tipo es requerido.',
            }}
            render={({ field }) => {
              return (
                <FormItem className="max-w-96">
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo de producto" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Selecciona un tipo</SelectLabel>
                        <SelectItem value="FOOD">Comida</SelectItem>
                        <SelectItem value="BEVERAGE">Bebida</SelectItem>
                        <SelectItem value="ALCOHOL">Alcohol</SelectItem>
                        <SelectItem value="RETAIL">Retail</SelectItem>
                        <SelectItem value="SERVICE">Servicio</SelectItem>
                        <SelectItem value="OTHER">Otro</SelectItem>
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
                <FormLabel>Foto</FormLabel>
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
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              handleCropConfirm()
                              form.setValue('imageUrl', imageUrl, { shouldDirty: true })
                            }}
                            disabled={uploading}
                          >
                            Confirmar
                          </Button>
                        </div>
                      </div>
                    ) : imageUrl ? (
                      // 2) Si ya hay una imagen (de la BD o subida) y NO estamos recortando:
                      <div className="relative flex space-x-4">
                        {/* Sección Izquierda: Imagen */}
                        <div className="w-1/3">
                          <img src={imageUrl} alt="Product" className="object-cover w-full h-auto rounded-md" />
                        </div>

                        {/* Sección Derecha: Texto y Botones */}
                        <div className="flex-1 space-y-2">
                          <p className="text-base">Los clientes pueden ver esta foto en la app de Avoqado.</p>
                          <p className="text-sm text-green-600">
                            <a href="https://www.ubereats.com" target="_blank" rel="noreferrer">
                              Consulta las directrices completas sobre fotografía
                            </a>
                            .
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Requisitos del archivo: JPG, PNG, GIF o WEBP hasta 10 MB. Número mínimo de píxeles obligatorio: 320 de ancho y
                            alto.
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
                              Sustituir
                            </Button>
                            <Button variant="destructive" type="button" disabled={uploading} onClick={handleDeleteImage}>
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // 3) Si no hay nada de imagen y no estamos recortando, mostramos input normal
                      <div className="relative flex space-x-4">
                        {/* Sección Izquierda: recuadro para subir imagen */}
                        <div className="relative flex flex-col items-center justify-center w-64 h-64 border-2 border-border border-dashed rounded-md ">
                          <p className="text-sm text-center text-muted-foreground">Suelta la imagen aquí para cargarla</p>
                          <p className="text-muted-foreground">o</p>

                          {/* Input "invisible" sobre la zona de drag & drop para que sea clickeable */}
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={e => handleFileUpload(e.target.files?.[0])}
                            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer "
                            disabled={uploading}
                          />

                          {/* Texto que se ve (debajo del input invisible) */}
                          <p className="font-[400] text-sm text-green-600">Examinar Archivo</p>
                        </div>

                        {/* Sección Derecha: descripción y botones */}
                        <div className="flex-1 space-y-2 ">
                          <p className="text-base">Las fotos ayudan a los clientes a decidir qué pedir y pueden aumentar las ventas.</p>
                          <p className="text-sm text-green-600">
                            <a href="https://www.ubereats.com" target="_blank" rel="noreferrer">
                              Consulta las directrices completas sobre fotografía.
                            </a>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Requisitos del archivo: JPG, PNG, GIF o WEBP hasta 10 MB. Mínimo de 320 px de ancho y alto.
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
                              Añadir Foto
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
              required: { value: true, message: 'Selecciona una categoría.' },
            }}
            render={({ field }) => (
              <FormItem className="max-w-96">
                <FormLabel>Categoría</FormLabel>
                <FormControl>
                  <Select onValueChange={value => { field.onChange(value); form.clearErrors('categoryId') }} defaultValue={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona la categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Selecciona una categoría</SelectLabel>
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
                <FormLabel>Grupos Modificadores</FormLabel>
                <FormControl>
                  <MultipleSelector
                    {...field}
                    options={(modifierGroups ?? []).map(modifierGroup => ({
                      label: modifierGroup.name,
                      value: modifierGroup.id,
                      disabled: false,
                    }))}
                    hidePlaceholderWhenSelected
                    placeholder="Selecciona los grupos"
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
