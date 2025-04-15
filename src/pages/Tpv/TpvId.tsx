import api from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'
import { themeClasses } from '@/lib/theme-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, PencilIcon, SaveIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Textarea } from '@/components/ui/textarea'

// Define the schema for validation
const tpvFormSchema = z.object({
  name: z.string().min(1, { message: 'El nombre es requerido' }),
  version: z.string().optional(),
  serial: z.string().min(1, { message: 'El número de serie es requerido' }),
  tradeMark: z.string().optional(),
  model: z.string().optional(),
  idMenta: z.string().optional(),
  customerId: z.string().optional(),
  configuration: z.string().optional(),
  status: z.string().optional(),
})

// Type for the form values
type TpvFormValues = z.infer<typeof tpvFormSchema>

interface TpvData {
  id: string
  name: string
  version?: string
  serial: string
  tradeMark?: string
  model?: string
  idMenta?: string
  customerId?: string
  configuration?: string
  status?: string
  venueId: string
  createdAt?: string
  updatedAt?: string
}

export default function TpvId() {
  const { venueId, tpvId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)

  // Initialize form with react-hook-form
  const form = useForm<TpvFormValues>({
    resolver: zodResolver(tpvFormSchema),
    defaultValues: {
      name: '',
      version: '',
      serial: '',
      tradeMark: '',
      model: '',
      idMenta: '',
      customerId: '',
      configuration: '',
      status: '',
    },
  })

  // Fetch the TPV data
  const { data: tpv, isLoading } = useQuery<TpvData>({
    queryKey: ['tpv', venueId, tpvId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/tpv/${tpvId}`)
      return response.data
    },
  })

  useEffect(() => {
    if (tpv) {
      form.reset({
        name: tpv.name || '',
        version: tpv.version || '',
        serial: tpv.serial || '',
        tradeMark: tpv.tradeMark || '',
        model: tpv.model || '',
        idMenta: tpv.idMenta || '',
        customerId: tpv.customerId || '',
        configuration: tpv.configuration || '',
        status: tpv.status || '',
      })
    }
  }, [tpv, form])

  // Mutation for updating the TPV
  const updateTpvMutation = useMutation({
    mutationFn: async (updatedData: TpvFormValues) => {
      const response = await api.put(`/v2/dashboard/${venueId}/tpv/${tpvId}`, updatedData)
      return response.data
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['tpv', venueId, tpvId] })
      queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })

      setIsEditing(false)
      toast({
        title: 'Terminal actualizado',
        description: 'Los cambios han sido guardados exitosamente',
      })
    },
    onError: error => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el terminal. Por favor intente de nuevo.',
        variant: 'destructive',
      })
      console.error('Error updating TPV:', error)
    },
  })

  const onSubmit = (values: TpvFormValues) => {
    updateTpvMutation.mutate(values)
  }

  const handleCancel = () => {
    // Reset form to original values
    if (tpv) {
      form.reset({
        name: tpv.name || '',
        version: tpv.version || '',
        serial: tpv.serial || '',
        tradeMark: tpv.tradeMark || '',
        model: tpv.model || '',
        idMenta: tpv.idMenta || '',
        customerId: tpv.customerId || '',
        configuration: tpv.configuration || '',
        status: tpv.status || '',
      })
    }
    setIsEditing(false)
  }

  const from = (location.state as any)?.from || `/venues/${venueId}/tpv`

  if (isLoading) {
    return <div className="p-8 text-center">Cargando información del terminal...</div>
  }

  return (
    <div>
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-white border-b-2 top-14">
        <div className="space-x-4 flex items-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>Detalles del Terminal {tpv?.name || ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 ${tpv?.status === 'ACTIVE' ? themeClasses.success.bg : themeClasses.neutral.bg} ${
              tpv?.status === 'ACTIVE' ? themeClasses.success.text : themeClasses.neutral.text
            } rounded-full font-medium`}
          >
            {tpv?.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
          </span>

          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel} className="flex items-center gap-1">
                <XIcon className="w-4 h-4" />
                <span>Cancelar</span>
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={form.handleSubmit(onSubmit)}
                className="flex items-center gap-1"
                disabled={updateTpvMutation.isPending}
              >
                <SaveIcon className="w-4 h-4" />
                <span>{updateTpvMutation.isPending ? 'Guardando...' : 'Guardar'}</span>
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="flex items-center gap-1">
              <PencilIcon className="w-4 h-4" />
              <span>Editar</span>
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-4xl p-6 mx-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!isEditing} className={isEditing ? 'border-primary' : ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div>
                  <Label htmlFor="id">ID del Sistema</Label>
                  <Input id="id" value={tpv?.id || ''} disabled />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="serial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Serie</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!isEditing} className={isEditing ? 'border-primary' : ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Versión</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!isEditing} className={isEditing ? 'border-primary' : ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="tradeMark"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!isEditing} className={isEditing ? 'border-primary' : ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!isEditing} className={isEditing ? 'border-primary' : ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Información de conexión</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-md">
                  <FormField
                    control={form.control}
                    name="idMenta"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm text-muted-foreground">ID de Menta</FormLabel>
                        <FormControl>
                          {isEditing ? (
                            <Input {...field} className="mt-2 border-primary" />
                          ) : (
                            <p className="font-medium">{tpv?.idMenta || '-'}</p>
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="p-4 border rounded-md">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm text-muted-foreground">ID de Cliente</FormLabel>
                        <FormControl>
                          {isEditing ? (
                            <Input {...field} className="mt-2 border-primary" />
                          ) : (
                            <p className="font-medium">{tpv?.customerId || '-'}</p>
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Configuración</h3>
              <FormField
                control={form.control}
                name="configuration"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      {isEditing ? (
                        <div className="p-4 border rounded-md">
                          <Textarea {...field} className="w-full h-32 p-2 text-sm font-mono resize-y border-primary" />
                        </div>
                      ) : tpv?.configuration ? (
                        <div className="p-4 border rounded-md">
                          <pre className="whitespace-pre-wrap text-sm">{tpv.configuration}</pre>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No hay configuración registrada para este terminal.</p>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Información adicional</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-md">
                  <Label className="text-sm text-muted-foreground">Venue ID</Label>
                  <p className="text-sm">{tpv?.venueId}</p>
                </div>
                <div className="p-4 border rounded-md">
                  <Label className="text-sm text-muted-foreground">Creado</Label>
                  <p className="text-sm">{tpv?.createdAt ? new Date(tpv.createdAt).toLocaleString() : '-'}</p>
                </div>
                <div className="p-4 border rounded-md">
                  <Label className="text-sm text-muted-foreground">Última actualización</Label>
                  <p className="text-sm">{tpv?.updatedAt ? new Date(tpv.updatedAt).toLocaleString() : '-'}</p>
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end mt-6 space-x-4">
                <Button type="button" variant="outline" onClick={handleCancel} className="flex items-center gap-1">
                  <XIcon className="w-4 h-4" />
                  <span>Cancelar</span>
                </Button>
                <Button type="submit" className="flex items-center gap-1" disabled={updateTpvMutation.isPending}>
                  <SaveIcon className="w-4 h-4" />
                  <span>{updateTpvMutation.isPending ? 'Guardando...' : 'Guardar'}</span>
                </Button>
              </div>
            )}
          </form>
        </Form>
      </div>
    </div>
  )
}
