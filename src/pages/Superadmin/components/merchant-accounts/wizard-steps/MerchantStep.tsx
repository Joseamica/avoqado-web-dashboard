import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Landmark,
  Plus,
  X,
  CheckCircle2,
  Loader2,
  Zap,
  AlertTriangle,
} from 'lucide-react'
import type { WizardState, WizardContext, MerchantSelection } from '../PaymentSetupWizard'
import type { MerchantAccountListItem, PaymentSetupSummary } from '@/services/paymentProvider.service'

interface MerchantStepProps {
  state: WizardState
  dispatch: React.Dispatch<any>
  allMerchants: MerchantAccountListItem[]
  existingSummary: PaymentSetupSummary | null
  context: WizardContext
  onMerchantsRefresh: () => void
}

interface SlotConfig {
  key: 'primary' | 'secondary' | 'tertiary'
  label: string
  required: boolean
  actionType: string
}

const SLOTS: SlotConfig[] = [
  { key: 'primary', label: 'PRIMARIA', required: true, actionType: 'SET_PRIMARY_MERCHANT' },
  { key: 'secondary', label: 'SECUNDARIA (opcional)', required: false, actionType: 'SET_SECONDARY_MERCHANT' },
  { key: 'tertiary', label: 'TERCIARIA (opcional)', required: false, actionType: 'SET_TERTIARY_MERCHANT' },
]

function formatMerchantLabel(account: MerchantAccountListItem): string {
  const name = account.displayName || account.alias || account.externalMerchantId
  const env = account.environment ? ` - ${account.environment}` : ''
  return `${name} (${account.providerName}${env})`
}

// ============================================
// Provider Options
// ============================================

type ProviderKey = 'BLUMON' | 'MENTA' | 'CLIP' | 'BANK_DIRECT'

interface ProviderOption {
  key: ProviderKey
  label: string
  description: string
  icon: React.ReactNode
  available: boolean
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    key: 'BLUMON',
    label: 'Blumon',
    description: 'Auto-Fetch con número de serie de terminal',
    icon: <Zap className="w-5 h-5" />,
    available: true,
  },
  {
    key: 'MENTA',
    label: 'Menta',
    description: 'Procesador de pagos Menta',
    icon: <CreditCard className="w-5 h-5" />,
    available: false,
  },
  {
    key: 'CLIP',
    label: 'Clip',
    description: 'Procesador de pagos Clip',
    icon: <CreditCard className="w-5 h-5" />,
    available: false,
  },
  {
    key: 'BANK_DIRECT',
    label: 'Transferencia Bancaria',
    description: 'Conexión directa con banco',
    icon: <Landmark className="w-5 h-5" />,
    available: false,
  },
]

// ============================================
// Provider Picker
// ============================================

interface ProviderPickerProps {
  onSelect: (provider: ProviderKey) => void
  onCancel: () => void
}

