import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Smartphone, Tablet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FloorDrawing } from './FloorDrawing'
import { gridOf } from '../model/floorGeometry'
import type { DraftArea, DraftElement, DraftTable } from '../model/types'

/** El mismo dibujo dentro de una tablet y un celular. `preserveAspectRatio` lo encoge sin estirarlo (spec §4.3). */
export function WaiterPreview({ area, tables, elements }: { area: DraftArea; tables: DraftTable[]; elements: DraftElement[] }) {
  const { t } = useTranslation('floorPlan')
  const { cols, rows } = gridOf(area.floorShape)
  // Una de cada tres mesas se pinta ocupada, sólo de ejemplo.
  const busy = useMemo(() => new Set(tables.filter((_, i) => i % 3 === 1).map(x => x.key)), [tables])
  const device = (label: string, icon: ReactNode, size: string) => (
    <figure className="flex flex-col items-center gap-3">
      <div className={cn('overflow-hidden rounded-[28px] border-[10px] border-foreground/85 bg-background p-2 shadow-xl', size)}>
        <svg viewBox={`-1 -1 ${cols + 2} ${rows + 2}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full" role="img" aria-label={label}>
          <FloorDrawing area={area} tables={tables} elements={elements} busyKeys={busy} showGrid={false} />
        </svg>
      </div>
      <figcaption className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </figcaption>
    </figure>
  )
  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-auto rounded-2xl border border-input bg-card p-8"
      data-testid="floor-plan-waiter-preview"
      data-tour="floor-plan-waiter-preview"
    >
      <h3 className="text-lg font-semibold">{t('preview.title')}</h3>
      <div className="flex flex-wrap items-end justify-center gap-10">
        {device(t('preview.tablet'), <Tablet className="h-4 w-4" />, 'h-[380px] w-[600px]')}
        {device(t('preview.phone'), <Smartphone className="h-4 w-4" />, 'h-[460px] w-[230px]')}
      </div>
      <div className="flex items-center gap-5 text-xs text-muted-foreground">
        {/* `--color-success` no está en el @theme: el verde va por la variable `--success` (igual que FloorDrawing). */}
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border border-(--success) bg-(--success)/20" />
          {t('preview.free')}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border border-destructive bg-destructive/20" />
          {t('preview.busy')}
        </span>
      </div>
      <p className="max-w-md text-center text-xs text-muted-foreground">{t('preview.note')}</p>
    </div>
  )
}
