import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertCircle, AlertTriangle, Loader2, Trash2, Terminal, X } from 'lucide-react'
import { paymentProviderAPI, type MerchantAccount } from '@/services/paymentProvider.service'
import { cn } from '@/lib/utils'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: MerchantAccount | null
  onConfirmDelete: () => Promise<void>
  onDeleteCostStructure: (id: string) => Promise<void>
  onDeleteVenueConfig: (venueId: string, configId: string) => Promise<void>
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
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
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
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
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
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
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
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