const ProviderPicker: React.FC<ProviderPickerProps> = ({ onSelect, onCancel }) => (
  <div className="rounded-2xl border border-border/50 bg-muted/30 p-5 space-y-3">
    <div className="flex items-center justify-between">
      <h4 className="font-medium text-sm">Selecciona un proveedor</h4>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
        <X className="w-4 h-4" />
      </Button>
    </div>
    <div className="grid grid-cols-2 gap-2">
      {PROVIDER_OPTIONS.map(provider => (
        <button
          key={provider.key}
          onClick={() => provider.available && onSelect(provider.key)}
          disabled={!provider.available}
          className={cn(
            'flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
            provider.available
              ? 'border-border/50 bg-card hover:border-primary/40 hover:bg-primary/5 cursor-pointer'
              : 'border-border/30 bg-muted/20 opacity-50 cursor-not-allowed',
          )}
        >
          <div className={cn(
            'p-1.5 rounded-lg flex-shrink-0',
            provider.available ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          )}>
            {provider.icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{provider.label}</p>
            <p className="text-xs text-muted-foreground">{provider.description}</p>
            {!provider.available && (
              <p className="text-[10px] text-muted-foreground mt-0.5">Próximamente</p>
            )}
          </div>
        </button>
      ))}
    </div>
  </div>
)

// ============================================
// Inline Auto-Fetch Form
// ============================================

interface AutoFetchFormProps {
  onCreated: (merchantId: string, displayName: string) => void
  onCancel: () => void
  onBack: () => void
  orgType?: string
}

const AutoFetchForm: React.FC<AutoFetchFormProps> = ({ onCreated, onCancel, onBack, orgType }) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [fetching, setFetching] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    serialNumber: '',
    brand: 'PAX',
    model: 'A910S',
    displayName: '',
    environment: 'PRODUCTION' as 'SANDBOX' | 'PRODUCTION',
  })

  const handleAutoFetch = async () => {
    if (!form.serialNumber.trim()) {
      toast({ title: 'Ingresa el número de serie', variant: 'destructive' })
      return
    }

    setFetching(true)
    setError(null)
    setResult(null)

    try {
      const { autoFetchBlumonCredentials } = await import('@/services/paymentProvider.service')
      const res = await autoFetchBlumonCredentials({
        serialNumber: form.serialNumber.trim(),
        brand: form.brand,
        model: form.model,
        displayName: form.displayName.trim() || undefined,
        environment: form.environment,
        businessCategory: orgType || undefined,
        skipCostStructure: true, // Cost structure is configured in step 3
      })

      setResult(res)
      // Refresh merchant accounts list
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-list-active'] })

      toast({
        title: res.alreadyExists ? 'Cuenta existente encontrada' : 'Cuenta creada exitosamente',
        description: `${res.displayName} — ${res.dukptKeysAvailable ? 'Llaves DUKPT disponibles' : 'Sin llaves DUKPT'}`,
      })

      // Auto-select after a short delay for query to refresh
      setTimeout(() => {
        onCreated(res.id, res.displayName)
      }, 500)
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Error desconocido'
      setError(msg)
      toast({ title: 'Error al obtener credenciales', description: msg, variant: 'destructive' })
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Zap className="w-4 h-4 text-primary" />
          <h4 className="font-medium text-sm">Crear cuenta Blumon (Auto-Fetch)</h4>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs">Número de Serie *</Label>
          <Input
            value={form.serialNumber}
            onChange={e => setForm(p => ({ ...p, serialNumber: e.target.value }))}
            placeholder="0821234567"
            className="h-10 font-mono"
            disabled={fetching}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Marca</Label>
          <Select value={form.brand} onValueChange={v => setForm(p => ({ ...p, brand: v }))} disabled={fetching}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PAX">PAX Technology</SelectItem>
              <SelectItem value="Verifone">Verifone</SelectItem>
              <SelectItem value="Ingenico">Ingenico</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Modelo</Label>
          <Input
            value={form.model}
            onChange={e => setForm(p => ({ ...p, model: e.target.value }))}
            placeholder="A910S"
            className="h-10"
            disabled={fetching}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Nombre (opcional)</Label>
          <Input
            value={form.displayName}
            onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
            placeholder="Terminal Caja 1"
            className="h-10"
            disabled={fetching}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Ambiente</Label>
          <Select
            value={form.environment}
            onValueChange={v => setForm(p => ({ ...p, environment: v as 'SANDBOX' | 'PRODUCTION' }))}
            disabled={fetching}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PRODUCTION">Producción</SelectItem>
              <SelectItem value="SANDBOX">Sandbox</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 text-xs">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {result && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50 text-xs">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-green-700 dark:text-green-300">
            <p className="font-medium">{result.alreadyExists ? 'Cuenta ya existía' : 'Cuenta creada'}: {result.displayName}</p>
            <p>POS ID: {result.posId} · DUKPT: {result.dukptKeysAvailable ? 'Sí' : 'No'}</p>
            {result.autoAttached?.count > 0 && (
              <p>{result.autoAttached.count} terminal{result.autoAttached.count > 1 ? 'es' : ''} vinculada{result.autoAttached.count > 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
      )}

      <Button
        onClick={handleAutoFetch}
        disabled={fetching || !form.serialNumber.trim()}
        className="w-full"
      >
        {fetching ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Conectando con Blumon...
          </>
        ) : (
          <>
            <Zap className="mr-2 h-4 w-4" />
            Obtener Credenciales
          </>
        )}
      </Button>
    </div>
  )
}

// ============================================
// Main MerchantStep
// ============================================

