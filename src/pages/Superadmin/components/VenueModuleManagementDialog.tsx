import React from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  getModulesForVenue,
  enableModuleForVenue,
  disableModuleForVenue,
  type ModuleForVenue,
} from '@/services/superadmin.service'
import { Loader2, Package, Power, PowerOff, Building2, ArrowDown, ExternalLink } from 'lucide-react'

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
// VENUE MODULE MANAGEMENT DIALOG
// ===========================================

interface VenueModuleManagementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venue: {
    id: string
    name: string
    organization?: {
      name: string
    }
  } | null
}

const VenueModuleManagementDialog: React.FC<VenueModuleManagementDialogProps> = ({
  open,
  onOpenChange,
  venue,
}) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch modules for this venue
  const { data: modules = [], isLoading } = useQuery({
    queryKey: ['venue-modules', venue?.id],
    queryFn: () => getModulesForVenue(venue!.id),
    enabled: !!venue && open,
  })

  // Enable mutation
  const enableMutation = useMutation({
    mutationFn: ({ moduleCode, preset }: { moduleCode: string; preset?: string }) =>
      enableModuleForVenue(venue!.id, moduleCode, preset),
    onSuccess: () => {
      toast({ title: 'Módulo Activado', description: 'El módulo ha sido activado para esta sucursal.' })
      queryClient.invalidateQueries({ queryKey: ['venue-modules', venue?.id] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-venues'] })
    },
    onError: (error: any) => {
      toast({
        title: 'Error al activar módulo',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Disable mutation
  const disableMutation = useMutation({
    mutationFn: (moduleCode: string) => disableModuleForVenue(venue!.id, moduleCode),
    onSuccess: () => {
      toast({ title: 'Módulo Desactivado', description: 'El módulo ha sido desactivado para esta sucursal.' })
      queryClient.invalidateQueries({ queryKey: ['venue-modules', venue?.id] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-venues'] })
    },
    onError: (error: any) => {
      toast({
        title: 'Error al desactivar módulo',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  const handleToggleModule = (module: ModuleForVenue) => {
    // Can't disable inherited modules at venue level
    if (module.isInherited) {
      toast({
        title: 'Módulo Heredado',
        description: 'Este módulo está activado a nivel organización. Para desactivarlo, edita los módulos de la organización.',
        variant: 'destructive',
      })
      return
    }

    if (module.isEnabled && module.venueModule) {
      disableMutation.mutate(module.code)
    } else {
      enableMutation.mutate({ moduleCode: module.code })
    }
  }

  // Separate inherited and venue-specific modules
  const inheritedModules = modules.filter(m => m.isInherited)
  const _venueSpecificModules = modules.filter(m => !m.isInherited || m.venueModule)

  if (!venue) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            Módulos de {venue.name}
          </DialogTitle>
          <DialogDescription>
            Gestiona los módulos activados para esta sucursal.
            {venue.organization && (
              <span className="block mt-1">
                Organización: <strong>{venue.organization.name}</strong>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : modules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay módulos configurados en el sistema
            </div>
          ) : (
            <>
              {/* Inherited Modules Section */}
              {inheritedModules.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Módulos Heredados de la Organización
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {inheritedModules.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {inheritedModules.map(module => (
                      <GlassCard key={module.id} className="p-3 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                              <ArrowDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-sm">{module.name}</h4>
                                <Badge variant="outline" className="text-xs font-mono">
                                  {module.code}
                                </Badge>
                                <Badge className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                                  Heredado
                                </Badge>
                              </div>
                              {module.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{module.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Power className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <span className="text-xs text-muted-foreground">Siempre activo</span>
                          </div>
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                </div>
              )}

              {/* Available/Venue-Specific Modules Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Módulos Específicos de la Sucursal
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {modules.filter(m => !m.isInherited).length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {modules
                    .filter(m => !m.isInherited)
                    .map(module => (
                      <GlassCard key={module.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'p-1.5 rounded-lg',
                                module.isEnabled
                                  ? 'bg-gradient-to-br from-green-500/20 to-green-500/5'
                                  : 'bg-muted'
                              )}
                            >
                              {module.isEnabled ? (
                                <Power className="w-3 h-3 text-green-600 dark:text-green-400" />
                              ) : (
                                <PowerOff className="w-3 h-3 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-sm">{module.name}</h4>
                                <Badge variant="outline" className="text-xs font-mono">
                                  {module.code}
                                </Badge>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Link to="/superadmin/modules" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 cursor-pointer hover:bg-muted"
                                        >
                                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                        </Button>
                                      </Link>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Editar módulo</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              {module.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{module.description}</p>
                              )}
                            </div>
                          </div>
                          <Switch
                            checked={module.isEnabled}
                            onCheckedChange={() => handleToggleModule(module)}
                            disabled={enableMutation.isPending || disableMutation.isPending}
                          />
                        </div>
                        {module.isEnabled && module.venueModule?.enabledAt && (
                          <p className="text-xs text-muted-foreground mt-2 ml-8">
                            Activo desde{' '}
                            {new Date(module.venueModule.enabledAt).toLocaleDateString('es-MX', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        )}
                      </GlassCard>
                    ))}
                </div>
                {modules.filter(m => !m.isInherited).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Todos los módulos disponibles están activos a nivel organización.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Los módulos heredados provienen de la organización y no pueden desactivarse aquí.
            Para gestionar módulos a nivel organización, ve a la sección de Organizaciones.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default VenueModuleManagementDialog
