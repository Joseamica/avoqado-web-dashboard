import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
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
  Pencil,
  Plus,
  Power,
  PowerOff,
  Trash2,
  XCircle,
} from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const ModuleManagement: React.FC = () => {
  const { t } = useTranslation('superadmin')
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
      toast({ title: t('moduleMgmt.toast.enabledTitle'), description: data.message })
      queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-module-venues'] })
      setIsEnableDialogOpen(false)
      setSelectedPreset('')
    },
    onError: (error: any) => {
      toast({
        title: t('moduleMgmt.toast.enableFailed'),
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
      toast({ title: t('moduleMgmt.toast.disabledTitle'), description: data.message })
      queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-module-venues'] })
    },
    onError: (error: any) => {
      toast({
        title: t('moduleMgmt.toast.disableFailed'),
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Create module mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateModuleData) => moduleAPI.createModule(data),
    onSuccess: data => {
      toast({ title: t('moduleMgmt.toast.createdTitle'), description: t('moduleMgmt.toast.createdDesc', { name: data.module.name }) })
      queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })
      setIsCreateDialogOpen(false)
      resetFormData()
    },
    onError: (error: any) => {
      toast({
        title: t('moduleMgmt.toast.createFailed'),
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
      toast({ title: t('moduleMgmt.toast.updatedTitle'), description: t('moduleMgmt.toast.updatedDesc', { name: data.module.name }) })
      queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })
      setIsEditDialogOpen(false)
      setModuleToEdit(null)
      resetFormData()
    },
    onError: (error: any) => {
      toast({
        title: t('moduleMgmt.toast.updateFailed'),
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Delete module mutation
  const deleteMutation = useMutation({
    mutationFn: (moduleId: string) => moduleAPI.deleteModule(moduleId),
    onSuccess: data => {
      toast({ title: t('moduleMgmt.toast.deletedTitle'), description: data.message })
      queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })
      setIsDeleteDialogOpen(false)
      setModuleToDelete(null)
    },
    onError: (error: any) => {
      toast({
        title: t('moduleMgmt.toast.deleteFailed'),
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
        title: t('moduleMgmt.toast.jsonError'),
        description: t('moduleMgmt.toast.jsonErrorDesc'),
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
        title: t('moduleMgmt.toast.jsonError'),
        description: t('moduleMgmt.toast.jsonErrorDesc'),
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
      header: t('moduleMgmt.columns.module'),
      cell: ({ row }) => (
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-muted">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-sm text-muted-foreground">{row.original.code}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: t('moduleMgmt.columns.description'),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground line-clamp-2">
          {row.original.description || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'enabledVenueCount',
      header: t('moduleMgmt.columns.enabledVenues'),
      cell: ({ row }) => (
        <Badge variant={row.original.enabledVenueCount > 0 ? 'default' : 'secondary'}>
          <Building2 className="w-3 h-3 mr-1" />
          {row.original.enabledVenueCount}
        </Badge>
      ),
    },
    {
      accessorKey: 'presets',
      header: t('moduleMgmt.columns.presets'),
      cell: ({ row }) => {
        const presetCount = row.original.presets ? Object.keys(row.original.presets).length : 0
        return (
          <Badge variant="outline">
            {presetCount} {t('moduleMgmt.presetsCount')}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: t('moduleMgmt.columns.actions'),
      cell: ({ row }) => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={5} className="w-48">
            <DropdownMenuItem onClick={() => handleViewVenues(row.original)}>
              <Eye className="mr-2 h-4 w-4" />
              {t('moduleMgmt.dropdown.viewVenues')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleOpenEditDialog(row.original)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t('moduleMgmt.dropdown.editModule')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleOpenDeleteDialog(row.original)}
              className="text-destructive focus:text-destructive"
              disabled={row.original.enabledVenueCount > 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('moduleMgmt.dropdown.deleteModule')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const venueColumns: ColumnDef<VenueModuleStatus>[] = [
    {
      accessorKey: 'name',
      header: t('moduleMgmt.venueColumns.venue'),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="text-sm text-muted-foreground">{row.original.slug}</div>
        </div>
      ),
    },
    {
      accessorKey: 'moduleEnabled',
      header: t('moduleMgmt.venueColumns.status'),
      cell: ({ row }) => (
        <Badge variant={row.original.moduleEnabled ? 'default' : 'secondary'}>
          {row.original.moduleEnabled ? (
            <>
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {t('moduleMgmt.status.enabled')}
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3 mr-1" />
              {t('moduleMgmt.status.disabled')}
            </>
          )}
        </Badge>
      ),
    },
    {
      accessorKey: 'enabledAt',
      header: t('moduleMgmt.venueColumns.enabledAt'),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.enabledAt ? new Date(row.original.enabledAt).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('moduleMgmt.venueColumns.actions'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.moduleEnabled ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDisableModule(row.original)}
              disabled={disableMutation.isPending}
            >
              <PowerOff className="w-3 h-3 mr-1" />
              {t('moduleMgmt.actions.disable')}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => handleEnableModule(row.original)}
            >
              <Power className="w-3 h-3 mr-1" />
              {t('moduleMgmt.actions.enable')}
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('moduleMgmt.title')}</h1>
          <p className="text-muted-foreground">{t('moduleMgmt.subtitle')}</p>
        </div>
        <Button onClick={handleOpenCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          {t('moduleMgmt.createModule')}
        </Button>
      </div>

      {/* Module Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('moduleMgmt.stats.totalModules')}</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{modules.length}</div>
            <p className="text-xs text-muted-foreground">{t('moduleMgmt.stats.availableForVenues')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('moduleMgmt.stats.totalEnabledCount')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {modules.reduce((sum, m) => sum + m.enabledVenueCount, 0)}
            </div>
            <p className="text-xs text-muted-foreground">{t('moduleMgmt.stats.acrossAllVenues')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('moduleMgmt.stats.mostPopular')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {modules.length > 0
                ? modules.reduce((max, m) => (m.enabledVenueCount > max.enabledVenueCount ? m : max), modules[0]).name
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {modules.length > 0
                ? `${modules.reduce((max, m) => (m.enabledVenueCount > max.enabledVenueCount ? m : max), modules[0]).enabledVenueCount} ${t('moduleMgmt.stats.venues')}`
                : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modules Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('moduleMgmt.tableTitle')}</CardTitle>
          <CardDescription>{t('moduleMgmt.tableDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder={t('moduleMgmt.searchPlaceholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="py-8 text-sm text-muted-foreground">{t('common.loading')}</div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredModules}
              pagination={{ pageIndex: 0, pageSize: 10 }}
              setPagination={() => {}}
              rowCount={filteredModules.length}
            />
          )}
        </CardContent>
      </Card>

      {/* Venue Dialog */}
      <Dialog open={isVenueDialogOpen} onOpenChange={setIsVenueDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>
              {t('moduleMgmt.venueDialog.title', { module: selectedModule?.name })}
            </DialogTitle>
            <DialogDescription>
              {t('moduleMgmt.venueDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {isLoadingVenues ? (
              <div className="py-8 text-sm text-muted-foreground text-center">{t('common.loading')}</div>
            ) : (
              <DataTable
                columns={venueColumns}
                data={moduleVenuesData?.venues || []}
                pagination={{ pageIndex: 0, pageSize: 10 }}
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
            <DialogTitle>{t('moduleMgmt.enableDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('moduleMgmt.enableDialog.description', {
                module: selectedModule?.name,
                venue: selectedVenueForEnable?.name,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {availablePresets.length > 0 && (
              <div>
                <Label htmlFor="preset">{t('moduleMgmt.enableDialog.presetLabel')}</Label>
                <Select value={selectedPreset || '__none__'} onValueChange={(val) => setSelectedPreset(val === '__none__' ? '' : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('moduleMgmt.enableDialog.presetPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('moduleMgmt.enableDialog.noPreset')}</SelectItem>
                    {availablePresets.map(preset => (
                      <SelectItem key={preset} value={preset}>
                        {preset.charAt(0).toUpperCase() + preset.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('moduleMgmt.enableDialog.presetHelp')}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEnableDialogOpen(false)}>
              {t('moduleMgmt.enableDialog.cancel')}
            </Button>
            <Button onClick={handleConfirmEnable} disabled={enableMutation.isPending}>
              {enableMutation.isPending ? t('moduleMgmt.enableDialog.enabling') : t('moduleMgmt.enableDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Module Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('moduleMgmt.createDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('moduleMgmt.createDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">{t('moduleMgmt.form.code')}</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={e => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase().replace(/[^A-Z_]/g, '_') }))}
                  placeholder="SERIALIZED_INVENTORY"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('moduleMgmt.form.codeHelp')}
                </p>
              </div>
              <div>
                <Label htmlFor="name">{t('moduleMgmt.form.name')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Serialized Inventory"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">{t('moduleMgmt.form.description')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('moduleMgmt.form.descriptionPlaceholder')}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="defaultConfig">{t('moduleMgmt.form.defaultConfig')}</Label>
              <Textarea
                id="defaultConfig"
                value={formData.defaultConfig}
                onChange={e => setFormData(prev => ({ ...prev, defaultConfig: e.target.value }))}
                placeholder='{"enabled": true, "settings": {}}'
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('moduleMgmt.form.defaultConfigHelp')}
              </p>
            </div>
            <div>
              <Label htmlFor="presets">{t('moduleMgmt.form.presets')}</Label>
              <Textarea
                id="presets"
                value={formData.presets}
                onChange={e => setFormData(prev => ({ ...prev, presets: e.target.value }))}
                placeholder='{"telecom": {"labels": {"item": "SIM"}}, "jewelry": {"labels": {"item": "Pieza"}}}'
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('moduleMgmt.form.presetsHelp')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateModule} disabled={createMutation.isPending || !formData.code || !formData.name}>
              {createMutation.isPending ? t('common.creating') : t('moduleMgmt.createDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Module Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('moduleMgmt.editDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('moduleMgmt.editDialog.description', { module: moduleToEdit?.code })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-code">{t('moduleMgmt.form.code')}</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('moduleMgmt.form.codeNotEditable')}
                </p>
              </div>
              <div>
                <Label htmlFor="edit-name">{t('moduleMgmt.form.name')}</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-description">{t('moduleMgmt.form.description')}</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="edit-defaultConfig">{t('moduleMgmt.form.defaultConfig')}</Label>
              <Textarea
                id="edit-defaultConfig"
                value={formData.defaultConfig}
                onChange={e => setFormData(prev => ({ ...prev, defaultConfig: e.target.value }))}
                rows={4}
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label htmlFor="edit-presets">{t('moduleMgmt.form.presets')}</Label>
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
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUpdateModule} disabled={updateMutation.isPending || !formData.name}>
              {updateMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Module Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{t('moduleMgmt.deleteDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('moduleMgmt.deleteDialog.description', { module: moduleToDelete?.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {moduleToDelete && moduleToDelete.enabledVenueCount > 0 && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {t('moduleMgmt.deleteDialog.warningEnabled', { count: moduleToDelete.enabledVenueCount })}
              </div>
            )}
            {moduleToDelete && moduleToDelete.enabledVenueCount === 0 && (
              <p className="text-sm text-muted-foreground">
                {t('moduleMgmt.deleteDialog.confirmText')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteModule}
              disabled={deleteMutation.isPending || (moduleToDelete?.enabledVenueCount ?? 0) > 0}
            >
              {deleteMutation.isPending ? t('common.deleting') : t('moduleMgmt.deleteDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ModuleManagement