export const MerchantStep: React.FC<MerchantStepProps> = ({
  state,
  dispatch,
  allMerchants,
  existingSummary,
  context,
  onMerchantsRefresh,
}) => {
  const [showSecondary, setShowSecondary] = useState(!!state.merchants.secondary)
  const [showTertiary, setShowTertiary] = useState(!!state.merchants.tertiary)
  const [creatingForSlot, setCreatingForSlot] = useState<SlotConfig | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey | null>(null)

  const handleSelectMerchant = (slot: SlotConfig, merchantId: string) => {
    if (merchantId === 'none') {
      dispatch({ type: slot.actionType, merchant: null })
      return
    }

    const merchant = allMerchants.find(m => m.id === merchantId)
    if (merchant) {
      const selection: MerchantSelection = {
        mode: 'existing',
        merchantId: merchant.id,
        merchant: merchant as any,
      }
      dispatch({ type: slot.actionType, merchant: selection })
    }
  }

  const handleCreated = (slot: SlotConfig, merchantId: string, displayName: string) => {
    // After auto-fetch creates a merchant, select it in this slot
    // We need the merchant list to refresh first, then select
    onMerchantsRefresh()
    // Optimistically create a selection
    const selection: MerchantSelection = {
      mode: 'existing',
      merchantId,
      merchant: {
        id: merchantId,
        displayName,
        externalMerchantId: merchantId,
        providerName: 'Blumon',
      } as any,
    }
    dispatch({ type: slot.actionType, merchant: selection })
    setCreatingForSlot(null)
    setSelectedProvider(null)
  }

  const getSelectedIds = () => {
    const ids: string[] = []
    if (state.merchants.primary) ids.push(state.merchants.primary.merchantId)
    if (state.merchants.secondary) ids.push(state.merchants.secondary.merchantId)
    if (state.merchants.tertiary) ids.push(state.merchants.tertiary.merchantId)
    return ids
  }

  const selectedIds = getSelectedIds()

  const renderSlot = (slot: SlotConfig, show: boolean) => {
    if (!show && slot.key !== 'primary') return null

    const currentSelection = state.merchants[slot.key]
    const availableMerchants = allMerchants.filter(
      m => !selectedIds.includes(m.id) || m.id === currentSelection?.merchantId,
    )
    const isCreating = creatingForSlot?.key === slot.key

    return (
      <div
        key={slot.key}
        className="rounded-2xl border border-border/50 bg-card p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'px-2 py-0.5 rounded-md text-xs font-medium',
                slot.required
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {slot.label}
            </div>
            {slot.required && <span className="text-destructive text-xs">*</span>}
          </div>
          <div className="flex items-center gap-1">
            {!isCreating && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setCreatingForSlot(slot); setSelectedProvider(null) }}
              >
                <Plus className="mr-1 h-3 w-3" />
                Crear nueva
              </Button>
            )}
            {!slot.required && currentSelection && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  dispatch({ type: slot.actionType, merchant: null })
                  if (slot.key === 'secondary') setShowSecondary(false)
                  if (slot.key === 'tertiary') setShowTertiary(false)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Provider picker → then provider-specific form */}
        {isCreating && !selectedProvider && (
          <div className="mb-4">
            <ProviderPicker
              onSelect={setSelectedProvider}
              onCancel={() => setCreatingForSlot(null)}
            />
          </div>
        )}
        {isCreating && selectedProvider === 'BLUMON' && (
          <div className="mb-4">
            <AutoFetchForm
              onCreated={(id, name) => handleCreated(slot, id, name)}
              onCancel={() => setCreatingForSlot(null)}
              onBack={() => setSelectedProvider(null)}
              orgType={context.orgType}
            />
          </div>
        )}

        {/* Select existing — hidden during creation flow */}
        {!isCreating && (
          <>
            <Select
              value={currentSelection?.merchantId || 'none'}
              onValueChange={value => handleSelectMerchant(slot, value)}
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Seleccionar cuenta existente..." />
              </SelectTrigger>
              <SelectContent>
                {!slot.required && <SelectItem value="none">— Ninguna —</SelectItem>}
                {availableMerchants.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span>{formatMerchantLabel(account)}</span>
                    </div>
                  </SelectItem>
                ))}
                {availableMerchants.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No hay cuentas disponibles. Crea una nueva.
                  </div>
                )}
              </SelectContent>
            </Select>

            {/* Mini preview of selected merchant */}
            {currentSelection && (
              <div className="mt-3 p-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-green-700 dark:text-green-300">
                      {currentSelection.merchant.displayName || currentSelection.merchant.externalMerchantId}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      {(currentSelection.merchant as any).providerName || 'Blumon'} · {(currentSelection.merchant as any).environment || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Cuentas de Cobro</h3>
            <p className="text-sm text-muted-foreground">
              Selecciona una cuenta existente o crea una nueva con el proveedor de tu preferencia
            </p>
          </div>
        </div>
      </div>

      {/* Primary Slot (always visible) */}
      {renderSlot(SLOTS[0], true)}

      {/* Secondary Slot */}
      {renderSlot(SLOTS[1], showSecondary)}

      {/* Tertiary Slot */}
      {renderSlot(SLOTS[2], showTertiary)}

      {/* Add buttons */}
      <div className="flex gap-2">
        {!showSecondary && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSecondary(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar cuenta secundaria
          </Button>
        )}
        {showSecondary && !showTertiary && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTertiary(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar cuenta terciaria
          </Button>
        )}
      </div>
    </div>
  )
}
