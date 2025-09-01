import api from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { User, Mail, Shield, Calendar } from 'lucide-react'

export default function Account() {
  const { venueId } = useCurrentVenue()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const form = useForm({
    defaultValues: {
      email: user?.email || '',
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
      old_password: '',
      password: '',
    },
  })

  const editProfile = useMutation({
    mutationFn: async (formValues: any) => {
      // Only send fields that have values
      const payload: any = {
        id: user?.id,
      }
      
      if (formValues.firstName) payload.firstName = formValues.firstName
      if (formValues.lastName) payload.lastName = formValues.lastName  
      if (formValues.email) payload.email = formValues.email
      if (formValues.phone) payload.phone = formValues.phone
      
      // Only send password fields if both are provided (for password change)
      if (formValues.old_password && formValues.password) {
        payload.old_password = formValues.old_password
        payload.password = formValues.password
      }

      const response = await api.patch(`/api/v1/dashboard/${venueId}/account`, payload)
      return response.data
    },
    onSuccess: () => {
      toast({
        title: 'Cambios guardados',
        description: 'Tus cambios se han actualizado correctamente',
      })
      // Clear password fields after successful update
      form.setValue('old_password', '')
      form.setValue('password', '')
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <User className="h-6 w-6" />
          Mi Perfil
        </h1>
        <p className="text-muted-foreground mt-2">Administra tu información personal y configuración de cuenta</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Information Card */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Información de Cuenta
              </CardTitle>
              <CardDescription>Detalles básicos de tu cuenta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Rol</p>
                  <Badge variant="secondary">{user?.role}</Badge>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Miembro desde</p>
                  <p className="text-sm text-muted-foreground">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('es-ES') : 'N/A'}
                  </p>
                </div>
              </div>

              {user?.lastLogin && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Último acceso</p>
                    <p className="text-sm text-muted-foreground">{new Date(user.lastLogin).toLocaleString('es-ES')}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Edit Profile Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Editar Perfil</CardTitle>
              <CardDescription>Actualiza tu información personal</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* First Name */}
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={editProfile.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Last Name */}
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Apellido</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={editProfile.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo electrónico</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" disabled={editProfile.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Phone */}
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" disabled={editProfile.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  {/* Password Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium">Contraseña</h3>
                        <p className="text-sm text-muted-foreground">Cambia tu contraseña para mantener tu cuenta segura</p>
                      </div>
                      <Button ref={triggerRef} type="button" variant="outline" onClick={() => setIsDialogOpen(true)}>
                        Cambiar contraseña
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button type="submit" disabled={editProfile.isPending}>
                      {editProfile.isPending ? 'Guardando...' : 'Guardar cambios'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => form.reset()} disabled={editProfile.isPending}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Diálogo para cambiar contraseña */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          onOpenAutoFocus={e => {
            // Prevent default auto-focus to avoid focusing while aria-hidden toggles
            e.preventDefault()
            // Focus the first field after the dialog is fully mounted
            setTimeout(() => {
              form.setFocus('old_password')
            }, 0)
          }}
          onCloseAutoFocus={e => {
            // Prevent default to avoid focusing an element inside an aria-hidden subtree
            e.preventDefault()
            // Restore focus to the trigger button
            triggerRef.current?.focus()
          }}
        >
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
                      <Input {...field} type="email" readOnly className="text-muted-foreground" />
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
