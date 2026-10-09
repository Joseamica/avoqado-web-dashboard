import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Circle, Copy, Minus, Plus, RectangleHorizontal, RotateCw, Square, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toolLabelKey } from './ToolPalette'
import { gridOf } from '../model/floorGeometry'
import type { EditorAction } from '../model/editorReducer'
import type { DraftArea, DraftElement, DraftTable, TableShape, ToolId } from '../model/types'

export interface InspectorProps {
  areas: DraftArea[]
  allNumbers: string[]
  tables: DraftTable[]
  elements: DraftElement[]
  dispatch: (action: EditorAction) => void
  onRemove: (keys: string[]) => void
  onDuplicate: (keys: string[]) => void
}

const SHAPES: Array<{ id: TableShape; icon: typeof Square }> = [
  { id: 'SQUARE', icon: Square },
  { id: 'ROUND', icon: Circle },
  { id: 'RECTANGLE', icon: RectangleHorizontal },
]
const UNPLACED = '__unplaced'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function Stepper({
  value,
  min,
  max,
  onChange,
  less,
  more,
  testId,
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  less: string
  more: string
  testId: string
}) {
  return (
    <div className="flex items-center gap-2" data-testid={testId}>
      <Button type="button" variant="outline" size="icon" className="h-11 w-11 cursor-pointer" aria-label={less} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus className="h-4 w-4" />
      </Button>
      <span className="w-12 text-center text-lg font-semibold tabular-nums">{value}</span>
      <Button type="button" variant="outline" size="icon" className="h-11 w-11 cursor-pointer" aria-label={more} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function Inspector(props: InspectorProps) {
  const { t } = useTranslation('floorPlan')
  const count = props.tables.length + props.elements.length
  const allKeys = () => [...props.tables, ...props.elements].map(x => x.key)
  return (
    <aside
      className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-input bg-card p-4"
      data-tour="floor-plan-inspector"
      data-testid="floor-plan-inspector"
    >
      {count === 0 && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">{t('inspector.nothing')}</p>
          <div className="space-y-1.5 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{t('inspector.shortcuts')}</p>
            <p>{t('inspector.shortcutMove')}</p>
            <p>{t('inspector.shortcutRotate')}</p>
            <p>{t('inspector.shortcutDuplicate')}</p>
            <p>{t('inspector.shortcutDelete')}</p>
            <p>{t('inspector.shortcutUndo')}</p>
            <p>{t('inspector.shortcutPan')}</p>
          </div>
        </div>
      )}
      {count === 1 && props.tables[0] && <TableFields key={props.tables[0].key} table={props.tables[0]} {...props} />}
      {count === 1 && props.elements[0] && <ElementFields key={props.elements[0].key} element={props.elements[0]} {...props} />}
      {count > 1 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">{t('inspector.many', { count })}</h3>
          <Button variant="outline" className="w-full cursor-pointer" onClick={() => props.dispatch({ type: 'ROTATE', keys: allKeys() })}>
            <RotateCw className="mr-2 h-4 w-4" />
            {t('inspector.rotateAll')}
          </Button>
          <Button variant="outline" className="w-full cursor-pointer" onClick={() => props.onDuplicate(allKeys())}>
            <Copy className="mr-2 h-4 w-4" />
            {t('inspector.shortcutDuplicate')}
          </Button>
          <Button variant="ghost" className="w-full cursor-pointer text-destructive hover:text-destructive" onClick={() => props.onRemove(allKeys())}>
            <Trash2 className="mr-2 h-4 w-4" />
            {t('inspector.removeMany')}
          </Button>
        </div>
      )}
    </aside>
  )
}

