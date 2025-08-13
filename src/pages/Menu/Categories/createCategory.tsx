import { createMenuCategory, getMenus, getProducts } from '@/services/menu.service'
import { LoadingButton } from '@/components/loading-button'
import MultipleSelector from '@/components/multi-selector'
import { LoadingScreen } from '@/components/spinner'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import TimePicker from '@/components/time-picker'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCurrentVenue } from '@/hooks/use-current-venue'

export default function CreateCategory() {
  const { venueId } = useCurrentVenue()

  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()

  const { data: menus, isLoading: isMenusLoading } = useQuery({
    queryKey: ['menus', venueId],
    queryFn: () => getMenus(venueId!),
    enabled: !!venueId,
  })

  const { data: products, isLoading: isProductsLoading } = useQuery({
    queryKey: ['products', venueId],
    queryFn: () => getProducts(venueId!),
    enabled: !!venueId,
  })

  const from = (location.state as any)?.from || '/'

  const createCategory = useMutation({
    mutationFn: async formValues => {
      return await createMenuCategory(venueId!, formValues)
    },
    onSuccess: (_, data: any) => {
      toast({
        title: `Categoría ${data.name.toLowerCase()} creada.`,
        description: 'La categoría se ha creado correctamente.',
      })
      navigate(from)
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error.message || 'Hubo un problema al guardar los cambios.'
      toast({
        title: 'Error al guardar',
        description: errorMessage,
        variant: 'destructive',
      })
    },
  })

  const form = useForm({
    defaultValues: {
      name: '',
      avoqadoMenus: [],
      avoqadoProducts: [],
      availableFrom: '',
      availableUntil: '',
      availableDays: [],
      active: true,
    },
  })

  useEffect(() => {
    if ((menus?.length ?? 0) > 0 && location.search) {
      const params = new URLSearchParams(location.search)
      const menuIdFromQuery = params.get('menuId')
      if (menuIdFromQuery) {
        const selectedMenuFromData = menus!.find(menu => menu.id === menuIdFromQuery)
        if (selectedMenuFromData) {
          const menuToSetInForm = [
            {
              value: selectedMenuFromData.id,
              label: selectedMenuFromData.name,
              disabled: false,
            },
          ]
          form.setValue('avoqadoMenus', menuToSetInForm)
        }
      }
    }
  }, [menus, location.search, form])

  // Manejador del submit
  // function onSubmit(formValues: z.infer<typeof FormSchema>) {
  function onSubmit(formValues: any) {
    // Transform the data to match server expectations
    const transformedData = {
      ...formValues,
      // Transform availableDays from MultiSelector format to server format
      availableDays: formValues.availableDays?.map((day: any) => day.value || day) || [],
      // Transform avoqadoMenus from MultiSelector format to server format  
      avoqadoMenus: formValues.avoqadoMenus?.map((menu: any) => ({
        value: menu.value || menu.id,
        label: menu.label || menu.name,
        disabled: menu.disabled || false,
      })) || [],
      // Transform avoqadoProducts from MultiSelector format to server format
      avoqadoProducts: formValues.avoqadoProducts?.map((product: any) => ({
        value: product.value || product.id,
        label: product.label || product.name,
        disabled: product.disabled || false,
      })) || [],
    }

    // Handle time values: send null for empty values, keep valid times
    if (!transformedData.availableFrom || transformedData.availableFrom.trim() === '') {
      transformedData.availableFrom = null
    }
    if (!transformedData.availableUntil || transformedData.availableUntil.trim() === '') {
      transformedData.availableUntil = null
    }

    // Validate time range - availableFrom should be before availableUntil
    if (transformedData.availableFrom && transformedData.availableUntil) {
      const fromTime = transformedData.availableFrom.split(':').map(Number)
      const untilTime = transformedData.availableUntil.split(':').map(Number)
      
      const fromMinutes = fromTime[0] * 60 + fromTime[1]
      const untilMinutes = untilTime[0] * 60 + untilTime[1]
      
      if (fromMinutes >= untilMinutes) {
        toast({
          title: 'Horario inválido',
          description: 'La hora de inicio debe ser anterior a la hora de cierre.',
          variant: 'destructive',
        })
        return // Don't submit if time range is invalid
      }
    }
    
    createCategory.mutate(transformedData)
  }

  if (isMenusLoading || isProductsLoading) {
    return <LoadingScreen message="Cargando..." />
  }

  return (
    <div>
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-white border-b-2 top-14">
        <div className="space-x-4 flex-row-center">
          <button type="button" onClick={() => history.back()} className="cursor-pointer bg-transparent">
            <ArrowLeft />
          </button>
          <span>{form.watch('name', '')}</span>
        </div>
        <div className="space-x-3 flex-row-center">
          <Button
            variant={form.watch('active') ? "default" : "secondary"}
            size="sm"
            onClick={() => {
              const currentActive = form.getValues('active')
              form.setValue('active', !currentActive)
            }}
          >
            {form.watch('active') ? '✓ Activa' : '✗ Inactiva'}
          </Button>
          <LoadingButton loading={createCategory.isPending} onClick={form.handleSubmit(onSubmit)} variant="default">
            {createCategory.isPending ? 'Guardando...' : 'Guardar'}
          </LoadingButton>
        </div>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 space-y-6 ">
          <h1 className="text-xl font-semibold">Nueva categoría</h1>

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
          <FormField
            control={form.control}
            name="avoqadoMenus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Menús en los que aparececerá la categoría</FormLabel>
                <FormControl>
                  <MultipleSelector
                    {...field}
                    options={(menus ?? []).map(menu => ({
                      label: menu.name,
                      value: menu.id,
                      disabled: false,
                    }))}
                    hidePlaceholderWhenSelected
                    placeholder="Selecciona los menús"
                    emptyIndicator="No se han encontrado mas menús"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="avoqadoProducts"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agregar productos a esta categoría</FormLabel>
                <FormControl>
                  <MultipleSelector
                    {...field}
                    options={(products ?? []).map(product => ({
                      label: product.name,
                      value: product.id,
                      disabled: false,
                    }))}
                    hidePlaceholderWhenSelected
                    placeholder="Selecciona los productos"
                    emptyIndicator="No se han encontrado mas productos"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="availableFrom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Disponible desde</FormLabel>
                  <FormControl>
                    <TimePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Seleccionar hora de inicio"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="availableUntil"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Disponible hasta</FormLabel>
                  <FormControl>
                    <TimePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Seleccionar hora de cierre"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          {/* Time range validation message */}
          {(() => {
            const fromValue = form.watch('availableFrom')
            const untilValue = form.watch('availableUntil')
            
            if (fromValue && untilValue) {
              const fromTime = fromValue.split(':').map(Number)
              const untilTime = untilValue.split(':').map(Number)
              const fromMinutes = fromTime[0] * 60 + fromTime[1]
              const untilMinutes = untilTime[0] * 60 + untilTime[1]
              
              if (fromMinutes >= untilMinutes) {
                return (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
                    ⚠️ La hora de inicio debe ser anterior a la hora de cierre
                  </div>
                )
              }
            }
            return null
          })()}
          
          <FormField
            control={form.control}
            name="availableDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Días disponibles</FormLabel>
                <FormControl>
                  <MultipleSelector
                    {...field}
                    options={[
                      { label: 'Lunes', value: 'MON', disabled: false },
                      { label: 'Martes', value: 'TUE', disabled: false },
                      { label: 'Miércoles', value: 'WED', disabled: false },
                      { label: 'Jueves', value: 'THU', disabled: false },
                      { label: 'Viernes', value: 'FRI', disabled: false },
                      { label: 'Sábado', value: 'SAT', disabled: false },
                      { label: 'Domingo', value: 'SUN', disabled: false },
                    ]}
                    hidePlaceholderWhenSelected
                    placeholder="Selecciona los días"
                    emptyIndicator="No se han encontrado más días"
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
