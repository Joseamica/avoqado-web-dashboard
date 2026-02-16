import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  organizationAPI,
  type Organization,
  type BusinessType,
  type CreateOrganizationData,
  type UpdateOrganizationData,
  type ModuleForOrganization,
  type SetOrgPaymentConfigData,
  type SetOrgPricingData,
  type AccountType,
} from '@/services/superadmin-organizations.service'
import { getMerchantAccountsList } from '@/services/paymentProvider.service'
import { PaymentSetupWizard } from './components/merchant-accounts/PaymentSetupWizard'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  CreditCard,
  Check,
  Loader2,
  Mail,
  MoreHorizontal,
  Package,
  Phone,
  Plus,
  Power,
  PowerOff,
  Search,
  Settings,
  Settings2,
  Store,
  Trash2,
  Users,
  Edit3,
} from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// ===========================================
// SHARED COMPONENTS - Modern 2025/2026 Design
// ===========================================

const GlassCard: React.FC<{
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}> = ({ children, className, hover = false, onClick }) => (
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
// BUSINESS TYPE OPTIONS
// ===========================================

const BUSINESS_TYPES: { value: BusinessType; label: string; icon: React.ReactNode }[] = [
  { value: 'RESTAURANT', label: 'Restaurante', icon: <Store className="w-4 h-4" /> },
  { value: 'RETAIL', label: 'Retail', icon: <Package className="w-4 h-4" /> },
  { value: 'SERVICE', label: 'Servicios', icon: <Settings2 className="w-4 h-4" /> },
  { value: 'ENTERTAINMENT', label: 'Entretenimiento', icon: <Building2 className="w-4 h-4" /> },
  { value: 'HOSPITALITY', label: 'Hospitalidad', icon: <Building2 className="w-4 h-4" /> },
  { value: 'HEALTHCARE', label: 'Salud', icon: <Building2 className="w-4 h-4" /> },
  { value: 'OTHER', label: 'Otro', icon: <Building2 className="w-4 h-4" /> },
]

// ===========================================
// ORGANIZATION CARD COMPONENT
// ===========================================

interface OrganizationCardProps {
  organization: Organization
  onEdit: (org: Organization) => void
  onDelete: (org: Organization) => void
  onManageModules: (org: Organization) => void
  onPaymentConfig: (org: Organization) => void
  onPaymentWizard: (org: Organization) => void
}

const OrganizationCard: React.FC<OrganizationCardProps> = ({ organization, onEdit, onDelete, onManageModules, onPaymentConfig, onPaymentWizard }) => {
  const businessTypeLabel = BUSINESS_TYPES.find(bt => bt.value === organization.type)?.label || organization.type

  return (
    <GlassCard className="p-0 overflow-hidden" hover>
      {/* Header with gradient accent */}
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        <div className="p-4 pt-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
                <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-base">{organization.name}</h3>
                {organization.slug && (
                  <p className="text-xs text-muted-foreground font-mono">{organization.slug}</p>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full cursor-pointer">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(organization)} className="cursor-pointer">
                  <Edit3 className="w-4 h-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onManageModules(organization)} className="cursor-pointer">
                  <Package className="w-4 h-4 mr-2" />
                  Gestionar Módulos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPaymentConfig(organization)} className="cursor-pointer">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Configurar Pagos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPaymentWizard(organization)} className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Wizard de Pagos
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(organization)}
                  className="cursor-pointer text-red-600 dark:text-red-400"
                  disabled={organization.venueCount > 0}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 pb-4 space-y-3">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Store className="w-3.5 h-3.5" />
            <span>{organization.venueCount} sucursales</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{organization.staffCount} usuarios</span>
          </div>
        </div>

        {/* Contact info */}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Mail className="w-3 h-3" />
            <span className="truncate max-w-[150px]">{organization.email}</span>
          </div>
          <div className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            <span>{organization.phone}</span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-xs rounded-full">
            {businessTypeLabel}
          </Badge>
          {organization.enabledModules.slice(0, 2).map(mod => (
            <Badge key={mod.code} variant="secondary" className="text-xs rounded-full">
              {mod.name}
            </Badge>
          ))}
          {organization.enabledModules.length > 2 && (
            <Badge variant="secondary" className="text-xs rounded-full">
              +{organization.enabledModules.length - 2}
            </Badge>
          )}
        </div>
      </div>
    </GlassCard>
  )
}

