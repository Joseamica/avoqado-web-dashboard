import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  getOrganizationsList,
  getOrganizationById,
  type OrganizationSimple,
} from '@/services/superadmin-organizations.service'
import { moduleAPI } from '@/services/superadmin-modules.service'
import {
  trainingAPI,
  type TrainingModule,
  type CreateTrainingData,
  type TrainingCategory,
  type TrainingStatus,
} from '@/services/superadmin-training.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import {
  BookOpen,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  Globe,
  GraduationCap,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ===========================================
// HELPERS
// ===========================================

const categoryLabels: Record<TrainingCategory, string> = {
  VENTAS: 'Ventas',
  INVENTARIO: 'Inventario',
  PAGOS: 'Pagos',
  ATENCION_CLIENTE: 'Atención al Cliente',
  GENERAL: 'General',
}

const categoryColors: Record<TrainingCategory, string> = {
  VENTAS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  INVENTARIO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PAGOS: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ATENCION_CLIENTE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  GENERAL: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
}

// ===========================================
// GLASS CARD COMPONENT
// ===========================================

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className, hover = false, onClick }) => (
  <div
    onClick={onClick}
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      hover && 'cursor-pointer hover:shadow-md hover:border-border hover:bg-card/90 hover:-translate-y-0.5',
      onClick && 'cursor-pointer',
      className,
    )}
  >
    {children}
  </div>
)

// ===========================================
// TRAINING MANAGEMENT PAGE
// ===========================================

