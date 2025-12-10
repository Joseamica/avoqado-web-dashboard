import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { AlertTriangle, Building2, CreditCard, Loader2, Unlink, Zap } from 'lucide-react'
import { paymentProviderAPI, type MerchantAccount } from '@/services/paymentProvider.service'
import { getAllVenues, type SuperadminVenue } from '@/services/superadmin.service'
import { cn } from '@/lib/utils'

interface AssignAccountToVenueDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: MerchantAccount | null
}

type AccountSlot = 'PRIMARY' | 'SECONDARY' | 'TERTIARY'

interface CurrentAssignment {
  venueId: string
  venueName: string
  slot: AccountSlot
}

export const AssignAccountToVenueDialog: React.FC<AssignAccountToVenueDialogProps> = ({ open, onOpenChange, account }) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedVenueId, setSelectedVenueId] = useState<string>('')
  const [selectedSlot, setSelectedSlot] = useState<AccountSlot>('PRIMARY')
  const [hasInitialized, setHasInitialized] = useState(false)

  // Fetch all venues
  const { data: venues = [] } = useQuery({
    queryKey: ['superadmin-venues', 'all'],
    queryFn: () => getAllVenues(true),
    enabled: open,
  })

  // Fetch current venue assignments for this account
  const { data: currentAssignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['venue-configs-by-merchant', account?.id],
    queryFn: () => paymentProviderAPI.getVenueConfigsByMerchantAccount(account!.id),
    enabled: open && !!account?.id,
  })

  // Derive current assignment info from backend response
  // Backend returns configs with 'accountType' field (PRIMARY, SECONDARY, TERTIARY)
  const currentAssignment: CurrentAssignment | null = React.useMemo(() => {
    if (!currentAssignments.length || !account) return null

    // The backend adds 'accountType' field telling us which slot this account occupies
    const config = currentAssignments[0] as any
    if (config && config.venueId && config.accountType) {
      return {
        venueId: config.venueId,
        venueName: config.venue?.name || 'Venue desconocido',
        slot: config.accountType as AccountSlot,
      }
    }
    return null
  }, [currentAssignments, account])

  // Auto-select current venue when dialog opens (only once)
  useEffect(() => {
    if (open && currentAssignment && !hasInitialized && !loadingAssignments) {
      setSelectedVenueId(currentAssignment.venueId)
      setSelectedSlot(currentAssignment.slot)
      setHasInitialized(true)
    }
  }, [open, currentAssignment, hasInitialized, loadingAssignments])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedVenueId('')
      setSelectedSlot('PRIMARY')
      setHasInitialized(false)
    }
  }, [open])

  // Fetch existing config for selected venue
  const { data: existingConfig, isLoading: loadingConfig } = useQuery({
    queryKey: ['venue-payment-config', selectedVenueId],
    queryFn: () => paymentProviderAPI.getVenuePaymentConfig(selectedVenueId),
    enabled: open && !!selectedVenueId,
  })

  // Check if user is changing the venue assignment
  const isChangingVenue = currentAssignment && selectedVenueId && currentAssignment.venueId !== selectedVenueId

  // Check if the selected slot is occupied by a DIFFERENT account
  const getSlotOccupant = (slot: AccountSlot) => {
    if (!existingConfig) return null
    if (slot === 'PRIMARY' && existingConfig.primaryAccountId && existingConfig.primaryAccountId !== account?.id) {
      return existingConfig.primaryAccount
    }
    if (slot === 'SECONDARY' && existingConfig.secondaryAccountId && existingConfig.secondaryAccountId !== account?.id) {
      return existingConfig.secondaryAccount
    }
    if (slot === 'TERTIARY' && existingConfig.tertiaryAccountId && existingConfig.tertiaryAccountId !== account?.id) {
      return existingConfig.tertiaryAccount
    }
    return null
  }

  const selectedSlotOccupant = getSlotOccupant(selectedSlot)

  // Sort venues: ACTIVE first
  const sortedVenues = React.useMemo(() => {
    const active = venues.filter((v: SuperadminVenue) => v.status === 'ACTIVE')
    const others = venues.filter((v: SuperadminVenue) => v.status !== 'ACTIVE')
    return [...active, ...others]
  }, [venues])

  // Create/Update mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVenueId || !account) throw new Error('Missing data')

      const updateData: any = {}

      if (selectedSlot === 'PRIMARY') {
        updateData.primaryAccountId = account.id
      } else if (selectedSlot === 'SECONDARY') {
        updateData.secondaryAccountId = account.id
      } else if (selectedSlot === 'TERTIARY') {
        updateData.tertiaryAccountId = account.id
      }

      if (existingConfig) {
        // Update existing config
        return paymentProviderAPI.updateVenuePaymentConfig(selectedVenueId, updateData)
      } else {
        // Create new config - primary is required
        if (selectedSlot !== 'PRIMARY') {
          throw new Error('Para crear una nueva configuración, primero debes asignar una cuenta primaria')
        }
        return paymentProviderAPI.createVenuePaymentConfig({
          venueId: selectedVenueId,
          primaryAccountId: account.id,
        })
      }
    },
    onSuccess: () => {
      toast({
        title: 'Asignación exitosa',
        description: `Cuenta asignada como ${selectedSlot.toLowerCase()} al venue`,
      })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config'] })
      queryClient.invalidateQueries({ queryKey: ['all-venue-configs'] })
      queryClient.invalidateQueries({ queryKey: ['venue-configs-by-merchant'] })
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo asignar la cuenta',
        variant: 'destructive',
      })
    },
  })

  // Unassign mutation - removes account from its current slot
  const unassignMutation = useMutation({
    mutationFn: async () => {
      if (!currentAssignment || !account) throw new Error('Missing data')

      const updateData: any = {}

      // Set the current slot to null
      if (currentAssignment.slot === 'PRIMARY') {
        updateData.primaryAccountId = null
      } else if (currentAssignment.slot === 'SECONDARY') {
        updateData.secondaryAccountId = null
      } else if (currentAssignment.slot === 'TERTIARY') {
        updateData.tertiaryAccountId = null
      }

      return paymentProviderAPI.updateVenuePaymentConfig(currentAssignment.venueId, updateData)
    },
    onSuccess: () => {
      toast({
        title: 'Cuenta desanexada',
        description: `La cuenta fue removida del slot ${currentAssignment?.slot?.toLowerCase()}`,
      })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config'] })
      queryClient.invalidateQueries({ queryKey: ['all-venue-configs'] })
      queryClient.invalidateQueries({ queryKey: ['venue-configs-by-merchant'] })
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo desanexar la cuenta',
        variant: 'destructive',
      })
    },
  })

  if (!account) return null

  // Determine current slot holders
  const currentPrimary = existingConfig?.primaryAccount
  const currentSecondary = existingConfig?.secondaryAccount
  const currentTertiary = existingConfig?.tertiaryAccount

  // Check if this account is already assigned to selected venue
  const isAlreadyAssigned =
    existingConfig &&
    (existingConfig.primaryAccountId === account.id ||
      existingConfig.secondaryAccountId === account.id ||
      existingConfig.tertiaryAccountId === account.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-pink-500/10">
              <Building2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle>Asignar cuenta a venue</DialogTitle>
              <DialogDescription>Selecciona un venue y un slot para asignar esta cuenta</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Account Info */}
          <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', account.provider?.code === 'BLUMON' ? 'bg-yellow-500/10' : 'bg-blue-500/10')}>
                {account.provider?.code === 'BLUMON' ? (
                  <Zap className="w-4 h-4 text-yellow-600" />
                ) : (
                  <CreditCard className="w-4 h-4 text-blue-600" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">{account.displayName || account.alias || account.externalMerchantId}</p>
                <p className="text-xs text-muted-foreground">{account.provider?.name}</p>
              </div>
              {account.blumonEnvironment && (
                <Badge
                  variant={account.blumonEnvironment === 'PRODUCTION' ? 'default' : 'secondary'}
                  className={cn(
                    'text-[10px] px-1.5 py-0 ml-auto',
                    account.blumonEnvironment === 'PRODUCTION'
                      ? 'bg-green-600 hover:bg-green-600'
                      : 'bg-amber-500/80 text-amber-950 hover:bg-amber-500/80',
                  )}
                >
                  {account.blumonEnvironment === 'PRODUCTION' ? 'PROD' : 'SANDBOX'}
                </Badge>
              )}
            </div>
          </div>

          {/* Current Assignment Info */}
          {loadingAssignments ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando asignaciones...
            </div>
          ) : currentAssignment ? (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Asignación actual:</strong> {currentAssignment.venueName} como{' '}
                {currentAssignment.slot === 'PRIMARY'
                  ? 'Principal'
                  : currentAssignment.slot === 'SECONDARY'
                    ? 'Secundaria'
                    : 'Terciaria'}
              </p>
            </div>
          ) : null}

          {/* Venue Selection */}
          <div className="space-y-2">
            <Label>Venue</Label>
            <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un venue" />
              </SelectTrigger>
              <SelectContent>
                {sortedVenues.map((venue: SuperadminVenue, idx: number) => {
                  const isActive = venue.status === 'ACTIVE'
                  const prevVenue = sortedVenues[idx - 1] as SuperadminVenue | undefined
                  const showSeparator = idx > 0 && !isActive && prevVenue?.status === 'ACTIVE'

                  return (
                    <React.Fragment key={venue.id}>
                      {showSeparator && <div className="h-px bg-border my-1" />}
                      <SelectItem value={venue.id}>
                        <div className={cn('flex items-center gap-2', !isActive && 'text-muted-foreground')}>
                          <span
                            className={cn(
                              'w-2 h-2 rounded-full shrink-0',
                              venue.status === 'ACTIVE' && 'bg-green-500',
                              venue.status === 'ONBOARDING' && 'bg-yellow-500',
                              venue.status === 'TRIAL' && 'bg-orange-500',
                              !['ACTIVE', 'ONBOARDING', 'TRIAL'].includes(venue.status || '') && 'bg-muted',
                            )}
                          />
                          <span className="truncate">{venue.name}</span>
                        </div>
                      </SelectItem>
                    </React.Fragment>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Slot Selection */}
          {selectedVenueId && (
            <div className="space-y-2">
              <Label>Posición</Label>
              <Select value={selectedSlot} onValueChange={v => setSelectedSlot(v as AccountSlot)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMARY">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Principal</span>
                      {loadingConfig && <Loader2 className="w-3 h-3 animate-spin" />}
                      {currentPrimary && !loadingConfig && (
                        <span className="text-xs text-muted-foreground">
                          (actual: {currentPrimary.displayName || currentPrimary.alias || 'Sin nombre'})
                        </span>
                      )}
                      {!existingConfig && !loadingConfig && (
                        <Badge variant="outline" className="text-[10px] ml-2">
                          Nueva config
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                  <SelectItem value="SECONDARY" disabled={!existingConfig}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Secundaria</span>
                      {currentSecondary && (
                        <span className="text-xs text-muted-foreground">
                          (actual: {currentSecondary.displayName || currentSecondary.alias || 'Sin nombre'})
                        </span>
                      )}
                      {!existingConfig && <span className="text-xs text-muted-foreground">(requiere config primaria)</span>}
                    </div>
                  </SelectItem>
                  <SelectItem value="TERTIARY" disabled={!existingConfig}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Terciaria</span>
                      {currentTertiary && (
                        <span className="text-xs text-muted-foreground">
                          (actual: {currentTertiary.displayName || currentTertiary.alias || 'Sin nombre'})
                        </span>
                      )}
                      {!existingConfig && <span className="text-xs text-muted-foreground">(requiere config primaria)</span>}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {!existingConfig && selectedVenueId && !loadingConfig && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Este venue no tiene configuración de pagos. Se creará una nueva con esta cuenta como principal.
                </p>
              )}

              {/* Warning: Selected slot is occupied by another account */}
              {selectedSlotOccupant && !loadingConfig && (
                <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                        Este slot está ocupado
                      </p>
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                        <strong>{selectedSlotOccupant.displayName || selectedSlotOccupant.alias || 'Cuenta sin nombre'}</strong> será
                        reemplazada si continúas. El venue perderá esa cuenta en este slot.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Warning: Trying to move PRIMARY account to another slot */}
              {currentAssignment?.slot === 'PRIMARY' &&
                selectedSlot !== 'PRIMARY' &&
                selectedVenueId === currentAssignment.venueId &&
                !loadingConfig && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-700 dark:text-red-300">No se puede mover cuenta primaria</p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          La cuenta primaria es obligatoria. Para cambiarla de slot, primero asigna otra cuenta como primaria.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Warning: Changing venue assignment */}
          {isChangingVenue && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">
                    ¡Cambio de venue detectado!
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Esta cuenta se moverá de <strong>{currentAssignment?.venueName}</strong> a un nuevo venue.
                    Esto podría afectar la configuración de pagos del venue anterior.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Already assigned to this venue warning */}
          {isAlreadyAssigned && !isChangingVenue && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                ⚠️ Esta cuenta ya está asignada a este venue. Puedes cambiarla a otro slot.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Unassign button - only show if account is currently assigned AND not PRIMARY */}
          {currentAssignment && currentAssignment.slot !== 'PRIMARY' && (
            <Button
              variant="destructive"
              onClick={() => unassignMutation.mutate()}
              disabled={unassignMutation.isPending}
              className="sm:mr-auto"
            >
              {unassignMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Desanexando...
                </>
              ) : (
                <>
                  <Unlink className="w-4 h-4 mr-2" />
                  Desanexar
                </>
              )}
            </Button>
          )}
          {/* Info for PRIMARY accounts - cannot be unassigned */}
          {currentAssignment && currentAssignment.slot === 'PRIMARY' && (
            <p className="text-xs text-muted-foreground sm:mr-auto self-center">
              La cuenta primaria no se puede desanexar (es obligatoria)
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => assignMutation.mutate()}
              disabled={
                !selectedVenueId ||
                assignMutation.isPending ||
                unassignMutation.isPending ||
                // Disable if trying to move PRIMARY account to another slot in same venue
                (currentAssignment?.slot === 'PRIMARY' &&
                  selectedSlot !== 'PRIMARY' &&
                  selectedVenueId === currentAssignment.venueId)
              }
              className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
            >
              {assignMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Asignando...
                </>
              ) : (
                'Asignar'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
