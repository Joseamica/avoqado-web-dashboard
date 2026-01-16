import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import {
  CreditCard,
  Plus,
  Building2,
  Wallet,
  Globe,
  Pencil,
  Trash2,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Store,
} from 'lucide-react'
import { paymentProviderAPI, type PaymentProvider } from '@/services/paymentProvider.service'
import { PaymentProviderDialog } from './components/PaymentProviderDialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

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

interface StatusPulseProps {
  status: 'success' | 'warning' | 'error' | 'neutral'
}

const StatusPulse: React.FC<StatusPulseProps> = ({ status }) => {
  const colors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    neutral: 'bg-muted',
  }
  return (
    <span className="relative flex h-3 w-3">
      <span
        className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', colors[status])}
      />
      <span className={cn('relative inline-flex rounded-full h-3 w-3', colors[status])} />
    </span>
  )
}

// ===========================================
// METRIC CARD COMPONENT
// ===========================================

interface MetricCardProps {
  icon: React.ReactNode
  value: string | number
  label: string
  gradient: string
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, value, label, gradient }) => (
  <GlassCard className="p-4">
    <div className="flex items-center gap-3">
      <div className={cn('p-2.5 rounded-xl bg-gradient-to-br', gradient)}>{icon}</div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  </GlassCard>
)

// ===========================================
// PROVIDER TYPE ICONS & LABELS
// ===========================================

const PROVIDER_TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; gradient: string }> = {
  PAYMENT_PROCESSOR: {
    icon: <CreditCard className="w-4 h-4" />,
    label: 'Procesador de Pagos',
    gradient: 'from-blue-500/20 to-blue-500/5',
  },
  GATEWAY: {
    icon: <Globe className="w-4 h-4" />,
    label: 'Gateway',
    gradient: 'from-purple-500/20 to-purple-500/5',
  },
  WALLET: {
    icon: <Wallet className="w-4 h-4" />,
    label: 'Billetera Digital',
    gradient: 'from-orange-500/20 to-orange-500/5',
  },
  BANK_DIRECT: {
    icon: <Building2 className="w-4 h-4" />,
    label: 'Banco Directo',
    gradient: 'from-green-500/20 to-green-500/5',
  },
  AGGREGATOR: {
    icon: <Store className="w-4 h-4" />,
    label: 'Agregador',
    gradient: 'from-pink-500/20 to-pink-500/5',
  },
}

// ===========================================
// PROVIDER CARD COMPONENT
// ===========================================

interface ProviderCardProps {
  provider: PaymentProvider
  onEdit: (provider: PaymentProvider) => void
  onDelete: (id: string) => void
  onToggleActive: (provider: PaymentProvider) => void
  isToggling: boolean
}