// ===========================================
// CREATE/EDIT DIALOG
// ===========================================

interface OrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organization?: Organization | null
  onSave: (data: CreateOrganizationData | UpdateOrganizationData) => void
  isLoading: boolean
}

const OrganizationDialog: React.FC<OrganizationDialogProps> = ({ open, onOpenChange, organization, onSave, isLoading }) => {
  const isEdit = !!organization

  const [formData, setFormData] = useState<CreateOrganizationData>({
    name: '',
    slug: '',
    email: '',
    phone: '',
    taxId: '',
    type: 'RESTAURANT',
  })

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      if (organization) {
        setFormData({
          name: organization.name,
          slug: organization.slug || '',
          email: organization.email,
          phone: organization.phone,
          taxId: organization.taxId || '',
          type: organization.type,
        })
      } else {
        setFormData({
          name: '',
          slug: '',
          email: '',
          phone: '',
          taxId: '',
          type: 'RESTAURANT',
        })
      }
    }
  }, [open, organization])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const dataToSend = {
      ...formData,
      slug: formData.slug || undefined,
      taxId: formData.taxId || undefined,
    }
    onSave(dataToSend)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
              <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            {isEdit ? 'Editar Organización' : 'Nueva Organización'}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? 'Modifica los datos de la organización' : 'Crea una nueva organización para agrupar sucursales'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Mi Organización"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  placeholder="mi-organizacion"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="contacto@empresa.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+52 55 1234 5678"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Negocio</Label>
                <Select
                  value={formData.type}
                  onValueChange={value => setFormData(prev => ({ ...prev, type: value as BusinessType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map(bt => (
                      <SelectItem key={bt.value} value={bt.value}>
                        <div className="flex items-center gap-2">
                          {bt.icon}
                          {bt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">RFC / ID Fiscal</Label>
                <Input
                  id="taxId"
                  value={formData.taxId}
                  onChange={e => setFormData(prev => ({ ...prev, taxId: e.target.value }))}
                  placeholder="XAXX010101000"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-full cursor-pointer">
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-full cursor-pointer">
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================
// DELETE CONFIRMATION DIALOG
// ===========================================

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organization: Organization | null
  onConfirm: () => void
  isLoading: boolean
}

const DeleteDialog: React.FC<DeleteDialogProps> = ({ open, onOpenChange, organization, onConfirm, isLoading }) => {
  if (!organization) return null

  const canDelete = organization.venueCount === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <Trash2 className="w-5 h-5" />
            Eliminar Organización
          </DialogTitle>
          <DialogDescription>
            {canDelete
              ? `¿Estás seguro de que deseas eliminar la organización "${organization.name}"?`
              : `No se puede eliminar porque tiene ${organization.venueCount} sucursales.`}
          </DialogDescription>
        </DialogHeader>

        {!canDelete && (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Debes eliminar todas las sucursales antes de poder eliminar la organización.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full cursor-pointer">
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!canDelete || isLoading}
            className="rounded-full cursor-pointer"
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================
// MODULE MANAGEMENT DIALOG
// ===========================================

interface ModuleManagementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organization: Organization | null
}

const ModuleManagementDialog: React.FC<ModuleManagementDialogProps> = ({ open, onOpenChange, organization }) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch modules for this organization
  const { data: modulesData, isLoading } = useQuery({
    queryKey: ['organization-modules', organization?.id],
    queryFn: () => organizationAPI.getModulesForOrganization(organization!.id),
    enabled: !!organization && open,
  })

  // Enable mutation
  const enableMutation = useMutation({
    mutationFn: ({ moduleCode, preset }: { moduleCode: string; preset?: string }) =>
      organizationAPI.enableModuleForOrganization(organization!.id, moduleCode, preset),
    onSuccess: data => {
      toast({ title: 'Módulo Activado', description: data.message })
      queryClient.invalidateQueries({ queryKey: ['organization-modules', organization?.id] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-organizations'] })
    },
    onError: (error: any) => {
      toast({
        title: 'Error al activar módulo',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Disable mutation
  const disableMutation = useMutation({
    mutationFn: (moduleCode: string) =>
      organizationAPI.disableModuleForOrganization(organization!.id, moduleCode),
    onSuccess: data => {
      toast({ title: 'Módulo Desactivado', description: data.message })
      queryClient.invalidateQueries({ queryKey: ['organization-modules', organization?.id] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-organizations'] })
    },
    onError: (error: any) => {
      toast({
        title: 'Error al desactivar módulo',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  const handleToggleModule = (module: ModuleForOrganization) => {
    if (module.enabled) {
      disableMutation.mutate(module.code)
    } else {
      enableMutation.mutate({ moduleCode: module.code })
    }
  }

  if (!organization) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            Módulos de {organization.name}
          </DialogTitle>
          <DialogDescription>
            Activa o desactiva módulos a nivel organizacional. Los módulos activos aquí se heredan a todas las sucursales.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : modulesData?.modules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay módulos configurados en el sistema
            </div>
          ) : (
            <div className="space-y-3">
              {modulesData?.modules.map(module => (
                <GlassCard key={module.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        module.enabled
                          ? 'bg-gradient-to-br from-green-500/20 to-green-500/5'
                          : 'bg-muted',
                      )}>
                        {module.enabled ? (
                          <Power className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <PowerOff className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm">{module.name}</h4>
                          <Badge variant="outline" className="text-xs font-mono rounded-full">
                            {module.code}
                          </Badge>
                        </div>
                        {module.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{module.description}</p>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={module.enabled}
                      onCheckedChange={() => handleToggleModule(module)}
                      disabled={enableMutation.isPending || disableMutation.isPending}
                    />
                  </div>
                  {module.enabled && module.enabledAt && (
                    <p className="text-xs text-muted-foreground mt-2 ml-11">
                      Activo desde {new Date(module.enabledAt).toLocaleDateString('es-MX')}
                    </p>
                  )}
                </GlassCard>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Los módulos activos a nivel organización se heredan automáticamente a todas las sucursales. Cada sucursal puede tener módulos adicionales activados individualmente.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================
// PAYMENT CONFIG DIALOG
// ===========================================

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PaymentConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organization: Organization | null
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, { label: string; color: string }> = {
  PRIMARY: { label: 'Primaria', color: 'text-emerald-600 bg-emerald-500/10' },
  SECONDARY: { label: 'Secundaria', color: 'text-blue-600 bg-blue-500/10' },
  TERTIARY: { label: 'Terciaria', color: 'text-purple-600 bg-purple-500/10' },
}

const PaymentConfigDialog: React.FC<PaymentConfigDialogProps> = ({ open, onOpenChange, organization }) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch org payment config
  const { data: paymentData, isLoading } = useQuery({
    queryKey: ['org-payment-config', organization?.id],
    queryFn: () => organizationAPI.getOrganizationPaymentConfig(organization!.id),
    enabled: !!organization && open,
  })

  // Fetch merchant accounts for dropdowns
  const { data: merchantAccounts = [] } = useQuery({
    queryKey: ['merchant-accounts-list'],
    queryFn: () => getMerchantAccountsList({ active: true }),
    enabled: open,
  })

  // Form state for payment config
  const [configForm, setConfigForm] = useState<SetOrgPaymentConfigData>({
    primaryAccountId: '',
    secondaryAccountId: null,
    tertiaryAccountId: null,
    preferredProcessor: 'AUTO',
  })

  // Form state for pricing
  const [pricingForm, setPricingForm] = useState<SetOrgPricingData>({
    accountType: 'PRIMARY',
    debitRate: 0,
    creditRate: 0,
    amexRate: 0,
    internationalRate: 0,
    effectiveFrom: new Date().toISOString(),
  })

  // Sync form when data loads
  React.useEffect(() => {
    if (paymentData?.paymentConfig) {
      const pc = paymentData.paymentConfig
      setConfigForm({
        primaryAccountId: pc.primaryAccountId,
        secondaryAccountId: pc.secondaryAccountId,
        tertiaryAccountId: pc.tertiaryAccountId,
        preferredProcessor: pc.preferredProcessor,
      })
    } else {
      setConfigForm({ primaryAccountId: '', secondaryAccountId: null, tertiaryAccountId: null, preferredProcessor: 'AUTO' })
    }
  }, [paymentData])

  // Save payment config mutation
  const saveConfigMutation = useMutation({
    mutationFn: (data: SetOrgPaymentConfigData) =>
      organizationAPI.setOrganizationPaymentConfig(organization!.id, data),
    onSuccess: () => {
      toast({ title: 'Configuracion de pago guardada' })
      queryClient.invalidateQueries({ queryKey: ['org-payment-config', organization?.id] })
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar configuracion',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Delete payment config mutation
  const deleteConfigMutation = useMutation({
    mutationFn: () => organizationAPI.deleteOrganizationPaymentConfig(organization!.id),
    onSuccess: () => {
      toast({ title: 'Configuracion de pago eliminada' })
      queryClient.invalidateQueries({ queryKey: ['org-payment-config', organization?.id] })
    },
    onError: (error: any) => {
      toast({
        title: 'Error al eliminar configuracion',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Save pricing mutation
  const savePricingMutation = useMutation({
    mutationFn: (data: SetOrgPricingData) =>
      organizationAPI.setOrganizationPricing(organization!.id, data),
    onSuccess: () => {
      toast({ title: 'Tarifas guardadas' })
      queryClient.invalidateQueries({ queryKey: ['org-payment-config', organization?.id] })
      setPricingForm(prev => ({ ...prev, debitRate: 0, creditRate: 0, amexRate: 0, internationalRate: 0 }))
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar tarifas',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Delete pricing mutation
  const deletePricingMutation = useMutation({
    mutationFn: (pricingId: string) =>
      organizationAPI.deleteOrganizationPricing(organization!.id, pricingId),
    onSuccess: () => {
      toast({ title: 'Tarifa desactivada' })
      queryClient.invalidateQueries({ queryKey: ['org-payment-config', organization?.id] })
    },
    onError: (error: any) => {
      toast({
        title: 'Error al desactivar tarifa',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault()
    if (!configForm.primaryAccountId) {
      toast({ title: 'Selecciona una cuenta primaria', variant: 'destructive' })
      return
    }
    saveConfigMutation.mutate(configForm)
  }

  const handleSavePricing = (e: React.FormEvent) => {
    e.preventDefault()
    savePricingMutation.mutate({
      ...pricingForm,
      effectiveFrom: new Date().toISOString(),
    })
  }

  if (!organization) return null

  const venueInheritance = paymentData?.venueInheritance || []
  const pricingStructures = paymentData?.pricingStructures || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[850px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5">
              <CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            Configuracion de Pagos - {organization.name}
          </DialogTitle>
          <DialogDescription>
            Configura cuentas merchant y tarifas a nivel organizacion. Se heredan a todas las sucursales sin configuracion propia.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="config" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border w-full">
              <TabsTrigger value="config" className="flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground cursor-pointer">
                Cuentas Merchant
              </TabsTrigger>
              <TabsTrigger value="pricing" className="flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground cursor-pointer">
                Tarifas
              </TabsTrigger>
              <TabsTrigger value="venues" className="group flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground cursor-pointer">
                <span>Herencia</span>
                <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
                  {venueInheritance.length}
                </span>
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Merchant Account Config */}
            <TabsContent value="config" className="flex-1 overflow-y-auto mt-4">
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <GlassCard className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Cuenta Primaria *</Label>
                    <Select
                      value={configForm.primaryAccountId || undefined}
                      onValueChange={v => setConfigForm(prev => ({ ...prev, primaryAccountId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cuenta primaria" />
                      </SelectTrigger>
                      <SelectContent>
                        {merchantAccounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.displayName || acc.alias || acc.externalMerchantId} — {acc.providerName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cuenta Secundaria</Label>
                      <Select
                        value={configForm.secondaryAccountId || 'none'}
                        onValueChange={v => setConfigForm(prev => ({ ...prev, secondaryAccountId: v === 'none' ? null : v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Ninguna" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Ninguna</SelectItem>
                          {merchantAccounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.displayName || acc.alias || acc.externalMerchantId}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Cuenta Terciaria</Label>
                      <Select
                        value={configForm.tertiaryAccountId || 'none'}
                        onValueChange={v => setConfigForm(prev => ({ ...prev, tertiaryAccountId: v === 'none' ? null : v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Ninguna" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Ninguna</SelectItem>
                          {merchantAccounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.displayName || acc.alias || acc.externalMerchantId}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Procesador Preferido</Label>
                    <Select
                      value={configForm.preferredProcessor || 'AUTO'}
                      onValueChange={v => setConfigForm(prev => ({ ...prev, preferredProcessor: v as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUTO">Automatico</SelectItem>
                        <SelectItem value="LEGACY">Legacy (Blumon)</SelectItem>
                        <SelectItem value="MENTA">Menta</SelectItem>
                        <SelectItem value="CLIP">Clip</SelectItem>
                        <SelectItem value="BANK_DIRECT">Transferencia Bancaria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </GlassCard>

                <div className="flex items-center justify-between">
                  {paymentData?.paymentConfig && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteConfigMutation.mutate()}
                      disabled={deleteConfigMutation.isPending}
                      className="rounded-full cursor-pointer"
                    >
                      {deleteConfigMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Eliminar Config
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={saveConfigMutation.isPending || !configForm.primaryAccountId}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 ml-auto rounded-full cursor-pointer"
                  >
                    {saveConfigMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Guardar Cuentas
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* Tab 2: Pricing */}
            <TabsContent value="pricing" className="flex-1 overflow-y-auto mt-4 space-y-4">
              {/* Existing pricing structures */}
              {pricingStructures.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Tarifas Activas</h4>
                  {pricingStructures.map(ps => (
                    <GlassCard key={ps.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={cn('rounded-full', ACCOUNT_TYPE_LABELS[ps.accountType as AccountType]?.color || '')}>
                            {ACCOUNT_TYPE_LABELS[ps.accountType as AccountType]?.label || ps.accountType}
                          </Badge>
                          <span className="text-sm font-mono">
                            D:{(Number(ps.debitRate) * 100).toFixed(2)}% C:{(Number(ps.creditRate) * 100).toFixed(2)}% A:{(Number(ps.amexRate) * 100).toFixed(2)}% I:{(Number(ps.internationalRate) * 100).toFixed(2)}%
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deletePricingMutation.mutate(ps.id)}
                          disabled={deletePricingMutation.isPending}
                          className="text-red-500 hover:text-red-600 h-8 w-8 rounded-full cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      {ps.contractReference && (
                        <p className="text-xs text-muted-foreground mt-1">Ref: {ps.contractReference}</p>
                      )}
                    </GlassCard>
                  ))}
                </div>
              )}

              {/* New pricing form */}
              <form onSubmit={handleSavePricing} className="space-y-4">
                <GlassCard className="p-4 space-y-4">
                  <h4 className="text-sm font-medium">Nueva Tarifa</h4>
                  <div className="space-y-2">
                    <Label>Tipo de Cuenta</Label>
                    <Select
                      value={pricingForm.accountType}
                      onValueChange={v => setPricingForm(prev => ({ ...prev, accountType: v as AccountType }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRIMARY">Primaria</SelectItem>
                        <SelectItem value="SECONDARY">Secundaria</SelectItem>
                        <SelectItem value="TERTIARY">Terciaria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tasa Debito (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={pricingForm.debitRate ? (pricingForm.debitRate * 100).toFixed(2) : ''}
                        onChange={e => setPricingForm(prev => ({ ...prev, debitRate: Number(e.target.value) / 100 }))}
                        placeholder="1.68"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tasa Credito (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={pricingForm.creditRate ? (pricingForm.creditRate * 100).toFixed(2) : ''}
                        onChange={e => setPricingForm(prev => ({ ...prev, creditRate: Number(e.target.value) / 100 }))}
                        placeholder="2.30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tasa Amex (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={pricingForm.amexRate ? (pricingForm.amexRate * 100).toFixed(2) : ''}
                        onChange={e => setPricingForm(prev => ({ ...prev, amexRate: Number(e.target.value) / 100 }))}
                        placeholder="3.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tasa Internacional (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={pricingForm.internationalRate ? (pricingForm.internationalRate * 100).toFixed(2) : ''}
                        onChange={e => setPricingForm(prev => ({ ...prev, internationalRate: Number(e.target.value) / 100 }))}
                        placeholder="3.30"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Referencia de Contrato</Label>
                      <Input
                        value={pricingForm.contractReference || ''}
                        onChange={e => setPricingForm(prev => ({ ...prev, contractReference: e.target.value || null }))}
                        placeholder="CONTRATO-2026-001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notas</Label>
                      <Input
                        value={pricingForm.notes || ''}
                        onChange={e => setPricingForm(prev => ({ ...prev, notes: e.target.value || null }))}
                        placeholder="Notas opcionales"
                      />
                    </div>
                  </div>
                </GlassCard>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={savePricingMutation.isPending}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-full cursor-pointer"
                  >
                    {savePricingMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Guardar Tarifas
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* Tab 3: Venue Inheritance */}
            <TabsContent value="venues" className="flex-1 overflow-y-auto mt-4">
              {venueInheritance.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Esta organizacion no tiene sucursales
                </div>
              ) : (
                <div className="space-y-2">
                  {venueInheritance.map(v => (
                    <GlassCard key={v.venueId} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium">{v.venueName}</h4>
                          <p className="text-xs text-muted-foreground font-mono">{v.venueSlug}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <InheritanceBadge label="Config" source={v.paymentConfig.source} hasOverride={v.paymentConfig.hasVenueOverride} />
                          <InheritanceBadge label="Tarifas" source={v.pricing.source} hasOverride={v.pricing.hasVenueOverride} />
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}

              <div className="pt-4 border-t mt-4">
                <p className="text-xs text-muted-foreground">
                  Las sucursales con configuracion propia ("Personalizado") no se ven afectadas por cambios a nivel organizacion.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

const InheritanceBadge: React.FC<{ label: string; source: string; hasOverride: boolean }> = ({ label, source, hasOverride }) => {
  if (source === 'none') {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground rounded-full">
        {label}: Sin config
      </Badge>
    )
  }
  if (hasOverride) {
    return (
      <Badge variant="secondary" className="text-xs text-blue-600 bg-blue-500/10 rounded-full">
        {label}: Personalizado
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="text-xs text-emerald-600 bg-emerald-500/10 rounded-full">
      <Check className="w-3 h-3 mr-1" />
      {label}: Heredado
    </Badge>
  )
}

// ===========================================
// MAIN COMPONENT
// ===========================================

const OrganizationManagement: React.FC = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch all organizations
  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ['superadmin-organizations'],
    queryFn: organizationAPI.getAllOrganizations,
  })

  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false)
  const [isPaymentConfigDialogOpen, setIsPaymentConfigDialogOpen] = useState(false)
  const [isPaymentWizardOpen, setIsPaymentWizardOpen] = useState(false)

  // Filtered organizations
  const filteredOrganizations = useMemo(() => {
    return organizations.filter(org => {
      const matchesSearch =
        org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (org.slug?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
        org.email.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = typeFilter === 'all' || org.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [organizations, searchTerm, typeFilter])

  // Stats
  const stats = useMemo(() => ({
    total: organizations.length,
    totalVenues: organizations.reduce((acc, org) => acc + org.venueCount, 0),
    totalStaff: organizations.reduce((acc, org) => acc + org.staffCount, 0),
    withModules: organizations.filter(org => org.enabledModules.length > 0).length,
  }), [organizations])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateOrganizationData) => organizationAPI.createOrganization(data),
    onSuccess: () => {
      toast({ title: 'Organización creada exitosamente' })
      queryClient.invalidateQueries({ queryKey: ['superadmin-organizations'] })
      setIsCreateDialogOpen(false)
    },
    onError: (error: any) => {
      toast({
        title: 'Error al crear organización',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrganizationData }) =>
      organizationAPI.updateOrganization(id, data),
    onSuccess: () => {
      toast({ title: 'Organización actualizada exitosamente' })
      queryClient.invalidateQueries({ queryKey: ['superadmin-organizations'] })
      setIsEditDialogOpen(false)
      setSelectedOrganization(null)
    },
    onError: (error: any) => {
      toast({
        title: 'Error al actualizar organización',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => organizationAPI.deleteOrganization(id),
    onSuccess: () => {
      toast({ title: 'Organización eliminada exitosamente' })
      queryClient.invalidateQueries({ queryKey: ['superadmin-organizations'] })
      setIsDeleteDialogOpen(false)
      setSelectedOrganization(null)
    },
    onError: (error: any) => {
      toast({
        title: 'Error al eliminar organización',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Handlers
  const handleEdit = (org: Organization) => {
    setSelectedOrganization(org)
    setIsEditDialogOpen(true)
  }

  const handleDelete = (org: Organization) => {
    setSelectedOrganization(org)
    setIsDeleteDialogOpen(true)
  }

  const handleManageModules = (org: Organization) => {
    setSelectedOrganization(org)
    setIsModuleDialogOpen(true)
  }

  const handlePaymentConfig = (org: Organization) => {
    setSelectedOrganization(org)
    setIsPaymentConfigDialogOpen(true)
  }

  const handlePaymentWizard = (org: Organization) => {
    setSelectedOrganization(org)
    setIsPaymentWizardOpen(true)
  }

  const handleSaveCreate = (data: CreateOrganizationData | UpdateOrganizationData) => {
    createMutation.mutate(data as CreateOrganizationData)
  }

  const handleSaveEdit = (data: CreateOrganizationData | UpdateOrganizationData) => {
    if (selectedOrganization) {
      updateMutation.mutate({ id: selectedOrganization.id, data })
    }
  }

  const handleConfirmDelete = () => {
    if (selectedOrganization) {
      deleteMutation.mutate(selectedOrganization.id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Organizaciones</h1>
          <p className="text-muted-foreground">Administra organizaciones y sus módulos habilitados</p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-full cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Organización
        </Button>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
              <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Organizaciones</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <Store className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalVenues}</p>
              <p className="text-xs text-muted-foreground">Total Sucursales</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalStaff}</p>
              <p className="text-xs text-muted-foreground">Total Usuarios</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
              <Package className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.withModules}</p>
              <p className="text-xs text-muted-foreground">Con Módulos Activos</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Filters */}
      <GlassCard className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar organizaciones..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 rounded-full"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Tipo de negocio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {BUSINESS_TYPES.map(bt => (
                <SelectItem key={bt.value} value={bt.value}>
                  <div className="flex items-center gap-2">
                    {bt.icon}
                    {bt.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      {/* Organizations Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Cargando organizaciones...</span>
        </div>
      ) : filteredOrganizations.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
            <Building2 className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">Sin organizaciones</h3>
          <p className="text-sm text-muted-foreground mb-6">
            {searchTerm || typeFilter !== 'all'
              ? 'No se encontraron resultados con los filtros aplicados'
              : 'No hay organizaciones registradas. Crea una para comenzar.'}
          </p>
          {!searchTerm && typeFilter === 'all' && (
            <Button onClick={() => setIsCreateDialogOpen(true)} className="rounded-full cursor-pointer">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Organización
            </Button>
          )}
        </GlassCard>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando {filteredOrganizations.length} de {organizations.length} organizaciones
            </p>
            <Badge variant="outline" className="rounded-full">{filteredOrganizations.length} resultados</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrganizations.map(org => (
              <OrganizationCard
                key={org.id}
                organization={org}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onManageModules={handleManageModules}
                onPaymentConfig={handlePaymentConfig}
                onPaymentWizard={handlePaymentWizard}
              />
            ))}
          </div>
        </>
      )}

      {/* Dialogs */}
      <OrganizationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        organization={null}
        onSave={handleSaveCreate}
        isLoading={createMutation.isPending}
      />

      <OrganizationDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        organization={selectedOrganization}
        onSave={handleSaveEdit}
        isLoading={updateMutation.isPending}
      />

      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        organization={selectedOrganization}
        onConfirm={handleConfirmDelete}
        isLoading={deleteMutation.isPending}
      />

      <ModuleManagementDialog
        open={isModuleDialogOpen}
        onOpenChange={setIsModuleDialogOpen}
        organization={selectedOrganization}
      />

      <PaymentConfigDialog
        open={isPaymentConfigDialogOpen}
        onOpenChange={setIsPaymentConfigDialogOpen}
        organization={selectedOrganization}
      />

      {selectedOrganization && (
        <PaymentSetupWizard
          open={isPaymentWizardOpen}
          onClose={() => {
            setIsPaymentWizardOpen(false)
            queryClient.invalidateQueries({ queryKey: ['superadmin-organizations'] })
          }}
          target={{
            type: 'organization',
            organizationId: selectedOrganization.id,
            orgName: selectedOrganization.name,
          }}
        />
      )}
    </div>
  )
}

export default OrganizationManagement
