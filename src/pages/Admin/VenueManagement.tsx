import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { themeClasses } from '@/lib/theme-utils'
import { useTheme } from '@/context/ThemeContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PlusCircle, Search, Edit, X, MapPin, CheckCircle, XCircle, Building, Users, Clock, Utensils, Loader2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Define types for venues and admins
interface Venue {
  id: string
  name: string
  address: string
  city?: string
  type: string
  status: 'active' | 'inactive'
  admins?: number
  waiters?: number
}

interface VenueAdmin {
  id: string
  name: string
  email: string
  role: string
  venueId: string
}

// Mock data for venues
const mockVenues = [
  {
    id: '1',
    name: 'Restaurante Madrid Centro',
    address: 'Calle Gran Vía 42, Madrid',
    status: 'active',
    type: 'restaurant',
    admins: 2,
    waiters: 8,
  },
  {
    id: '2',
    name: 'Bar Sevilla',
    address: 'Av. de la Constitución 15, Sevilla',
    status: 'active',
    type: 'bar',
    admins: 1,
    waiters: 4,
  },
  {
    id: '3',
    name: 'Cafetería Barcelona',
    address: 'Paseo de Gracia 34, Barcelona',
    status: 'inactive',
    type: 'cafe',
    admins: 1,
    waiters: 3,
  },
  {
    id: '4',
    name: 'Restaurante Valencia Playa',
    address: 'Paseo Marítimo 22, Valencia',
    status: 'active',
    type: 'restaurant',
    admins: 2,
    waiters: 10,
  },
  {
    id: '5',
    name: 'Pub Bilbao',
    address: 'Calle Ledesma 8, Bilbao',
    status: 'active',
    type: 'pub',
    admins: 1,
    waiters: 5,
  },
]

// Mock data for admins in a specific venue
const mockVenueAdmins = [
  { id: '1', name: 'Elena Martínez', email: 'elena@example.com', role: 'VENUEADMIN', venueId: '1' },
  { id: '2', name: 'Miguel Santos', email: 'miguel@example.com', role: 'ADMIN', venueId: '1' },
  { id: '3', name: 'Laura Fernández', email: 'laura@example.com', role: 'ADMIN', venueId: '2' },
  { id: '4', name: 'Carlos Ruíz', email: 'carlos@example.com', role: 'VENUEADMIN', venueId: '3' },
  { id: '5', name: 'Ana Gómez', email: 'ana@example.com', role: 'VENUEADMIN', venueId: '4' },
  { id: '6', name: 'Roberto Silva', email: 'roberto@example.com', role: 'ADMIN', venueId: '4' },
  { id: '7', name: 'Patricia Navarro', email: 'patricia@example.com', role: 'VENUEADMIN', venueId: '5' },
]

