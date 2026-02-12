/**
 * ModuleOrganizationDialog
 *
 * Shows modules grouped by organization with collapsible venue lists.
 * Supports org-level enable/disable, venue-level overrides, and
 * "reset to org" (delete VenueModule override for inheritance).
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { moduleAPI, type Module, type OrganizationModuleGroup, type VenueModuleInOrg } from '@/services/superadmin-modules.service'
import {
  enableModuleForOrganization,
  disableModuleForOrganization,
  getModulesForOrganization,
} from '@/services/superadmin-organizations.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, Building2, ChevronDown, Palette, Power, PowerOff, RotateCcw, Search } from 'lucide-react'
import React, { useCallback, useMemo, useState } from 'react'
import type { WhiteLabelConfig } from '@/types/white-label'

// ===========================================
// STATUS PULSE (duplicated from parent for encapsulation)
// ===========================================

const StatusPulse: React.FC<{ status: 'success' | 'warning' | 'error' | 'neutral' }> = ({ status }) => {
  const colors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    neutral: 'bg-muted',
  }
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', colors[status])} />
      <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', colors[status])} />
    </span>
  )
}

// ===========================================
// TYPES
// ===========================================

interface ModuleOrganizationDialogProps {
  selectedModule: Module | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onOpenWhiteLabelWizard: (target: {
    venueId?: string
    venueName?: string
    orgId?: string
    orgName?: string
    initialConfig?: WhiteLabelConfig
  }) => void
}

// ===========================================
// COMPONENT
// ===========================================

const ModuleOrganizationDialog: React.FC<ModuleOrganizationDialogProps> = ({
  selectedModule,
  isOpen,
  onOpenChange,
  onOpenWhiteLabelWizard,
}) => {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set())

  // Fetch grouped data
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-module-venues-grouped', selectedModule?.code],
    queryFn: () => moduleAPI.getVenuesForModuleGrouped(selectedModule!.code),
    enabled: !!selectedModule && isOpen,
  })

  // ===========================================
  // MUTATIONS
  // ===========================================

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['superadmin-module-venues-grouped'] })
    queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })
    queryClient.invalidateQueries({ queryKey: ['superadmin-organizations'] })
  }, [queryClient])

  // Org enable
  const orgEnableMutation = useMutation({
    mutationFn: ({ orgId, moduleCode }: { orgId: string; moduleCode: string }) => enableModuleForOrganization(orgId, moduleCode),
    onSuccess: result => {
      toast({ title: 'Módulo activado para organización', description: result.message })
      invalidateAll()
    },
    onError: (error: any) => {
      toast({
        title: 'Error al activar módulo',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Org disable
  const orgDisableMutation = useMutation({
    mutationFn: ({ orgId, moduleCode }: { orgId: string; moduleCode: string }) => disableModuleForOrganization(orgId, moduleCode),
    onSuccess: result => {
      toast({ title: 'Módulo desactivado para organización', description: result.message })
      invalidateAll()
    },
    onError: (error: any) => {
      toast({
        title: 'Error al desactivar módulo',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Venue enable
  const venueEnableMutation = useMutation({
    mutationFn: ({ venueId, moduleCode }: { venueId: string; moduleCode: string }) => moduleAPI.enableModule(venueId, moduleCode),
    onSuccess: result => {
      toast({ title: 'Módulo activado', description: result.message })
      invalidateAll()
    },
    onError: (error: any) => {
      toast({
        title: 'Error al activar módulo',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Venue disable
  const venueDisableMutation = useMutation({
    mutationFn: ({ venueId, moduleCode }: { venueId: string; moduleCode: string }) => moduleAPI.disableModule(venueId, moduleCode),
    onSuccess: result => {
      toast({ title: 'Módulo desactivado', description: result.message })
      invalidateAll()
    },
    onError: (error: any) => {
      toast({
        title: 'Error al desactivar módulo',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Venue reset to org
  const venueResetMutation = useMutation({
    mutationFn: ({ venueId, moduleCode }: { venueId: string; moduleCode: string }) =>
      moduleAPI.deleteVenueModuleOverride(venueId, moduleCode),
    onSuccess: result => {
      toast({ title: 'Override eliminado', description: result.message })
      invalidateAll()
    },
    onError: (error: any) => {
      toast({
        title: 'Error al restablecer',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  const isMutating =
    orgEnableMutation.isPending ||
    orgDisableMutation.isPending ||
    venueEnableMutation.isPending ||
    venueDisableMutation.isPending ||
    venueResetMutation.isPending

  // ===========================================
  // FILTERING
  // ===========================================

  const filteredOrganizations = useMemo(() => {
    if (!data?.organizations) return []
    if (!searchTerm.trim()) return data.organizations

    const term = searchTerm.toLowerCase()
    return data.organizations
      .map(org => {
        const orgMatches = org.name.toLowerCase().includes(term) || org.slug?.toLowerCase().includes(term)
        const matchingVenues = org.venues.filter(v => v.name.toLowerCase().includes(term) || v.slug.toLowerCase().includes(term))

        // Show org if org name matches or any venue matches
        if (orgMatches) return org
        if (matchingVenues.length > 0) return { ...org, venues: matchingVenues }
        return null
      })
      .filter((org): org is OrganizationModuleGroup => org !== null)
  }, [data?.organizations, searchTerm])

  // Summary stats
  const stats = useMemo(() => {
    if (!data?.organizations) return { orgs: 0, activeVenues: 0, totalVenues: 0 }
    let activeVenues = 0
    let totalVenues = 0
    data.organizations.forEach(org => {
      org.venues.forEach(v => {
        totalVenues++
        if (v.moduleEnabled) activeVenues++
      })
    })
    return { orgs: data.organizations.length, activeVenues, totalVenues }
  }, [data?.organizations])

  // ===========================================
  // HANDLERS
  // ===========================================

  const toggleOrg = useCallback((orgId: string) => {
    setExpandedOrgs(prev => {
      const next = new Set(prev)
      if (next.has(orgId)) next.delete(orgId)
      else next.add(orgId)
      return next
    })
  }, [])

  const handleOrgToggle = useCallback(
    (org: OrganizationModuleGroup, enabled: boolean) => {
      if (!selectedModule) return
      if (enabled) {
        orgEnableMutation.mutate({ orgId: org.id, moduleCode: selectedModule.code })
      } else {
        orgDisableMutation.mutate({ orgId: org.id, moduleCode: selectedModule.code })
      }
    },
    [selectedModule, orgEnableMutation, orgDisableMutation],
  )

  const handleOrgConfigure = useCallback(
    async (org: OrganizationModuleGroup) => {
      if (!selectedModule) return
      // Fetch org-level config for the wizard
      try {
        const { modules } = await getModulesForOrganization(org.id)
        const wlModule = modules.find(m => m.code === 'WHITE_LABEL_DASHBOARD')
        const config = wlModule?.config as WhiteLabelConfig | undefined
        onOpenWhiteLabelWizard({
          orgId: org.id,
          orgName: org.name,
          initialConfig: config || undefined,
        })
      } catch {
        // If fetch fails, open wizard without pre-loaded config
        onOpenWhiteLabelWizard({ orgId: org.id, orgName: org.name })
      }
    },
    [selectedModule, onOpenWhiteLabelWizard],
  )

  const handleVenueEnable = useCallback(
    (venue: VenueModuleInOrg) => {
      if (!selectedModule) return
      venueEnableMutation.mutate({ venueId: venue.id, moduleCode: selectedModule.code })
    },
    [selectedModule, venueEnableMutation],
  )

  const handleVenueDisable = useCallback(
    (venue: VenueModuleInOrg) => {
      if (!selectedModule) return
      venueDisableMutation.mutate({ venueId: venue.id, moduleCode: selectedModule.code })
    },
    [selectedModule, venueDisableMutation],
  )

  const handleVenueReset = useCallback(
    (venue: VenueModuleInOrg) => {
      if (!selectedModule) return
      venueResetMutation.mutate({ venueId: venue.id, moduleCode: selectedModule.code })
    },
    [selectedModule, venueResetMutation],
  )

  const handleVenueConfigure = useCallback(
    (venue: VenueModuleInOrg) => {
      onOpenWhiteLabelWizard({ venueId: venue.id, venueName: venue.name })
    },
    [onOpenWhiteLabelWizard],
  )

  // ===========================================
  // VENUE STATUS BADGE
  // ===========================================

  const renderVenueStatusBadge = (venue: VenueModuleInOrg) => {
    if (venue.isInherited) {
      return (
        <Badge variant="outline" className="text-xs border-blue-300 text-blue-600 dark:text-blue-400 dark:border-blue-600">
          <ArrowDownToLine className="w-3 h-3 mr-1" />
          Heredado
        </Badge>
      )
    }
    if (venue.hasExplicitOverride && venue.moduleEnabled) {
      return (
        <Badge variant="outline" className="text-xs border-amber-300 text-amber-600 dark:text-amber-400 dark:border-amber-600">
          Personalizado
        </Badge>
      )
    }
    if (venue.moduleEnabled) {
      return (
        <Badge variant="default" className="text-xs">
          Activo
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="text-xs">
        Inactivo
      </Badge>
    )
  }

  // ===========================================
  // RENDER
  // ===========================================

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            Organizaciones — {selectedModule?.name}
          </DialogTitle>
          <DialogDescription>Gestiona el módulo a nivel de organización. Las sucursales heredan automáticamente.</DialogDescription>
        </DialogHeader>

        {/* Search + Summary */}
        <div className="flex items-center gap-3 px-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar organización o sucursal..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {stats.orgs} orgs · {stats.activeVenues}/{stats.totalVenues} activas
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-2 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-xl border border-border/50 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-20 ml-auto" />
                  </div>
                  <div className="space-y-2 pl-8">
                    <Skeleton className="h-4 w-60" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredOrganizations.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {searchTerm ? 'No se encontraron resultados.' : 'No hay organizaciones.'}
            </div>
          ) : (
            filteredOrganizations.map(org => (
              <OrgRow
                key={org.id}
                org={org}
                moduleCode={selectedModule?.code || ''}
                isExpanded={expandedOrgs.has(org.id)}
                onToggleExpand={() => toggleOrg(org.id)}
                onOrgToggle={handleOrgToggle}
                onOrgConfigure={handleOrgConfigure}
                onVenueEnable={handleVenueEnable}
                onVenueDisable={handleVenueDisable}
                onVenueReset={handleVenueReset}
                onVenueConfigure={handleVenueConfigure}
                renderVenueStatusBadge={renderVenueStatusBadge}
                isMutating={isMutating}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================
// ORG ROW (Collapsible)
// ===========================================

interface OrgRowProps {
  org: OrganizationModuleGroup
  moduleCode: string
  isExpanded: boolean
  onToggleExpand: () => void
  onOrgToggle: (org: OrganizationModuleGroup, enabled: boolean) => void
  onOrgConfigure: (org: OrganizationModuleGroup) => void
  onVenueEnable: (venue: VenueModuleInOrg) => void
  onVenueDisable: (venue: VenueModuleInOrg) => void
  onVenueReset: (venue: VenueModuleInOrg) => void
  onVenueConfigure: (venue: VenueModuleInOrg) => void
  renderVenueStatusBadge: (venue: VenueModuleInOrg) => React.ReactNode
  isMutating: boolean
}

const OrgRow: React.FC<OrgRowProps> = React.memo(
  ({
    org,
    moduleCode,
    isExpanded,
    onToggleExpand,
    onOrgToggle,
    onOrgConfigure,
    onVenueEnable,
    onVenueDisable,
    onVenueReset,
    onVenueConfigure,
    renderVenueStatusBadge,
    isMutating,
  }) => {
    const isWL = moduleCode === 'WHITE_LABEL_DASHBOARD'
    const activeCount = org.venues.filter(v => v.moduleEnabled).length

    return (
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm transition-all duration-200 hover:border-border">
          {/* Org header */}
          <CollapsibleTrigger asChild>
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none min-h-[52px]">
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm">{org.name}</span>
                <Badge variant="secondary" className="ml-2 text-xs">
                  {org.venueCount} sucursales
                </Badge>
                {activeCount > 0 && (
                  <Badge
                    variant="outline"
                    className="ml-1.5 text-xs border-green-300 text-green-600 dark:text-green-400 dark:border-green-600"
                  >
                    {activeCount} activas
                  </Badge>
                )}
              </div>

              {/* Org-level toggle */}
              <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                {isWL && org.orgModuleEnabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs cursor-pointer"
                    onClick={() => onOrgConfigure(org)}
                    disabled={isMutating}
                  >
                    <Palette className="w-3 h-3 mr-1" />
                    Configurar
                  </Button>
                )}
                <Switch
                  checked={org.orgModuleEnabled}
                  onCheckedChange={checked => onOrgToggle(org, checked)}
                  disabled={isMutating}
                  className="cursor-pointer"
                />
              </div>

              <ChevronDown
                className={cn('w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0', isExpanded && 'rotate-180')}
              />
            </div>
          </CollapsibleTrigger>

          {/* Venue rows */}
          <CollapsibleContent>
            <div className="border-t border-border/30">
              {org.venues.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">Sin sucursales en esta organización.</div>
              ) : (
                org.venues.map(venue => (
                  <VenueRow
                    key={venue.id}
                    venue={venue}
                    moduleCode={moduleCode}
                    onEnable={onVenueEnable}
                    onDisable={onVenueDisable}
                    onReset={onVenueReset}
                    onConfigure={onVenueConfigure}
                    renderStatusBadge={renderVenueStatusBadge}
                    isMutating={isMutating}
                  />
                ))
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    )
  },
)
OrgRow.displayName = 'OrgRow'

// ===========================================
// VENUE ROW
// ===========================================

interface VenueRowProps {
  venue: VenueModuleInOrg
  moduleCode: string
  onEnable: (venue: VenueModuleInOrg) => void
  onDisable: (venue: VenueModuleInOrg) => void
  onReset: (venue: VenueModuleInOrg) => void
  onConfigure: (venue: VenueModuleInOrg) => void
  renderStatusBadge: (venue: VenueModuleInOrg) => React.ReactNode
  isMutating: boolean
}

const VenueRow: React.FC<VenueRowProps> = React.memo(
  ({ venue, moduleCode, onEnable, onDisable, onReset, onConfigure, renderStatusBadge, isMutating }) => {
    const isWL = moduleCode === 'WHITE_LABEL_DASHBOARD'

    return (
      <div className="flex items-center gap-3 px-4 py-2.5 border-l-2 border-border/50 ml-6 mr-4 transition-colors duration-200 hover:bg-muted/50 min-h-[44px]">
        {/* Venue info */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{venue.name}</span>
          <span className="text-xs text-muted-foreground ml-2">/{venue.slug}</span>
        </div>

        {/* Status badge */}
        <div className="shrink-0">
          <StatusPulse status={venue.moduleEnabled ? 'success' : 'neutral'} />
        </div>
        <div className="shrink-0">{renderStatusBadge(venue)}</div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {venue.isInherited && (
            <>
              {isWL && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs cursor-pointer"
                  onClick={() => onConfigure(venue)}
                  disabled={isMutating}
                >
                  <Palette className="w-3 h-3 mr-1" />
                  Configurar
                </Button>
              )}
            </>
          )}

          {venue.hasExplicitOverride && (
            <>
              {isWL && venue.moduleEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs cursor-pointer"
                  onClick={() => onConfigure(venue)}
                  disabled={isMutating}
                >
                  <Palette className="w-3 h-3 mr-1" />
                  Configurar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs cursor-pointer"
                onClick={() => onReset(venue)}
                disabled={isMutating}
                title="Restablecer a configuración de organización"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Restablecer
              </Button>
              {venue.moduleEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs cursor-pointer"
                  onClick={() => onDisable(venue)}
                  disabled={isMutating}
                >
                  <PowerOff className="w-3 h-3 mr-1" />
                  Desactivar
                </Button>
              )}
            </>
          )}

          {!venue.isInherited && !venue.hasExplicitOverride && !venue.moduleEnabled && (
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs cursor-pointer"
              onClick={() => onEnable(venue)}
              disabled={isMutating}
            >
              <Power className="w-3 h-3 mr-1" />
              Activar
            </Button>
          )}
        </div>
      </div>
    )
  },
)
VenueRow.displayName = 'VenueRow'

export default ModuleOrganizationDialog
