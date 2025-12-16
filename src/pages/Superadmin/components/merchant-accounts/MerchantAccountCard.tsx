import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Pencil,
  Power,
  Shield,
  Smartphone,
  Trash2,
  Zap,
} from 'lucide-react'
import { type MerchantAccount } from '@/services/paymentProvider.service'
import { cn } from '@/lib/utils'
import { GlassCard } from './shared-components'

interface MerchantAccountCardProps {
  account: MerchantAccount
  onEdit: (account: MerchantAccount) => void
  onToggle: (id: string) => void
  onDelete: (account: MerchantAccount) => void
  onManageTerminals: (account: MerchantAccount) => void
  onManageCosts: (account: MerchantAccount) => void
  onAssignToVenue: (account: MerchantAccount) => void
}

export const MerchantAccountCard: React.FC<MerchantAccountCardProps> = ({
  account,
  onEdit,
  onToggle,
  onDelete,
  onManageTerminals,
  onManageCosts,
  onAssignToVenue,
}) => {
  const costStructuresCount = account._count?.costStructures || 0
  const venueConfigsCount = account._count?.venueConfigs || 0
  const terminalsCount = account._count?.terminals || 0

  return (
    <GlassCard className="p-4" hover>
      {/* Header Row */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Icon + Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={cn(
              'shrink-0 p-2.5 rounded-xl',
              account.active ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/10' : 'bg-muted'
            )}
          >
            {account.provider?.code === 'BLUMON' ? (
              <Zap
                className={cn(
                  'w-5 h-5',
                  account.active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                )}
              />
            ) : (
              <CreditCard
                className={cn(
                  'w-5 h-5',
                  account.active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                )}
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            {/* Title + Status Badge */}
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

            {/* Provider name (text) + Environment badge in 2 columns */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={account.provider?.name}>
                {account.provider?.name}
              </span>
              {account.blumonEnvironment && (
                <Badge
                  variant={account.blumonEnvironment === 'PRODUCTION' ? 'default' : 'secondary'}
                  className={cn(
                    'text-[10px] px-1.5 py-0 shrink-0',
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
                  <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => onManageCosts(account)}>
                    <DollarSign className="w-3.5 h-3.5 text-green-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Costos</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 cursor-pointer"
                    onClick={() => onManageTerminals(account)}
                  >
                    <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Terminales</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 cursor-pointer"
                    onClick={() => onAssignToVenue(account)}
                  >
                    <Building2 className="w-3.5 h-3.5 text-amber-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Asignar a Venue</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => onEdit(account)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Editar</TooltipContent>
              </Tooltip>

              <div className="w-px h-4 bg-border mx-0.5" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => onToggle(account.id)}>
                    <Power
                      className={cn(
                        'w-3.5 h-3.5',
                        account.active ? 'text-green-600' : 'text-muted-foreground'
                      )}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{account.active ? 'Desactivar' : 'Activar'}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => onDelete(account)}>
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
                  S/N {account.blumonSerialNumber}
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
                <span>
                  {costStructuresCount} costo{costStructuresCount !== 1 ? 's' : ''}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                <span>Sin costos</span>
              </div>
            )}
            {terminalsCount > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Smartphone className="w-3 h-3 text-blue-500" />
                <span>
                  {terminalsCount} terminal{terminalsCount !== 1 ? 'es' : ''}
                </span>
              </div>
            )}
            {venueConfigsCount > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Building2 className="w-3 h-3" />
                <span>
                  {venueConfigsCount} config{venueConfigsCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  )
}
