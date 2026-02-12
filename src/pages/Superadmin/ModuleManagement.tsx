import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { moduleAPI, type Module, type CreateModuleData, type UpdateModuleData } from '@/services/superadmin-modules.service'
import { updateOrganizationModuleConfig } from '@/services/superadmin-organizations.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Building2, Boxes, CheckCircle2, Eye, MoreHorizontal, Package, Pencil, Plus, Trash2, Sparkles, Settings2 } from 'lucide-react'
import type { WhiteLabelConfig } from '@/types/white-label'
import { Switch } from '@/components/ui/switch'
import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'

// Lazy load WhiteLabelWizard to avoid loading it for all users
const WhiteLabelWizard = lazy(() => import('@/pages/Superadmin/WhiteLabelBuilder/WhiteLabelWizard'))
// Lazy load ModuleCreationWizard (v2 interactive wizard)
const ModuleCreationWizard = lazy(() => import('@/pages/Superadmin/components/ModuleCreationWizard'))
// Lazy load ModuleOrganizationDialog
const ModuleOrganizationDialog = lazy(() => import('@/pages/Superadmin/components/ModuleOrganizationDialog'))

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
// JSON BOOLEAN TOGGLES (dynamic preview)
// Parses a JSON string and renders toggles for all boolean fields.
// Toggles sync back to the JSON string in real time.
// ===========================================

interface JsonBooleanTogglesProps {
  jsonString: string
  onChange: (updatedJson: string) => void
}

