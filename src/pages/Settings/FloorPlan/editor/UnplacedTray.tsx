import { useTranslation } from 'react-i18next'
import { TABLE_DRAG_MIME } from './FloorCanvas'
import type { DraftTable } from '../model/types'

/** Mesas sin lugar en el plano: se arrastran al lienzo, o un clic las pone al centro del área abierta. */
export function UnplacedTray({ tables, onPlace }: { tables: DraftTable[]; onPlace: (key: string) => void }) {
  const { t } = useTranslation('floorPlan')
  if (!tables.length) return null
  return (
    <div
      className="flex items-center gap-4 rounded-2xl border border-dashed border-input bg-card px-4 py-3"
      data-testid="floor-plan-unplaced"
      data-tour="floor-plan-unplaced"
    >
      <div className="shrink-0">
        <p className="text-sm font-medium" id="floor-unplaced-title">
          {t('tray.title', { count: tables.length })}
        </p>
        <p className="text-xs text-muted-foreground">{t('tray.hint')}</p>
      </div>
      <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto p-0.5" role="group" aria-labelledby="floor-unplaced-title">
        {tables.map(tb => (
          <button
            key={tb.key}
            type="button"
            draggable
            onDragStart={e => {
              e.dataTransfer.setData(TABLE_DRAG_MIME, tb.key)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onClick={() => onPlace(tb.key)}
            aria-label={t('tray.place', { number: tb.number })}
            data-testid={`floor-unplaced-${tb.number}`}
            className="flex h-10 min-w-10 cursor-grab items-center justify-center rounded-lg border border-input bg-background px-3 text-sm font-semibold transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          >
            {tb.number}
          </button>
        ))}
      </div>
    </div>
  )
}
