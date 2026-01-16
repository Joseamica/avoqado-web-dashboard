import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { moduleAPI, type Module, type VenueModuleStatus, type CreateModuleData, type UpdateModuleData } from '@/services/superadmin-modules.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Building2,
  Boxes,
  CheckCircle2,
  Eye,
  MoreHorizontal,
  Package,
  Palette,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Trash2,
  XCircle,
  Sparkles,
  Settings2,
} from 'lucide-react'
import React, { Suspense, lazy, useMemo, useState } from 'react'

// Lazy load WhiteLabelWizard to avoid loading it for all users
const WhiteLabelWizard = lazy(() => import('@/pages/Superadmin/WhiteLabelBuilder/WhiteLabelWizard'))
// Lazy load ModuleCreationWizard (v2 interactive wizard)
const ModuleCreationWizard = lazy(() => import('@/pages/Superadmin/components/ModuleCreationWizard'))

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
      className
    )}
  >
    {children}
  </div>
)

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
  const [isEnableDialogOpen, setIsEnableDialogOpen] = useState(false)
  const [selectedVenueForEnable, setSelectedVenueForEnable] = useState<VenueModuleStatus | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<string>('')

  // Create/Edit module state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [moduleToEdit, setModuleToEdit] = useState<Module | null>(null)
  const [moduleToDelete, setModuleToDelete] = useState<Module | null>(null)

  // White-Label Wizard state
  const [isWhiteLabelWizardOpen, setIsWhiteLabelWizardOpen] = useState(false)
  const [selectedVenueForWizard, setSelectedVenueForWizard] = useState<{ id: string; name: string } | null>(null)

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

  // Fetch venues for selected module
  const { data: moduleVenuesData, isLoading: isLoadingVenues } = useQuery({
    queryKey: ['superadmin-module-venues', selectedModule?.code],
    queryFn: () => moduleAPI.getVenuesForModule(selectedModule!.code),
    enabled: !!selectedModule && isVenueDialogOpen,
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

  // Enable module mutation
  const enableMutation = useMutation({
    mutationFn: ({ venueId, moduleCode, preset }: { venueId: string; moduleCode: string; preset?: string }) =>
      moduleAPI.enableModule(venueId, moduleCode, preset),
    onSuccess: data => {
      toast({ title: 'Módulo activado', description: data.message })
      queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-module-venues'] })
      setIsEnableDialogOpen(false)
      setSelectedPreset('')
    },
    onError: (error: any) => {
      toast({
        title: 'Error al activar módulo',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Disable module mutation
  const disableMutation = useMutation({
    mutationFn: ({ venueId, moduleCode }: { venueId: string; moduleCode: string }) =>
      moduleAPI.disableModule(venueId, moduleCode),
    onSuccess: data => {
      toast({ title: 'Módulo desactivado', description: data.message })
      queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-module-venues'] })
    },
    onError: (error: any) => {
      toast({
        title: 'Error al desactivar módulo',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

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
    mutationFn: ({ moduleId, data }: { moduleId: string; data: UpdateModuleData }) =>
      moduleAPI.updateModule(moduleId, data),
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

  const handleEnableModule = (venue: VenueModuleStatus) => {
    setSelectedVenueForEnable(venue)
    setIsEnableDialogOpen(true)
  }

  const handleConfirmEnable = () => {
    if (!selectedVenueForEnable || !selectedModule) return
    enableMutation.mutate({
      venueId: selectedVenueForEnable.id,
      moduleCode: selectedModule.code,
      preset: selectedPreset || undefined,
    })
  }

  const handleDisableModule = (venue: VenueModuleStatus) => {
    if (!selectedModule) return
    disableMutation.mutate({
      venueId: venue.id,
      moduleCode: selectedModule.code,
    })
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
    } catch (e) {
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
    } catch (e) {
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

  // Get available presets for the selected module
  const availablePresets = useMemo(() => {
    if (!selectedModule?.presets) return []
    return Object.keys(selectedModule.presets)
  }, [selectedModule])

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
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground line-clamp-2 max-w-xs">
          {row.original.description || '-'}
        </span>
      ),
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

  const venueColumns: ColumnDef<VenueModuleStatus>[] = [
    {
      accessorKey: 'name',
      header: 'Sucursal',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="text-sm text-muted-foreground">{row.original.slug}</div>
        </div>
      ),
    },
    {
      accessorKey: 'moduleEnabled',
      header: 'Estado',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <StatusPulse status={row.original.moduleEnabled ? 'success' : 'neutral'} />
          <Badge variant={row.original.moduleEnabled ? 'default' : 'secondary'}>
            {row.original.moduleEnabled ? (
              <>
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Activo
              </>
            ) : (
              <>
                <XCircle className="w-3 h-3 mr-1" />
                Inactivo
              </>
            )}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: 'enabledAt',
      header: 'Activado',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.enabledAt ? new Date(row.original.enabledAt).toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }) : '-'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.moduleEnabled ? (
            <>
              {/* Configure Dashboard button - only for WHITE_LABEL_DASHBOARD */}
              {selectedModule?.code === 'WHITE_LABEL_DASHBOARD' && (
                <Button
                  variant="default"
                  size="sm"
                  className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 cursor-pointer"
                  onClick={() => {
                    setSelectedVenueForWizard({ id: row.original.id, name: row.original.name })
                    setIsWhiteLabelWizardOpen(true)
                  }}
                >
                  <Palette className="w-3 h-3 mr-1" />
                  Configurar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDisableModule(row.original)}
                disabled={disableMutation.isPending}
                className="cursor-pointer"
              >
                <PowerOff className="w-3 h-3 mr-1" />
                Desactivar
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => handleEnableModule(row.original)}
              className="cursor-pointer"
            >
              <Power className="w-3 h-3 mr-1" />
              Activar
            </Button>
          )}
        </div>
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
              <p className="text-xl font-bold tracking-tight mt-1 truncate max-w-[180px]">
                {mostPopularModule?.name || '-'}
              </p>
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

      {/* Venue Dialog */}
      <Dialog open={isVenueDialogOpen} onOpenChange={setIsVenueDialogOpen}>
        <DialogContent className="sm:max-w-[850px] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              Sucursales - {selectedModule?.name}
            </DialogTitle>
            <DialogDescription>
              Gestiona qué sucursales tienen acceso a este módulo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            {isLoadingVenues ? (
              <div className="py-8 text-sm text-muted-foreground text-center">Cargando sucursales...</div>
            ) : (
              <DataTable
                columns={venueColumns}
                data={moduleVenuesData?.venues || []}
                pagination={{ pageIndex: 0, pageSize: 20 }}
                setPagination={() => {}}
                rowCount={moduleVenuesData?.venues?.length || 0}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Enable Module Dialog */}
      <Dialog open={isEnableDialogOpen} onOpenChange={setIsEnableDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/5">
                <Power className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              Activar Módulo
            </DialogTitle>
            <DialogDescription>
              Activar <strong>{selectedModule?.name}</strong> para <strong>{selectedVenueForEnable?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {availablePresets.length > 0 && (
              <div>
                <Label htmlFor="preset">Preset de configuración (opcional)</Label>
                <Select value={selectedPreset || '__none__'} onValueChange={(val) => setSelectedPreset(val === '__none__' ? '' : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar preset..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin preset (usar defaults)</SelectItem>
                    {availablePresets.map(preset => (
                      <SelectItem key={preset} value={preset}>
                        {preset.charAt(0).toUpperCase() + preset.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Los presets aplican configuraciones predefinidas para diferentes industrias.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEnableDialogOpen(false)} className="cursor-pointer">
              Cancelar
            </Button>
            <Button onClick={handleConfirmEnable} disabled={enableMutation.isPending} className="cursor-pointer">
              {enableMutation.isPending ? 'Activando...' : 'Activar módulo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <p className="text-xs text-muted-foreground mt-1">
                  Solo mayúsculas y guiones bajos. Ej: FEATURE_NAME
                </p>
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
              <p className="text-xs text-muted-foreground mt-1">
                Configuración inicial que se aplica al activar el módulo.
              </p>
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
              <p className="text-xs text-muted-foreground mt-1">
                Configuraciones predefinidas para diferentes tipos de negocio.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="cursor-pointer">
              Cancelar
            </Button>
            <Button onClick={handleCreateModule} disabled={createMutation.isPending || !formData.code || !formData.name} className="cursor-pointer">
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
              Modificando el módulo <Badge variant="outline" className="font-mono">{moduleToEdit?.code}</Badge>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-code">Código</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  El código no puede modificarse.
                </p>
              </div>
              <div>
                <Label htmlFor="edit-name">Nombre</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
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
                  Este módulo está activo en <strong>{moduleToDelete.enabledVenueCount}</strong> sucursal(es). Debes desactivarlo en todas antes de eliminarlo.
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Abre el panel de sucursales para desactivar el módulo.
                  </p>
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
              <p className="text-sm text-muted-foreground">
                Esta acción no se puede deshacer. El módulo será eliminado permanentemente.
              </p>
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

      {/* White-Label Wizard Dialog */}
      <Dialog
        open={isWhiteLabelWizardOpen}
        onOpenChange={(open) => {
          setIsWhiteLabelWizardOpen(open)
          if (!open) setSelectedVenueForWizard(null)
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {selectedVenueForWizard ? (
            <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Cargando wizard...</div>}>
              {/* Key forces re-mount when venue changes, ensuring fresh state and config load */}
              <WhiteLabelWizard
                key={selectedVenueForWizard.id}
                initialVenueId={selectedVenueForWizard.id}
                initialVenueName={selectedVenueForWizard.name}
                onComplete={async (venueId, config) => {
                  try {
                    // Save config and get updated venueModule from API
                    const { venueModule: updatedModule } = await moduleAPI.updateModuleConfig(
                      venueId,
                      'WHITE_LABEL_DASHBOARD',
                      config
                    )

                    // ============================================
                    // WORLD-CLASS PATTERN: Optimistic Cache Update
                    // Instead of refetching ALL data, surgically update only what changed.
                    // This is how Stripe, Linear, and Vercel handle cache updates.
                    // Benefits:
                    // - Instant UI update (no loading state)
                    // - No unnecessary network requests
                    // - Reduced server load
                    // - Better UX
                    // ============================================
                    queryClient.setQueryData(['status'], (oldData: any) => {
                      if (!oldData) return oldData

                      // Helper to update a venue's modules array
                      const updateVenueModules = (venue: any) => {
                        if (venue.id !== venueId) return venue

                        // Find and update the WHITE_LABEL_DASHBOARD module
                        const updatedModules = venue.modules?.map((m: any) =>
                          m.module.code === 'WHITE_LABEL_DASHBOARD'
                            ? { ...m, config: updatedModule.config }
                            : m
                        ) ?? []

                        return { ...venue, modules: updatedModules }
                      }

                      return {
                        ...oldData,
                        // Update in user.venues (for non-SUPERADMIN users)
                        user: oldData.user ? {
                          ...oldData.user,
                          venues: oldData.user.venues?.map(updateVenueModules) ?? []
                        } : null,
                        // Update in allVenues (for SUPERADMIN users)
                        allVenues: oldData.allVenues?.map(updateVenueModules) ?? []
                      }
                    })

                    toast({
                      title: 'Configuración guardada',
                      description: 'La configuración white-label ha sido actualizada.',
                    })
                    setIsWhiteLabelWizardOpen(false)
                    setSelectedVenueForWizard(null)

                    // Invalidate superadmin-specific queries (these are only for the management UI)
                    queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })
                    queryClient.invalidateQueries({ queryKey: ['superadmin-module-venues'] })
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
          ) : (
            <div className="py-8 text-center text-muted-foreground">Cargando...</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Module Creation Wizard v2 Dialog */}
      <Dialog open={isModuleWizardOpen} onOpenChange={setIsModuleWizardOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Cargando wizard...</div>}>
            <ModuleCreationWizard
              onComplete={(wizardData) => {
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