export default function VenueManagement() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [activeTab, setActiveTab] = useState('details')
  const isSuperAdmin = user?.role === 'SUPERADMIN'

  // Query to fetch all venues
  const { data: venues = [], isLoading: venuesLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: async () => {
      const response = await api.get('/v1/admin/venues')
      return response.data.data as Venue[] // Access the nested data property
    },
    enabled: isSuperAdmin,
  })

  // Query to fetch venue admins when a venue is selected
  const {
    data: venueAdmins = [],
    isLoading: adminsLoading,
    refetch: refetchAdmins,
  } = useQuery({
    queryKey: ['venue-admins', selectedVenue?.id],
    queryFn: async () => {
      if (!selectedVenue?.id) return []
      const response = await api.get(`/v1/admin/venues/${selectedVenue.id}/admins`)
      return response.data.data as VenueAdmin[] // Access the nested data property
    },
    enabled: !!selectedVenue?.id && isSuperAdmin,
  })
  // Filter venues based on search and filter criteria
  const filteredVenues =
    venues && venues.length > 0
      ? venues.filter(venue => {
          const matchesSearch =
            venue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (venue.address && venue.address.toLowerCase().includes(searchTerm.toLowerCase()))
          const matchesType = filterType !== 'all' ? venue.type === filterType : true
          return matchesSearch && matchesType
        })
      : []

  // Get admins for a specific venue
  const getVenueAdmins = venueId => {
    return mockVenueAdmins.filter(admin => admin.venueId === venueId)
  }

  // Mutation to toggle venue status
  const toggleVenueStatusMutation = useMutation({
    mutationFn: async ({ venueId, status }: { venueId: string; status: string }) => {
      return await api.patch(`/v1/admin/venues/${venueId}/status`, {
        status: status === 'active' ? 'inactive' : 'active',
      })
    },
    onSuccess: (response, variables) => {
      const newStatus = variables.status === 'active' ? 'inactive' : 'active'
      toast({
        title: `Venue ${newStatus === 'active' ? 'activado' : 'desactivado'}`,
        description: `El establecimiento ha sido ${newStatus === 'active' ? 'activado' : 'desactivado'} correctamente.`,
      })
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
    onError: error => {
      console.error('Error toggling venue status:', error)
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado del establecimiento.',
        variant: 'destructive',
      })
    },
  })

  // Mutation to create a new venue
  const createVenueMutation = useMutation({
    mutationFn: async (venueData: Partial<Venue>) => {
      return await api.post('/v1/admin/venues', venueData)
    },
    onSuccess: response => {
      toast({
        title: 'Venue creado',
        description: 'El nuevo establecimiento ha sido creado correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
    onError: error => {
      console.error('Error creating venue:', error)
      toast({
        title: 'Error',
        description: 'No se pudo crear el establecimiento.',
        variant: 'destructive',
      })
    },
  })

  // Mutation to add admin to venue
  const addVenueAdminMutation = useMutation({
    mutationFn: async ({ venueId, userData }: { venueId: string; userData: Partial<VenueAdmin> }) => {
      return await api.post(`/v1/admin/venues/${venueId}/admins`, userData)
    },
    onSuccess: () => {
      toast({
        title: 'Administrador añadido',
        description: 'El administrador ha sido asignado al establecimiento correctamente.',
      })
      if (selectedVenue?.id) {
        refetchAdmins()
      }
    },
    onError: error => {
      console.error('Error adding admin to venue:', error)
      toast({
        title: 'Error',
        description: 'No se pudo asignar el administrador al establecimiento.',
        variant: 'destructive',
      })
    },
  })

  // Handle venue status toggle
  const handleStatusToggle = (venueId: string, currentStatus: string) => {
    toggleVenueStatusMutation.mutate({ venueId, status: currentStatus })
  }

  // Handle opening details panel for a venue
  const openVenueDetails = (venue: Venue) => {
    setSelectedVenue(venue)
    setActiveTab('details')
  }

  // Create a new venue
  const handleCreateVenue = (data: any) => {
    createVenueMutation.mutate(data)
  }

  // Add admin to venue
  const handleAddAdmin = (venueId: string, userData: any) => {
    addVenueAdminMutation.mutate({ venueId, userData })
  }

  return (
    <div className={`space-y-6 h-screen ${themeClasses.contentBg}`}>
      <div className="flex justify-between items-start">
        <div>
          <h2 className={`text-2xl font-bold ${themeClasses.text}`}>Gestión de Establecimientos</h2>
          <p className={themeClasses.textMuted}>Administra los establecimientos y sus configuraciones</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Nuevo Establecimiento
            </Button>
          </DialogTrigger>
          <DialogContent className={`sm:max-w-[600px] ${themeClasses.cardBg} ${themeClasses.border}`}>
            <DialogHeader>
              <DialogTitle className={themeClasses.text}>Crear Nuevo Establecimiento</DialogTitle>
              <DialogDescription className={themeClasses.textMuted}>
                Completa los datos para crear un nuevo establecimiento en el sistema
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="name" className="text-right">
                  Nombre
                </label>
                <Input id="name" className="col-span-3" placeholder="Nombre del establecimiento" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="type" className="text-right">
                  Tipo
                </label>
                <Select>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restaurant">Restaurante</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="cafe">Cafetería</SelectItem>
                    <SelectItem value="pub">Pub</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="address" className="text-right">
                  Dirección
                </label>
                <Input id="address" className="col-span-3" placeholder="Dirección completa" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="phone" className="text-right">
                  Teléfono
                </label>
                <Input id="phone" type="tel" className="col-span-3" placeholder="+34 000 000 000" />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <label htmlFor="description" className="text-right pt-2">
                  Descripción
                </label>
                <Textarea id="description" className="col-span-3" placeholder="Descripción del establecimiento" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleCreateVenue} disabled={createVenueMutation.isPending}>
                {createVenueMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear Establecimiento'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Venues List Panel */}
        <div className="w-full lg:w-3/5 space-y-4">
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar establecimientos..."
                className={`pl-8 w-[250px] ${themeClasses.inputBg}`}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="restaurant">Restaurante</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="cafe">Cafetería</SelectItem>
                <SelectItem value="pub">Pub</SelectItem>
              </SelectContent>
            </Select>
            {filterType !== 'all' && (
              <Button variant="ghost" size="icon" onClick={() => setFilterType('all')} className="h-10 w-10">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className={`rounded-md ${themeClasses.border}`}>
            <Table className={themeClasses.table.bg}>
              <TableHeader className={themeClasses.table.headerBg}>
                <TableRow>
                  <TableHead className={themeClasses.table.cell}>Nombre</TableHead>
                  <TableHead className={themeClasses.table.cell}>Ubicación</TableHead>
                  <TableHead className={themeClasses.table.cell}>Tipo</TableHead>
                  <TableHead className={themeClasses.table.cell}>Estado</TableHead>
                  <TableHead className={`text-right ${themeClasses.table.cell}`}>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {venuesLoading ? (
                  Array(5)
                    .fill(0)
                    .map((_, index) => (
                      <TableRow key={`skeleton-${index}`}>
                        <TableCell>
                          <Skeleton className="h-6 w-full max-w-[180px]" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-full max-w-[220px]" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-16" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Skeleton className="h-8 w-24" />
                            <Skeleton className="h-8 w-8" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                ) : filteredVenues.length > 0 ? (
                  filteredVenues.map(venue => (
                    <TableRow key={venue.id} className={themeClasses.table.rowHover}>
                      <TableCell className={themeClasses.table.cell}>{venue.name}</TableCell>
                      <TableCell className={themeClasses.table.cell}>
                        <div className="flex items-center">
                          <MapPin className="mr-1 h-3 w-3 text-muted-foreground" />
                          {venue.address}
                        </div>
                      </TableCell>
                      <TableCell className={themeClasses.table.cell}>{venue.type}</TableCell>
                      <TableCell className={themeClasses.table.cell}>
                        <div className="flex items-center">
                          {venue.status === 'active' ? (
                            <CheckCircle className="mr-1 h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="mr-1 h-4 w-4 text-red-500" />
                          )}
                          {venue.status === 'active' ? 'Activo' : 'Inactivo'}
                        </div>
                      </TableCell>
                      <TableCell className={`text-right ${themeClasses.table.cell}`}>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusToggle(venue.id, venue.status)}
                            disabled={toggleVenueStatusMutation.isPending}
                          >
                            {toggleVenueStatusMutation.isPending && toggleVenueStatusMutation.variables?.venueId === venue.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : venue.status === 'active' ? (
                              'Desactivar'
                            ) : (
                              'Activar'
                            )}
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => openVenueDetails(venue)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      No se encontraron establecimientos con los criterios de búsqueda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className={themeClasses.textMuted + ' text-xs'}>
            Mostrando {filteredVenues.length} de {venues.length} establecimientos
          </div>
        </div>

        {/* Venue Details Panel */}
        <div className="w-full lg:w-2/5">
          {selectedVenue ? (
            <Card className={`${themeClasses.cardBg} ${themeClasses.border}`}>
              <CardHeader>
                <CardTitle className={themeClasses.text}>{selectedVenue.name}</CardTitle>
                <CardDescription className={themeClasses.textMuted}>
                  <div className="flex items-center text-sm">
                    <MapPin className="mr-1 h-3 w-3" /> {selectedVenue.address}
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full">
                    <TabsTrigger value="details" className="flex-1">
                      Detalles
                    </TabsTrigger>
                    <TabsTrigger value="admins" className="flex-1">
                      Administradores
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="flex-1">
                      Configuración
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col space-y-1">
                        <span className="text-sm font-semibold">Tipo</span>
                        <span className="text-sm capitalize">{selectedVenue.type}</span>
                      </div>
                      <div className="flex flex-col space-y-1">
                        <span className="text-sm font-semibold">Estado</span>
                        <span className="flex items-center text-sm">
                          {selectedVenue.status === 'active' ? (
                            <CheckCircle className="mr-1 h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="mr-1 h-3 w-3 text-red-500" />
                          )}
                          {selectedVenue.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <div className="flex flex-col space-y-1">
                        <span className="text-sm font-semibold">Administradores</span>
                        <span className="flex items-center text-sm">
                          <Users className="mr-1 h-3 w-3 text-blue-500" />
                          {selectedVenue.admins || 0}
                        </span>
                      </div>
                      <div className="flex flex-col space-y-1">
                        <span className="text-sm font-semibold">Camareros</span>
                        <span className="flex items-center text-sm">
                          <Users className="mr-1 h-3 w-3 text-green-500" />
                          {selectedVenue.waiters || 0}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <h4 className={`text-sm font-semibold ${themeClasses.text}`}>Estadísticas rápidas</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <Card className={`${themeClasses.border} ${themeClasses.cardBg}`}>
                          <CardContent className="flex flex-col items-center p-4">
                            <Clock className="h-5 w-5 text-blue-500 mb-1" />
                            <span className={`text-xl font-bold ${themeClasses.text}`}>24h</span>
                            <span className={themeClasses.textMuted + ' text-xs'}>Horario</span>
                          </CardContent>
                        </Card>
                        <Card className={`${themeClasses.border} ${themeClasses.cardBg}`}>
                          <CardContent className="flex flex-col items-center p-4">
                            <Utensils className="h-5 w-5 text-orange-500 mb-1" />
                            <span className={`text-xl font-bold ${themeClasses.text}`}>42</span>
                            <span className={themeClasses.textMuted + ' text-xs'}>Platos</span>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    <div className="pt-2 space-y-2">
                      <Button className="w-full">Editar Establecimiento</Button>
                      <Button variant="outline" className="w-full">
                        Ver en detalle
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="admins" className="pt-4">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className={`text-sm font-semibold ${themeClasses.text}`}>Administradores asignados</h4>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm">
                              <PlusCircle className="mr-2 h-3 w-3" />
                              Añadir
                            </Button>
                          </DialogTrigger>
                          <DialogContent className={`${themeClasses.cardBg} ${themeClasses.border}`}>
                            <DialogHeader>
                              <DialogTitle className={themeClasses.text}>Añadir Administrador</DialogTitle>
                              <DialogDescription className={themeClasses.textMuted}>
                                Asigna un administrador a este establecimiento
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <Select>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona un usuario" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user1">María López (maria@example.com)</SelectItem>
                                  <SelectItem value="user2">Javier Rodríguez (javier@example.com)</SelectItem>
                                  <SelectItem value="user3">Sara García (sara@example.com)</SelectItem>
                                </SelectContent>
                              </Select>
                              <Select>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona un rol" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="VENUEADMIN">Administrador de Venue</SelectItem>
                                  <SelectItem value="ADMIN">Administrador</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <DialogFooter>
                              <Button onClick={() => handleAddAdmin(selectedVenue.id, {})} disabled={addVenueAdminMutation.isPending}>
                                {addVenueAdminMutation.isPending ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Asignando...
                                  </>
                                ) : (
                                  'Asignar'
                                )}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>

                      <div className={`rounded-md ${themeClasses.border} overflow-hidden`}>
                        <Table className={themeClasses.table.bg}>
                          <TableHeader className={themeClasses.table.headerBg}>
                            <TableRow>
                              <TableHead className={themeClasses.table.cell}>Nombre</TableHead>
                              <TableHead className={themeClasses.table.cell}>Rol</TableHead>
                              <TableHead className={`text-right ${themeClasses.table.cell}`}>Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {adminsLoading ? (
                              Array(3)
                                .fill(0)
                                .map((_, index) => (
                                  <TableRow key={`admin-skeleton-${index}`}>
                                    <TableCell>
                                      <div className="space-y-2">
                                        <Skeleton className="h-5 w-32" />
                                        <Skeleton className="h-4 w-24" />
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Skeleton className="h-5 w-24" />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Skeleton className="h-8 w-16 ml-auto" />
                                    </TableCell>
                                  </TableRow>
                                ))
                            ) : venueAdmins.length > 0 ? (
                              venueAdmins.map(admin => (
                                <TableRow key={admin.id} className={themeClasses.table.rowHover}>
                                  <TableCell>
                                    <div>
                                      <div className={`font-medium ${themeClasses.text}`}>{admin.name}</div>
                                      <div className={themeClasses.textMuted + ' text-xs'}>{admin.email}</div>
                                    </div>
                                  </TableCell>
                                  <TableCell>{admin.role === 'VENUEADMIN' ? 'Admin de Venue' : 'Administrador'}</TableCell>
                                  <TableCell className={`text-right ${themeClasses.table.cell}`}>
                                    <Button variant="ghost" size="sm">
                                      Eliminar
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center">
                                  No hay administradores asignados a este establecimiento.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="settings" className="pt-4 space-y-4">
                    <div className="space-y-2">
                      <h4 className={`text-sm font-semibold ${themeClasses.text}`}>Configuración de establecimiento</h4>
                      <p className={themeClasses.textMuted + ' text-sm'}>Configura los parámetros específicos de este establecimiento.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Zona horaria</label>
                          <Select defaultValue="Europe/Madrid">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Europe/Madrid">Europe/Madrid</SelectItem>
                              <SelectItem value="Europe/London">Europe/London</SelectItem>
                              <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Moneda</label>
                          <Select defaultValue="EUR">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EUR">Euro (€)</SelectItem>
                              <SelectItem value="USD">Dólar ($)</SelectItem>
                              <SelectItem value="GBP">Libra (£)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Horario de operación</label>
                          <Select defaultValue="custom">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="24h">24 horas</SelectItem>
                              <SelectItem value="day">Diurno (8:00 - 20:00)</SelectItem>
                              <SelectItem value="night">Nocturno (18:00 - 4:00)</SelectItem>
                              <SelectItem value="custom">Personalizado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Button className="w-full">Guardar Configuración</Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className={`${themeClasses.cardBg} ${themeClasses.border} border-dashed`}>
              <CardContent className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                <Building className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className={`text-lg font-semibold ${themeClasses.text}`}>Selecciona un establecimiento</h3>
                  <p className={themeClasses.textMuted + ' text-sm'}>
                    Haz clic en el botón de editar junto a un establecimiento para ver y gestionar sus detalles.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
