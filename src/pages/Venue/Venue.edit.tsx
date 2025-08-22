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
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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

// Add VenueType enum to match Prisma schema
enum VenueType {
  RESTAURANT = 'RESTAURANT',
  STUDIO = 'STUDIO',
  BAR = 'BAR',
  CAFE = 'CAFE',
  OTHER = 'OTHER',
}

enum PosNames {
  WANSOFT = 'WANSOFT',
  SOFTRESTAURANT = 'SOFTRESTAURANT',
  NONE = 'NONE',
}

const venueFormSchema = z.object({
  name: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres.' }),
  posName: z.string().nullable().optional(),
  posUniqueId: z.string().nullable().optional(),

  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  utc: z.string().nullable().default('America/Mexico_City'),
  instagram: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  website: z.string().nullable().optional(),
  language: z.string().nullable().default('es'),
  image: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  cuisine: z.string().nullable().optional(),
  dynamicMenu: z.boolean().default(false),
  wifiName: z.string().nullable().optional(),
  wifiPassword: z.string().nullable().optional(),
  softRestaurantVenueId: z.string().nullable().optional(),
  tipPercentage1: z.string().default('0.10'),
  tipPercentage2: z.string().default('0.15'),
  tipPercentage3: z.string().default('0.20'),
  tipPercentages: z.array(z.number()).default([0.1, 0.15, 0.2]),
  askNameOrdering: z.boolean().default(false),
  googleBusinessId: z.string().nullable().optional(),
  stripeAccountId: z.string().nullable().optional(),
  specialPayment: z.boolean().default(false),
  specialPaymentRef: z.string().nullable().optional(),
  ordering: z.boolean().default(false),
  // Menta fields
  merchantIdA: z.string().nullable().optional(),
  merchantIdB: z.string().nullable().optional(),
  apiKeyA: z.string().nullable().optional(),
  apiKeyB: z.string().nullable().optional(),
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
    return list.map(country => ({
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
      posName: null,
      posUniqueId: '',
      address: '',
      city: '',
      type: null,
      country: '',
      utc: 'America/Mexico_City',
      instagram: '',
      phone: '',
      email: '',
      website: '',
      language: 'es',
      image: '',
      logo: '',
      cuisine: '',
      dynamicMenu: false,
      wifiName: '',
      wifiPassword: '',
      softRestaurantVenueId: '',
      tipPercentage1: '0.10',
      tipPercentage2: '0.15',
      tipPercentage3: '0.20',
      tipPercentages: [0.1, 0.15, 0.2],
      askNameOrdering: false,
      googleBusinessId: '',
      stripeAccountId: '',
      specialPayment: false,
      specialPaymentRef: '',
      ordering: false,
      merchantIdA: '',
      merchantIdB: '',
      apiKeyA: '',
      apiKeyB: '',
    },
  })

  // Update form values when venue data is loaded
  useEffect(() => {
    if (venue) {
      console.log('Venue data for reset:', venue) // Debugging

      // El país puede venir como código ISO (MX) o como nombre completo
      const countryValue = venue.country || ''
      console.log('Country value from API:', countryValue)

      form.reset({
        name: venue.name || '',
        posName: (venue.posName as PosNames) || null,
        posUniqueId: venue.posUniqueId || null,
        address: venue.address || null,
        city: venue.city || null,
        type: (venue.type as VenueType) || null,
        country: countryValue || null, // Usamos el valor tal como viene
        utc: venue.utc || 'America/Mexico_City',
        instagram: venue.instagram || null,
        phone: venue.phone || null,
        email: venue.email || null,
        website: venue.website || null,
        language: venue.language || 'es',
        image: venue.image || null,
        logo: venue.logo || null,
        cuisine: venue.cuisine || null,
        dynamicMenu: Boolean(venue.dynamicMenu),
        wifiName: venue.wifiName || null,
        wifiPassword: venue.wifiPassword || null,
        softRestaurantVenueId: venue.softRestaurantVenueId || null,
        tipPercentage1: venue.tipPercentage1 || '0.10',
        tipPercentage2: venue.tipPercentage2 || '0.15',
        tipPercentage3: venue.tipPercentage3 || '0.20',
        tipPercentages: venue.tipPercentages || [0.1, 0.15, 0.2],
        askNameOrdering: Boolean(venue.askNameOrdering),
        googleBusinessId: venue.googleBusinessId || null,
        stripeAccountId: venue.stripeAccountId || null,
        specialPayment: Boolean(venue.specialPayment),
        specialPaymentRef: venue.specialPaymentRef || null,
        ordering: Boolean(venue.feature?.ordering),
        merchantIdA: venue.menta?.merchantIdA || null,
        merchantIdB: venue.menta?.merchantIdB || null,
        apiKeyA: venue.menta?.apiKeyA || null,
        apiKeyB: venue.menta?.apiKeyB || null,
      })

      // Después de reiniciar el formulario, verificar el valor establecido
      console.log('Form reset with country:', form.getValues('country'))
    }
  }, [venue, form])

  useEffect(() => {
    if (venue) {
      // Para debugging
      console.log('Venue POS system:', venue.posName)
      console.log('Venue country code:', venue.country)
    }
  }, [venue])

  const saveVenue = useMutation({
    mutationFn: async (data: VenueFormValues) => {
      // Create a clean object with only the fields that have values
      const venueData: any = {}

      // Process all fields and only include non-null/non-undefined values
      Object.entries(data).forEach(([key, value]) => {
        // Skip the Menta fields and Feature fields as they'll be handled separately
        if (key !== 'merchantIdA' && key !== 'merchantIdB' && key !== 'apiKeyA' && key !== 'apiKeyB' && key !== 'ordering') {
          if (value !== null && value !== undefined && value !== '') {
            venueData[key] = value
          }
        }
      })

      // Add feature object with proper Prisma relation syntax
      venueData.feature = {
        upsert: {
          create: {
            ordering: data.ordering,
          },
          update: {
            ordering: data.ordering,
          },
        },
      }

      // Only add the menta object if at least one of the fields has a value
      if (data.merchantIdA || data.merchantIdB || data.apiKeyA || data.apiKeyB) {
        venueData.menta = {
          merchantIdA: data.merchantIdA || null,
          merchantIdB: data.merchantIdB || null,
          apiKeyA: data.apiKeyA || null,
          apiKeyB: data.apiKeyB || null,
        }
      }

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
                          <SelectItem value={VenueType.STUDIO}>Estudio</SelectItem>
                          <SelectItem value={VenueType.BAR}>Bar</SelectItem>
                          <SelectItem value={VenueType.CAFE}>Café</SelectItem>
                          <SelectItem value={VenueType.OTHER}>Otro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cuisine"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Cocina</FormLabel>
                      <FormControl>
                        <Input placeholder="Tipo de cocina" {...field} />
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
                        <Textarea placeholder="Dirección completa" className="resize-none" {...field} />
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
                    render={({ field }) => {
                      // Para debugging
                      console.log('Field country value:', field.value)
                      return (
                        <FormItem>
                          <FormLabel>País</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un país" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {countries.map(country => (
                                <SelectItem key={country.value} value={country.value}>
                                  {country.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="utc"
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
                        <Input placeholder="https://tusitio.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="instagram"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instagram</FormLabel>
                      <FormControl>
                        <Input placeholder="@tusitio" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="image"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL de imagen principal</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/imagen.jpg" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="logo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL de logo</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/logo.jpg" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Configuración del WiFi</h3>
                <Separator />

                <FormField
                  control={form.control}
                  name="wifiName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del WiFi</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre de la red WiFi" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="wifiPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña del WiFi</FormLabel>
                      <FormControl>
                        <Input placeholder="Contraseña del WiFi" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-medium">Configuración del menú</h3>
                <Separator />

                <FormField
                  control={form.control}
                  name="dynamicMenu"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Menú dinámico</FormLabel>
                        <p className="text-sm text-muted-foreground">Habilitar menú dinámico para este venue</p>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="askNameOrdering"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Pedir nombre al ordenar</FormLabel>
                        <p className="text-sm text-muted-foreground">Solicitar nombre del cliente al realizar una orden</p>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ordering"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Ordenar desde TPV</FormLabel>
                        <p className="text-sm text-muted-foreground">Permite ordenar desde el Terminal Punto de Venta (solo lectura)</p>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Idioma por defecto</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'es'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un idioma" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="es">Español</SelectItem>
                          <SelectItem value="en">Inglés</SelectItem>
                          <SelectItem value="fr">Francés</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Configuración de propinas</h3>
                <Separator />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="tipPercentage1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Propina 1</FormLabel>
                        <FormControl>
                          <Input placeholder="0.10" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tipPercentage2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Propina 2</FormLabel>
                        <FormControl>
                          <Input placeholder="0.15" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tipPercentage3"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Propina 3</FormLabel>
                        <FormControl>
                          <Input placeholder="0.20" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-medium">Configuración de pagos</h3>
                <Separator />

                <FormField
                  control={form.control}
                  name="stripeAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID de cuenta Stripe</FormLabel>
                      <FormControl>
                        <Input placeholder="acct_..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="specialPayment"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Pago especial</FormLabel>
                        <p className="text-sm text-muted-foreground">Habilitar pago especial para este venue</p>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="specialPaymentRef"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referencia de pago especial</FormLabel>
                      <FormControl>
                        <Input placeholder="Referencia de pago especial" {...field} disabled={!form.watch('specialPayment')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Integración con POS</h3>
                <Separator />

                <FormField
                  control={form.control}
                  name="posName"
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
                          <SelectItem value={PosNames.WANSOFT}>Wansoft</SelectItem>
                          <SelectItem value={PosNames.SOFTRESTAURANT}>Soft Restaurant</SelectItem>
                          <SelectItem value={PosNames.NONE}>Ninguno</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="posUniqueId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID Único POS</FormLabel>
                      <FormControl>
                        <Input placeholder="ID único del sistema POS" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="softRestaurantVenueId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID de Soft Restaurant</FormLabel>
                      <FormControl>
                        <Input placeholder="ID de Soft Restaurant" {...field} disabled={form.watch('posName') !== 'SOFTRESTAURANT'} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-medium">Integraciones externas</h3>
                <Separator />

                <FormField
                  control={form.control}
                  name="googleBusinessId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID de Google Business</FormLabel>
                      <FormControl>
                        <Input placeholder="ID de Google Business" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="merchantIdA"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Menta Merchant ID A</FormLabel>
                      <FormControl>
                        <Input placeholder="Menta Merchant ID A" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="merchantIdB"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Menta Merchant ID B (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Menta Merchant ID B" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="apiKeyA"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Menta API Key A</FormLabel>
                      <FormControl>
                        <Input placeholder="Menta API Key A" {...field} type="password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="apiKeyB"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Menta API Key B (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Menta API Key B" {...field} type="password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
