import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getDeviceKindIcon, normalizeFormFactor } from '@/lib/device-kind'
import { useDeviceKindLabels } from './useDeviceKindLabels'

interface DeviceTypeCellProps {
  formFactor?: string | null
  /** Nombre comercial resuelto por el server: "iPhone 15 Pro", "Sunmi D3 Mini". */
  model?: string | null
  brand?: string | null
  osVersion?: string | null
  /** true = apareció solo al hacer login; false = lo dio de alta un admin. */
  selfRegistered?: boolean | null
}

/**
 * Columna "Tipo" de la lista de terminales.
 *
 * Muestra qué clase de aparato es y de dónde salió. La distinción entre hardware
 * provisionado y auto-registrado importa: una PAX comprada tiene merchants asignados y
 * procesa cobros; el teléfono de un mesero no. Que se vean iguales confundiría.
 */
export function DeviceTypeCell({ formFactor, model, brand, osVersion, selfRegistered }: DeviceTypeCellProps) {
  const { t } = useTranslation('tpv')
  const labels = useDeviceKindLabels()
  const kind = normalizeFormFactor(formFactor)
  const Icon = getDeviceKindIcon(kind)

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs font-medium">{labels[kind]}</p>
          {osVersion && <p className="text-xs text-muted-foreground">{osVersion}</p>}
        </TooltipContent>
      </Tooltip>

      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm">{model || labels[kind]}</span>
        <div className="flex items-center gap-1.5">
          {/*
            El modelo resuelto por el server a menudo YA trae la marca dentro
            ("Samsung SM-X133", "Sunmi D3", "PAX A910S"). Repetirla abajo era
            redundante y, peor, robaba ancho al badge y truncaba el texto a
            "Samsu…". Sólo se muestra cuando aporta algo que el modelo no dice.
          */}
          {brand && !model?.toLowerCase().startsWith(brand.toLowerCase()) && (
            <span className="truncate text-xs text-muted-foreground">{brand}</span>
          )}
          {selfRegistered && (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
              {t('deviceKind.selfRegistered', { defaultValue: 'Auto-registrado' })}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

export default DeviceTypeCell
