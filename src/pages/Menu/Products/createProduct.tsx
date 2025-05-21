import api from '@/api'
import { LoadingButton } from '@/components/loading-button'
import MultipleSelector from '@/components/multi-selector'
import { LoadingScreen } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useImageUploader } from '@/hooks/use-image-uploader'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import Cropper from 'react-easy-crop' // <-- Import del Cropper
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

export default function CreateProduct() {
  const { venueId } = useParams()
  // const [selectedCategories, setSelectedCategories] = useState<Option[]>([])

  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['necessary-product-creation-data', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/necessary-product-creation-data`)
      return response.data
    },
  })

  const from = (location.state as any)?.from || '/'

  const createProduct = useMutation({
    mutationFn: async formValues => {
      const response = await api.post(`/v2/dashboard/${venueId}/product`, formValues)
      return response.data
    },
    onSuccess: (_, data: any) => {
      toast({
        title: `Producto ${data.name} creado`,
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
      name: '',
      description: '',
      price: '',
      type: '',
      imageUrl: '',
      categories: [],
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
    if (data?.categories && data.categories.length > 0 && location.search) {
      const params = new URLSearchParams(location.search)
      const categoryIdFromQuery = params.get('categoryId')
      if (categoryIdFromQuery) {
        const selectedCategoryFromData = data.categories.find(cat => cat.id === categoryIdFromQuery)
        if (selectedCategoryFromData) {
          // Construct the Option object matching the structure for MultipleSelector's value
          const categoryToSetInForm = [
            {
              value: selectedCategoryFromData.id,
              label: selectedCategoryFromData.name,
              disabled: false, // Ensure it matches the option structure completely
            },
          ]
          form.setValue('categories', categoryToSetInForm)
        }
      }
    }
  }, [data, location.search, form])

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
    `${data?.avoqadoProduct?.name}`,
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
    createProduct.mutate({
      ...formValues,
      // categories: selectedCategories.map(category => category.value),
      imageUrl: imageUrl,
    })
  }

  if (isLoading) {
    return <LoadingScreen message="Cargando..." />
  }

  if (!data) {
    return <div>Producto no encontrado</div>
  }
  return (
    <div className="">
      {/* Barra superior */}
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-white border-b-2 top-14">
        <div className="space-x-4 flex-row-center">
          <button type="button" onClick={() => history.back()} className="cursor-pointer bg-transparent">
            <ArrowLeft />
          </button>
          <span>{form.watch('name', '')}</span>
        </div>
        <div className="space-x-3 flex-row-center">
          <LoadingButton loading={createProduct.isPending} onClick={form.handleSubmit(onSubmit)} variant="default">
            {createProduct.isPending ? 'Guardando...' : 'Guardar'}
          </LoadingButton>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 space-y-6 pb-20 ">
          <h1 className="text-xl font-semibold">Nuevo producto</h1>

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
                    <Input placeholder="Introduce un nombre" className="max-w-96" {...field} />
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
                        <SelectItem value="BEVERAGE">Bebida</SelectItem>
                        <SelectItem value="MERCH">Mercancia</SelectItem>
                        <SelectItem value="FOOD">Comida</SelectItem>
                        <SelectItem value="MEMBERSHIP">Membresía</SelectItem>
                        <SelectItem value="SESSION">Sesión</SelectItem>
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
                        <div className="relative w-full h-64 bg-gray-100">
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
                          <p className="text-sm text-gray-500">
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
                        <div className="relative flex flex-col items-center justify-center w-64 h-64 border-2 border-gray-300 border-dashed rounded-md ">
                          <p className="text-sm text-center text-gray-600">Suelta la imagen aquí para cargarla</p>
                          <p className="text-gray-600">o</p>

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
                          <p className="text-sm text-gray-500">
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
            name="categories"
            rules={{
              required: { value: true, message: 'Selecciona al menos una categoría.' },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categorías</FormLabel>
                <FormControl>
                  <MultipleSelector
                    {...field}
                    options={data.categories.map(category => ({
                      label: category.name,
                      value: category.id,
                      disabled: false,
                    }))}
                    hidePlaceholderWhenSelected
                    placeholder="Selecciona las categorías"
                  />
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
                    options={data.modifierGroups.map(modifierGroup => ({
                      label: modifierGroup.name,
                      value: modifierGroup.id,
                      disabled: false,
                    }))}
                    hidePlaceholderWhenSelected
                    placeholder="Selecciona las categorías"
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
