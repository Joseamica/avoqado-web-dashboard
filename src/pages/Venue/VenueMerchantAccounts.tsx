import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Building2,
  Plus,
  Zap,
  Shield,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Smartphone,
  Loader2,
  Trash2,
  Power,
  Pencil,
  Eye,
  EyeOff,
  Terminal,
  ArrowRight,
  Check,
  Info,
  AlertTriangle,
  X,
  Calculator,
  DollarSign,
  Percent,
  RefreshCw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import {
  paymentProviderAPI,
  type MerchantAccount,
  type MerchantAccountCredentials,
  type ProviderCostStructure,
  type MccLookupResult,
} from '@/services/paymentProvider.service'
import { terminalAPI } from '@/services/superadmin-terminals.service'
import { useToast } from '@/hooks/use-toast'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

/**
 * VenueMerchantAccounts - Modern 2025/2026 Design
 *
 * This page allows SUPERADMIN to create and manage merchant accounts
 * directly within the venue context.
 */

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

/** Glassmorphism card wrapper */
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

/** Status indicator with pulse animation */
const StatusPulse: React.FC<{ status: 'success' | 'warning' | 'error' | 'neutral' }> = ({ status }) => {
  const colors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    neutral: 'bg-muted-foreground',
  }

  return (
    <span className="relative flex h-3 w-3">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', colors[status])} />
      <span className={cn('relative inline-flex rounded-full h-3 w-3', colors[status])} />
    </span>
  )
}

/** Step indicator component */
const StepIndicator: React.FC<{
  steps: { label: string; description?: string }[]
  currentStep: number
}> = ({ steps, currentStep }) => (
  <div className="flex items-center gap-2">
    {steps.map((step, index) => (
      <React.Fragment key={step.label}>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
              index < currentStep && 'bg-green-500 text-primary-foreground',
              index === currentStep && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
              index > currentStep && 'bg-muted text-muted-foreground',
            )}
          >
            {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
          </div>
          <div className="hidden sm:block">
            <p className={cn('text-sm font-medium', index <= currentStep ? 'text-foreground' : 'text-muted-foreground')}>{step.label}</p>
          </div>
        </div>
        {index < steps.length - 1 && (
          <div className={cn('flex-1 h-0.5 rounded-full mx-2', index < currentStep ? 'bg-green-500' : 'bg-muted')} />
        )}
      </React.Fragment>
    ))}
  </div>
)

// ============================================================================
// MANUAL ACCOUNT DIALOG (Create/Edit)
// ============================================================================

interface ManualAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: MerchantAccount | null
  onSave: (data: any) => Promise<void>
}