function TableFields({ table, areas, allNumbers, dispatch, onRemove, onDuplicate }: InspectorProps & { table: DraftTable }) {
  const { t } = useTranslation('floorPlan')
  const [number, setNumber] = useState(table.number)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setNumber(table.number), [table.number])

  const commitNumber = () => {
    const n = number.trim()
    if (!n) {
      setError(t('inspector.numberRequired'))
      setNumber(table.number)
      return
    }
    if (n !== table.number && allNumbers.some(x => x.trim() === n)) {
      setError(t('inspector.numberTaken', { number: n }))
      return
    }
    setError(null)
    if (n !== table.number) dispatch({ type: 'UPDATE_TABLE', key: table.key, patch: { number: n } })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{t('inspector.table', { number: table.number })}</h3>
        {table.hasOpenOrder && <Badge variant="outline">{t('inspector.openOrder')}</Badge>}
      </div>
      <Field label={t('inspector.number')}>
        <Input
          value={number}
          maxLength={20}
          onChange={e => {
            setNumber(e.target.value)
            setError(null)
          }}
          onBlur={commitNumber}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          aria-invalid={!!error}
          className="h-11 text-base"
          data-testid="floor-inspector-number"
          data-tour="floor-plan-inspector-number"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </Field>
      <Field label={t('inspector.capacity')}>
        <Stepper
          value={table.capacity}
          min={1}
          max={99}
          less={t('inspector.fewer')}
          more={t('inspector.more')}
          testId="floor-inspector-capacity"
          onChange={capacity => dispatch({ type: 'UPDATE_TABLE', key: table.key, patch: { capacity } })}
        />
      </Field>
      <Field label={t('inspector.shape')}>
        <div className="grid grid-cols-3 gap-2">
          {SHAPES.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={table.shape === id}
              aria-label={t(toolLabelKey(`table:${id}` as ToolId))}
              onClick={() => dispatch({ type: 'UPDATE_TABLE', key: table.key, patch: { shape: id } })}
              className={cn(
                'flex h-11 cursor-pointer items-center justify-center rounded-xl border border-input',
                table.shape === id ? 'border-foreground bg-foreground text-background' : 'hover:bg-muted',
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </Field>
      <Field label={t('inspector.rotate')}>
        <Button variant="outline" className="h-11 w-full cursor-pointer" onClick={() => dispatch({ type: 'ROTATE', keys: [table.key] })}>
          <RotateCw className="mr-2 h-4 w-4" />
          {table.rotation}°
        </Button>
      </Field>
      <Field label={t('inspector.area')}>
        <Select
          value={table.areaKey ?? UNPLACED}
          onValueChange={v => dispatch({ type: 'UPDATE_TABLE', key: table.key, patch: { areaKey: v === UNPLACED ? null : v } })}
        >
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {areas.map(a => (
              <SelectItem key={a.key} value={a.key}>
                {a.name}
              </SelectItem>
            ))}
            <SelectItem value={UNPLACED}>{t('inspector.unplaced')}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="space-y-2 border-t border-input pt-4">
        <Button variant="outline" className="w-full cursor-pointer" onClick={() => onDuplicate([table.key])}>
          <Copy className="mr-2 h-4 w-4" />
          {t('inspector.shortcutDuplicate')}
        </Button>
        <Button
          variant="ghost"
          className="w-full cursor-pointer text-destructive hover:text-destructive"
          disabled={table.hasOpenOrder}
          onClick={() => onRemove([table.key])}
          data-testid="floor-inspector-remove"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t('inspector.remove')}
        </Button>
        {table.hasOpenOrder && <p className="text-xs text-muted-foreground">{t('inspector.removeBlocked')}</p>}
      </div>
    </div>
  )
}

function ElementFields({ element, areas, dispatch, onRemove, onDuplicate }: InspectorProps & { element: DraftElement }) {
  const { t } = useTranslation('floorPlan')
  const [label, setLabel] = useState(element.label ?? '')
  useEffect(() => setLabel(element.label ?? ''), [element.label])
  const named = element.type === 'LABEL' || element.type === 'SERVICE_AREA' || element.type === 'BAR_COUNTER'
  const sized = element.type === 'BAR_COUNTER' || element.type === 'SERVICE_AREA' || element.type === 'DOOR'
  // El ancho y el alto no pasan del lienzo de su área (el borrador los recorta igual; así el «+» se apaga en la orilla).
  const grid = gridOf(areas.find(a => a.key === element.areaKey)?.floorShape ?? 'WIDE')
  const commitLabel = () => {
    const v = label.trim()
    if (element.type === 'LABEL' && !v) return setLabel(element.label ?? '')
    if (v !== (element.label ?? '')) dispatch({ type: 'UPDATE_ELEMENT', key: element.key, patch: { label: v || null } })
  }
  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold">{t(toolLabelKey(element.type))}</h3>
      {named && (
        <Field label={t('inspector.label')}>
          <Input
            value={label}
            maxLength={40}
            onChange={e => setLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            className="h-11 text-base"
            data-testid="floor-inspector-label"
          />
        </Field>
      )}
      {sized && (
        <>
          <Field label={t('inspector.width')}>
            <Stepper
              value={element.w ?? 1}
              min={1}
              max={grid.cols}
              less={t('inspector.decrease')}
              more={t('inspector.increase')}
              testId="floor-inspector-width"
              onChange={w => dispatch({ type: 'UPDATE_ELEMENT', key: element.key, patch: { w } })}
            />
          </Field>
          <Field label={t('inspector.height')}>
            <Stepper
              value={element.h ?? 1}
              min={1}
              max={grid.rows}
              less={t('inspector.decrease')}
              more={t('inspector.increase')}
              testId="floor-inspector-height"
              onChange={h => dispatch({ type: 'UPDATE_ELEMENT', key: element.key, patch: { h } })}
            />
          </Field>
          {/* Barras, zonas y puertas giran intercambiando ancho y alto: no guardan grados que enseñar (R13). */}
          <Button variant="outline" className="h-11 w-full cursor-pointer" onClick={() => dispatch({ type: 'ROTATE', keys: [element.key] })} data-testid="floor-inspector-rotate">
            <RotateCw className="mr-2 h-4 w-4" />
            {t('inspector.rotate')}
          </Button>
        </>
      )}
      <div className="space-y-2 border-t border-input pt-4">
        <Button variant="outline" className="w-full cursor-pointer" onClick={() => onDuplicate([element.key])}>
          <Copy className="mr-2 h-4 w-4" />
          {t('inspector.shortcutDuplicate')}
        </Button>
        <Button variant="ghost" className="w-full cursor-pointer text-destructive hover:text-destructive" onClick={() => onRemove([element.key])}>
          <Trash2 className="mr-2 h-4 w-4" />
          {t('inspector.removeElement')}
        </Button>
      </div>
    </div>
  )
}
