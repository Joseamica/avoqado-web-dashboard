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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  PlusCircle,
  Search,
  Edit,
  X,
  MapPin,
  CheckCircle,
  XCircle,
  Building,
  Users,
  Clock,
  Utensils,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, Link } from 'react-router-dom'
import DataTable from '@/components/data-table'
import { ColumnDef } from '@tanstack/react-table'

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

export default function VenueManagement() {
  const { toast } = useToast()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [activeTab, setActiveTab] = useState('details')
  const isSuperAdmin = user?.role === 'SUPERADMIN'
  const location = useLocation()

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
    <div className={`space-y-4 h-screen ${themeClasses.pageBg} p-4 md:p-6 lg:p-8`}>
      <Link to="/admin" className={`inline-flex items-center text-sm ${themeClasses.textMuted} hover:${themeClasses.text} mb-4`}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Volver al Panel de Administración
      </Link>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-2xl font-bold ${themeClasses.text}`}>Gestión de Establecimientos</h2>
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

      <Card className={`${themeClasses.cardBg} rounded-xl shadow-sm`}>
        <CardContent className="p-4">
          <div className="flex gap-2 mb-4">
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

          {/* Define columns for DataTable */}
          {(() => {
            const columns: ColumnDef<Venue>[] = [
              {
                accessorKey: 'name',
                header: 'Nombre',
                cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
              },
              {
                accessorKey: 'address',
                header: 'Ubicación',
                cell: ({ row }) => (
                  <div className="flex items-center">
                    <MapPin className="mr-1 h-3 w-3 text-muted-foreground" />
                    {row.original.address}
                  </div>
                ),
              },
              {
                accessorKey: 'type',
                header: 'Tipo',
                cell: ({ row }) => <div>{row.original.type}</div>,
              },
              {
                accessorKey: 'status',
                header: 'Estado',
                cell: ({ row }) => (
                  <div
                    className={`flex items-center ${
                      row.original.status === 'active' ? themeClasses.success.text : themeClasses.error.text
                    }`}
                  >
                    {row.original.status === 'active' ? <CheckCircle className="mr-1 h-4 w-4" /> : <XCircle className="mr-1 h-4 w-4" />}
                    {row.original.status === 'active' ? 'Activo' : 'Inactivo'}
                  </div>
                ),
              },
              {
                id: 'actions',
                header: () => <div className="text-right">Acciones</div>,
                cell: ({ row }) => (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={e => {
                        e.stopPropagation()
                        handleStatusToggle(row.original.id, row.original.status)
                      }}
                      disabled={toggleVenueStatusMutation.isPending}
                    >
                      {toggleVenueStatusMutation.isPending && toggleVenueStatusMutation.variables?.venueId === row.original.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : row.original.status === 'active' ? (
                        'Desactivar'
                      ) : (
                        'Activar'
                      )}
                    </Button>
                    {/* <Button
                      variant="outline"
                      size="icon"
                      onClick={e => {
                        e.stopPropagation()
                        openVenueDetails(row.original)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button> */}
                  </div>
                ),
              },
            ]

            return (
              <DataTable
                data={filteredVenues}
                rowCount={venues.length}
                columns={columns}
                isLoading={venuesLoading}
                clickableRow={row => ({
                  to: `${row.id}`,
                  state: { from: location.pathname },
                })}
              />
            )
          })()}

          <div className={`text-xs ${themeClasses.textMuted} mt-2`}>
            Mostrando {filteredVenues.length} de {venues.length} establecimientos
          </div>
        </CardContent>
      </Card>

      {/* {selectedVenue && (
        <div className="mt-6">
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
        </div>
      )} */}
    </div>
  )
}
