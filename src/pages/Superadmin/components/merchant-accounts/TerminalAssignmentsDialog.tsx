import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { paymentProviderAPI, type MerchantAccount } from '@/services/paymentProvider.service'
import { terminalAPI } from '@/services/superadmin-terminals.service'
import { getAllVenues } from '@/services/superadmin.service'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Check, Info, Loader2, Plus, Smartphone, Terminal as TerminalIcon, X } from 'lucide-react'
import React, { useState } from 'react'

interface TerminalAssignmentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: MerchantAccount | null
  venueId?: string
}

export const TerminalAssignmentsDialog: React.FC<TerminalAssignmentsDialogProps> = ({
  open,
  onOpenChange,
  account,
  venueId: propVenueId,
}) => {
  const [removingTerminal, setRemovingTerminal] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>('')
  const [selectedVenueForLink, setSelectedVenueForLink] = useState<string>('')
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

  // Fetch all venues for the dropdown
  const { data: allVenues = [] } = useQuery({
    queryKey: ['superadmin-venues', 'all'],
    queryFn: () => getAllVenues(true),
    enabled: open && showAddForm,
  })

  // Get venueId from props OR from user selection
  const venueId = propVenueId || selectedVenueForLink

  // Fetch all terminals from the selected venue to find available ones
  const { data: allTerminals = [], isLoading: loadingTerminals } = useQuery({
    queryKey: ['venue-terminals', venueId],
    queryFn: () => terminalAPI.getAllTerminals({ venueId }),
    enabled: open && !!venueId && showAddForm,
  })

  // Filter out terminals that already have this merchant account assigned
  const availableTerminals = allTerminals.filter(terminal => !assignedTerminals.some((assigned: any) => assigned.id === terminal.id))

  if (!account) return null

  const handleRemoveTerminal = async (terminalId: string) => {
    setRemovingTerminal(terminalId)
    try {
      await paymentProviderAPI.removeMerchantFromTerminal(account.id, terminalId)
      refetchTerminals()
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
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
      const terminal = allTerminals.find(t => t.id === selectedTerminalId)
      const currentMerchantIds = terminal?.assignedMerchantIds || []
      const newMerchantIds = [...currentMerchantIds, account!.id]

      await terminalAPI.updateTerminal(selectedTerminalId, {
        assignedMerchantIds: newMerchantIds,
      })

      refetchTerminals()
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
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
              <TerminalIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
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
                <TerminalIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Esta cuenta no está asignada a ninguna terminal</p>
              <p className="text-xs text-muted-foreground mt-1">
                Las terminales se vinculan automáticamente cuando se crean con Blumon Auto-Fetch
              </p>
              <p className="text-xs text-muted-foreground mt-1">O puedes vincular manualmente usando el botón de abajo.</p>
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
          {showAddForm && (
            <div className="mt-4 p-4 rounded-xl border border-border bg-muted/30">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Vincular Terminal
              </h4>
              <div className="space-y-4">
                {/* Step 1: Select Venue */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    1. Selecciona el Venue
                  </Label>
                  <Select
                    value={selectedVenueForLink}
                    onValueChange={value => {
                      setSelectedVenueForLink(value)
                      setSelectedTerminalId('') // Reset terminal when venue changes
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un venue..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allVenues.map(venue => (
                        <SelectItem key={venue.id} value={venue.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span>{venue.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Step 2: Select Terminal (only after venue is selected) */}
                {selectedVenueForLink && (
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5" />
                      2. Selecciona la Terminal
                    </Label>
                    {loadingTerminals ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Cargando terminales...
                      </div>
                    ) : availableTerminals.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No hay terminales disponibles en este venue para vincular.</p>
                    ) : (
                      <Select value={selectedTerminalId} onValueChange={setSelectedTerminalId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una terminal..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTerminals.map(terminal => (
                            <SelectItem key={terminal.id} value={terminal.id}>
                              <div className="flex items-center gap-2">
                                <Smartphone className="w-4 h-4 text-muted-foreground" />
                                <span>{terminal.name || 'Sin nombre'}</span>
                                <span className="text-xs text-muted-foreground font-mono">({terminal.serialNumber})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false)
                      setSelectedTerminalId('')
                      setSelectedVenueForLink('')
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleLinkTerminal}
                    disabled={!selectedTerminalId || !selectedVenueForLink || isLinking}
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
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!showAddForm && (
            <Button
              onClick={() => setShowAddForm(true)}
              className="w-full sm:w-auto bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-1" />
              Vincular Terminal
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Listo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