const TrainingManagement: React.FC = () => {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const navigate = useNavigate()

  // Data fetching
  const { data: response, isLoading } = useQuery({
    queryKey: ['superadmin-trainings'],
    queryFn: () => trainingAPI.getAll({ limit: 100 }),
  })

  const { data: organizations = [] } = useQuery<OrganizationSimple[]>({
    queryKey: ['superadmin-organizations-list'],
    queryFn: getOrganizationsList,
  })

  const { data: modules = [] } = useQuery({
    queryKey: ['superadmin-modules'],
    queryFn: moduleAPI.getAllModules,
  })

  const trainings = response?.data || []

  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<TrainingStatus | 'ALL'>('ALL')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTraining, setSelectedTraining] = useState<TrainingModule | null>(null)
  const [venueScope, setVenueScope] = useState<'all' | 'specific'>('all')
  const [orgVenues, setOrgVenues] = useState<Array<{ id: string; name: string }>>([])
  const [isLoadingVenues, setIsLoadingVenues] = useState(false)
  const [formData, setFormData] = useState<CreateTrainingData>({
    title: '',
    description: '',
    category: 'GENERAL',
    difficulty: 'BASIC',
    estimatedMinutes: 5,
    isRequired: false,
    organizationId: null,
    venueIds: [],
    featureTags: [],
  })

  // Fetch venues when org changes
  useEffect(() => {
    if (!formData.organizationId) {
      setOrgVenues([])
      setVenueScope('all')
      setFormData(prev => ({ ...prev, venueIds: [] }))
      return
    }

    setIsLoadingVenues(true)
    getOrganizationById(formData.organizationId)
      .then(org => {
        setOrgVenues(org.venues.map(v => ({ id: v.id, name: v.name })))
      })
      .catch(() => setOrgVenues([]))
      .finally(() => setIsLoadingVenues(false))
  }, [formData.organizationId])

  // Filtered data
  const filteredTrainings = useMemo(() => {
    return trainings.filter(t => {
      const matchesSearch =
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [trainings, searchTerm, statusFilter])

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateTrainingData) => {
      const finalData = { ...data }
      if (venueScope === 'all') {
        finalData.venueIds = []
      }
      return trainingAPI.create(finalData)
    },
    onSuccess: data => {
      toast({ title: 'Entrenamiento creado', description: `"${data.title}" creado exitosamente.` })
      queryClient.invalidateQueries({ queryKey: ['superadmin-trainings'] })
      setIsCreateModalOpen(false)
      resetForm()
      navigate(`/superadmin/trainings/${data.id}`)
    },
    onError: (error: any) => {
      toast({
        title: 'Error al crear',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => trainingAPI.remove(id),
    onSuccess: () => {
      toast({ title: 'Eliminado', description: 'Entrenamiento eliminado correctamente.' })
      queryClient.invalidateQueries({ queryKey: ['superadmin-trainings'] })
      setIsDeleteDialogOpen(false)
      setSelectedTraining(null)
    },
    onError: (error: any) => {
      toast({
        title: 'Error al eliminar',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'GENERAL',
      difficulty: 'BASIC',
      estimatedMinutes: 5,
      isRequired: false,
      organizationId: null,
      venueIds: [],
      featureTags: [],
    })
    setVenueScope('all')
    setOrgVenues([])
  }

  const handleOpenDeleteDialog = (training: TrainingModule) => {
    setSelectedTraining(training)
    setIsDeleteDialogOpen(true)
  }

  const handleToggleFeatureTag = (tag: string) => {
    setFormData(prev => {
      const current = prev.featureTags || []
      const updated = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]
      return { ...prev, featureTags: updated }
    })
  }

  const handleToggleVenue = (venueId: string) => {
    setFormData(prev => {
      const current = prev.venueIds || []
      const updated = current.includes(venueId) ? current.filter(v => v !== venueId) : [...current, venueId]
      return { ...prev, venueIds: updated }
    })
  }

  // Stats
  const totalPublished = trainings.filter(t => t.status === 'PUBLISHED').length
  const totalDraft = trainings.filter(t => t.status === 'DRAFT').length
  const totalRequired = trainings.filter(t => t.isRequired).length

  // Columns
  const columns: ColumnDef<TrainingModule>[] = [
    {
      accessorKey: 'title',
      header: 'Entrenamiento',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.coverImageUrl ? (
            <img
              src={row.original.coverImageUrl}
              alt={row.original.title}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5">
              <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
          )}
          <div>
            <div className="font-medium">{row.original.title}</div>
            <div className="text-xs text-muted-foreground line-clamp-1">{row.original.description}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Categoría',
      cell: ({ row }) => (
        <Badge variant="outline" className={cn('text-xs', categoryColors[row.original.category])}>
          {categoryLabels[row.original.category]}
        </Badge>
      ),
    },
    {
      id: 'organization',
      header: 'Organización',
      cell: ({ row }) =>
        row.original.organization ? (
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3 text-muted-foreground" />
            <span className="text-sm truncate max-w-[120px]">{row.original.organization.name}</span>
            {(row.original.venueIds || []).length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                <MapPin className="w-2.5 h-2.5 mr-0.5" />
                {row.original.venueIds.length}
              </Badge>
            )}
          </div>
        ) : (
          <Badge variant="outline" className="text-xs">
            <Globe className="w-3 h-3 mr-1" />
            Global
          </Badge>
        ),
    },
    {
      id: 'content',
      header: 'Contenido',
      cell: ({ row }) => (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{row.original._count.steps} pasos</span>
          <span>&middot;</span>
          <span>{row.original._count.quizQuestions} preguntas</span>
        </div>
      ),
    },
    {
      accessorKey: 'featureTags',
      header: 'Tags',
      cell: ({ row }) =>
        row.original.featureTags.length > 0 ? (
          <div className="flex gap-1 flex-wrap">
            {row.original.featureTags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'PUBLISHED' ? 'default' : 'secondary'}>
          {row.original.status === 'PUBLISHED' ? 'Publicado' : 'Borrador'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => (
        <div onClick={e => e.stopPropagation()}>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={5} className="w-48">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => navigate(`/superadmin/trainings/${row.original.id}`)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={() => handleOpenDeleteDialog(row.original)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Entrenamientos</h1>
          <p className="text-muted-foreground">
            Administra módulos de capacitación para el personal de las sucursales.
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="cursor-pointer">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo entrenamiento
        </Button>
      </div>

      {/* Statistics - Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total de Módulos</p>
              <p className="text-3xl font-bold tracking-tight mt-1">{trainings.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Entrenamientos creados</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5">
              <BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Publicados</p>
              <p className="text-3xl font-bold tracking-tight mt-1">{totalPublished}</p>
              <p className="text-xs text-muted-foreground mt-1">Visibles en TPV</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
              <Eye className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Borradores</p>
              <p className="text-3xl font-bold tracking-tight mt-1">{totalDraft}</p>
              <p className="text-xs text-muted-foreground mt-1">En preparación</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-500/5">
              <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Obligatorios</p>
              <p className="text-3xl font-bold tracking-tight mt-1">{totalRequired}</p>
              <p className="text-xs text-muted-foreground mt-1">Requeridos para el personal</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/5">
              <CheckCircle2 className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Trainings Table */}
      <GlassCard className="overflow-hidden">
        <div className="p-5 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5">
              <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="font-semibold">Catálogo de Entrenamientos</h2>
              <p className="text-sm text-muted-foreground">Módulos de capacitación disponibles en la plataforma.</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Buscar por título o descripción..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
            <div className="flex gap-1">
              {(['ALL', 'PUBLISHED', 'DRAFT'] as const).map(status => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => setStatusFilter(status)}
                >
                  {status === 'ALL' ? 'Todos' : status === 'PUBLISHED' ? 'Publicados' : 'Borradores'}
                </Button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="py-8 text-sm text-muted-foreground text-center">Cargando entrenamientos...</div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredTrainings}
              pagination={{ pageIndex: 0, pageSize: 20 }}
              setPagination={() => {}}
              rowCount={filteredTrainings.length}
              onRowClick={row => navigate(`/superadmin/trainings/${row.id}`)}
            />
          )}
        </div>
      </GlassCard>

      {/* Create Modal (Full Screen) */}
      <FullScreenModal
        open={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          resetForm()
        }}
        title="Nuevo Entrenamiento"
        actions={
          <Button
            onClick={() => createMutation.mutate(formData)}
            disabled={createMutation.isPending || !formData.title || !formData.description}
            className="cursor-pointer"
          >
            {createMutation.isPending ? 'Creando...' : 'Crear y editar'}
          </Button>
        }
      >
        <div className="mx-auto max-w-2xl p-6 space-y-8">
          {/* Section: Basic info */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Información básica</h2>
              <p className="text-sm text-muted-foreground">
                Define el título, descripción y configuración general del entrenamiento.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-title">Título</Label>
              <Input
                id="create-title"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Cómo procesar un pago"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-description">Descripción</Label>
              <Textarea
                id="create-description"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe brevemente el contenido del entrenamiento..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-category">Categoría</Label>
                <select
                  id="create-category"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                  value={formData.category}
                  onChange={e => setFormData(prev => ({ ...prev, category: e.target.value as TrainingCategory }))}
                >
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-difficulty">Dificultad</Label>
                <select
                  id="create-difficulty"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                  value={formData.difficulty}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, difficulty: e.target.value as 'BASIC' | 'INTERMEDIATE' }))
                  }
                >
                  <option value="BASIC">Básico</option>
                  <option value="INTERMEDIATE">Intermedio</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-duration">Duración estimada (min)</Label>
                <Input
                  id="create-duration"
                  type="number"
                  min={1}
                  max={480}
                  value={formData.estimatedMinutes}
                  onChange={e => setFormData(prev => ({ ...prev, estimatedMinutes: Number(e.target.value) }))}
                />
              </div>
              <div className="flex items-center justify-between pt-7">
                <Label htmlFor="create-required" className="cursor-pointer">
                  Obligatorio
                </Label>
                <Switch
                  id="create-required"
                  checked={formData.isRequired}
                  onCheckedChange={checked => setFormData(prev => ({ ...prev, isRequired: checked }))}
                />
              </div>
            </div>
          </div>

          {/* Section: Organization assignment */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Asignación</h2>
              <p className="text-sm text-muted-foreground">
                Define a qué organización pertenece este entrenamiento. Si es global, estará disponible para todas.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-org">Organización</Label>
              <select
                id="create-org"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                value={formData.organizationId ?? ''}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    organizationId: e.target.value === '' ? null : e.target.value,
                  }))
                }
              >
                <option value="">Global (todas las organizaciones)</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.venueCount} sucursales)
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Los entrenamientos globales se muestran a todas las organizaciones. Los específicos solo a la seleccionada.
              </p>
            </div>

            {formData.organizationId && (
              <div className="space-y-3">
                <Label>Sucursales</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={venueScope === 'all' ? 'default' : 'outline'}
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => {
                      setVenueScope('all')
                      setFormData(prev => ({ ...prev, venueIds: [] }))
                    }}
                  >
                    Todas las sucursales
                  </Button>
                  <Button
                    type="button"
                    variant={venueScope === 'specific' ? 'default' : 'outline'}
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => setVenueScope('specific')}
                  >
                    Sucursales específicas
                  </Button>
                </div>

                {venueScope === 'specific' && (
                  <div className="space-y-2">
                    {isLoadingVenues ? (
                      <p className="text-sm text-muted-foreground">Cargando sucursales...</p>
                    ) : orgVenues.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {orgVenues.map(venue => {
                          const isSelected = (formData.venueIds || []).includes(venue.id)
                          return (
                            <button
                              key={venue.id}
                              type="button"
                              onClick={() => handleToggleVenue(venue.id)}
                              className={cn(
                                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer',
                                isSelected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30',
                              )}
                            >
                              <MapPin className="w-3 h-3" />
                              {venue.name}
                              {isSelected && <X className="w-3 h-3" />}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No hay sucursales en esta organización.</p>
                    )}
                    {(formData.venueIds || []).length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {formData.venueIds!.length} sucursal(es) seleccionada(s)
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section: Feature tags */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Tags de módulos</h2>
              <p className="text-sm text-muted-foreground">
                Selecciona los módulos relacionados. Solo las organizaciones con estos módulos activos verán el
                entrenamiento. Si no seleccionas ninguno, será visible para todos.
              </p>
            </div>

            {modules.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {modules.map(mod => {
                  const isSelected = (formData.featureTags || []).includes(mod.code)
                  return (
                    <button
                      key={mod.code}
                      type="button"
                      onClick={() => handleToggleFeatureTag(mod.code)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30',
                      )}
                    >
                      <Tag className="w-3 h-3" />
                      {mod.code}
                      {isSelected && <X className="w-3 h-3" />}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay módulos disponibles.</p>
            )}

            {(formData.featureTags || []).length > 0 && (
              <p className="text-xs text-muted-foreground">
                {formData.featureTags!.length} tag(s) seleccionado(s): solo organizaciones con al menos uno de estos módulos verán este entrenamiento.
              </p>
            )}
          </div>
        </div>
      </FullScreenModal>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/20 to-red-500/5">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              Eliminar Entrenamiento
            </DialogTitle>
            <DialogDescription>
              Se eliminará <strong>{selectedTraining?.title}</strong> junto con todos sus pasos, preguntas y progreso.
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="cursor-pointer">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedTraining && deleteMutation.mutate(selectedTraining.id)}
              disabled={deleteMutation.isPending}
              className="cursor-pointer"
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TrainingManagement
