import api from '@/api'
import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, CheckCircle, Loader2, MapPin, PlusCircle, Search, X, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'

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
  const { t } = useTranslation()
  const { toast } = useToast()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [activeTab] = useState('details')
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

  // Suppress unused variable warnings for variables that may be used in commented-out sections
  void venueAdmins
  void adminsLoading
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
      const statusKey = newStatus === 'active' ? 'activated' : 'deactivated'
      toast({
        title: t(`admin.venueManagement.toast.${statusKey}`),
        description: t(`admin.venueManagement.toast.${statusKey}Desc`),
      })
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
    onError: error => {
      console.error('Error toggling venue status:', error)
      toast({
        title: t('admin.venueManagement.toast.statusError'),
        description: t('admin.venueManagement.toast.statusErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Mutation to create a new venue
  const createVenueMutation = useMutation({
    mutationFn: async (venueData: Partial<Venue>) => {
      return await api.post('/v1/admin/venues', venueData)
    },
    onSuccess: () => {
      toast({
        title: t('admin.venueManagement.toast.created'),
        description: t('admin.venueManagement.toast.createdDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
    onError: error => {
      console.error('Error creating venue:', error)
      toast({
        title: t('admin.venueManagement.toast.createError'),
        description: t('admin.venueManagement.toast.createErrorDesc'),
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
        title: t('admin.venueManagement.toast.adminAdded'),
        description: t('admin.venueManagement.toast.adminAddedDesc'),
      })
      if (selectedVenue?.id) {
        refetchAdmins()
      }
    },
    onError: error => {
      console.error('Error adding admin to venue:', error)
      toast({
        title: t('admin.venueManagement.toast.createError'),
        description: t('admin.venueManagement.toast.adminAddError'),
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
    // setActiveTab('details') - commented out since setActiveTab is not available
  }

  // Suppress unused variable warnings
  void openVenueDetails
  void activeTab

  // Create a new venue
  const handleCreateVenue = (data: any) => {
    createVenueMutation.mutate(data)
  }

  // Add admin to venue
  const handleAddAdmin = (venueId: string, userData: any) => {
    addVenueAdminMutation.mutate({ venueId, userData })
  }

  // Suppress unused variable warning
  void handleAddAdmin

  return (
    <div className={`space-y-4 h-screen bg-background p-4 md:p-6 lg:p-8`}>
      <Link to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t('admin.venueManagement.backToAdmin')}
      </Link>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-foreground">{t('admin.venueManagement.title')}</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              {t('admin.venueManagement.newVenue')}
            </Button>
          </DialogTrigger>
          <DialogContent className={`sm:max-w-[600px] bg-card border-border`}>
            <DialogHeader>
              <DialogTitle className="text-foreground">{t('admin.venueManagement.dialog.create.title')}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {t('admin.venueManagement.dialog.create.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="name" className="text-right">
                  {t('admin.venueManagement.dialog.create.name')}
                </label>
                <Input id="name" className="col-span-3" placeholder={t('admin.venueManagement.dialog.create.namePlaceholder')} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="type" className="text-right">
                  {t('admin.venueManagement.dialog.create.type')}
                </label>
                <Select>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder={t('admin.venueManagement.dialog.create.typePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restaurant">{t('admin.venueManagement.types.restaurant')}</SelectItem>
                    <SelectItem value="bar">{t('admin.venueManagement.types.bar')}</SelectItem>
                    <SelectItem value="cafe">{t('admin.venueManagement.types.cafe')}</SelectItem>
                    <SelectItem value="pub">{t('admin.venueManagement.types.pub')}</SelectItem>
                    <SelectItem value="other">{t('admin.venueManagement.types.other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="address" className="text-right">
                  {t('admin.venueManagement.dialog.create.address')}
                </label>
                <Input id="address" className="col-span-3" placeholder={t('admin.venueManagement.dialog.create.addressPlaceholder')} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="phone" className="text-right">
                  {t('admin.venueManagement.dialog.create.phone')}
                </label>
                <Input id="phone" type="tel" className="col-span-3" placeholder={t('admin.venueManagement.dialog.create.phonePlaceholder')} />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <label htmlFor="description" className="text-right pt-2">
                  {t('common.description')}
                </label>
                <Textarea id="description" className="col-span-3" placeholder={t('admin.venueManagement.dialog.create.descriptionPlaceholder')} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleCreateVenue} disabled={createVenueMutation.isPending}>
                {createVenueMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('admin.venueManagement.dialog.create.creating')}
                  </>
                ) : (
                  t('admin.venueManagement.dialog.create.create')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className={`bg-card rounded-xl shadow-sm`}>
        <CardContent className="p-4">
          <div className="flex gap-2 mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t('admin.venueManagement.searchPlaceholder')}
                className={`pl-8 w-[250px] bg-input`}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('admin.venueManagement.filterByType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.venueManagement.allTypes')}</SelectItem>
                <SelectItem value="restaurant">{t('admin.venueManagement.types.restaurant')}</SelectItem>
                <SelectItem value="bar">{t('admin.venueManagement.types.bar')}</SelectItem>
                <SelectItem value="cafe">{t('admin.venueManagement.types.cafe')}</SelectItem>
                <SelectItem value="pub">{t('admin.venueManagement.types.pub')}</SelectItem>
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
                header: t('admin.venueManagement.table.name'),
                cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
              },
              {
                accessorKey: 'address',
                header: t('admin.venueManagement.table.location'),
                cell: ({ row }) => (
                  <div className="flex items-center">
                    <MapPin className="mr-1 h-3 w-3 text-muted-foreground" />
                    {row.original.address}
                  </div>
                ),
              },
              {
                accessorKey: 'type',
                header: t('admin.venueManagement.table.type'),
                cell: ({ row }) => <div>{row.original.type}</div>,
              },
              {
                accessorKey: 'status',
                header: t('admin.venueManagement.table.status'),
                cell: ({ row }) => (
                  <div
                    className={`flex items-center ${
                      row.original.status === 'active' ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {row.original.status === 'active' ? <CheckCircle className="mr-1 h-4 w-4" /> : <XCircle className="mr-1 h-4 w-4" />}
                    {row.original.status === 'active' ? t('admin.venueManagement.table.active') : t('admin.venueManagement.table.inactive')}
                  </div>
                ),
              },
              {
                id: 'actions',
                header: () => <div className="text-right">{t('admin.venueManagement.table.actions')}</div>,
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
                        t('admin.venueManagement.table.deactivate')
                      ) : (
                        t('admin.venueManagement.table.activate')
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
                tableId="admin:venues"
                clickableRow={row => ({
                  to: `${row.id}`,
                  state: { from: location.pathname },
                })}
              />
            )
          })()}

          <div className="text-xs text-muted-foreground mt-2">
            {t('admin.venueManagement.showing', { filtered: filteredVenues.length, total: venues.length })}
          </div>
        </CardContent>
      </Card>

      {/* {selectedVenue && (
        <div className="mt-6">
          <Card className={`${bg-card} ${border-border}`}>
            <CardHeader>
              <CardTitle className="text-foreground">{selectedVenue.name}</CardTitle>
              <CardDescription className="text-muted-foreground">
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
                    <h4 className="text-sm font-semibold text-foreground">Estadísticas rápidas</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Card className={`${border-border} ${bg-card}`}>
                        <CardContent className="flex flex-col items-center p-4">
                          <Clock className="h-5 w-5 text-blue-500 mb-1" />
                          <span className="text-xl font-bold text-foreground">24h</span>
                          <span className="text-muted-foreground text-xs">Horario</span>
                        </CardContent>
                      </Card>
                      <Card className={`${border-border} ${bg-card}`}>
                        <CardContent className="flex flex-col items-center p-4">
                          <Utensils className="h-5 w-5 text-orange-500 mb-1" />
                          <span className="text-xl font-bold text-foreground">42</span>
                          <span className="text-muted-foreground text-xs">Platos</span>
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
                      <h4 className="text-sm font-semibold text-foreground">Administradores asignados</h4>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <PlusCircle className="mr-2 h-3 w-3" />
                            Añadir
                          </Button>
                        </DialogTrigger>
                        <DialogContent className={`${bg-card} ${border-border}`}>
                          <DialogHeader>
                            <DialogTitle className="text-foreground">Añadir Administrador</DialogTitle>
                            <DialogDescription className="text-muted-foreground">
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

                    <div className={`rounded-md ${border-border} overflow-hidden`}>
                      <Table className={""}>
                        <TableHeader className={""}>
                          <TableRow>
                            <TableHead className={""}>Nombre</TableHead>
                            <TableHead className={""}>Rol</TableHead>
                            <TableHead className={`text-right ${""}`}>Acciones</TableHead>
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
                              <TableRow key={admin.id} className={"hover:bg-muted/50"}>
                                <TableCell>
                                  <div>
                                    <div className="font-medium text-foreground">{admin.name}</div>
                                    <div className="text-muted-foreground text-xs">{admin.email}</div>
                                  </div>
                                </TableCell>
                                <TableCell>{admin.role === 'VENUEADMIN' ? 'Admin de Venue' : 'Administrador'}</TableCell>
                                <TableCell className={`text-right ${""}`}>
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
                    <h4 className="text-sm font-semibold text-foreground">Configuración de establecimiento</h4>
                    <p className="text-muted-foreground text-sm">Configura los parámetros específicos de este establecimiento.</p>
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
