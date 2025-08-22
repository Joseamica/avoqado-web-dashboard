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
        title: 'Producto guardado',
        description: 'Los cambios se han guardado correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['product', venueId, productId] }) // Refetch product data
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
      await api.patch(`/api/v1/dashboard/venues/${venueId}/products/${productId}/image`)
    },
    onSuccess: () => {
      toast({
        title: 'Imagen eliminada',
        description: 'La imagen se ha eliminado correctamente.',
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
        title: 'Producto eliminado',
        description: 'El producto se ha eliminado correctamente.',
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
    return <div>Cargando...</div>
  }

  if (!data) {
    return <div>Producto no encontrado</div>
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
            triggerTitle="Eliminar"
            title="Eliminar producto"
            // description="Al eliminar el producto, no podrás recuperarlo."
            message=" ¿Estás seguro de que deseas eliminar este producto?"
            rightButtonLabel="Eliminar"
            rightButtonVariant="default"
            onRightButtonClick={() => deleteProduct.mutate()}
          />
          <Button variant="outline">Duplicar</Button>
          <LoadingButton
            loading={saveProduct.isPending}
            onClick={form.handleSubmit(onSubmit)}
            variant="default"
            disabled={!form.formState.isDirty || saveProduct.isPending}
          >
            {saveProduct.isPending ? 'Guardando...' : 'Guardar'}
          </LoadingButton>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 space-y-6 pb-20 ">
          <FormField
            control={form.control}
            name="sku"
            rules={{
              required: { value: true, message: 'El SKU es requerido.' },
              pattern: {
                value: /^[A-Za-z0-9_-]+$/,
                message: 'El SKU solo puede contener letras, números, guiones y guiones bajos.',
              },
            }}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="SKU (p.ej., TACO-001 or Prod-abc123)"
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
              required: { value: true, message: 'El nombre es requerido.' },
              minLength: { value: 3, message: 'El nombre debe tener al menos 3 caracteres.' },
              maxLength: { value: 30, message: 'El nombre no debe tener más de 30 caracteres.' },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Introduce un nombre" className="max-w-96" {...field} />
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
                // Opcional: valor máximo
                // max: value =>
                //   parseFloat(value) <= 10000 || 'El precio no debe exceder $10,000.'
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
                    ) : displayedImageUrl && !imageError ? (
                      // 2) Si ya hay una imagen (de la BD o subida) y NO estamos recortando:
                      <div className="relative flex space-x-4">
                        {/* Sección Izquierda: Imagen */}
                        <div className="w-1/3">
                          <img 
                            src={displayedImageUrl} 
                            alt="Product" 
                            className="object-cover w-full h-auto rounded-md" 
                            onError={() => setImageError(true)}
                          />
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
                                    setImageError(false) // Reset error state when uploading new image
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
                    ) : displayedImageUrl && imageError ? (
                      // 2b) Si hay una imagen pero falló al cargar, mostrar placeholder elegante
                      <div className="relative flex space-x-4">
                        {/* Sección Izquierda: Placeholder para imagen rota */}
                        <div className="w-64 h-64 flex flex-col items-center justify-center bg-muted border-2 border-border rounded-md">
                          <ImageIcon className="w-12 h-12 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground text-center">Imagen no disponible</p>
                          <p className="text-xs text-muted-foreground text-center mt-1">La imagen no pudo cargarse</p>
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
                                    setImageError(false) // Reset error state when uploading new image
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
                                    setImageError(false) // Reset error state when uploading new image
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
                  <Select
                    onValueChange={value => {
                      field.onChange(value)
                      form.clearErrors('categoryId')
                    }}
                    value={field.value || ''}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona la categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Selecciona una categoría</SelectLabel>
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
                <FormLabel>Grupos Modificadores</FormLabel>
                <FormControl>
                  <MultipleSelector
                    {...field}
                    options={modifierGroups?.map(mg => ({ label: mg.name, value: mg.id, disabled: false })) || []}
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
