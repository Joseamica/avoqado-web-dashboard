import { getProduct, updateProduct, getMenuCategories, getModifierGroups } from '@/services/menu.service'
import AlertDialogWrapper from '@/components/alert-dialog'
import MultipleSelector from '@/components/multi-selector'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useImageUploader } from '@/hooks/use-image-uploader'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import Cropper from 'react-easy-crop' // <-- Import del Cropper
import { useForm } from 'react-hook-form'
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
  const { venueId, productId } = useParams()
  const queryClient = useQueryClient()
  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()

  // Traemos la información del producto
  const { data, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => getProduct(venueId!, productId!),
  })

  // Traemos las categorías disponibles para el selector
  const { data: categories } = useQuery({
    queryKey: ['categories', venueId],
    queryFn: () => getMenuCategories(venueId!),
  })

  // Traemos los grupos de modificadores disponibles para el selector
  const { data: modifierGroups } = useQuery({
    queryKey: ['modifierGroups', venueId],
    queryFn: () => getModifierGroups(venueId!),
  })

  const from = (location.state as any)?.from || '/'

  const saveProduct = useMutation({
    mutationFn: async formValues => {
      return await updateProduct(venueId!, productId!, formValues)
    },
    onSuccess: () => {
      toast({
        title: 'Producto guardado',
        description: 'Los cambios se han guardado correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['product', productId] }) // Refetch product data
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar',
        description: error.message || 'Hubo un problema al guardar los cambios.',
        variant: 'destructive',
      })
    },
  })

  const deleteImage = useMutation({
    mutationFn: async () => {
      await api.patch(`/v2/dashboard/${venueId}/products/${productId}/image`)
    },
    onSuccess: () => {
      toast({
        title: 'Imagen eliminada',
        description: 'La imagen se ha eliminado correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['product', productId] })
    },
  })
  const deleteProduct = useMutation({
    mutationFn: async () => {
      await api.delete(`/v2/dashboard/${venueId}/products/${productId}`)
    },
    onSuccess: () => {
      toast({
        title: 'Producto eliminado',
        description: 'El producto se ha eliminado correctamente.',
      })
      navigate(from)
    },
  })

  // Configuración del formulario
  // const form = useForm<z.infer<typeof FormSchema>>({
  // resolver: zodResolver(FormSchema),
  const form = useForm({
    // defaultValues: {
    //   name: '',
    //   description: '',
    //   imageUrl: '',
    //   categories: [],
    // },
    // values: {
    //   name: data?.avoqadoProduct.name || '',
    //   description: data?.avoqadoProduct.description || '',
    //   imageUrl: data?.avoqadoProduct.imageUrl || '',
    //   categories: [],
    // },
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
    `${data?.name}`,
    { minWidth: 320, minHeight: 320 }, // Aquí pasas tu configuración
  )

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
  function onSubmit(formValues) {
    saveProduct.mutate({
      ...formValues,
      // categories: selectedCategories.map(category => category.value),
      imageUrl: imageUrl || data.imageUrl,
    })
  }

  // Imagen a mostrar: si hay una nueva (subida) úsala, si no usa la de la BD
  if (isLoading) {
    return <div>Cargando...</div>
  }

  if (!data) {
    return <div>Producto no encontrado</div>
  }

  const displayedImageUrl = imageUrl || data.imageUrl
  return (
    <div className="">
      {/* Barra superior */}
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-white border-b-2 top-14">
        <div className="space-x-4 flex-row-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>{data.name}</span>
        </div>
        <div className="space-x-3 flex-row-center ">
          <AlertDialogWrapper
            triggerTitle="Eliminar"
            title="Eliminar producto"
            // description="Al eliminar el producto, no podrás recuperarlo."
            message=" ¿Estás seguro de que deseas eliminar este producto?"
            rightButtonLabel="Eliminar"
            rightButtonVariant="default"
            onRightButtonClick={() => deleteProduct.mutate()}
          />
          <Button variant="outline">Duplicar</Button>
          <Button disabled={!form.formState.isDirty || saveProduct.isPending} onClick={form.handleSubmit(onSubmit)}>
            {saveProduct.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 space-y-6 ">
          <FormField
            control={form.control}
            name="name"
            rules={{
              required: { value: true, message: 'El nombre es requerido.' },
              minLength: { value: 3, message: 'El nombre debe tener al menos 3 caracteres.' },
              maxLength: { value: 30, message: 'El nombre no debe tener más de 30 caracteres.' },
            }}
            defaultValue={data.name}
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
                  <Textarea
                    placeholder="Introduce una descripción"
                    className="max-w-96"
                    {...field}
                    // value={field.value || data.description || ''}
                    defaultValue={data.description || ''}
                    onChange={e => field.onChange(e.target.value)}
                  />
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
                // Opcional: valor máximo
                // max: value =>
                //   parseFloat(value) <= 10000 || 'El precio no debe exceder $10,000.'
              },
            }}
            defaultValue={data.price}
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
            defaultValue={data.type}
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
            defaultValue={data.imageUrl}
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
                    ) : displayedImageUrl ? (
                      // 2) Si ya hay una imagen (de la BD o subida) y NO estamos recortando:
                      <div className="relative flex space-x-4">
                        {/* Sección Izquierda: Imagen */}
                        <div className="w-1/3">
                          <img src={displayedImageUrl} alt="Product" className="object-cover w-full h-auto rounded-md" />
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
            defaultValue={
              data.category
                ? [
                    {
                      label: data.category.name,
                      value: data.category.id,
                      disabled: false,
                    },
                  ]
                : []
            }
            rules={{
              required: { value: true, message: 'Selecciona al menos una categoría.' },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categorías</FormLabel>
                <FormControl>
                  <MultipleSelector
                    {...field}
                    options={categories?.map(category => ({
                      label: category.name,
                      value: category.id,
                      disabled: false,
                    })) || []}
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
            defaultValue={
              data.modifierGroups
                ? data.modifierGroups.map(modifierGroup => ({
                    label: modifierGroup.group?.name || '',
                    value: modifierGroup.id,
                    disabled: false,
                  }))
                : []
            }
            render={({ field }) => (
              <FormItem>
                <FormLabel>Grupos Modificadores</FormLabel>
                <FormControl>
                  <MultipleSelector
                    {...field}
                    options={modifierGroups?.map(modifierGroup => ({
                      label: modifierGroup.name,
                      value: modifierGroup.id,
                      disabled: false,
                    })) || []}
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
