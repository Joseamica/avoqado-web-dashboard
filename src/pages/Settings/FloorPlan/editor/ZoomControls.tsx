import { useTranslation } from 'react-i18next'
import { Maximize, Minus, Plus } from 'lucide-react'
import { IconAction } from './IconAction'

/** Acercar, alejar y «Ver todo», con el porcentaje a la vista. Vive en la barra de abajo del lienzo, fuera del dibujo. */
export function ZoomControls({ zoom, onZoomIn, onZoomOut, onFit }: { zoom: number; onZoomIn: () => void; onZoomOut: () => void; onFit: () => void }) {
  const { t } = useTranslation('floorPlan')
  return (
    <div className="flex shrink-0 items-center gap-0.5" data-tour="floor-plan-zoom">
      <IconAction label={t('canvas.zoomOut')} className="h-9 w-9" onClick={onZoomOut}>
        <Minus className="h-4 w-4" />
      </IconAction>
      <span className="w-12 text-center text-xs font-medium tabular-nums text-muted-foreground" data-testid="floor-canvas-zoom">
        {zoom}%
      </span>
      <IconAction label={t('canvas.zoomIn')} className="h-9 w-9" onClick={onZoomIn}>
        <Plus className="h-4 w-4" />
      </IconAction>
      <IconAction label={t('canvas.fit')} className="h-9 w-9" onClick={onFit}>
        <Maximize className="h-4 w-4" />
      </IconAction>
    </div>
  )
}
