import api from '@/api'
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
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import countryList from 'react-select-country-list'
import { z } from 'zod'
import { useCurrentVenue } from '@/hooks/use-current-venue'

// Enums to match Prisma schema exactly
enum VenueType {
  RESTAURANT = 'RESTAURANT',
  BAR = 'BAR',
  CAFE = 'CAFE',
  FAST_FOOD = 'FAST_FOOD',
  FOOD_TRUCK = 'FOOD_TRUCK',
  RETAIL_STORE = 'RETAIL_STORE',
  HOTEL_RESTAURANT = 'HOTEL_RESTAURANT',
  FITNESS_STUDIO = 'FITNESS_STUDIO',
  SPA = 'SPA',
  OTHER = 'OTHER',
}

enum PosType {
  SOFTRESTAURANT = 'SOFTRESTAURANT',
  SQUARE = 'SQUARE',
  TOAST = 'TOAST',
  CLOVER = 'CLOVER',
  ALOHA = 'ALOHA',
  MICROS = 'MICROS',
  NCR = 'NCR',
  CUSTOM = 'CUSTOM',
  NONE = 'NONE',
}

const venueFormSchema = z.object({
  // Required fields from Prisma schema
  name: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres.' }),
  address: z.string().min(1, { message: 'La dirección es requerida.' }),
  city: z.string().min(1, { message: 'La ciudad es requerida.' }),
  state: z.string().min(1, { message: 'El estado es requerido.' }),
  country: z.string().min(1, { message: 'El país es requerido.' }).default('MX'),
  zipCode: z.string().min(1, { message: 'El código postal es requerido.' }),
  phone: z.string().min(1, { message: 'El teléfono es requerido.' }),
  email: z.string().email({ message: 'Debe ser un email válido.' }),
  
  // Optional fields from Prisma schema
  type: z.nativeEnum(VenueType).default(VenueType.RESTAURANT),
  timezone: z.string().default('America/Mexico_City'),
  currency: z.string().default('MXN'),
  website: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  secondaryColor: z.string().nullable().optional(),
  
  // POS Integration fields
  posType: z.nativeEnum(PosType).nullable().optional(),
  
  // Location coordinates
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
})

type VenueFormValues = z.infer<typeof venueFormSchema>