const JsonBooleanToggles: React.FC<JsonBooleanTogglesProps> = ({ jsonString, onChange }) => {
  const booleanEntries = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonString)
      if (typeof parsed !== 'object' || parsed === null) return []

      const entries: { section: string; key: string; value: boolean }[] = []
      for (const [section, sectionValue] of Object.entries(parsed)) {
        if (typeof sectionValue === 'object' && sectionValue !== null && !Array.isArray(sectionValue)) {
          for (const [key, val] of Object.entries(sectionValue as Record<string, unknown>)) {
            if (typeof val === 'boolean') {
              entries.push({ section, key, value: val })
            }
          }
        }
      }
      return entries
    } catch {
      return []
    }
  }, [jsonString])

  const handleToggle = useCallback(
    (section: string, key: string, newValue: boolean) => {
      try {
        const parsed = JSON.parse(jsonString)
        parsed[section][key] = newValue
        onChange(JSON.stringify(parsed, null, 2))
      } catch {
        // JSON invalid, ignore
      }
    },
    [jsonString, onChange],
  )

  if (booleanEntries.length === 0) return null

  // Group by section
  const grouped = booleanEntries.reduce(
    (acc, entry) => {
      if (!acc[entry.section]) acc[entry.section] = []
      acc[entry.section].push(entry)
      return acc
    },
    {} as Record<string, typeof booleanEntries>,
  )

  // Human-readable labels for known keys
  const labelMap: Record<string, string> = {
    enablePortabilidad: 'Portabilidad',
    allowUnregisteredSale: 'Venta sin registro',
    requireCategorySelection: 'Requiere categoría',
    showStockCounts: 'Mostrar stock',
    simplifiedOrderFlow: 'Flujo simplificado',
    skipTipScreen: 'Saltar propina',
    skipReviewScreen: 'Saltar reseña',
    enableShifts: 'Turnos habilitados',
    requireClockInPhoto: 'Foto al entrar',
    requireClockInGps: 'GPS al entrar',
    requireClockOutPhoto: 'Foto al salir',
    requireClockOutGps: 'GPS al salir',
  }

  const sectionLabelMap: Record<string, string> = {
    features: 'Funcionalidades',
    ui: 'Interfaz',
    attendance: 'Asistencia',
    labels: 'Etiquetas',
  }

  return (
    <div className="mt-3 space-y-3">
      {Object.entries(grouped).map(([section, entries]) => (
        <div key={section} className="rounded-lg border border-border/50 p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{sectionLabelMap[section] || section}</p>
          {entries.map(({ key, value }) => (
            <div key={`${section}-${key}`} className="flex items-center justify-between py-1">
              <Label htmlFor={`toggle-${section}-${key}`} className="text-sm cursor-pointer">
                {labelMap[key] || key}
              </Label>
              <Switch id={`toggle-${section}-${key}`} checked={value} onCheckedChange={checked => handleToggle(section, key, checked)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ===========================================
// STATUS PULSE COMPONENT
// ===========================================

const StatusPulse: React.FC<{ status: 'success' | 'warning' | 'error' | 'neutral' }> = ({ status }) => {
  const colors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    neutral: 'bg-muted',
  }
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', colors[status])} />
      <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', colors[status])} />
    </span>
  )
}

// ===========================================
// MODULE MANAGEMENT PAGE
// ===========================================

const ModuleManagement: React.FC = () => {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Fetch all modules
  const { data: modules = [], isLoading } = useQuery({
    queryKey: ['superadmin-modules'],
    queryFn: moduleAPI.getAllModules,
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedModule, setSelectedModule] = useState<Module | null>(null)
  const [isVenueDialogOpen, setIsVenueDialogOpen] = useState(false)

  // Create/Edit module state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [moduleToEdit, setModuleToEdit] = useState<Module | null>(null)
  const [moduleToDelete, setModuleToDelete] = useState<Module | null>(null)

  // White-Label Wizard state
  const [isWhiteLabelWizardOpen, setIsWhiteLabelWizardOpen] = useState(false)
  const [selectedVenueForWizard, setSelectedVenueForWizard] = useState<{ id: string; name: string } | null>(null)
  const [selectedOrgForWizard, setSelectedOrgForWizard] = useState<{ id: string; name: string; initialConfig?: WhiteLabelConfig } | null>(
    null,
  )

  // Module Creation Wizard v2 state
  const [isModuleWizardOpen, setIsModuleWizardOpen] = useState(false)

  // Form state for create/edit
  const [formData, setFormData] = useState<{
    code: string
    name: string
    description: string
    defaultConfig: string
    presets: string
  }>({
    code: '',
    name: '',
    description: '',
    defaultConfig: '{}',
    presets: '{}',
  })

  // Filter modules based on search
  const filteredModules = useMemo(() => {
    return modules.filter(module => {
      const matchesSearch =
        module.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        module.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (module.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
      return matchesSearch
    })
  }, [modules, searchTerm])

  // Create module mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateModuleData) => moduleAPI.createModule(data),
    onSuccess: data => {
      toast({ title: 'Módulo creado', description: `El módulo "${data.module.name}" ha sido creado exitosamente.` })
      queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })
      setIsCreateDialogOpen(false)
      resetFormData()
    },
    onError: (error: any) => {
      toast({
        title: 'Error al crear módulo',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Update module mutation
  const updateMutation = useMutation({
    mutationFn: ({ moduleId, data }: { moduleId: string; data: UpdateModuleData }) => moduleAPI.updateModule(moduleId, data),
    onSuccess: data => {
      toast({ title: 'Módulo actualizado', description: `El módulo "${data.module.name}" ha sido actualizado.` })
      queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })
      setIsEditDialogOpen(false)
      setModuleToEdit(null)
      resetFormData()
    },
    onError: (error: any) => {
      toast({
        title: 'Error al actualizar módulo',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Delete module mutation
  const deleteMutation = useMutation({
    mutationFn: (moduleId: string) => moduleAPI.deleteModule(moduleId),
    onSuccess: data => {
      toast({ title: 'Módulo eliminado', description: data.message })
      queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })
      setIsDeleteDialogOpen(false)
      setModuleToDelete(null)
    },
    onError: (error: any) => {
      toast({
        title: 'Error al eliminar módulo',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  const resetFormData = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      defaultConfig: '{}',
      presets: '{}',
    })
  }

  const handleViewVenues = (module: Module) => {
    setSelectedModule(module)
    setIsVenueDialogOpen(true)
  }

  const handleOpenCreateDialog = () => {
    resetFormData()
    setIsCreateDialogOpen(true)
  }

  const handleOpenEditDialog = (module: Module) => {
    setModuleToEdit(module)
    setFormData({
      code: module.code,
      name: module.name,
      description: module.description || '',
      defaultConfig: JSON.stringify(module.defaultConfig || {}, null, 2),
      presets: JSON.stringify(module.presets || {}, null, 2),
    })
    setIsEditDialogOpen(true)
  }

  const handleOpenDeleteDialog = (module: Module) => {
    setModuleToDelete(module)
    setSelectedModule(module)
    setIsDeleteDialogOpen(true)
  }

  const handleCreateModule = () => {
    try {
      const parsedDefaultConfig = JSON.parse(formData.defaultConfig)
      const parsedPresets = JSON.parse(formData.presets)

      createMutation.mutate({
        code: formData.code.toUpperCase().replace(/[^A-Z_]/g, '_'),
        name: formData.name,
        description: formData.description || undefined,
        defaultConfig: parsedDefaultConfig,
        presets: parsedPresets,
      })
    } catch (_e) {
      toast({
        title: 'Error de JSON',
        description: 'Verifica que la configuración y presets sean JSON válido.',
        variant: 'destructive',
      })
    }
  }

  const handleUpdateModule = () => {
    if (!moduleToEdit) return

    try {
      const parsedDefaultConfig = JSON.parse(formData.defaultConfig)
      const parsedPresets = JSON.parse(formData.presets)

      updateMutation.mutate({
        moduleId: moduleToEdit.id,
        data: {
          name: formData.name,
          description: formData.description || null,
          defaultConfig: parsedDefaultConfig,
          presets: parsedPresets,
        },
      })
    } catch (_e) {
      toast({
        title: 'Error de JSON',
        description: 'Verifica que la configuración y presets sean JSON válido.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteModule = () => {
    if (!moduleToDelete) return
    deleteMutation.mutate(moduleToDelete.id)
  }

  const columns: ColumnDef<Module>[] = [
    {
      accessorKey: 'name',
      header: 'Módulo',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
            <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="font-medium">{row.original.name}</div>
            <Badge variant="outline" className="font-mono text-xs mt-0.5">
              {row.original.code}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Descripción',
      cell: ({ row }) => <span className="text-sm text-muted-foreground line-clamp-2 max-w-xs">{row.original.description || '-'}</span>,
    },
    {
      accessorKey: 'enabledVenueCount',
      header: 'Sucursales',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <StatusPulse status={row.original.enabledVenueCount > 0 ? 'success' : 'neutral'} />
          <Badge variant={row.original.enabledVenueCount > 0 ? 'default' : 'secondary'}>
            <Building2 className="w-3 h-3 mr-1" />
            {row.original.enabledVenueCount}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: 'presets',
      header: 'Presets',
      cell: ({ row }) => {
        const presetCount = row.original.presets ? Object.keys(row.original.presets).length : 0
        return (
          <Badge variant="outline" className="text-xs">
            <Settings2 className="w-3 h-3 mr-1" />
            {presetCount} {presetCount === 1 ? 'preset' : 'presets'}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={5} className="w-48">
            <DropdownMenuItem onClick={() => handleViewVenues(row.original)} className="cursor-pointer">
              <Eye className="mr-2 h-4 w-4" />
              Ver sucursales
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleOpenEditDialog(row.original)} className="cursor-pointer">
              <Pencil className="mr-2 h-4 w-4" />
              Editar módulo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleOpenDeleteDialog(row.original)}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar módulo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  // Calculate stats
  const totalEnabledCount = useMemo(() => modules.reduce((sum, m) => sum + m.enabledVenueCount, 0), [modules])
  const mostPopularModule = useMemo(() => {
    if (modules.length === 0) return null
    return modules.reduce((max, m) => (m.enabledVenueCount > max.enabledVenueCount ? m : max), modules[0])
  }, [modules])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestión de Módulos</h1>
          <p className="text-muted-foreground">Administra los módulos del sistema y su disponibilidad por sucursal.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleOpenCreateDialog} variant="outline" className="cursor-pointer">
            <Plus className="w-4 h-4 mr-2" />
            Crear módulo
          </Button>
          <Button
            onClick={() => setIsModuleWizardOpen(true)}
            className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Wizard interactivo
          </Button>
        </div>
      </div>

      {/* Module Statistics - Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total de Módulos</p>
              <p className="text-3xl font-bold tracking-tight mt-1">{modules.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Disponibles para sucursales</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Boxes className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Activaciones Totales</p>
              <p className="text-3xl font-bold tracking-tight mt-1">{totalEnabledCount}</p>
              <p className="text-xs text-muted-foreground mt-1">En todas las sucursales</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Módulo Más Popular</p>
              <p className="text-xl font-bold tracking-tight mt-1 truncate max-w-[180px]">{mostPopularModule?.name || '-'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {mostPopularModule ? `${mostPopularModule.enabledVenueCount} sucursales` : '-'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Modules Table */}
      <GlassCard className="overflow-hidden">
        <div className="p-5 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="font-semibold">Catálogo de Módulos</h2>
              <p className="text-sm text-muted-foreground">Módulos disponibles en la plataforma.</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nombre, código o descripción..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="py-8 text-sm text-muted-foreground text-center">Cargando módulos...</div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredModules}
              pagination={{ pageIndex: 0, pageSize: 20 }}
              setPagination={() => {}}
              rowCount={filteredModules.length}
            />
          )}
        </div>
      </GlassCard>

      {/* Organization-grouped Venue Dialog */}
      <Suspense fallback={null}>
        <ModuleOrganizationDialog
          selectedModule={selectedModule}
          isOpen={isVenueDialogOpen}
          onOpenChange={setIsVenueDialogOpen}
          onOpenWhiteLabelWizard={target => {
            if (target.venueId) {
              setSelectedVenueForWizard({ id: target.venueId, name: target.venueName || '' })
              setSelectedOrgForWizard(null)
            } else if (target.orgId) {
              setSelectedOrgForWizard({ id: target.orgId, name: target.orgName || '', initialConfig: target.initialConfig })
              setSelectedVenueForWizard(null)
            }
            setIsWhiteLabelWizardOpen(true)
          }}
        />
      </Suspense>

      {/* Create Module Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                <Plus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              Crear Nuevo Módulo
            </DialogTitle>
            <DialogDescription>
              Define un nuevo módulo para el sistema. Los módulos controlan funcionalidades que pueden activarse por sucursal.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">Código</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={e => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase().replace(/[^A-Z_]/g, '_') }))}
                  placeholder="SERIALIZED_INVENTORY"
                />
                <p className="text-xs text-muted-foreground mt-1">Solo mayúsculas y guiones bajos. Ej: FEATURE_NAME</p>
              </div>
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Inventario Serializado"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe qué hace este módulo..."
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="defaultConfig">Configuración por defecto (JSON)</Label>
              <Textarea
                id="defaultConfig"
                value={formData.defaultConfig}
                onChange={e => setFormData(prev => ({ ...prev, defaultConfig: e.target.value }))}
                placeholder='{"enabled": true, "settings": {}}'
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">Configuración inicial que se aplica al activar el módulo.</p>
            </div>
            <div>
              <Label htmlFor="presets">Presets por industria (JSON)</Label>
              <Textarea
                id="presets"
                value={formData.presets}
                onChange={e => setFormData(prev => ({ ...prev, presets: e.target.value }))}
                placeholder='{"telecom": {"labels": {"item": "SIM"}}, "jewelry": {"labels": {"item": "Pieza"}}}'
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">Configuraciones predefinidas para diferentes tipos de negocio.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="cursor-pointer">
              Cancelar
            </Button>
            <Button
              onClick={handleCreateModule}
              disabled={createMutation.isPending || !formData.code || !formData.name}
              className="cursor-pointer"
            >
              {createMutation.isPending ? 'Creando...' : 'Crear módulo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Module Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                <Pencil className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              Editar Módulo
            </DialogTitle>
            <DialogDescription>
              Modificando el módulo{' '}
              <Badge variant="outline" className="font-mono">
                {moduleToEdit?.code}
              </Badge>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-code">Código</Label>
                <Input id="edit-code" value={formData.code} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground mt-1">El código no puede modificarse.</p>
              </div>
              <div>
                <Label htmlFor="edit-name">Nombre</Label>
                <Input id="edit-name" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-description">Descripción</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="edit-defaultConfig">Configuración por defecto (JSON)</Label>
              <Textarea
                id="edit-defaultConfig"
                value={formData.defaultConfig}
                onChange={e => setFormData(prev => ({ ...prev, defaultConfig: e.target.value }))}
                rows={4}
                className="font-mono text-sm"
              />
              <JsonBooleanToggles
                jsonString={formData.defaultConfig}
                onChange={updatedJson => setFormData(prev => ({ ...prev, defaultConfig: updatedJson }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-presets">Presets por industria (JSON)</Label>
              <Textarea
                id="edit-presets"
                value={formData.presets}
                onChange={e => setFormData(prev => ({ ...prev, presets: e.target.value }))}
                rows={4}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="cursor-pointer">
              Cancelar
            </Button>
            <Button onClick={handleUpdateModule} disabled={updateMutation.isPending || !formData.name} className="cursor-pointer">
              {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Module Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/20 to-red-500/5">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              Eliminar Módulo
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro que deseas eliminar <strong>{moduleToDelete?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {moduleToDelete && moduleToDelete.enabledVenueCount > 0 && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  Este módulo está activo en <strong>{moduleToDelete.enabledVenueCount}</strong> sucursal(es). Debes desactivarlo en todas
                  antes de eliminarlo.
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">Abre el panel de sucursales para desactivar el módulo.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsDeleteDialogOpen(false)
                      setIsVenueDialogOpen(true)
                    }}
                    className="cursor-pointer"
                  >
                    Ver sucursales
                  </Button>
                </div>
              </div>
            )}
            {moduleToDelete && moduleToDelete.enabledVenueCount === 0 && (
              <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer. El módulo será eliminado permanentemente.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="cursor-pointer">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteModule}
              disabled={deleteMutation.isPending || (moduleToDelete?.enabledVenueCount ?? 0) > 0}
              className="cursor-pointer"
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar módulo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* White-Label Wizard Full-Screen Modal (venue-level) */}
      {selectedVenueForWizard && (
        <FullScreenModal
          open={isWhiteLabelWizardOpen}
          onClose={() => {
            setIsWhiteLabelWizardOpen(false)
            setSelectedVenueForWizard(null)
          }}
          title={`Configurar White-Label — ${selectedVenueForWizard.name}`}
        >
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Cargando wizard...</div>}>
            <WhiteLabelWizard
              key={selectedVenueForWizard.id}
              initialVenueId={selectedVenueForWizard.id}
              initialVenueName={selectedVenueForWizard.name}
              onComplete={async (venueId, config) => {
                try {
                  const { venueModule: updatedModule } = await moduleAPI.updateModuleConfig(venueId, 'WHITE_LABEL_DASHBOARD', config)

                  queryClient.setQueryData(['status'], (oldData: any) => {
                    if (!oldData) return oldData
                    const updateVenueModules = (venue: any) => {
                      if (venue.id !== venueId) return venue
                      const updatedModules =
                        venue.modules?.map((m: any) =>
                          m.module.code === 'WHITE_LABEL_DASHBOARD' ? { ...m, config: updatedModule.config } : m,
                        ) ?? []
                      return { ...venue, modules: updatedModules }
                    }
                    return {
                      ...oldData,
                      user: oldData.user
                        ? {
                            ...oldData.user,
                            venues: oldData.user.venues?.map(updateVenueModules) ?? [],
                          }
                        : null,
                      allVenues: oldData.allVenues?.map(updateVenueModules) ?? [],
                    }
                  })

                  toast({
                    title: 'Configuración guardada',
                    description: 'La configuración white-label ha sido actualizada.',
                  })
                  setIsWhiteLabelWizardOpen(false)
                  setSelectedVenueForWizard(null)
                  queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })
                  queryClient.invalidateQueries({ queryKey: ['superadmin-module-venues-grouped'] })
                } catch (error: any) {
                  toast({
                    title: 'Error al guardar',
                    description: error?.response?.data?.error || error.message,
                    variant: 'destructive',
                  })
                }
              }}
              onCancel={() => {
                setIsWhiteLabelWizardOpen(false)
                setSelectedVenueForWizard(null)
              }}
            />
          </Suspense>
        </FullScreenModal>
      )}

      {/* White-Label Wizard Full-Screen Modal (org-level) */}
      {selectedOrgForWizard && (
        <FullScreenModal
          open={isWhiteLabelWizardOpen}
          onClose={() => {
            setIsWhiteLabelWizardOpen(false)
            setSelectedOrgForWizard(null)
          }}
          title={`Configurar White-Label Org — ${selectedOrgForWizard.name}`}
        >
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Cargando wizard...</div>}>
            <WhiteLabelWizard
              key={`org-${selectedOrgForWizard.id}`}
              initialVenueId=""
              initialVenueName={selectedOrgForWizard.name}
              initialConfig={selectedOrgForWizard.initialConfig}
              mode="organization"
              onComplete={async (_venueId, config) => {
                try {
                  await updateOrganizationModuleConfig(selectedOrgForWizard.id, 'WHITE_LABEL_DASHBOARD', config)

                  toast({
                    title: 'Configuración guardada',
                    description: 'La configuración white-label de la organización ha sido actualizada.',
                  })
                  setIsWhiteLabelWizardOpen(false)
                  setSelectedOrgForWizard(null)
                  queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })
                  queryClient.invalidateQueries({ queryKey: ['superadmin-module-venues-grouped'] })
                  queryClient.invalidateQueries({ queryKey: ['superadmin-organizations'] })
                } catch (error: any) {
                  toast({
                    title: 'Error al guardar',
                    description: error?.response?.data?.error || error.message,
                    variant: 'destructive',
                  })
                }
              }}
              onCancel={() => {
                setIsWhiteLabelWizardOpen(false)
                setSelectedOrgForWizard(null)
              }}
            />
          </Suspense>
        </FullScreenModal>
      )}

      {/* Module Creation Wizard v2 Dialog */}
      <Dialog open={isModuleWizardOpen} onOpenChange={setIsModuleWizardOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Cargando wizard...</div>}>
            <ModuleCreationWizard
              onComplete={wizardData => {
                createMutation.mutate({
                  code: wizardData.code,
                  name: wizardData.name,
                  description: wizardData.description,
                  defaultConfig: wizardData.defaultConfig,
                  presets: wizardData.presets,
                })
                setIsModuleWizardOpen(false)
              }}
              onCancel={() => setIsModuleWizardOpen(false)}
              isSubmitting={createMutation.isPending}
            />
          </Suspense>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ModuleManagement
