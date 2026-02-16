import React, { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { Smartphone, Monitor, Ban, CheckCircle2 } from 'lucide-react'
import type { WizardState, PaymentSetupWizardProps } from '../PaymentSetupWizard'

interface TerminalStepProps {
  state: WizardState
  dispatch: React.Dispatch<any>
  target: PaymentSetupWizardProps['target']
}

interface TerminalItem {
  id: string
  name: string | null
  serialNumber: string | null
  type: string
  brand: string | null
  model: string | null
  assignedMerchantIds: string[]
  status: string
}

const COMPATIBLE_TYPES = ['TPV_ANDROID', 'TPV_IOS']

export const TerminalStep: React.FC<TerminalStepProps> = ({ state, dispatch, target }) => {
  const venueId = target.type === 'venue' ? target.venueId : undefined

  // Fetch terminals
  const { data: terminals = [], isLoading } = useQuery({
    queryKey: ['superadmin-terminals', venueId],
    queryFn: async () => {
      const svc = await import('@/services/superadmin-terminals.service')
      const filters: any = {}
      if (venueId) filters.venueId = venueId
      return svc.getAllTerminals(filters)
    },
    enabled: true,
  })

  // Get active merchants from wizard state
  const merchantSlots = useMemo(() => {
    const slots: Array<{ slot: string; merchantId: string; displayName: string }> = []
    if (state.merchants.primary) {
      slots.push({
        slot: 'PRIMARY',
        merchantId: state.merchants.primary.merchantId,
        displayName: state.merchants.primary.merchant.displayName || state.merchants.primary.merchantId,
      })
    }
    if (state.merchants.secondary) {
      slots.push({
        slot: 'SECONDARY',
        merchantId: state.merchants.secondary.merchantId,
        displayName: state.merchants.secondary.merchant.displayName || state.merchants.secondary.merchantId,
      })
    }
    if (state.merchants.tertiary) {
      slots.push({
        slot: 'TERTIARY',
        merchantId: state.merchants.tertiary.merchantId,
        displayName: state.merchants.tertiary.merchant.displayName || state.merchants.tertiary.merchantId,
      })
    }
    return slots
  }, [state.merchants])

  const handleToggleTerminal = (merchantId: string, terminalId: string) => {
    const current = state.terminalAssignments[merchantId] || []
    const newAssignments = current.includes(terminalId)
      ? current.filter(id => id !== terminalId)
      : [...current, terminalId]
    dispatch({ type: 'SET_TERMINAL_ASSIGNMENTS', merchantId, terminalIds: newAssignments })
  }

  const handleSelectAllCompatible = (merchantId: string) => {
    const compatibleIds = terminals
      .filter(t => COMPATIBLE_TYPES.includes(t.type))
      .map(t => t.id)
    dispatch({ type: 'SET_TERMINAL_ASSIGNMENTS', merchantId, terminalIds: compatibleIds })
  }

  const handleDeselectAll = (merchantId: string) => {
    dispatch({ type: 'SET_TERMINAL_ASSIGNMENTS', merchantId, terminalIds: [] })
  }

  if (merchantSlots.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-6 text-center">
        <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold mb-2">Sin cuentas seleccionadas</h3>
        <p className="text-sm text-muted-foreground">
          Regresa al paso anterior para seleccionar al menos una cuenta de cobro
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-blue-500/10">
            <Smartphone className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold">Asignación de Terminales</h3>
            <p className="text-sm text-muted-foreground">
              Vincula las terminales físicas a las cuentas de cobro
            </p>
          </div>
        </div>
      </div>

      {/* Terminal list per merchant */}
      {merchantSlots.map(({ slot, merchantId, displayName }) => {
        const assignedIds = state.terminalAssignments[merchantId] || []

        return (
          <div key={merchantId} className="rounded-2xl border border-border/50 bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">
                Cuenta {slot}: <span className="text-primary">{displayName}</span>
              </h4>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleSelectAllCompatible(merchantId)}>
                  Seleccionar Todos TPV
                </Button>
                {assignedIds.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => handleDeselectAll(merchantId)}>
                    Limpiar
                  </Button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Cargando terminales...</div>
            ) : terminals.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No hay terminales registradas
              </div>
            ) : (
              <div className="space-y-2">
                {terminals.map(terminal => {
                  const isCompatible = COMPATIBLE_TYPES.includes(terminal.type)
                  const isSelected = assignedIds.includes(terminal.id)
                  const isAlreadyAssigned = terminal.assignedMerchantIds?.includes(merchantId)

                  return (
                    <label
                      key={terminal.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer',
                        !isCompatible && 'opacity-50 cursor-not-allowed',
                        isSelected
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border/50 hover:border-border',
                      )}
                    >
                      <Checkbox
                        checked={isSelected || isAlreadyAssigned}
                        disabled={!isCompatible || isAlreadyAssigned}
                        onCheckedChange={() => {
                          if (isCompatible && !isAlreadyAssigned) {
                            handleToggleTerminal(merchantId, terminal.id)
                          }
                        }}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {terminal.name || 'Sin nombre'}
                          </span>
                          {terminal.serialNumber && (
                            <span className="text-xs text-muted-foreground font-mono">
                              ({terminal.serialNumber})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {terminal.brand} {terminal.model}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {terminal.type}
                          </Badge>
                        </div>
                      </div>

                      {!isCompatible && (
                        <Badge variant="secondary" className="text-xs">
                          <Ban className="w-3 h-3 mr-1" />
                          No compatible
                        </Badge>
                      )}
                      {isAlreadyAssigned && (
                        <Badge className="text-xs bg-green-500/10 text-green-600 border-green-200">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Ya asignada
                        </Badge>
                      )}
                    </label>
                  )
                })}
              </div>
            )}

            {assignedIds.length > 0 && (
              <div className="mt-3 text-sm text-muted-foreground">
                {assignedIds.length} terminal{assignedIds.length > 1 ? 'es' : ''} seleccionada{assignedIds.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
