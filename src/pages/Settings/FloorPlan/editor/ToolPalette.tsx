import { useTranslation } from 'react-i18next'
import { Circle, DoorOpen, GalleryHorizontal, Minus, MousePointer2, RectangleHorizontal, Square, SquareDashed, Type, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TOOL_DRAG_MIME } from './FloorCanvas'
import type { PlanLimits } from '../model/limits'
import type { ToolId } from '../model/types'

/** Llave de texto de cada herramienta (i18next usa ':' para namespaces: `table:SQUARE` no puede ser llave). */
export const toolLabelKey = (id: ToolId) => `tools.${id.startsWith('table:') ? `TABLE_${id.slice(6)}` : id === 'select' ? 'select' : id}`

type Kind = 'tables' | 'elements'
const SECTIONS: Array<{ title: string; kind: Kind; tools: Array<{ id: ToolId; icon: LucideIcon }> }> = [
  {
    title: 'tools.tablesSection',
    kind: 'tables',
    tools: [
      { id: 'table:SQUARE', icon: Square },
      { id: 'table:ROUND', icon: Circle },
      { id: 'table:RECTANGLE', icon: RectangleHorizontal },
    ],
  },
  {
    title: 'tools.roomSection',
    kind: 'elements',
    tools: [
      { id: 'WALL', icon: Minus },
      { id: 'BAR_COUNTER', icon: GalleryHorizontal },
      { id: 'SERVICE_AREA', icon: SquareDashed },
      { id: 'DOOR', icon: DoorOpen },
      { id: 'LABEL', icon: Type },
    ],
  },
]

export interface ToolPaletteProps {
  tool: ToolId
  onTool: (tool: ToolId) => void
  disabled: boolean
  /** Cuánto cabe todavía; en 0 la sección se apaga y dice por qué. */
  room: PlanLimits
  limits: PlanLimits
}

export function ToolPalette({ tool, onTool, disabled, room, limits }: ToolPaletteProps) {
  const { t } = useTranslation('floorPlan')
  const button = (id: ToolId, Icon: LucideIcon, off: boolean) => {
    const active = tool === id
    return (
      <button
        key={id}
        type="button"
        disabled={off}
        draggable={!off && id !== 'WALL' && id !== 'select'}
        onDragStart={e => {
          e.dataTransfer.setData(TOOL_DRAG_MIME, id)
          e.dataTransfer.effectAllowed = 'copy'
        }}
        // Con el ratón el foco no se queda en el botón (lo suelta el editor entero, `blurAfterPointerClick`).
        onClick={() => onTool(active && id !== 'select' ? 'select' : id)}
        aria-pressed={active}
        data-testid={`floor-tool-${id}`}
        data-tour={`floor-plan-tool-${id.replace(':', '-').toLowerCase()}`}
        // Ojo: ninguna clase con «card» aquí: `.dark [class*='card']` (src/theme.css:78) le pinta fondo y texto propios.
        className={cn(
          'flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          active ? 'bg-foreground text-background' : 'text-foreground hover:bg-muted',
          off && 'cursor-not-allowed opacity-50 hover:bg-transparent',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span>{t(toolLabelKey(id))}</span>
      </button>
    )
  }
  return (
    <aside className="flex min-h-0 flex-col gap-5 overflow-y-auto rounded-2xl border border-input bg-card p-3" data-tour="floor-plan-palette" aria-label={t('tools.palette')}>
      {button('select', MousePointer2, disabled)}
      {SECTIONS.map(s => {
        const full = room[s.kind] <= 0
        return (
          <div key={s.title} className="space-y-1" role="group" aria-labelledby={`floor-tools-${s.kind}`}>
            <p id={`floor-tools-${s.kind}`} className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(s.title)}
            </p>
            {s.tools.map(x => button(x.id, x.icon, disabled || full))}
            {full && !disabled && (
              <p className="px-3 pt-1 text-xs leading-relaxed text-muted-foreground" data-testid={`floor-tools-full-${s.kind}`}>
                {t(`limits.${s.kind}`, { max: limits[s.kind] })}
              </p>
            )}
          </div>
        )
      })}
      <p className="mt-auto px-3 text-xs leading-relaxed text-muted-foreground">{t('tools.hint')}</p>
    </aside>
  )
}
