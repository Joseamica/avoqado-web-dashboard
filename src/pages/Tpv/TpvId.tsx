import api from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, PencilIcon, SaveIcon, XIcon, AlertCircle, Home } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCurrentVenue } from '@/hooks/use-current-venue'

// Define the schema for validation (based on actual database schema)
const tpvFormSchema = z.object({
  name: z.string().min(1, { message: 'El nombre es requerido' }),
  serialNumber: z.string().min(1, { message: 'El número de serie es requerido' }),
  type: z.string().optional(),
  status: z.string().optional(),
  config: z.string().optional(), // JSON configuration
})

// Type for the form values
type TpvFormValues = z.infer<typeof tpvFormSchema>

interface TpvData {
  id: string
  name: string
  serialNumber: string
  type?: string
  status?: string
  lastHeartbeat?: string
  config?: any // JSON field
  venueId: string
  createdAt?: string
  updatedAt?: string
}

export default function TpvId() {
  const { tpvId } = useParams()
  const location = useLocation()
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)

  // Initialize form with react-hook-form
  const form = useForm<TpvFormValues>({
    resolver: zodResolver(tpvFormSchema),
    defaultValues: {
      name: '',
      serialNumber: '',
      type: '',
      status: '',
      config: '',
    },
  })

  const navigate = useNavigate()

  // Fetch the TPV data
  const { data: tpv, isLoading, error, isError } = useQuery<TpvData>({
    queryKey: ['tpv', venueId, tpvId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/tpv/${tpvId}`)
      return response.data
    },
    enabled: Boolean(venueId && tpvId),
    retry: (failureCount, error: any) => {
      // Don't retry if it's a 404 error
      if (error?.response?.status === 404) {
        return false
      }
      // Retry up to 3 times for other errors
      return failureCount < 3
    },
  })

  useEffect(() => {
    if (tpv) {
      form.reset({
        name: tpv.name || '',
        serialNumber: tpv.serialNumber || '',
        type: tpv.type || '',
        status: tpv.status || '',
        config: tpv.config ? JSON.stringify(tpv.config, null, 2) : '',
      })
    }
  }, [tpv, form])

  // Mutation for updating the TPV
  const updateTpvMutation = useMutation({
    mutationFn: async (updatedData: TpvFormValues) => {
      if (!venueId || !tpvId) {
        throw new Error('Venue o TPV no definido')
      }
      const response = await api.put(`/api/v1/dashboard/venues/${venueId}/tpv/${tpvId}`, updatedData)
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
        serialNumber: tpv.serialNumber || '',
        type: tpv.type || '',
        status: tpv.status || '',
        config: tpv.config ? JSON.stringify(tpv.config, null, 2) : '',
      })
    }
    setIsEditing(false)
  }

  const from = (location.state as any)?.from || `/venues/${venueId}/tpv`

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Cargando información del terminal...</p>
      </div>
    )
  }

  // Handle 404 error - TPV not found
  if (isError && (error as any)?.response?.status === 404) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-xl">Terminal no encontrado</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              El terminal con ID <code className="bg-muted px-2 py-1 rounded text-sm">{tpvId}</code> no existe o no tienes permisos para acceder a él.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate(-1)} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver atrás
              </Button>
              <Button onClick={() => navigate(`/venues/${venueId}/tpv`)} className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Ir a Terminales
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Handle other errors
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error al cargar el terminal. Por favor intenta de nuevo o contacta al soporte técnico.
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver atrás
          </Button>
          <Button onClick={() => window.location.reload()}>
            Intentar de nuevo
          </Button>
        </div>
      </div>
    )
  }

  // If no TPV data and not loading/error, show not found
  if (!tpv) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <p className="text-muted-foreground">No se encontraron datos del terminal.</p>
        <Button onClick={() => navigate(`/venues/${venueId}/tpv`)}>
          <Home className="h-4 w-4 mr-2" />
          Volver a Terminales
        </Button>
      </div>
    )
  }

  return (
    <div>
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-background border-b-2 top-14">
        <div className="space-x-4 flex items-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>Detalles del Terminal {tpv?.name || ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 ${tpv?.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900/50' : 'bg-secondary'} ${
              tpv?.status === 'ACTIVE' ? 'text-green-800 dark:text-green-200' : 'text-secondary-foreground'
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
                  name="serialNumber"
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
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Terminal</FormLabel>
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
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!isEditing} className={isEditing ? 'border-primary' : ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div>
                  <Label htmlFor="lastHeartbeat">Último Heartbeat</Label>
                  <Input 
                    id="lastHeartbeat" 
                    value={tpv?.lastHeartbeat ? new Date(tpv.lastHeartbeat).toLocaleString('es-ES') : 'Nunca'} 
                    disabled 
                  />
                </div>
              </div>
            </div>


            <Separator className="my-6" />

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Configuración</h3>
              <FormField
                control={form.control}
                name="config"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      {isEditing ? (
                        <div className="p-4 border rounded-md">
                          <Textarea {...field} className="w-full h-32 p-2 text-sm font-mono resize-y border-primary" placeholder='Configuración en formato JSON (ej: {"setting": "value"})' />
                        </div>
                      ) : tpv?.config ? (
                        <div className="p-4 border rounded-md">
                          <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(tpv.config, null, 2)}</pre>
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
                  <Label className="text-sm text-muted-foreground">Tipo de Terminal</Label>
                  <p className="text-sm">{tpv?.type || '-'}</p>
                </div>
                <div className="p-4 border rounded-md">
                  <Label className="text-sm text-muted-foreground">Creado</Label>
                  <p className="text-sm">{tpv?.createdAt ? new Date(tpv.createdAt).toLocaleString('es-ES') : '-'}</p>
                </div>
                <div className="p-4 border rounded-md">
                  <Label className="text-sm text-muted-foreground">Última actualización</Label>
                  <p className="text-sm">{tpv?.updatedAt ? new Date(tpv.updatedAt).toLocaleString('es-ES') : '-'}</p>
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
