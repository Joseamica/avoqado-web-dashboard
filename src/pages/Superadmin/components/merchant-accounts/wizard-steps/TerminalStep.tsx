import React, { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { Smartphone, Ban, CheckCircle2, Search, X, AlertTriangle } from 'lucide-react'
import type { WizardState } from '../PaymentSetupWizard'
import type { Terminal } from '@/services/superadmin-terminals.service'

interface TerminalStepProps {
  state: WizardState
  dispatch: React.Dispatch<any>
}

const COMPATIBLE_TYPES = ['TPV_ANDROID', 'TPV_IOS']

export const TerminalStep: React.FC<TerminalStepProps> = ({ state, dispatch }) => {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  // Fetch all terminals (superadmin can see all)
  const { data: terminals = [], isLoading } = useQuery({
    queryKey: ['superadmin-terminals-all'],
    queryFn: async () => {
      const svc = await import('@/services/superadmin-terminals.service')
      return svc.getAllTerminals()
    },
    enabled: true,
  })

  // Get unique terminal types for filter pills
  const terminalTypes = useMemo(() => {
    const types = new Set(terminals.map((t: Terminal) => t.type))
    return Array.from(types).sort()
  }, [terminals])

  // Filtered terminals
  const filteredTerminals = useMemo(() => {
    let result = terminals as Terminal[]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        t =>
          (t.name?.toLowerCase().includes(q)) ||
          (t.serialNumber?.toLowerCase().includes(q)) ||
          (t.brand?.toLowerCase().includes(q)) ||
          (t.model?.toLowerCase().includes(q)),
      )
    }
    if (typeFilter) {
      result = result.filter(t => t.type === typeFilter)
    }
    return result
  }, [terminals, search, typeFilter])

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

  // Detect orphaned merchant assignments (merchants assigned to terminals but NOT in the wizard config)
  const orphanedAssignments = useMemo(() => {
    const configuredIds = new Set(merchantSlots.map(s => s.merchantId))
    const orphans: Array<{ terminalName: string; terminalSerial: string; merchantId: string }> = []
    for (const terminal of (terminals as Terminal[])) {
      const assigned = terminal.assignedMerchantIds || []
      for (const merchantId of assigned) {
        if (!configuredIds.has(merchantId)) {
          orphans.push({
            terminalName: terminal.name || terminal.serialNumber || 'Sin nombre',
            terminalSerial: terminal.serialNumber || '',
            merchantId,
          })
        }
      }
    }
    return orphans
  }, [terminals, merchantSlots])

  const handleToggleTerminal = (merchantId: string, terminalId: string) => {
    const current = state.terminalAssignments[merchantId] || []
    const newAssignments = current.includes(terminalId)
      ? current.filter(id => id !== terminalId)
      : [...current, terminalId]
    dispatch({ type: 'SET_TERMINAL_ASSIGNMENTS', merchantId, terminalIds: newAssignments })
  }

  const handleSelectAllCompatible = (merchantId: string) => {
    const compatibleIds = (terminals as Terminal[])
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

      {/* Orphaned assignments warning */}
      {orphanedAssignments.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-sm text-amber-700 dark:text-amber-400">
                Asignaciones huérfanas detectadas
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Las siguientes terminales tienen cuentas asignadas que NO están en la configuración actual.
                Al guardar, estas asignaciones se eliminarán automáticamente.
              </p>
              <div className="mt-2 space-y-1">
                {orphanedAssignments.map((o, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-amber-600 dark:text-amber-400">{o.terminalSerial || o.terminalName}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono text-muted-foreground">{o.merchantId.slice(0, 16)}…</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search + Filter bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, serial, marca..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-10"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {terminalTypes.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTypeFilter(null)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                !typeFilter
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              Todos ({terminals.length})
            </button>
            {terminalTypes.map(type => {
              const count = (terminals as Terminal[]).filter(t => t.type === type).length
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                    typeFilter === type
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {type} ({count})
                </button>
              )
            })}
          </div>
        )}
        {(search || typeFilter) && (
          <p className="text-xs text-muted-foreground">
            {filteredTerminals.length} de {terminals.length} terminales
          </p>
        )}
      </div>

      {/* Terminal list per merchant */}
      {merchantSlots.map(({ slot, merchantId, displayName }) => {
        const assignedIds = state.terminalAssignments[merchantId] || []

        return (
          <div key={merchantId} className="rounded-2xl border border-border/50 bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-sm">
                Cuenta {slot}: <span className="text-primary">{displayName}</span>
              </h4>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleSelectAllCompatible(merchantId)}>
                  Seleccionar Todos TPV
                </Button>
                {assignedIds.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleDeselectAll(merchantId)}>
                    Limpiar
                  </Button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Cargando terminales...</div>
            ) : filteredTerminals.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {search || typeFilter ? 'Sin resultados para el filtro actual' : 'No hay terminales registradas'}
              </div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                {filteredTerminals.map((terminal: Terminal) => {
                  const isCompatible = COMPATIBLE_TYPES.includes(terminal.type)
                  const isSelected = assignedIds.includes(terminal.id)
                  const isAlreadyAssigned = terminal.assignedMerchantIds?.includes(merchantId)

                  return (
                    <label
                      key={terminal.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg border transition-all cursor-pointer',
                        !isCompatible && 'opacity-40 cursor-not-allowed',
                        isSelected
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-transparent hover:bg-muted/50',
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

                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {terminal.name || 'Sin nombre'}
                        </span>
                        {terminal.serialNumber && (
                          <span className="text-xs text-muted-foreground font-mono truncate hidden sm:inline">
                            ({terminal.serialNumber})
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground truncate hidden md:inline">
                          {terminal.brand} {terminal.model}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                          {terminal.type}
                        </Badge>
                      </div>

                      {!isCompatible && (
                        <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                          <Ban className="w-3 h-3 mr-1" />
                          N/C
                        </Badge>
                      )}
                      {isAlreadyAssigned && (
                        <Badge className="text-[10px] bg-green-500/10 text-green-600 border-green-200 flex-shrink-0">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Asignada
                        </Badge>
                      )}
                    </label>
                  )
                })}
              </div>
            )}

            {assignedIds.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                {assignedIds.length} terminal{assignedIds.length > 1 ? 'es' : ''} seleccionada{assignedIds.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
