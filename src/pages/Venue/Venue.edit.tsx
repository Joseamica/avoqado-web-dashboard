import api from '@/api'
import AlertDialogWrapper from '@/components/alert-dialog'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'

import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

export default function EditVenue() {
  const { venueId } = useParams()

  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const from = (location.state as any)?.from || '/'
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const queryClient = useQueryClient()

  const { data: venue, isLoading } = useQuery({
    queryKey: ['get-venue-data', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/venue`)
      return response.data
    },
  })

  function onSubmit(formValues) {
    // saveCategory.mutate({
    //   ...formValues,
    // })
  }

  const form = useForm({
    defaultValues: {
      name: venue?.name || '',
      googleBusinessId: venue?.googleBusinessId || '',
      merchantIdA: venue?.menta?.merchantIdA || '',
      merchantIdB: venue?.menta?.merchantIdB || '',
    },
  })

  const handleDialogChange = (open: boolean) => {
    setShowDeleteDialog(open)
    if (!open) {
      setDeleteConfirmation('')
    }
  }

  const deleteVenue = useMutation({
    mutationFn: async () => {
      await api.delete(`/v2/dashboard/venues/${venueId}`)
    },
    onSuccess: () => {
      toast({
        title: 'Venue eliminado',
        description: 'El venue se ha eliminado correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['status'] }) // Refetch product data

      navigate(from)
    },
  })

  if (isLoading) return <div className="p-4">Loading...</div>

  const expectedDeleteText = `delete ${venue.name}`
  const isDeleteConfirmed = deleteConfirmation.toLowerCase() === expectedDeleteText.toLowerCase()

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
            onRightButtonClick={() => deleteVenue.mutate()}
          />
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            Eliminar
          </Button>

          {/* <Button disabled={!form.formState.isDirty || saveProduct.isPending} onClick={form.handleSubmit(onSubmit)}> */}
          {/* {saveProduct.isPending ? 'Guardando...' : 'Guardar'} */}
          {/* </Button> */}
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={handleDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro de que deseas eliminar este venue?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Para confirmar, escribe "delete {venue.name}" a continuación:
            </AlertDialogDescription>
            <div className="mt-4">
              <Input
                value={deleteConfirmation}
                onChange={e => setDeleteConfirmation(e.target.value)}
                placeholder={`delete ${venue.name}`}
                className="mt-2"
              />
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteVenue.mutate()}
              disabled={!isDeleteConfirmed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteVenue.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            defaultValue={venue?.menta?.merchantIdA}
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
            defaultValue={venue?.menta?.merchantIdB}
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