// Add a VenueSkeleton component
function VenueSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="sticky top-0 z-20 flex flex-row justify-between w-full px-4 py-3 bg-background/95 border-b shadow-md backdrop-blur-sm">
        <div className="space-x-3 flex items-center">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="space-x-2 flex items-center">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      <div className="container mx-auto pt-6 pb-20 px-3 md:px-4 flex-grow overflow-auto">
        <div className="space-y-6 md:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Skeleton className="h-7 w-48 mb-2" />
              <Skeleton className="h-0.5 w-full mb-6" />

              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>

              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>

              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>

              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>

            <div className="space-y-6">
              <Skeleton className="h-7 w-48 mb-2" />
              <Skeleton className="h-0.5 w-full mb-6" />

              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>

              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>

              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>

              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function EditVenue() {
  const { venueId } = useCurrentVenue()

  // Get the list of countries - moved to top of component
  const countries = useMemo(() => {
    // Obtener la lista de países pero usar el código ISO de dos letras como valor
    const list = countryList().getData()
    return list.map((country: any) => ({
      value: country.value,
      label: `${country.label} (${country.value})`, // Mostrar el código junto al nombre
    }))
  }, [])

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
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}`)
      return response.data
    },
    enabled: !!venueId,
  })

  const form = useForm<VenueFormValues>({
    resolver: zodResolver(venueFormSchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
      state: '',
      country: 'MX',
      zipCode: '',
      phone: '',
      email: '',
      type: VenueType.RESTAURANT,
      timezone: 'America/Mexico_City',
      currency: 'MXN',
      website: '',
      logo: '',
      primaryColor: '',
      secondaryColor: '',
      posType: null,
      latitude: null,
      longitude: null,
    },
  })

  // Update form values when venue data is loaded
  useEffect(() => {
    if (venue) {

      form.reset({
        name: venue.name || '',
        address: venue.address || '',
        city: venue.city || '',
        state: venue.state || '',
        country: venue.country || 'MX',
        zipCode: venue.zipCode || '',
        phone: venue.phone || '',
        email: venue.email || '',
        type: (venue.type as VenueType) || VenueType.RESTAURANT,
        timezone: venue.timezone || 'America/Mexico_City',
        currency: venue.currency || 'MXN',
        website: venue.website || '',
        logo: venue.logo || '',
        primaryColor: venue.primaryColor || '',
        secondaryColor: venue.secondaryColor || '',
        posType: (venue.posType as PosType) || null,
        latitude: venue.latitude ? Number(venue.latitude) : null,
        longitude: venue.longitude ? Number(venue.longitude) : null,
      })

    }
  }, [venue, form])


  const saveVenue = useMutation({
    mutationFn: async (data: VenueFormValues) => {
      // Create venue data object matching Prisma schema
      const venueData: any = {
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        zipCode: data.zipCode,
        phone: data.phone,
        email: data.email,
        type: data.type,
        timezone: data.timezone,
        currency: data.currency,
      }

      // Add optional fields if they have values
      if (data.website) venueData.website = data.website
      if (data.logo) venueData.logo = data.logo
      if (data.primaryColor) venueData.primaryColor = data.primaryColor
      if (data.secondaryColor) venueData.secondaryColor = data.secondaryColor
      if (data.posType) venueData.posType = data.posType
      if (data.latitude !== null) venueData.latitude = data.latitude
      if (data.longitude !== null) venueData.longitude = data.longitude

      return await api.put(`/api/v1/dashboard/venues/${venueId}`, venueData)
    },
    onSuccess: () => {
      toast({
        title: 'Venue actualizado',
        description: 'El venue se ha actualizado correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || 'Hubo un error al actualizar el venue.'
      toast({
        title: 'Error al actualizar venue',
        description: errorMessage,
        variant: 'destructive',
      })
      console.error('Error updating venue:', error)
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
      await api.delete(`/api/v1/dashboard/venues/${venueId}`)
    },
    onSuccess: () => {
      toast({
        title: 'Venue eliminado',
        description: 'El venue se ha eliminado correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['status'] })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data'] })
      navigate(from)
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || 'Hubo un error al eliminar el venue.'
      toast({
        title: 'Error al eliminar venue',
        description: errorMessage,
        variant: 'destructive',
      })
      console.error('Error deleting venue:', error)
    },
  })

  function onSubmit(formValues: VenueFormValues) {
    saveVenue.mutate(formValues)
  }

  if (isLoading) return <VenueSkeleton />
  
  if (!venue) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Venue no encontrado</h2>
          <p className="text-muted-foreground mb-4">El venue que buscas no existe o no tienes permisos para editarlo.</p>
          <Button onClick={() => navigate(from)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </div>
      </div>
    )
  }

  const expectedDeleteText = `delete ${venue.name}`
  const isDeleteConfirmed = deleteConfirmation.toLowerCase() === expectedDeleteText.toLowerCase()

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="sticky top-0 z-20 flex flex-row justify-between w-full px-4 py-3 bg-background/95 border-b shadow-md backdrop-blur-sm">
        <div className="space-x-3 flex items-center">
          <Link to={from} className="flex items-center hover:text-primary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="font-medium truncate max-w-[200px] md:max-w-none">{venue.name}</span>
        </div>
        <div className="space-x-2 flex items-center">
          <Button
            variant="default"
            size="sm"
            className="px-3 md:px-4 whitespace-nowrap"
            disabled={!form.formState.isDirty || saveVenue.isPending}
            onClick={form.handleSubmit(onSubmit)}
          >
            {saveVenue.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
          <Button variant="destructive" size="sm" className="px-3 md:px-4" onClick={() => setShowDeleteDialog(true)}>
            Eliminar
          </Button>
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

      <div className="container mx-auto pt-6 pb-20 px-3 md:px-4 flex-grow overflow-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 md:space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Información básica</h3>
                <Separator />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre del venue" {...field} />
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
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={VenueType.RESTAURANT}>Restaurante</SelectItem>
                          <SelectItem value={VenueType.BAR}>Bar</SelectItem>
                          <SelectItem value={VenueType.CAFE}>Café</SelectItem>
                          <SelectItem value={VenueType.FAST_FOOD}>Comida Rápida</SelectItem>
                          <SelectItem value={VenueType.FOOD_TRUCK}>Food Truck</SelectItem>
                          <SelectItem value={VenueType.RETAIL_STORE}>Tienda</SelectItem>
                          <SelectItem value={VenueType.HOTEL_RESTAURANT}>Restaurante de Hotel</SelectItem>
                          <SelectItem value={VenueType.FITNESS_STUDIO}>Estudio de Fitness</SelectItem>
                          <SelectItem value={VenueType.SPA}>Spa</SelectItem>
                          <SelectItem value={VenueType.OTHER}>Otro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <FormControl>
                        <Input placeholder="Estado" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código Postal</FormLabel>
                      <FormControl>
                        <Input placeholder="Código postal" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección</FormLabel>
                      <FormControl>
                        <Input placeholder="Dirección completa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ciudad</FormLabel>
                        <FormControl>
                          <Input placeholder="Ciudad" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>País</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un país" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {countries.map((country: any) => (
                              <SelectItem key={country.value} value={country.value}>
                                {country.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zona horaria</FormLabel>
                      <FormControl>
                        <Input placeholder="America/Mexico_City" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moneda</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'MXN'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una moneda" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MXN">Peso Mexicano (MXN)</SelectItem>
                          <SelectItem value="USD">Dólar Estadounidense (USD)</SelectItem>
                          <SelectItem value="EUR">Euro (EUR)</SelectItem>
                          <SelectItem value="CAD">Dólar Canadiense (CAD)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-medium">Contacto e imágenes</h3>
                <Separator />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@ejemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="+52 123 456 7890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sitio web</FormLabel>
                      <FormControl>
                        <Input placeholder="https://tusitio.com" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color Primario</FormLabel>
                      <FormControl>
                        <Input placeholder="#FF5733" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="secondaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color Secundario</FormLabel>
                      <FormControl>
                        <Input placeholder="#33C4FF" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="latitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Latitud</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="any" 
                            placeholder="19.432608" 
                            {...field} 
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="longitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Longitud</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="any" 
                            placeholder="-99.133209" 
                            {...field} 
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="logo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL de logo</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/logo.jpg" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-medium">Integración con POS</h3>
              <Separator />

              <FormField
                control={form.control}
                name="posType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sistema POS</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un sistema POS" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={PosType.SOFTRESTAURANT}>Soft Restaurant</SelectItem>
                        <SelectItem value={PosType.SQUARE}>Square</SelectItem>
                        <SelectItem value={PosType.TOAST}>Toast</SelectItem>
                        <SelectItem value={PosType.CLOVER}>Clover</SelectItem>
                        <SelectItem value={PosType.ALOHA}>Aloha</SelectItem>
                        <SelectItem value={PosType.MICROS}>Micros</SelectItem>
                        <SelectItem value={PosType.NCR}>NCR</SelectItem>
                        <SelectItem value={PosType.CUSTOM}>Personalizado</SelectItem>
                        <SelectItem value={PosType.NONE}>Ninguno</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

          </form>
        </Form>
      </div>
    </div>
  )
}
