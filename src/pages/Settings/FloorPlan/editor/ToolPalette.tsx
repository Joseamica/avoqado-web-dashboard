import { useTranslation } from 'react-i18next'
import { Circle, DoorOpen, GalleryHorizontal, Minus, MousePointer2, RectangleHorizontal, Square, SquareDashed, Type, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TOOL_DRAG_MIME } from './FloorCanvas'
import type { ToolId } from '../model/types'

/** Llave de texto de cada herramienta (i18next usa ':' para namespaces: `table:SQUARE` no puede ser llave). */
export const toolLabelKey = (id: ToolId) => `tools.${id.startsWith('table:') ? `TABLE_${id.slice(6)}` : id === 'select' ? 'select' : id}`

const SECTIONS: Array<{ title: string; tools: Array<{ id: ToolId; icon: LucideIcon }> }> = [
  {
    title: 'tools.tablesSection',
    tools: [
      { id: 'table:SQUARE', icon: Square },
      { id: 'table:ROUND', icon: Circle },
      { id: 'table:RECTANGLE', icon: RectangleHorizontal },
    ],
  },
  {
    title: 'tools.roomSection',
    tools: [
      { id: 'WALL', icon: Minus },
      { id: 'BAR_COUNTER', icon: GalleryHorizontal },
      { id: 'SERVICE_AREA', icon: SquareDashed },
      { id: 'DOOR', icon: DoorOpen },
      { id: 'LABEL', icon: Type },
    ],
  },
]

export function ToolPalette({ tool, onTool, disabled }: { tool: ToolId; onTool: (tool: ToolId) => void; disabled: boolean }) {
  const { t } = useTranslation('floorPlan')
  const button = (id: ToolId, Icon: LucideIcon) => {
    const active = tool === id
    return (
      <button
        key={id}
        type="button"
        disabled={disabled}
        draggable={!disabled && id !== 'WALL' && id !== 'select'}
        onDragStart={e => {
          e.dataTransfer.setData(TOOL_DRAG_MIME, id)
          e.dataTransfer.effectAllowed = 'copy'
        }}
        onClick={() => onTool(active && id !== 'select' ? 'select' : id)}
        aria-pressed={active}
        data-testid={`floor-tool-${id}`}
        data-tour={`floor-plan-tool-${id.replace(':', '-').toLowerCase()}`}
        className={cn(
          'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
          active ? 'bg-foreground text-background' : 'text-foreground hover:bg-muted',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{t(toolLabelKey(id))}</span>
      </button>
    )
  }
  return (
    <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-input bg-card p-3" data-tour="floor-plan-palette">
      {button('select', MousePointer2)}
      {SECTIONS.map(s => (
        <div key={s.title} className="space-y-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t(s.title)}</p>
          {s.tools.map(x => button(x.id, x.icon))}
        </div>
      ))}
      <p className="mt-auto px-3 text-xs leading-relaxed text-muted-foreground">{t('tools.hint')}</p>
    </aside>
  )
}
