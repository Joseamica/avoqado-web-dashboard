import { CheckCircle2, Eye, KeyRound, MoreHorizontal, RotateCw, Trash2, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAccess } from '@/hooks/use-access'
import { isTerminalOnline } from '@/lib/terminal-status'
import type { TpvListDevice } from '@/services/tpv.service'
import { TpvCommandType } from '@/types/tpv-commands'
import { canSendCommand, getDeviceActionPolicy } from '../deviceCapabilities'

interface DeviceRowMenuProps {
  device: TpvListDevice
  detailTo: string
  detailState?: Record<string, unknown>
  onActivate: (device: TpvListDevice) => void
  onRestart: (device: TpvListDevice) => void
  onCommand: (device: TpvListDevice, command: TpvCommandType) => void
  onDelete: (device: TpvListDevice) => void
}

/**
 * Menú «⋯» de cada fila. Reemplaza los íconos sueltos de llave y ↻ (founder, 8-oct): el ↻
 * no refrescaba, REINICIABA la terminal a un clic. Como en Square, lo que cambia el aparato
 * vive en un menú y reiniciar pide confirmación (la confirmación la pinta la página).
 *
 * Cada opción respeta los mismos permisos y capacidades que antes (`tpv:update`,
 * `tpv:command`, `tpv:delete` + lo que el aparato dice soportar).
 */
export function DeviceRowMenu({ device, detailTo, detailState, onActivate, onRestart, onCommand, onDelete }: DeviceRowMenuProps) {
  const { t } = useTranslation('tpv')
  const { can } = useAccess()
  const navigate = useNavigate()

  const policy = getDeviceActionPolicy(device.capabilities, device.activatedAt)
  const online = isTerminalOnline(device.lastHeartbeat)
  const inMaintenance = device.status === 'MAINTENANCE'

  const canActivate = policy.activationPending && can('tpv:update')
  const canCommand = can('tpv:command')
  const canRestart = canCommand && canSendCommand(device.capabilities, TpvCommandType.RESTART)
  const canEnterMaintenance = canCommand && !inMaintenance && canSendCommand(device.capabilities, TpvCommandType.MAINTENANCE_MODE)
  const canExitMaintenance = canCommand && inMaintenance && canSendCommand(device.capabilities, TpvCommandType.EXIT_MAINTENANCE)
  const canDelete = policy.activationPending && can('tpv:delete')
  const hasDeviceActions = canActivate || canRestart || canEnterMaintenance || canExitMaintenance

  return (
    // La fila entera navega al detalle y los clics del menú (aunque vivan en un portal) suben
    // por el árbol de React hasta ella: este contenedor los frena.
    <div className="flex justify-end" onClick={e => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8 cursor-pointer" aria-label={t('list.menu.open')}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={() => navigate(detailTo, { state: detailState })}>
            <Eye className="size-4" />
            {t('list.menu.viewDetail')}
          </DropdownMenuItem>

          {hasDeviceActions && <DropdownMenuSeparator />}

          {canActivate && (
            <DropdownMenuItem onSelect={() => onActivate(device)}>
              <KeyRound className="size-4" />
              {t('list.menu.activate')}
            </DropdownMenuItem>
          )}

          {canRestart && (
            <DropdownMenuItem onSelect={() => onRestart(device)}>
              <RotateCw className="size-4" />
              {online ? t('list.menu.restart') : t('list.menu.restartQueued')}
            </DropdownMenuItem>
          )}

          {canEnterMaintenance && (
            <DropdownMenuItem disabled={!online} onSelect={() => onCommand(device, TpvCommandType.MAINTENANCE_MODE)}>
              <Wrench className="size-4" />
              <span className="flex flex-col">
                {t('list.menu.maintenance')}
                {!online && <span className="text-xs text-muted-foreground">{t('list.menu.needsOnline')}</span>}
              </span>
            </DropdownMenuItem>
          )}

          {canExitMaintenance && (
            <DropdownMenuItem onSelect={() => onCommand(device, TpvCommandType.EXIT_MAINTENANCE)}>
              <CheckCircle2 className="size-4" />
              {t('list.menu.exitMaintenance')}
            </DropdownMenuItem>
          )}

          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onDelete(device)}>
                <Trash2 className="size-4" />
                {t('list.menu.delete')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
