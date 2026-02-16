import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  Building2,
  Plus,
  X,
  CheckCircle2,
  Smartphone,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { WizardState, MerchantSelection } from '../PaymentSetupWizard'
import type { MerchantAccountListItem, PaymentSetupSummary } from '@/services/paymentProvider.service'

interface MerchantStepProps {
  state: WizardState
  dispatch: React.Dispatch<any>
  allMerchants: MerchantAccountListItem[]
  existingSummary: PaymentSetupSummary | null
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

export const MerchantStep: React.FC<MerchantStepProps> = ({
  state,
  dispatch,
  allMerchants,
  existingSummary,
}) => {
  const [showSecondary, setShowSecondary] = useState(!!state.merchants.secondary)
  const [showTertiary, setShowTertiary] = useState(!!state.merchants.tertiary)

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

        <Select
          value={currentSelection?.merchantId || 'none'}
          onValueChange={value => handleSelectMerchant(slot, value)}
        >
          <SelectTrigger className="h-12 text-base">
            <SelectValue placeholder="Seleccionar cuenta..." />
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
                  {(currentSelection.merchant as any).blumonSerialNumber && ` · Serial: ${(currentSelection.merchant as any).blumonSerialNumber}`}
                </p>
              </div>
            </div>
          </div>
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
              Selecciona las cuentas que procesarán los pagos
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
