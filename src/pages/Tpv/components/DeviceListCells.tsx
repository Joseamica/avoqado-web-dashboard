import { BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, Check, Copy } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getDeviceKindIcon } from '@/lib/device-kind'
import { cn } from '@/lib/utils'
import { Currency } from '@/utils/currency'
import {
  getAppVersion,
  getDeviceBattery,
  getDeviceIdentifier,
  getDeviceKind,
  getDeviceListStatus,
  getDeviceSystem,
  type DeviceListInput,
  type DeviceListStatus,
} from '../deviceListPresentation'
import { useDeviceStatusLabel, useDeviceSubtitle } from './useDeviceListLabels'

/**
 * Celdas de la lista de Dispositivos (rediseño A1, 8-oct-2026). Las usan la tabla de
 * escritorio y las tarjetas de celular, para que las dos digan exactamente lo mismo.
 */

// Variables de estado de src/index.css (claro y oscuro). `status-success`/`status-info` no sirven:
// leen `--color-success-*`/`--color-info-*`, que el @theme no registra (sólo registra warning).
const TONE_CLASS: Record<DeviceListStatus['tone'], string> = {
  success: 'bg-(--success-muted) text-(--success-foreground) border-(--success-border)',
  warning: 'bg-(--warning-muted) text-(--warning-foreground) border-(--warning-border)',
  info: 'bg-(--info-muted) text-(--info-foreground) border-(--info-border)',
  danger: 'status-critical',
  neutral: 'bg-muted text-muted-foreground border-border',
}

export function DeviceStatusPill({ device, className }: { device: DeviceListInput; className?: string }) {
  const label = useDeviceStatusLabel()
  const status = getDeviceListStatus(device)
  return (
    <span className={cn('status-badge whitespace-nowrap font-medium', TONE_CLASS[status.tone], className)} data-status={status.key}>
      {status.key === 'online' && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {label(status)}
    </span>
  )
}

export function DeviceIcon({ device, className }: { device: DeviceListInput; className?: string }) {
  const Icon = getDeviceKindIcon(getDeviceKind(device))
  return (
    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground', className)}>
      <Icon className="size-4" aria-hidden="true" />
    </span>
  )
}

export function DeviceNameCell({ device, name }: { device: DeviceListInput; name: string }) {
  const subtitle = useDeviceSubtitle()
  return (
    <div className="flex min-w-0 items-center gap-3">
      <DeviceIcon device={device} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium underline decoration-muted-foreground/40 underline-offset-4">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{subtitle(device)}</span>
      </div>
    </div>
  )
}

export function DeviceSystemCell({ device }: { device: DeviceListInput }) {
  const { t } = useTranslation('tpv')
  const info = getDeviceSystem(device)
  if (!info.label) return <span className="text-sm text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
      {info.isPaymentTerminal && (
        <span className="rounded bg-muted px-1.5 py-px text-[10px] font-semibold tracking-wide text-muted-foreground">
          {t('list.tpvTag')}
        </span>
      )}
      {info.label}
    </span>
  )
}

export function DeviceBatteryCell({ device }: { device: DeviceListInput }) {
  const { t } = useTranslation('tpv')
  const battery = getDeviceBattery(device)
  if (!battery) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default text-sm text-muted-foreground">—</span>
        </TooltipTrigger>
        <TooltipContent>{t('list.battery.notReported')}</TooltipContent>
      </Tooltip>
    )
  }
  const Icon = battery.charging ? BatteryCharging : battery.low ? BatteryLow : battery.level >= 70 ? BatteryFull : BatteryMedium
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-sm tabular-nums', battery.low && 'text-warning')}
      title={battery.charging ? t('list.battery.charging') : undefined}
    >
      <Icon className="size-4" aria-hidden="true" />
      {battery.level}%
    </span>
  )
}

export function DeviceAppVersionCell({ device }: { device: DeviceListInput }) {
  const version = getAppVersion(device)
  if (!version) return <span className="text-sm text-muted-foreground">—</span>
  if (version.short === version.full) return <span className="whitespace-nowrap text-sm tabular-nums">v{version.short}</span>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default whitespace-nowrap text-sm tabular-nums">v{version.short}</span>
      </TooltipTrigger>
      <TooltipContent>v{version.full}</TooltipContent>
    </Tooltip>
  )
}

export function DeviceIdCell({ device }: { device: DeviceListInput }) {
  const { t } = useTranslation('tpv')
  const id = getDeviceIdentifier(device)
  const [copied, setCopied] = useState(false)
  if (!id) return <span className="text-sm text-muted-foreground">—</span>

  const copy = async (e: MouseEvent) => {
    // La fila entera navega al detalle: el botón tiene que frenar su propio clic.
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(id.full)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* El portapapeles puede estar bloqueado: el ID sigue a la vista para copiarlo a mano. */
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="select-all font-mono text-xs text-muted-foreground" title={id.full}>
        {id.display}
      </span>
      <button
        type="button"
        onClick={copy}
        className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={copied ? t('list.copied') : t('list.copyId')}
        title={copied ? t('list.copied') : t('list.copyId')}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </span>
  )
}

export function DeviceTodaySalesCell({ count, total }: { count?: number; total?: number }) {
  const { t } = useTranslation('tpv')
  if (!count) return <span className="text-sm text-muted-foreground">—</span>
  return (
    <div className="flex flex-col">
      <span className="text-sm font-semibold tabular-nums">{Currency(total || 0)}</span>
      <span className="text-xs text-muted-foreground">{t('list.salesCount', { count })}</span>
    </div>
  )
}
