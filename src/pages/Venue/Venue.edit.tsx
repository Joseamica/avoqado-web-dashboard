import api from '@/api'
import AlertDialogWrapper from '@/components/alert-dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'

import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

export default function EditVenue() {
  const { venueId } = useParams()

  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const from = (location.state as any)?.from || '/'

  const form = useForm({})

  function onSubmit(formValues) {
    // saveCategory.mutate({
    //   ...formValues,
    // })
  }

  const { data: venue, isLoading } = useQuery({
    queryKey: ['get-venue-data', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/venue`)
      return response.data
    },
  })

  const deleteProduct = useMutation({
    mutationFn: async () => {
      await api.delete(`/v2/dashboard/${venueId}/products/${venueId}`)
    },
    onSuccess: () => {
      toast({
        title: 'Producto eliminado',
        description: 'El producto se ha eliminado correctamente.',
      })
      navigate(from)
    },
  })

  if (isLoading) return <div className="p-4">Loading...</div>

  return (
    <div className="p-4">
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-white border-b-2 top-14">
        <div className="space-x-4 flex-row-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>{venue.name}</span>
        </div>
        <div className="space-x-3 flex-row-center ">
          <AlertDialogWrapper
            triggerTitle="Guardar"
            title={`Guardar ${venue.name}`}
            // description="Al eliminar el producto, no podrás recuperarlo."
            message=" ¿Estás seguro de que deseas guardar los cambios?"
            rightButtonLabel="Guardar"
            rightButtonVariant="default"
            onRightButtonClick={() => deleteProduct.mutate()}
          />

          {/* <Button disabled={!form.formState.isDirty || saveProduct.isPending} onClick={form.handleSubmit(onSubmit)}> */}
          {/* {saveProduct.isPending ? 'Guardando...' : 'Guardar'} */}
          {/* </Button> */}
        </div>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            rules={{
              required: { value: true, message: 'El nombre es requerido.' },
              minLength: { value: 3, message: 'El nombre debe tener al menos 3 caracteres.' },
              maxLength: { value: 30, message: 'El nombre no debe tener más de 30 caracteres.' },
            }}
            defaultValue={venue.name}
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
            name="googleBusinessId"
            rules={{
              required: { value: true, message: 'El nombre es requerido.' },
              minLength: { value: 3, message: 'El nombre debe tener al menos 3 caracteres.' },
              maxLength: { value: 30, message: 'El nombre no debe tener más de 30 caracteres.' },
            }}
            defaultValue={venue.googleBusinessId}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>Google Business Id</FormLabel>
                  <FormControl>
                    <Input placeholder="Introduce el Google Business Id" className="max-w-96" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          <FormField
            control={form.control}
            name="merchantIdA"
            rules={{
              required: { value: true, message: 'El nombre es requerido.' },
              minLength: { value: 3, message: 'El nombre debe tener al menos 3 caracteres.' },
              maxLength: { value: 30, message: 'El nombre no debe tener más de 30 caracteres.' },
            }}
            defaultValue={venue.menta.merchantIdA}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>Menta Id A</FormLabel>
                  <FormControl>
                    <Input placeholder="Introduce el Google Business Id" className="max-w-96" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          <FormField
            control={form.control}
            name="merchantIdB"
            defaultValue={venue.menta.merchantIdB}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>Menta Id B (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="" className="max-w-96" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        </form>
      </Form>
    </div>
  )
}
