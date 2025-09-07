import api from '@/api'
import { LoadingButton } from '@/components/loading-button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCurrentVenue } from '@/hooks/use-current-venue'

export default function CreateTpv() {
  const { venueId } = useCurrentVenue()
  // const [selectedCategories, setSelectedCategories] = useState<Option[]>([])

  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()

  const from = (location.state as any)?.from || '/'

  const createTpv = useMutation({
    mutationFn: async (formValues: any) => {
      const payload = { name: formValues.name, serialNumber: formValues.serial }
      const response = await api.post(`/api/v1/dashboard/venues/${venueId}/tpvs`, payload)
      return response.data
    },
    onSuccess: (_, data: any) => {
      toast({
        title: `Terminal ${data.name} creado`,
        description: 'La terminal se ha creado correctamente.',
      })
      navigate(from)
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar',
        description: error?.response?.data?.message || error.message || 'Hubo un problema al guardar los cambios.',
        variant: 'destructive',
      })
    },
  })

  const form = useForm({
    defaultValues: {
      name: '',
      serial: '',
    },
  })

  function onSubmit(formValues) {
    createTpv.mutate({
      ...formValues,
    })
  }

  return (
    <div className="">
      {/* Barra superior */}
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-background border-b-2 top-14">
        <div className="space-x-4 flex-row-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>{form.watch('name', '')}</span>
        </div>
        <div className="space-x-3 flex-row-center">
          <LoadingButton loading={createTpv.isPending} onClick={form.handleSubmit(onSubmit)} variant="default">
            {createTpv.isPending ? 'Guardando...' : 'Guardar'}
          </LoadingButton>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 space-y-6 ">
          <h1 className="text-xl font-semibold">Nuevo tpv</h1>

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
            name="serial"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número de serie</FormLabel>
                <FormControl>
                  <Input placeholder="Introduce una descripción" className="max-w-96" {...field} />
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
