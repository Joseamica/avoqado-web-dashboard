import api from '@/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useParams } from 'react-router-dom'

export default function Account() {
  const { venueId } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const form = useForm({
    defaultValues: {
      email: user?.email || '',
      old_password: '',
      password: '',
    },
  })

  const editProfile = useMutation({
    mutationFn: async (formValues: any) => {
      const response = await api.patch(`/v2/dashboard/${venueId}/account`, {
        id: user?.id,
        email: formValues.email,
        old_password: formValues.old_password,
        password: formValues.password,
      })
      return response.data
    },
    onSuccess: () => {
      toast({
        title: 'Cambios guardados',
        description: 'Tus cambios se han actualizado correctamente',
      })
      queryClient.invalidateQueries({ queryKey: ['user'] })
      setIsDialogOpen(false)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Error al guardar cambios',
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (formValues: any) => {
    editProfile.mutate(formValues)
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-semibold">Perfil</h1>
      <Separator className="my-4" />

      <Form {...form}>
        <form className="max-w-2xl space-y-6">
          {/* Campo de email visible siempre */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo electrónico</FormLabel>
                <FormControl>
                  <Input {...field} type="email" readOnly={editProfile.isPending} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Botón para abrir el diálogo de contraseña */}
          <div className="flex flex-row items-center space-x-4">
            <FormLabel>Contraseña</FormLabel>
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(true)}>
              Cambiar contraseña
            </Button>
          </div>
        </form>
      </Form>

      {/* Diálogo para cambiar contraseña */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <DialogHeader>
                <DialogTitle>Actualizar contraseña</DialogTitle>
              </DialogHeader>

              {/* Email visible pero no editable en el diálogo */}
              {/* <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo electrónico</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" readOnly className="text-gray-500" />
                    </FormControl>
                  </FormItem>
                )}
              /> */}

              {/* Campos de contraseña */}
              <FormField
                control={form.control}
                name="old_password"
                rules={{ required: 'La contraseña actual es obligatoria' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña actual</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                rules={{ required: 'La nueva contraseña es obligatoria' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nueva contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full">
                Guardar cambios
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
