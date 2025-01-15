import api from '@/api'
import { LoadingButton } from '@/components/loading-button'
import MultipleSelector from '@/components/multi-selector'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

export default function CreateCategory() {
  const { venueId } = useParams()

  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['necessary-category-creation-data', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/necessary-category-creation-data`)
      return response.data
    },
  })

  const from = (location.state as any)?.from || '/'

  const createCategory = useMutation({
    mutationFn: async formValues => {
      const response = await api.post(`/v2/dashboard/${venueId}/category`, formValues)
      return response.data
    },
    onSuccess: (_, data: any) => {
      toast({
        title: `Categoría ${data.name.toLowerCase()} creada.`,
        description: 'La categoría se ha creado correctamente.',
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
      avoqadoMenus: [],
      avoqadoProducts: [],
    },
  })

  // Manejador del submit
  // function onSubmit(formValues: z.infer<typeof FormSchema>) {
  function onSubmit(formValues) {
    createCategory.mutate({
      ...formValues,
    })
  }

  if (isLoading) {
    return <div>Cargando...</div>
  }

  if (!data) {
    return <div>Producto no encontrado</div>
  }

  return (
    <div>
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-white border-b-2 top-14">
        <div className="space-x-4 flex-row-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>{form.watch('name', '')}</span>
        </div>
        <div className="space-x-3 flex-row-center">
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
                    options={data.avoqadoMenus.map(avoqadoMenu => ({
                      label: avoqadoMenu.name,
                      value: avoqadoMenu.id,
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
                    options={data.avoqadoProducts.map(avoqadoProduct => ({
                      label: avoqadoProduct.name,
                      value: avoqadoProduct.id,
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
        </form>
      </Form>
    </div>
  )
}