const ManualAccountDialog: React.FC<ManualAccountDialogProps> = ({ open, onOpenChange, account, onSave }) => {
  const { t } = useTranslation(['payment', 'common'])
  const [loading, setLoading] = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)

  const [formData, setFormData] = useState({
    providerId: '',
    externalMerchantId: '',
    alias: '',
    displayName: '',
    active: true,
    displayOrder: 0,
    merchantId: '',
    apiKey: '',
    customerId: '',
    terminalId: '',
    providerConfig: '',
  })

  // Fetch providers for dropdown
  const { data: providers = [] } = useQuery({
    queryKey: ['payment-providers-list'],
    queryFn: () => paymentProviderAPI.getAllPaymentProviders({ active: true }),
    enabled: open,
  })

  useEffect(() => {
    if (account) {
      setFormData({
        providerId: account.providerId,
        externalMerchantId: account.externalMerchantId,
        alias: account.alias || '',
        displayName: account.displayName || '',
        active: account.active,
        displayOrder: account.displayOrder || 0,
        merchantId: '',
        apiKey: '',
        customerId: '',
        terminalId: '',
        providerConfig: account.providerConfig ? JSON.stringify(account.providerConfig, null, 2) : '',
      })
    } else {
      setFormData({
        providerId: '',
        externalMerchantId: '',
        alias: '',
        displayName: '',
        active: true,
        displayOrder: 0,
        merchantId: '',
        apiKey: '',
        customerId: '',
        terminalId: '',
        providerConfig: '',
      })
    }
  }, [account, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const credentials: MerchantAccountCredentials = {
        merchantId: formData.merchantId,
        apiKey: formData.apiKey,
        customerId: formData.customerId || undefined,
        terminalId: formData.terminalId || undefined,
      }

      let providerConfig: any = undefined
      if (formData.providerConfig) {
        try {
          providerConfig = JSON.parse(formData.providerConfig)
        } catch {
          alert('JSON inválido en provider config')
          setLoading(false)
          return
        }
      }

      await onSave({
        providerId: formData.providerId,
        externalMerchantId: formData.externalMerchantId,
        alias: formData.alias || undefined,
        displayName: formData.displayName || undefined,
        active: formData.active,
        displayOrder: formData.displayOrder,
        credentials,
        providerConfig,
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving account:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-background">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{account ? 'Editar Cuenta' : 'Crear Cuenta Manual'}</DialogTitle>
            <DialogDescription>
              {account ? 'Actualiza la información de la cuenta' : 'Ingresa las credenciales manualmente'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Provider */}
            <div className="grid gap-2">
              <Label>
                Procesador de Pago <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.providerId}
                onValueChange={value => setFormData({ ...formData, providerId: value })}
                disabled={!!account}
              >
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder="Seleccionar procesador..." />
                </SelectTrigger>
                <SelectContent>
                  {providers.map(provider => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name} ({provider.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* External Merchant ID */}
            <div className="grid gap-2">
              <Label>
                External Merchant ID <span className="text-destructive">*</span>
              </Label>
              <Input
                value={formData.externalMerchantId}
                onChange={e => setFormData({ ...formData, externalMerchantId: e.target.value })}
                placeholder="ID único del comercio en el procesador"
                required
                className="bg-background border-input font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Alias */}
              <div className="grid gap-2">
                <Label>Alias (interno)</Label>
                <Input
                  value={formData.alias}
                  onChange={e => setFormData({ ...formData, alias: e.target.value })}
                  placeholder="Ej: cuenta-principal"
                  className="bg-background border-input"
                />
              </div>

              {/* Display Name */}
              <div className="grid gap-2">
                <Label>Nombre para mostrar</Label>
                <Input
                  value={formData.displayName}
                  onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="Ej: Cuenta Caja 1"
                  className="bg-background border-input"
                />
              </div>
            </div>

            {/* Credentials Section */}
            <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Credenciales</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowCredentials(!showCredentials)}>
                  {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>

              {!account && (
                <div className="flex items-start space-x-2 text-sm bg-blue-50 dark:bg-blue-950/50 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                  <p className="text-blue-700 dark:text-blue-300">Las credenciales se encriptarán automáticamente (AES-256-CBC)</p>
                </div>
              )}

              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Merchant ID {!account && <span className="text-destructive">*</span>}</Label>
                    <Input
                      type={showCredentials ? 'text' : 'password'}
                      value={formData.merchantId}
                      onChange={e => setFormData({ ...formData, merchantId: e.target.value })}
                      required={!account}
                      placeholder="••••••••"
                      className="bg-background border-input font-mono text-sm"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>API Key {!account && <span className="text-destructive">*</span>}</Label>
                    <Input
                      type={showCredentials ? 'text' : 'password'}
                      value={formData.apiKey}
                      onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                      required={!account}
                      placeholder="••••••••"
                      className="bg-background border-input font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Customer ID (opcional)</Label>
                    <Input
                      type={showCredentials ? 'text' : 'password'}
                      value={formData.customerId}
                      onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                      placeholder="••••••••"
                      className="bg-background border-input font-mono text-sm"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Terminal ID (opcional)</Label>
                    <Input
                      type={showCredentials ? 'text' : 'password'}
                      value={formData.terminalId}
                      onChange={e => setFormData({ ...formData, terminalId: e.target.value })}
                      placeholder="••••••••"
                      className="bg-background border-input font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Provider Config (JSON) */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight className="w-4 h-4 transition-transform ui-expanded:rotate-90" />
                  Configuración avanzada
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3">
                <div className="grid gap-2">
                  <Label>Provider Config (JSON)</Label>
                  <Textarea
                    value={formData.providerConfig}
                    onChange={e => setFormData({ ...formData, providerConfig: e.target.value })}
                    placeholder='{"webhookSecret": "whsec_...", "mode": "live"}'
                    rows={3}
                    className="bg-background border-input font-mono text-xs"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Orden de visualización</Label>
                  <Input
                    type="number"
                    value={formData.displayOrder}
                    onChange={e => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                    className="bg-background border-input w-24"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked: boolean) => setFormData({ ...formData, active: checked })}
                  />
                  <label htmlFor="active" className="text-sm font-medium cursor-pointer">
                    Cuenta activa
                  </label>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {account ? 'Guardar Cambios' : 'Crear Cuenta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// DELETE CONFIRMATION DIALOG (with dependencies)
// ============================================================================

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: MerchantAccount | null
  onConfirmDelete: () => Promise<void>
  onDeleteCostStructure: (id: string) => Promise<void>
  onDeleteVenueConfig: (venueId: string, configId: string) => Promise<void>
}

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  onOpenChange,
  account,
  onConfirmDelete,
  onDeleteCostStructure,
  onDeleteVenueConfig,
}) => {
  const [loading, setLoading] = useState(false)
  const [deletingCost, setDeletingCost] = useState<string | null>(null)
  const [deletingConfig, setDeletingConfig] = useState<string | null>(null)
  const [removingTerminal, setRemovingTerminal] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Fetch cost structures for this merchant account
  // Always fetch when dialog is open - don't rely on _count which may not be populated
  const {
    data: costStructures = [],
    refetch: refetchCosts,
    isLoading: loadingCosts,
  } = useQuery({
    queryKey: ['merchant-account-costs', account?.id],
    queryFn: () => paymentProviderAPI.getProviderCostStructuresByMerchantAccount(account!.id),
    enabled: open && !!account,
  })

  // Fetch venue configs for this merchant account
  const {
    data: venueConfigs = [],
    refetch: refetchConfigs,
    isLoading: loadingConfigs,
  } = useQuery({
    queryKey: ['merchant-account-configs', account?.id],
    queryFn: () => paymentProviderAPI.getVenueConfigsByMerchantAccount(account!.id),
    enabled: open && !!account,
  })

  // Fetch terminals that have this merchant account assigned
  const {
    data: assignedTerminals = [],
    refetch: refetchTerminals,
    isLoading: loadingTerminals,
  } = useQuery({
    queryKey: ['merchant-account-terminals', account?.id],
    queryFn: () => paymentProviderAPI.getTerminalsByMerchantAccount(account!.id),
    enabled: open && !!account,
  })

  // Early return AFTER all hooks are called
  if (!account) return null

  const isLoadingDependencies = loadingCosts || loadingConfigs || loadingTerminals

  const handleDeleteCost = async (costId: string) => {
    setDeletingCost(costId)
    try {
      await onDeleteCostStructure(costId)
      refetchCosts()
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
    } finally {
      setDeletingCost(null)
    }
  }

  const handleDeleteConfig = async (venueId: string, configId: string) => {
    setDeletingConfig(configId)
    try {
      await onDeleteVenueConfig(venueId, configId)
      refetchConfigs()
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
    } finally {
      setDeletingConfig(null)
    }
  }

  const handleRemoveTerminal = async (terminalId: string) => {
    setRemovingTerminal(terminalId)
    try {
      await paymentProviderAPI.removeMerchantFromTerminal(account.id, terminalId)
      refetchTerminals()
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
    } finally {
      setRemovingTerminal(null)
    }
  }

  const handleFinalDelete = async () => {
    setLoading(true)
    try {
      await onConfirmDelete()
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  // Calculate dependencies from actual fetched data
  const actualCostCount = costStructures.length
  const actualConfigCount = venueConfigs.length
  const actualTerminalCount = assignedTerminals.length
  const hasDependencies = actualCostCount > 0 || actualConfigCount > 0 || actualTerminalCount > 0
  const canDelete = !isLoadingDependencies && actualCostCount === 0 && actualConfigCount === 0 && actualTerminalCount === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] bg-background">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('p-2.5 rounded-xl', hasDependencies ? 'bg-yellow-500/20' : 'bg-red-500/20')}>
              {hasDependencies ? (
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              ) : (
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div>
              <DialogTitle>
                {isLoadingDependencies ? 'Verificando dependencias...' : hasDependencies ? 'Dependencias encontradas' : 'Eliminar cuenta'}
              </DialogTitle>
              <DialogDescription>{account.displayName || account.alias || account.externalMerchantId}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {isLoadingDependencies ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Verificando dependencias...</span>
            </div>
          ) : hasDependencies ? (
            <>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  <p className="font-medium mb-1">Esta cuenta tiene dependencias</p>
                  <p>Debes eliminar las estructuras de costo y configuraciones de venue antes de poder eliminar esta cuenta.</p>
                </div>
              </div>

              {/* Cost Structures */}
              {actualCostCount > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Badge variant="secondary">{actualCostCount}</Badge>
                    Estructura(s) de Costo
                  </h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Las tasas que Blumon cobra a Avoqado por esta cuenta. Al eliminar, se perderá el historial de costos.
                  </p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {costStructures.map((cost: any) => (
                      <div key={cost.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                        <div className="text-sm">
                          <p className="font-medium">
                            Crédito: {(Number(cost.creditRate) * 100).toFixed(2)}% | Débito: {(Number(cost.debitRate) * 100).toFixed(2)}%
                          </p>
                          <p className="text-xs text-muted-foreground">Desde: {new Date(cost.effectiveFrom).toLocaleDateString()}</p>
                        </div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteCost(cost.id)}
                                disabled={deletingCost === cost.id}
                                className="text-destructive hover:text-destructive"
                              >
                                {deletingCost === cost.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Eliminar estructura de costo</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Venue Configs */}
              {actualConfigCount > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Badge variant="secondary">{actualConfigCount}</Badge>
                    Configuración(es) de Venue
                  </h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Venues que usan esta cuenta para procesar pagos. Al eliminar, el venue perderá su configuración de pagos.
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {venueConfigs.map((config: any) => (
                      <div key={config.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                        <div className="text-sm flex-1">
                          <p className="font-medium">{config.venue?.name || 'Venue'}</p>
                          <p className="text-xs text-muted-foreground">
                            Usa esta cuenta como:{' '}
                            <span className="font-medium text-foreground">
                              {config.accountType === 'PRIMARY'
                                ? 'Principal'
                                : config.accountType === 'SECONDARY'
                                ? 'Secundaria'
                                : 'Terciaria'}
                            </span>
                          </p>
                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                            ⚠️ Se eliminará TODA la config de pagos de este venue
                          </p>
                        </div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteConfig(config.venueId, config.id)}
                                disabled={deletingConfig === config.id}
                                className="text-destructive hover:text-destructive"
                              >
                                {deletingConfig === config.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Eliminar configuración de pagos del venue</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Assigned Terminals */}
              {actualTerminalCount > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Badge variant="secondary">{actualTerminalCount}</Badge>
                    Terminal(es) Asignadas
                  </h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Terminales que tienen esta cuenta asignada. Desvincular no elimina la terminal, solo quita la cuenta de su lista.
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {assignedTerminals.map((terminal: any) => (
                      <div
                        key={terminal.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50"
                      >
                        <div className="text-sm flex-1">
                          <p className="font-medium flex items-center gap-2">
                            <Terminal className="w-4 h-4 text-muted-foreground" />
                            {terminal.name || 'Terminal'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Serial: <span className="font-mono">{terminal.serialNumber}</span>
                          </p>
                          {terminal.venue && <p className="text-xs text-muted-foreground">Venue: {terminal.venue.name}</p>}
                        </div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveTerminal(terminal.id)}
                                disabled={removingTerminal === terminal.id}
                                className="text-orange-600 hover:text-orange-700"
                              >
                                {removingTerminal === terminal.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <X className="w-4 h-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Desvincular cuenta de esta terminal</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700 dark:text-red-300">
                <p className="font-medium mb-1">¿Estás seguro?</p>
                <p>Esta acción eliminará permanentemente la cuenta de procesamiento y no se puede deshacer.</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || isLoadingDependencies}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleFinalDelete} disabled={loading || isLoadingDependencies || !canDelete}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoadingDependencies ? 'Verificando...' : canDelete ? 'Eliminar Cuenta' : 'Elimina las dependencias primero'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// BLUMON AUTO-FETCH WIZARD
// ============================================================================

interface BlumonWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
  onSuccess: () => void
}

const BlumonAutoFetchWizard: React.FC<BlumonWizardProps> = ({ open, onOpenChange, venueId, onSuccess }) => {
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const [formData, setFormData] = useState({
    serialNumber: '',
    brand: 'PAX',
    model: 'A910S',
    displayName: '',
    environment: 'SANDBOX' as 'SANDBOX' | 'PRODUCTION',
    businessCategory: '',
  })

  // Cost structure preview state
  const [createCostStructure, setCreateCostStructure] = useState(true)
  const [mccPreview, setMccPreview] = useState<MccLookupResult | null>(null)
  const [loadingMccPreview, setLoadingMccPreview] = useState(false)

  const steps = [
    { label: 'Terminal', description: 'Datos del dispositivo' },
    { label: 'Configurar', description: 'Opciones adicionales' },
    { label: 'Costos', description: 'Estructura de costos' },
    { label: 'Confirmar', description: 'Revisar y crear' },
  ]

  const resetWizard = () => {
    setStep(0)
    setResult(null)
    setFormData({
      serialNumber: '',
      brand: 'PAX',
      model: 'A910S',
      displayName: '',
      environment: 'SANDBOX',
      businessCategory: '',
    })
    setCreateCostStructure(true)
    setMccPreview(null)
    setLoadingMccPreview(false)
  }

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(resetWizard, 300)
  }

  // Fetch MCC preview when entering step 2
  const fetchMccPreview = async () => {
    if (!formData.businessCategory) {
      // No business category, use default
      setMccPreview({
        found: false,
        confidence: 0,
        mcc: null,
        familia: 'Otros',
        rates: { credito: 2.59, debito: 1.95, internacional: 3.3, amex: 3.0 },
      } as MccLookupResult)
      return
    }

    setLoadingMccPreview(true)
    try {
      const result = await paymentProviderAPI.getMccRateSuggestion(formData.businessCategory)
      setMccPreview(result)
    } catch (error) {
      console.error('Error fetching MCC preview:', error)
      // Set default rates on error
      setMccPreview({
        found: false,
        confidence: 0,
        mcc: null,
        familia: 'Otros',
        rates: { credito: 2.59, debito: 1.95, internacional: 3.3, amex: 3.0 },
      } as MccLookupResult)
    } finally {
      setLoadingMccPreview(false)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const response = await paymentProviderAPI.autoFetchBlumonCredentials({
        serialNumber: formData.serialNumber,
        brand: formData.brand,
        model: formData.model,
        displayName: formData.displayName || undefined,
        environment: formData.environment,
        businessCategory: formData.businessCategory || undefined,
        skipCostStructure: !createCostStructure, // Skip if checkbox is unchecked
      })

      // Show toast and close dialog immediately
      if (response.alreadyExists) {
        toast({
          title: '📋 Cuenta ya existente',
          description: `Ya existe una cuenta para este terminal: ${response.displayName}`,
        })
      } else {
        toast({
          title: '✅ Cuenta creada exitosamente',
          description: `${response.displayName} está listo para procesar pagos`,
        })
      }

      onSuccess()
      onOpenChange(false) // Close dialog immediately after success
    } catch (error: any) {
      console.error('Auto-fetch error:', error)
      toast({
        variant: 'destructive',
        title: 'Error al crear cuenta',
        description: error.response?.data?.message || error.message || 'Error desconocido',
      })
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    if (step === 0) return formData.serialNumber.length > 0
    return true
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto bg-background p-0">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-yellow-500/10 border-b border-border/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-xl">Blumon Auto-Fetch</DialogTitle>
              <DialogDescription>Crea una cuenta de procesamiento automáticamente</DialogDescription>
            </div>
          </div>

          {step < 4 && <StepIndicator steps={steps} currentStep={step} />}
        </div>

        <div className="p-6">
          {/* Step 0: Terminal Info */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  <p className="font-medium mb-1">¿Cómo funciona?</p>
                  <p>
                    Ingresa el número de serie de tu terminal PAX. El sistema se conectará automáticamente con Blumon para obtener las
                    credenciales OAuth, RSA y DUKPT.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Número de Serie <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={formData.serialNumber}
                    onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                    placeholder="Ej: 2841548417"
                    className="h-12 text-lg font-mono bg-muted/30"
                  />
                  <p className="text-xs text-muted-foreground">
                    Encuéntralo en la etiqueta trasera del terminal o en Configuración &gt; Sistema
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Marca <span className="text-destructive">*</span>
                    </Label>
                    <Select value={formData.brand} onValueChange={value => setFormData({ ...formData, brand: value })}>
                      <SelectTrigger className="h-11 bg-muted/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PAX">
                          <div className="flex items-center gap-2">
                            <Terminal className="w-4 h-4" />
                            PAX Technology
                          </div>
                        </SelectItem>
                        <SelectItem value="Verifone">Verifone</SelectItem>
                        <SelectItem value="Ingenico">Ingenico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Modelo <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={formData.model}
                      onChange={e => setFormData({ ...formData, model: e.target.value })}
                      placeholder="A910S"
                      className="h-11 bg-muted/30"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Configuration */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Nombre para mostrar</Label>
                  <Input
                    value={formData.displayName}
                    onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="Ej: Cuenta Terraza, Cuenta Barra..."
                    className="h-11 bg-muted/30"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Ambiente <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, environment: 'SANDBOX' })}
                      className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all',
                        formData.environment === 'SANDBOX'
                          ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30'
                          : 'border-border hover:border-muted-foreground/50',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="font-medium text-sm">Sandbox</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Para pruebas</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, environment: 'PRODUCTION' })}
                      className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all',
                        formData.environment === 'PRODUCTION'
                          ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                          : 'border-border hover:border-muted-foreground/50',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="font-medium text-sm">Production</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Pagos reales</p>
                    </button>
                  </div>
                </div>

                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronRight className="w-4 h-4" />
                      Opciones avanzadas
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4">
                    <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-border/50">
                      <Label className="text-sm font-medium">Giro del Negocio (fallback para tasas MCC)</Label>
                      <Input
                        value={formData.businessCategory}
                        onChange={e => setFormData({ ...formData, businessCategory: e.target.value })}
                        placeholder="Ej: Restaurante, Gimnasio..."
                        className="h-11 bg-background"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          )}

          {/* Step 2: Cost Structure Preview */}
          {step === 2 && (
            <div className="space-y-6">
              {loadingMccPreview ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* MCC Detection Info */}
                  <div
                    className={cn(
                      'flex items-start gap-3 p-4 rounded-xl border',
                      mccPreview?.found
                        ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                        : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
                    )}
                  >
                    {mccPreview?.found ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div
                      className={cn(
                        'text-sm',
                        mccPreview?.found ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300',
                      )}
                    >
                      <p className="font-medium mb-1">
                        {mccPreview?.found ? 'Tasas detectadas automáticamente' : 'Usando tasas por defecto'}
                      </p>
                      <p className="text-xs">
                        {mccPreview?.found
                          ? `Basado en: ${mccPreview.familia} (MCC ${mccPreview.mcc}) - Confianza: ${mccPreview.confidence}%`
                          : 'No se detectó el giro del negocio. Puedes configurar las tasas después.'}
                      </p>
                    </div>
                  </div>

                  {/* Rate Preview */}
                  {mccPreview?.rates && (
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                      <h4 className="font-medium mb-4 flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-green-600" />
                        Tasas de Procesamiento
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                          <p className="text-xs text-muted-foreground mb-1">Crédito</p>
                          <p className="text-lg font-bold text-green-600">{mccPreview.rates.credito.toFixed(2)}%</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                          <p className="text-xs text-muted-foreground mb-1">Débito</p>
                          <p className="text-lg font-bold text-blue-600">{mccPreview.rates.debito.toFixed(2)}%</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                          <p className="text-xs text-muted-foreground mb-1">Amex</p>
                          <p className="text-lg font-bold text-purple-600">{mccPreview.rates.amex.toFixed(2)}%</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                          <p className="text-xs text-muted-foreground mb-1">Internacional</p>
                          <p className="text-lg font-bold text-orange-600">{mccPreview.rates.internacional.toFixed(2)}%</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Create Cost Structure Checkbox */}
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/20 border border-border/50">
                    <Checkbox
                      id="createCostStructure"
                      checked={createCostStructure}
                      onCheckedChange={checked => setCreateCostStructure(checked === true)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label htmlFor="createCostStructure" className="font-medium cursor-pointer">
                        Crear estructura de costos ahora
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {createCostStructure
                          ? 'Las tasas mostradas arriba se guardarán automáticamente.'
                          : 'Puedes configurarlo después desde el botón de costos en la tarjeta de cuenta.'}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <h4 className="font-medium mb-4">Resumen de configuración</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Número de serie</span>
                    <span className="text-sm font-mono font-medium">{formData.serialNumber}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Terminal</span>
                    <span className="text-sm font-medium">
                      {formData.brand} {formData.model}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Ambiente</span>
                    <Badge variant={formData.environment === 'PRODUCTION' ? 'default' : 'secondary'}>
                      {formData.environment === 'PRODUCTION' ? 'Production' : 'Sandbox'}
                    </Badge>
                  </div>
                  {formData.displayName && (
                    <div className="flex items-center justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Nombre</span>
                      <span className="text-sm font-medium">{formData.displayName}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">Estructura de costos</span>
                    <Badge variant={createCostStructure ? 'default' : 'secondary'}>
                      {createCostStructure ? 'Se creará' : 'Configurar después'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-700 dark:text-green-300">
                  <p className="font-medium mb-1">Lo que sucederá</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Se obtendrán credenciales OAuth de Blumon</li>
                    <li>• Se descargarán RSA keys y DUKPT keys</li>
                    {createCostStructure && <li>• Se creará la estructura de costos automáticamente</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && result && (
            <div className="space-y-6 text-center py-4">
              <div className="relative mx-auto w-fit">
                <div
                  className={cn(
                    'absolute inset-0 rounded-full blur-2xl animate-pulse',
                    result.alreadyExists ? 'bg-blue-500/20' : 'bg-green-500/20',
                  )}
                />
                <div
                  className={cn(
                    'relative p-6 rounded-full border',
                    result.alreadyExists
                      ? 'bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-blue-500/20'
                      : 'bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/20',
                  )}
                >
                  {result.alreadyExists ? (
                    <Info className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-2">{result.alreadyExists ? 'Cuenta Ya Existente' : '¡Cuenta Creada!'}</h3>
                <p className="text-muted-foreground">
                  {result.alreadyExists
                    ? `Ya existe una cuenta para este terminal. Puedes verla en la lista.`
                    : `${result.displayName} está listo para procesar pagos`}
                </p>
              </div>

              <div className="text-left p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Serial</span>
                  <span className="text-sm font-mono">{result.serialNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">POS ID</span>
                  <span className="text-sm font-mono">{result.posId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ambiente</span>
                  <Badge variant={result.blumonEnvironment === 'PRODUCTION' ? 'default' : 'secondary'}>{result.blumonEnvironment}</Badge>
                </div>
                {result.autoAttached?.count > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <span className="text-sm text-green-600 dark:text-green-400">
                      🔗 Auto-vinculado a {result.autoAttached.count} terminal(es)
                    </span>
                  </div>
                )}
              </div>

              {/* Cost Structure Info */}
              {result.costStructure ? (
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="font-medium text-sm text-green-700 dark:text-green-300">Estructura de Costos Creada</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between p-2 rounded-lg bg-background/50">
                      <span className="text-muted-foreground">Crédito</span>
                      <span className="font-medium">{(Number(result.costStructure.creditRate) * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-background/50">
                      <span className="text-muted-foreground">Débito</span>
                      <span className="font-medium">{(Number(result.costStructure.debitRate) * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-background/50">
                      <span className="text-muted-foreground">Amex</span>
                      <span className="font-medium">{(Number(result.costStructure.amexRate) * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-background/50">
                      <span className="text-muted-foreground">Internacional</span>
                      <span className="font-medium">{(Number(result.costStructure.internationalRate) * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                  {result.mccLookup?.found && (
                    <p className="text-xs text-muted-foreground">
                      Basado en: {result.mccLookup.familia} (MCC {result.mccLookup.mcc})
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    <span className="font-medium text-sm text-yellow-700 dark:text-yellow-300">Sin Estructura de Costos</span>
                  </div>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    No se pudo crear automáticamente la estructura de costos. Configúrala desde el botón{' '}
                    <Calculator className="w-3 h-3 inline mx-1" /> en la tarjeta de la cuenta.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-6 pt-0">
          {step < 4 ? (
            <>
              <Button variant="outline" onClick={step === 0 ? handleClose : () => setStep(step - 1)} disabled={loading}>
                {step === 0 ? 'Cancelar' : 'Atrás'}
              </Button>
              {step < 3 ? (
                <Button
                  onClick={() => {
                    // When moving to step 2 (Costos), fetch MCC preview
                    if (step === 1 && !mccPreview && !loadingMccPreview) {
                      fetchMccPreview()
                    }
                    setStep(step + 1)
                  }}
                  disabled={!canProceed()}
                >
                  Continuar
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                </Button>
              )}
            </>
          ) : (
            <Button onClick={handleClose} className="w-full">
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// TERMINAL ASSIGNMENTS DIALOG
// ============================================================================

interface TerminalAssignmentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: MerchantAccount | null
  venueId?: string
}

const TerminalAssignmentsDialog: React.FC<TerminalAssignmentsDialogProps> = ({ open, onOpenChange, account, venueId }) => {
  const [removingTerminal, setRemovingTerminal] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>('')
  const [isLinking, setIsLinking] = useState(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Fetch terminals that have this merchant account assigned
  const {
    data: assignedTerminals = [],
    refetch: refetchTerminals,
    isLoading,
  } = useQuery({
    queryKey: ['merchant-account-terminals', account?.id],
    queryFn: () => paymentProviderAPI.getTerminalsByMerchantAccount(account!.id),
    enabled: open && !!account,
  })

  // Fetch all terminals from the venue to find available ones
  const { data: allTerminals = [] } = useQuery({
    queryKey: ['venue-terminals', venueId],
    queryFn: () => terminalAPI.getAllTerminals({ venueId }),
    enabled: open && !!venueId && showAddForm,
  })

  // Filter out terminals that already have this merchant account assigned
  const availableTerminals = allTerminals.filter(
    (terminal) => !assignedTerminals.some((assigned: any) => assigned.id === terminal.id)
  )

  if (!account) return null

  const handleRemoveTerminal = async (terminalId: string) => {
    setRemovingTerminal(terminalId)
    try {
      await paymentProviderAPI.removeMerchantFromTerminal(account.id, terminalId)
      refetchTerminals()
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['payment-readiness', venueId] })
      toast({
        title: 'Terminal desvinculada',
        description: 'La cuenta se ha removido de la terminal exitosamente',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo desvincular la terminal',
      })
    } finally {
      setRemovingTerminal(null)
    }
  }

  const handleLinkTerminal = async () => {
    if (!selectedTerminalId) return
    setIsLinking(true)
    try {
      // Get the terminal's current assigned merchants and add this one
      const terminal = allTerminals.find((t) => t.id === selectedTerminalId)
      const currentMerchantIds = terminal?.assignedMerchantIds || []
      const newMerchantIds = [...currentMerchantIds, account!.id]

      await terminalAPI.updateTerminal(selectedTerminalId, {
        assignedMerchantIds: newMerchantIds,
      })

      refetchTerminals()
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['venue-terminals', venueId] })
      queryClient.invalidateQueries({ queryKey: ['payment-readiness', venueId] })
      toast({
        title: 'Terminal vinculada',
        description: 'La cuenta se ha asignado a la terminal exitosamente',
      })
      setShowAddForm(false)
      setSelectedTerminalId('')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo vincular la terminal',
      })
    } finally {
      setIsLinking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <Terminal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle>Terminales Asignadas</DialogTitle>
              <DialogDescription>{account.displayName || account.alias || account.externalMerchantId}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando terminales...</span>
            </div>
          ) : assignedTerminals.length === 0 ? (
            <div className="text-center py-8">
              <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
                <Terminal className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Esta cuenta no está asignada a ninguna terminal</p>
              <p className="text-xs text-muted-foreground mt-1">
                Las terminales se vinculan automáticamente cuando se crean con Blumon Auto-Fetch
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Desvincular una cuenta de una terminal no la elimina, solo remueve la referencia. La terminal seguirá funcionando pero
                  necesitará otra cuenta de procesamiento.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Badge variant="secondary">{assignedTerminals.length}</Badge>
                  Terminal(es)
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {assignedTerminals.map((terminal: any) => (
                    <div key={terminal.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                      <div className="text-sm flex-1">
                        <p className="font-medium flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-muted-foreground" />
                          {terminal.name || 'Terminal sin nombre'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Serial: <span className="font-mono">{terminal.serialNumber}</span>
                        </p>
                        {terminal.venue && <p className="text-xs text-muted-foreground">Venue: {terminal.venue.name}</p>}
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveTerminal(terminal.id)}
                              disabled={removingTerminal === terminal.id}
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                            >
                              {removingTerminal === terminal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Desvincular cuenta de esta terminal</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Add Terminal Form */}
          {showAddForm && venueId && (
            <div className="mt-4 p-4 rounded-xl border border-border bg-muted/30">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Vincular Terminal
              </h4>
              {availableTerminals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay terminales disponibles en este venue para vincular.
                </p>
              ) : (
                <div className="space-y-3">
                  <Select value={selectedTerminalId} onValueChange={setSelectedTerminalId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una terminal" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTerminals.map((terminal) => (
                        <SelectItem key={terminal.id} value={terminal.id}>
                          <div className="flex items-center gap-2">
                            <Smartphone className="w-4 h-4 text-muted-foreground" />
                            <span>{terminal.name || 'Sin nombre'}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              ({terminal.serialNumber})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowAddForm(false)
                        setSelectedTerminalId('')
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleLinkTerminal}
                      disabled={!selectedTerminalId || isLinking}
                      className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
                    >
                      {isLinking ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          Vinculando...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Vincular
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {venueId && !showAddForm && (
            <Button
              onClick={() => setShowAddForm(true)}
              className="w-full sm:w-auto bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-1" />
              Vincular Terminal
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// COST STRUCTURE DIALOG
// ============================================================================

interface CostStructureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: MerchantAccount | null
  venueType?: string
}

const CostStructureDialog: React.FC<CostStructureDialogProps> = ({ open, onOpenChange, account, venueType }) => {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view')
  const [isDetecting, setIsDetecting] = useState(false)
  const [mccResult, setMccResult] = useState<MccLookupResult | null>(null)
  const [businessCategory, setBusinessCategory] = useState(venueType || '')
  const [showAdditionalCosts, setShowAdditionalCosts] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedStructure, setSelectedStructure] = useState<ProviderCostStructure | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    creditRate: '',
    debitRate: '',
    amexRate: '',
    internationalRate: '',
    fixedCostPerTransaction: '',
    monthlyFee: '',
    notes: '',
  })

  // Fetch ALL cost structures for this merchant account (for history)
  const {
    data: allCostStructures = [],
    isLoading: loadingCostStructure,
    refetch,
  } = useQuery({
    queryKey: ['cost-structures-all', account?.id],
    queryFn: () => paymentProviderAPI.getProviderCostStructuresByMerchantAccount(account!.id),
    enabled: open && !!account,
  })

  // The TRULY active structure is: active=true AND no effectiveTo date
  // If multiple have active=true, the one without effectiveTo is the real one
  const activeCostStructure =
    allCostStructures.find(s => s.active && !s.effectiveTo) ||
    allCostStructures.find(s => !s.effectiveTo) || // Fallback: any without end date
    allCostStructures[0] ||
    null

  // Helper to check if a structure is the truly active one
  const isTrulyActive = (structure: ProviderCostStructure) => structure.id === activeCostStructure?.id

  // Reset state when dialog opens/closes or account changes
  useEffect(() => {
    if (open && account) {
      setMode('view')
      setMccResult(null)
      setBusinessCategory(venueType || '')
      setShowAdditionalCosts(false)
      setSelectedStructure(null)
      setFormData({
        creditRate: '',
        debitRate: '',
        amexRate: '',
        internationalRate: '',
        fixedCostPerTransaction: '',
        monthlyFee: '',
        notes: '',
      })
    }
  }, [open, account, venueType])

  // Populate form when editing existing structure
  useEffect(() => {
    if (mode === 'edit' && selectedStructure) {
      setFormData({
        creditRate: (Number(selectedStructure.creditRate) * 100).toFixed(2),
        debitRate: (Number(selectedStructure.debitRate) * 100).toFixed(2),
        amexRate: (Number(selectedStructure.amexRate) * 100).toFixed(2),
        internationalRate: (Number(selectedStructure.internationalRate) * 100).toFixed(2),
        fixedCostPerTransaction: selectedStructure.fixedCostPerTransaction?.toString() || '',
        monthlyFee: selectedStructure.monthlyFee?.toString() || '',
        notes: selectedStructure.notes || '',
      })
      setShowAdditionalCosts(!!selectedStructure.fixedCostPerTransaction || !!selectedStructure.monthlyFee)
    }
  }, [mode, selectedStructure])

  if (!account) return null

  const handleDetectRates = async () => {
    if (!businessCategory.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ingresa una categoría de negocio para detectar tasas',
      })
      return
    }

    setIsDetecting(true)
    try {
      const result = await paymentProviderAPI.getMccRateSuggestion(businessCategory)
      setMccResult(result)

      if (result.found && result.rates) {
        setFormData({
          creditRate: result.rates.credito.toFixed(2),
          debitRate: result.rates.debito.toFixed(2),
          amexRate: result.rates.amex.toFixed(2),
          internationalRate: result.rates.internacional.toFixed(2),
          fixedCostPerTransaction: '',
          monthlyFee: '',
          notes: `Auto-detectado: ${result.familia} (MCC ${result.mcc})`,
        })
        setMode('create')
        toast({
          title: 'Tasas detectadas',
          description: `Familia: ${result.familia} (MCC ${result.mcc}) - Confianza: ${result.confidence}%`,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'No encontrado',
          description: 'No se encontraron tasas para esta categoría. Puedes configurar manualmente.',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron detectar las tasas',
      })
    } finally {
      setIsDetecting(false)
    }
  }

  const handleManualCreate = () => {
    setMode('create')
    setFormData({
      creditRate: '2.30',
      debitRate: '1.68',
      amexRate: '3.00',
      internationalRate: '3.30',
      fixedCostPerTransaction: '',
      monthlyFee: '',
      notes: '',
    })
  }

  const handleSubmit = async () => {
    // Validate rates
    const creditRate = parseFloat(formData.creditRate)
    const debitRate = parseFloat(formData.debitRate)
    const amexRate = parseFloat(formData.amexRate)
    const internationalRate = parseFloat(formData.internationalRate)

    if (isNaN(creditRate) || isNaN(debitRate) || isNaN(amexRate) || isNaN(internationalRate)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Todas las tasas principales son requeridas',
      })
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'edit' && selectedStructure) {
        // Update existing structure
        await paymentProviderAPI.updateProviderCostStructure(selectedStructure.id, {
          creditRate: creditRate / 100,
          debitRate: debitRate / 100,
          amexRate: amexRate / 100,
          internationalRate: internationalRate / 100,
          fixedCostPerTransaction: formData.fixedCostPerTransaction ? parseFloat(formData.fixedCostPerTransaction) : null,
          monthlyFee: formData.monthlyFee ? parseFloat(formData.monthlyFee) : null,
          notes: formData.notes || null,
        })
        toast({
          title: 'Estructura actualizada',
          description: 'La estructura de costos ha sido actualizada exitosamente',
        })
      } else {
        // Create new structure
        await paymentProviderAPI.createProviderCostStructure({
          merchantAccountId: account.id,
          effectiveFrom: new Date().toISOString(),
          creditRate: creditRate / 100,
          debitRate: debitRate / 100,
          amexRate: amexRate / 100,
          internationalRate: internationalRate / 100,
          fixedCostPerTransaction: formData.fixedCostPerTransaction ? parseFloat(formData.fixedCostPerTransaction) : undefined,
          monthlyFee: formData.monthlyFee ? parseFloat(formData.monthlyFee) : undefined,
          notes: formData.notes || undefined,
        })
        toast({
          title: 'Estructura creada',
          description: 'La estructura de costos ha sido creada exitosamente',
        })
      }

      // Refresh data
      refetch()
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      setMode('view')
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo guardar la estructura de costos',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] bg-background">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
              <Calculator className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <DialogTitle>Estructura de Costos</DialogTitle>
              <DialogDescription>{account.displayName || account.alias || account.externalMerchantId}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {loadingCostStructure ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando estructura...</span>
            </div>
          ) : mode === 'view' ? (
            // VIEW MODE
            activeCostStructure ? (
              // Has existing structure
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-700 dark:text-green-300">
                    <p className="font-medium">Estructura activa</p>
                    <p className="text-xs mt-1">Desde: {new Date(activeCostStructure.effectiveFrom).toLocaleDateString()}</p>
                  </div>
                </div>

                <GlassCard className="p-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Percent className="w-4 h-4 text-muted-foreground" />
                    Tasas de Procesamiento
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Crédito</p>
                      <p className="text-lg font-semibold">{(Number(activeCostStructure.creditRate) * 100).toFixed(2)}%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Débito</p>
                      <p className="text-lg font-semibold">{(Number(activeCostStructure.debitRate) * 100).toFixed(2)}%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Amex</p>
                      <p className="text-lg font-semibold">{(Number(activeCostStructure.amexRate) * 100).toFixed(2)}%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Internacional</p>
                      <p className="text-lg font-semibold">{(Number(activeCostStructure.internationalRate) * 100).toFixed(2)}%</p>
                    </div>
                  </div>

                  {(activeCostStructure.fixedCostPerTransaction || activeCostStructure.monthlyFee) && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <h4 className="text-sm font-medium mb-2">Costos Adicionales</h4>
                      <div className="flex gap-4 text-sm">
                        {activeCostStructure.fixedCostPerTransaction && (
                          <div>
                            <span className="text-muted-foreground">Costo fijo/tx:</span>{' '}
                            <span className="font-medium">${Number(activeCostStructure.fixedCostPerTransaction).toFixed(2)}</span>
                          </div>
                        )}
                        {activeCostStructure.monthlyFee && (
                          <div>
                            <span className="text-muted-foreground">Cuota mensual:</span>{' '}
                            <span className="font-medium">${Number(activeCostStructure.monthlyFee).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeCostStructure.notes && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-xs text-muted-foreground">{activeCostStructure.notes}</p>
                    </div>
                  )}
                </GlassCard>

                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedStructure(activeCostStructure)
                    setMode('edit')
                  }}
                  className="w-full"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar Estructura Activa
                </Button>

                {/* History section - show all structures */}
                {allCostStructures.length > 1 && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between">
                        <span className="text-sm">Ver historial ({allCostStructures.length} estructuras)</span>
                        <ChevronRight className="w-4 h-4 transition-transform ui-expanded:rotate-90" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 space-y-2">
                      {allCostStructures.map((structure, index) => (
                        <div
                          key={structure.id}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-lg border',
                            isTrulyActive(structure)
                              ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20'
                              : 'border-border/50 bg-muted/30',
                          )}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {isTrulyActive(structure) ? '✓ Activa' : `#${allCostStructures.length - index}`}
                              </span>
                              {isTrulyActive(structure) && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                >
                                  Actual
                                </Badge>
                              )}
                              {structure.effectiveTo && (
                                <Badge variant="secondary" className="text-xs">
                                  Histórica
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Desde: {new Date(structure.effectiveFrom).toLocaleDateString()}
                              {structure.effectiveTo && ` • Hasta: ${new Date(structure.effectiveTo).toLocaleDateString()}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Crédito: {(Number(structure.creditRate) * 100).toFixed(2)}% | Débito:{' '}
                              {(Number(structure.debitRate) * 100).toFixed(2)}%
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedStructure(structure)
                              setMode('edit')
                            }}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            ) : (
              // No existing structure
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">
                    <p className="font-medium">Sin estructura de costos</p>
                    <p className="text-xs mt-1">
                      Esta cuenta no tiene tasas configuradas. Sin esto, no se puede calcular el margen de ganancia.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Categoría del negocio</Label>
                    <div className="flex gap-2">
                      <Input
                        value={businessCategory}
                        onChange={e => setBusinessCategory(e.target.value)}
                        placeholder="Ej: Restaurante, Gimnasio, Tienda..."
                        className="flex-1"
                      />
                      <Button onClick={handleDetectRates} disabled={isDetecting || !businessCategory.trim()} className="shrink-0">
                        {isDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Detectar
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ingresa el tipo de negocio para detectar automáticamente las tasas según el MCC de Blumon
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground px-2">o</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <Button variant="outline" onClick={handleManualCreate} className="w-full">
                    <Pencil className="w-4 h-4 mr-2" />
                    Configurar Manualmente
                  </Button>
                </div>
              </div>
            )
          ) : (
            // CREATE/EDIT MODE
            <div className="space-y-4">
              {mccResult && mccResult.found && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    <p className="font-medium">Tasas detectadas: {mccResult.familia}</p>
                    <p>
                      MCC {mccResult.mcc} • Confianza: {mccResult.confidence}%
                    </p>
                  </div>
                </div>
              )}

              <GlassCard className="p-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-muted-foreground" />
                  Tasas de Procesamiento
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Crédito (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.creditRate}
                      onChange={e => setFormData({ ...formData, creditRate: e.target.value })}
                      placeholder="2.30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Débito (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.debitRate}
                      onChange={e => setFormData({ ...formData, debitRate: e.target.value })}
                      placeholder="1.68"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Amex (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amexRate}
                      onChange={e => setFormData({ ...formData, amexRate: e.target.value })}
                      placeholder="3.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Internacional (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.internationalRate}
                      onChange={e => setFormData({ ...formData, internationalRate: e.target.value })}
                      placeholder="3.30"
                    />
                  </div>
                </div>
              </GlassCard>

              <Collapsible open={showAdditionalCosts} onOpenChange={setShowAdditionalCosts}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between h-auto py-2">
                    <span className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4" />
                      Costos adicionales (opcional)
                    </span>
                    <ChevronRight className={cn('w-4 h-4 transition-transform', showAdditionalCosts && 'rotate-90')} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <GlassCard className="p-4 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Costo fijo/transacción ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.fixedCostPerTransaction}
                          onChange={e => setFormData({ ...formData, fixedCostPerTransaction: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Cuota mensual ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.monthlyFee}
                          onChange={e => setFormData({ ...formData, monthlyFee: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <Label className="text-xs">Notas</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Notas adicionales..."
                        rows={2}
                      />
                    </div>
                  </GlassCard>
                </CollapsibleContent>
              </Collapsible>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMode('view')} className="flex-1" disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {mode === 'edit' ? 'Guardar Cambios' : 'Crear Estructura'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {mode === 'view' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// MERCHANT ACCOUNT CARD
// ============================================================================

interface MerchantAccountCardProps {
  account: MerchantAccount
  onEdit: (account: MerchantAccount) => void
  onToggle: (id: string) => void
  onDelete: (account: MerchantAccount) => void
  onManageTerminals: (account: MerchantAccount) => void
  onManageCosts: (account: MerchantAccount) => void
}

const MerchantAccountCard: React.FC<MerchantAccountCardProps> = ({
  account,
  onEdit,
  onToggle,
  onDelete,
  onManageTerminals,
  onManageCosts,
}) => {
  const costStructuresCount = account._count?.costStructures || 0
  const venueConfigsCount = account._count?.venueConfigs || 0

  return (
    <GlassCard className="p-4" hover>
      {/* Header Row */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Icon + Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn(
            'shrink-0 p-2.5 rounded-xl',
            account.active
              ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/10'
              : 'bg-muted'
          )}>
            {account.provider?.code === 'BLUMON' ? (
              <Zap className={cn('w-5 h-5', account.active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} />
            ) : (
              <CreditCard className={cn('w-5 h-5', account.active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            {/* Title + Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">
                {account.displayName || account.alias || 'Sin nombre'}
              </h3>
              {!account.active && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Inactivo
                </Badge>
              )}
            </div>

            {/* Provider + Environment badges */}
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                {account.provider?.name}
              </Badge>
              {account.blumonEnvironment && (
                <Badge
                  variant={account.blumonEnvironment === 'PRODUCTION' ? 'default' : 'secondary'}
                  className={cn(
                    'text-[10px] px-1.5 py-0',
                    account.blumonEnvironment === 'PRODUCTION'
                      ? 'bg-green-600 hover:bg-green-600'
                      : 'bg-amber-500/80 text-amber-950 hover:bg-amber-500/80'
                  )}
                >
                  {account.blumonEnvironment === 'PRODUCTION' ? 'PROD' : 'SANDBOX'}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center shrink-0">
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-0.5 p-1 rounded-lg bg-muted/50">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onManageCosts(account)}>
                    <DollarSign className="w-3.5 h-3.5 text-green-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Costos</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onManageTerminals(account)}>
                    <Terminal className="w-3.5 h-3.5 text-blue-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Terminales</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(account)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Editar</TooltipContent>
              </Tooltip>

              <div className="w-px h-4 bg-border mx-0.5" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggle(account.id)}>
                    <Power className={cn('w-3.5 h-3.5', account.active ? 'text-green-600' : 'text-muted-foreground')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{account.active ? 'Desactivar' : 'Activar'}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(account)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Eliminar</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </div>

      {/* Footer: IDs + Stats */}
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center justify-between gap-4 text-xs">
          {/* Left: IDs */}
          <div className="flex items-center gap-3 text-muted-foreground font-mono">
            <span className="truncate max-w-[180px]" title={account.externalMerchantId}>
              {account.externalMerchantId}
            </span>
            {account.blumonSerialNumber && (
              <>
                <span className="text-border">•</span>
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3 h-3" />
                  {account.blumonSerialNumber}
                </span>
              </>
            )}
          </div>

          {/* Right: Stats */}
          <div className="flex items-center gap-3 shrink-0">
            {account.hasCredentials && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Shield className="w-3 h-3 text-green-500" />
              </div>
            )}
            {costStructuresCount > 0 ? (
              <div className="flex items-center gap-1 text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span>{costStructuresCount} costo{costStructuresCount !== 1 ? 's' : ''}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                <span>Sin costos</span>
              </div>
            )}
            {venueConfigsCount > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Building2 className="w-3 h-3" />
                <span>{venueConfigsCount} config{venueConfigsCount !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const VenueMerchantAccounts: React.FC = () => {
  const { t } = useTranslation(['payment', 'common'])
  const { toast } = useToast()
  const { slug } = useParams<{ slug: string }>()
  const { getVenueBySlug } = useAuth()
  const queryClient = useQueryClient()

  const venue = getVenueBySlug(slug!)

  // Dialog states
  const [blumonWizardOpen, setBlumonWizardOpen] = useState(false)
  const [manualDialogOpen, setManualDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [terminalsDialogOpen, setTerminalsDialogOpen] = useState(false)
  const [costDialogOpen, setCostDialogOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<MerchantAccount | null>(null)

  // Fetch VenuePaymentConfig to know which accounts are associated with this venue
  const { data: venuePaymentConfig } = useQuery({
    queryKey: ['venue-payment-config', venue?.id],
    queryFn: () => paymentProviderAPI.getVenuePaymentConfig(venue!.id),
    enabled: !!venue?.id,
  })

  // Fetch terminals for this venue to get their assigned merchant accounts
  const { data: venueTerminals = [] } = useQuery({
    queryKey: ['terminals', venue?.id],
    queryFn: () => terminalAPI.getAllTerminals({ venueId: venue!.id }),
    enabled: !!venue?.id,
  })

  // Fetch ALL merchant accounts, then filter by venue association
  const { data: allAccounts = [], isLoading } = useQuery({
    queryKey: ['merchant-accounts'],
    queryFn: () => paymentProviderAPI.getAllMerchantAccounts(),
    enabled: !!venue?.id,
  })

  // Filter accounts to show only those associated with this venue:
  // 1. From VenuePaymentConfig (primary, secondary, tertiary)
  // 2. From terminals assigned to this venue
  const accounts = React.useMemo(() => {
    const associatedIds = new Set<string>()

    // Add accounts from VenuePaymentConfig
    if (venuePaymentConfig) {
      if (venuePaymentConfig.primaryAccountId) associatedIds.add(venuePaymentConfig.primaryAccountId)
      if (venuePaymentConfig.secondaryAccountId) associatedIds.add(venuePaymentConfig.secondaryAccountId)
      if (venuePaymentConfig.tertiaryAccountId) associatedIds.add(venuePaymentConfig.tertiaryAccountId)
    }

    // Add accounts from venue terminals
    venueTerminals.forEach((terminal: any) => {
      if (terminal.assignedMerchantIds?.length) {
        terminal.assignedMerchantIds.forEach((id: string) => associatedIds.add(id))
      }
    })

    // If no associations found, return empty (don't show all global accounts)
    if (associatedIds.size === 0) return []

    return allAccounts.filter(account => associatedIds.has(account.id))
  }, [allAccounts, venuePaymentConfig, venueTerminals])

  // Mutations
  const createMutation = useMutation({
    mutationFn: paymentProviderAPI.createMerchantAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      toast({ title: t('common:success'), description: 'Cuenta creada exitosamente' })
    },
    onError: (error: any) => {
      toast({
        title: t('common:error'),
        description: error.response?.data?.message || 'Error al crear cuenta',
        variant: 'destructive',
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => paymentProviderAPI.updateMerchantAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      toast({ title: t('common:success'), description: 'Cuenta actualizada' })
    },
    onError: () => {
      toast({ title: t('common:error'), description: 'Error al actualizar', variant: 'destructive' })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: paymentProviderAPI.toggleMerchantAccountStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      toast({ title: t('common:success'), description: 'Estado actualizado' })
    },
    onError: () => {
      toast({ title: t('common:error'), description: 'Error al actualizar estado', variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: paymentProviderAPI.deleteMerchantAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      toast({ title: t('common:success'), description: 'Cuenta eliminada' })
    },
    onError: (error: any) => {
      toast({
        title: t('common:error'),
        description: error.response?.data?.message || 'Error al eliminar',
        variant: 'destructive',
      })
    },
  })

  // Handlers
  const handleEdit = (account: MerchantAccount) => {
    setSelectedAccount(account)
    setManualDialogOpen(true)
  }

  const handleOpenCreate = () => {
    setSelectedAccount(null)
    setManualDialogOpen(true)
  }

  const handleToggle = async (id: string) => {
    await toggleMutation.mutateAsync(id)
  }

  const handleOpenDelete = (account: MerchantAccount) => {
    setSelectedAccount(account)
    setDeleteDialogOpen(true)
  }

  const handleOpenTerminals = (account: MerchantAccount) => {
    setSelectedAccount(account)
    setTerminalsDialogOpen(true)
  }

  const handleOpenCosts = (account: MerchantAccount) => {
    setSelectedAccount(account)
    setCostDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (selectedAccount) {
      await deleteMutation.mutateAsync(selectedAccount.id)
    }
  }

  const handleSave = async (data: any) => {
    if (selectedAccount) {
      await updateMutation.mutateAsync({ id: selectedAccount.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  const handleDeleteCostStructure = async (id: string) => {
    await paymentProviderAPI.deleteProviderCostStructure(id)
    toast({ title: t('common:success'), description: 'Estructura de costo eliminada' })
  }

  const handleDeleteVenueConfig = async (venueId: string, configId: string) => {
    await paymentProviderAPI.deleteVenuePaymentConfigByVenueId(venueId, configId)
    toast({ title: t('common:success'), description: 'Configuración de venue eliminada' })
  }

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
    // Also invalidate payment-readiness so the checklist updates
    if (venue?.id) {
      queryClient.invalidateQueries({ queryKey: ['payment-readiness', venue.id] })
    }
  }

  // Stats
  const activeCount = accounts.filter(a => a.active).length
  const blumonCount = accounts.filter(a => a.provider?.code === 'BLUMON').length

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-muted" />
            <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-t-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Cargando cuentas...</p>
        </div>
      </div>
    )
  }

  // Empty state
  if (accounts.length === 0) {
    return (
      <TooltipProvider>
        <div className="p-6 max-w-4xl mx-auto">
          <GlassCard className="p-12">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-2xl animate-pulse" />
                <div className="relative p-6 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border border-yellow-500/20">
                  <Building2 className="w-12 h-12 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>

              <div className="space-y-2 max-w-md">
                <h2 className="text-2xl font-bold">Crea tu Primera Cuenta</h2>
                <p className="text-muted-foreground">
                  Para procesar pagos con tarjeta necesitas configurar una cuenta de procesamiento. Con Blumon Auto-Fetch, solo necesitas el
                  número de serie de tu terminal.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg pt-4">
                <button
                  onClick={() => setBlumonWizardOpen(true)}
                  className="p-5 rounded-2xl border-2 border-yellow-500/50 bg-gradient-to-br from-yellow-500/10 to-orange-500/5 hover:border-yellow-500 hover:shadow-lg hover:shadow-yellow-500/10 transition-all text-left group cursor-pointer"
                >
                  <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 w-fit mb-3">
                    <Zap className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <h3 className="font-semibold mb-1 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                    Blumon Auto-Fetch
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Ingresa el serial de tu terminal PAX y obtenemos las credenciales automáticamente
                  </p>
                  <Badge variant="secondary" className="mt-3 text-xs">
                    Recomendado
                  </Badge>
                </button>

                <button
                  onClick={handleOpenCreate}
                  className="p-5 rounded-2xl border-2 border-border hover:border-muted-foreground/50 transition-all text-left group cursor-pointer"
                >
                  <div className="p-2 rounded-xl bg-muted w-fit mb-3">
                    <Plus className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-1 group-hover:text-foreground transition-colors">Configuración Manual</h3>
                  <p className="text-xs text-muted-foreground">Ingresa las credenciales manualmente para cualquier procesador</p>
                </button>
              </div>
            </div>
          </GlassCard>

          <BlumonAutoFetchWizard open={blumonWizardOpen} onOpenChange={setBlumonWizardOpen} venueId={venue!.id} onSuccess={handleSuccess} />

          <ManualAccountDialog open={manualDialogOpen} onOpenChange={setManualDialogOpen} account={selectedAccount} onSave={handleSave} />
        </div>
      </TooltipProvider>
    )
  }

  // Main content with accounts
  return (
    <TooltipProvider>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cuentas de Procesamiento</h1>
            <p className="text-muted-foreground text-sm mt-1">Administra las cuentas de pago vinculadas a este venue</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Manual
            </Button>
            <Button
              onClick={() => setBlumonWizardOpen(true)}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
            >
              <Zap className="w-4 h-4 mr-2" />
              Blumon Auto-Fetch
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{accounts.length}</p>
                <p className="text-xs text-muted-foreground">Cuentas totales</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Activas</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-500/5">
                <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{blumonCount}</p>
                <p className="text-xs text-muted-foreground">Blumon</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Accounts list */}
        <div className="space-y-4">
          {accounts.map(account => (
            <MerchantAccountCard
              key={account.id}
              account={account}
              onEdit={handleEdit}
              onToggle={handleToggle}
              onDelete={handleOpenDelete}
              onManageTerminals={handleOpenTerminals}
              onManageCosts={handleOpenCosts}
            />
          ))}
        </div>

        {/* Dialogs */}
        <BlumonAutoFetchWizard open={blumonWizardOpen} onOpenChange={setBlumonWizardOpen} venueId={venue!.id} onSuccess={handleSuccess} />

        <ManualAccountDialog open={manualDialogOpen} onOpenChange={setManualDialogOpen} account={selectedAccount} onSave={handleSave} />

        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          account={selectedAccount}
          onConfirmDelete={handleConfirmDelete}
          onDeleteCostStructure={handleDeleteCostStructure}
          onDeleteVenueConfig={handleDeleteVenueConfig}
        />

        <TerminalAssignmentsDialog open={terminalsDialogOpen} onOpenChange={setTerminalsDialogOpen} account={selectedAccount} venueId={venue?.id} />

        <CostStructureDialog open={costDialogOpen} onOpenChange={setCostDialogOpen} account={selectedAccount} venueType={venue?.type} />
      </div>
    </TooltipProvider>
  )
}

export default VenueMerchantAccounts