const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  onEdit,
  onDelete,
  onToggleActive,
  isToggling,
}) => {
  const config = PROVIDER_TYPE_CONFIG[provider.type] || PROVIDER_TYPE_CONFIG.GATEWAY

  return (
    <GlassCard className="p-4" hover>
      <div className="flex items-start justify-between gap-4">
        {/* Left: Icon + Info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={cn('p-2.5 rounded-xl bg-gradient-to-br shrink-0', config.gradient)}>
            {React.cloneElement(config.icon as React.ReactElement, {
              className: 'w-5 h-5 text-foreground',
            })}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">{provider.name}</h3>
              <Badge variant="outline" className="text-xs font-mono shrink-0">
                {provider.code}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{config.label}</p>

            {/* Countries */}
            {provider.countryCode && provider.countryCode.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {provider.countryCode.map(code => (
                  <Badge key={code} variant="secondary" className="text-xs px-1.5 py-0">
                    {code}
                  </Badge>
                ))}
              </div>
            )}

            {/* Merchant accounts count */}
            {provider._count?.merchantAccounts !== undefined && provider._count.merchantAccounts > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {provider._count.merchantAccounts} cuenta{provider._count.merchantAccounts !== 1 ? 's' : ''} de merchant
              </p>
            )}
          </div>
        </div>

        {/* Right: Status + Actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {/* Status */}
          <div className="flex items-center gap-2">
            <StatusPulse status={provider.active ? 'success' : 'neutral'} />
            <span className={cn('text-xs font-medium', provider.active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')}>
              {provider.active ? 'Activo' : 'Inactivo'}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Switch
                    checked={provider.active}
                    onCheckedChange={() => onToggleActive(provider)}
                    disabled={isToggling}
                    className="cursor-pointer"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{provider.active ? 'Desactivar' : 'Activar'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(provider)
                    }}
                  >
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Editar</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(provider.id)
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Eliminar</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

// ===========================================
// MAIN COMPONENT
// ===========================================

const PaymentProviders: React.FC = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [providerToDelete, setProviderToDelete] = useState<string | null>(null)

  // Query
  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['payment-providers'],
    queryFn: () => paymentProviderAPI.getAllPaymentProviders(),
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: paymentProviderAPI.createPaymentProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-providers'] })
      toast({ title: 'Proveedor Creado', description: 'El proveedor de pagos ha sido creado exitosamente.' })
    },
    onError: (error: any) => {
      toast({
        title: 'Error al crear proveedor',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PaymentProvider> }) =>
      paymentProviderAPI.updatePaymentProvider(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-providers'] })
      toast({ title: 'Proveedor Actualizado', description: 'El proveedor de pagos ha sido actualizado.' })
    },
    onError: (error: any) => {
      toast({
        title: 'Error al actualizar proveedor',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: paymentProviderAPI.deletePaymentProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-providers'] })
      toast({ title: 'Proveedor Eliminado', description: 'El proveedor de pagos ha sido eliminado.' })
      setDeleteDialogOpen(false)
      setProviderToDelete(null)
    },
    onError: (error: any) => {
      toast({
        title: 'Error al eliminar proveedor',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Handlers
  const handleSave = async (data: Partial<PaymentProvider>) => {
    if (selectedProvider) {
      await updateMutation.mutateAsync({ id: selectedProvider.id, data })
    } else {
      await createMutation.mutateAsync(data as any)
    }
  }

  const handleEdit = (provider: PaymentProvider) => {
    setSelectedProvider(provider)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setSelectedProvider(null)
    setDialogOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    setProviderToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (providerToDelete) {
      await deleteMutation.mutateAsync(providerToDelete)
    }
  }

  const handleToggleActive = async (provider: PaymentProvider) => {
    await updateMutation.mutateAsync({
      id: provider.id,
      data: { active: !provider.active },
    })
  }

  // Filter providers
  const filteredProviders = useMemo(() => {
    return providers.filter(
      provider =>
        provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        provider.code.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [providers, searchTerm])

  // Stats
  const activeCount = providers.filter(p => p.active).length
  const totalMerchantAccounts = providers.reduce((sum, p) => sum + (p._count?.merchantAccounts || 0), 0)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proveedores de Pago</h1>
          <p className="text-muted-foreground text-sm">
            Gestiona los proveedores de pago disponibles en la plataforma
          </p>
        </div>
        <Button onClick={handleAdd} className="cursor-pointer shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Proveedor
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          value={providers.length}
          label="Total Proveedores"
          gradient="from-blue-500/20 to-blue-500/5"
        />
        <MetricCard
          icon={<CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />}
          value={activeCount}
          label="Activos"
          gradient="from-green-500/20 to-green-500/5"
        />
        <MetricCard
          icon={<XCircle className="w-5 h-5 text-muted-foreground" />}
          value={providers.length - activeCount}
          label="Inactivos"
          gradient="from-gray-500/20 to-gray-500/5"
        />
        <MetricCard
          icon={<Store className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
          value={totalMerchantAccounts}
          label="Cuentas Merchant"
          gradient="from-purple-500/20 to-purple-500/5"
        />
      </div>

      {/* Search */}
      <GlassCard className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o código..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 bg-background"
          />
        </div>
      </GlassCard>

      {/* Providers List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredProviders.length === 0 ? (
        <GlassCard className="p-8">
          <div className="text-center">
            <div className="p-3 rounded-full bg-muted w-fit mx-auto mb-3">
              <CreditCard className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium">No hay proveedores</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchTerm
                ? 'No se encontraron proveedores con ese criterio de búsqueda.'
                : 'Aún no hay proveedores de pago configurados.'}
            </p>
            {!searchTerm && (
              <Button onClick={handleAdd} className="mt-4 cursor-pointer">
                <Plus className="w-4 h-4 mr-2" />
                Crear Primer Proveedor
              </Button>
            )}
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredProviders.map(provider => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onToggleActive={handleToggleActive}
              isToggling={updateMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Dialog */}
      <PaymentProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        provider={selectedProvider}
        onSave={handleSave}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El proveedor será eliminado permanentemente del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default PaymentProviders
