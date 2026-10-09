import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Circle, Copy, Minus, MousePointerClick, Plus, RectangleHorizontal, RotateCw, Square, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ShortcutList } from './ShortcutList'
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

/**
 * Un campo con su nombre. Con `htmlFor` el nombre es la `<label>` del campo de texto; si no, nombra al grupo (botones de
 * más/menos, de forma…), para que el lector de pantalla diga «Personas, 6» y no sólo «6».
 */
function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  const id = useId()
  if (htmlFor) {
    return (
      <div className="space-y-1.5">
        <label htmlFor={htmlFor} className="block text-xs font-medium text-muted-foreground">
          {label}
        </label>
        {children}
      </div>
    )
  }
  return (
    <div className="space-y-1.5" role="group" aria-labelledby={id}>
      <p id={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}

/** Mismo botón de quitar en todos los casos: rojo, sin relleno, al final del panel. */
const REMOVE_CLASS = 'w-full cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive'
/** Botón de forma (cuadrada, redonda, larga): se ve elegido y con anillo de foco por teclado. */
const SHAPE_CLASS =
  'flex h-11 cursor-pointer items-center justify-center rounded-xl border border-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

/**
 * Un campo del inspector guarda al salir de él (Enter, Tab o clic fuera). Pero un clic en el lienzo cambia la selección
 * en `pointerdown`, y el inspector se desmonta ANTES de que llegue el `blur`: lo escrito se perdía. Esto guarda también
 * al desmontarse, con la última versión de `commit` (que aplica las mismas reglas y no repite lo ya guardado).
 */
function useCommitOnUnmount(commit: () => void) {
  const latest = useRef(commit)
  useEffect(() => {
    latest.current = commit
  })
  useEffect(() => () => latest.current(), [])
}

function Stepper({
  value,
  min,
  max,
  onChange,
  less,
  more,
  testId,
  tour,
  unknown,
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  less: string
  more: string
  testId: string
  tour: string
  /** Cómo se dice un 0 que no es un valor sino «sin dato» (R31); sin esto, el 0 se enseña tal cual. */
  unknown?: string
}) {
  return (
    <div className="flex items-center gap-2" data-testid={testId} data-tour={tour}>
      <Button type="button" variant="outline" size="icon" className="h-11 w-11 cursor-pointer" aria-label={less} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus className="h-4 w-4" />
      </Button>
      <span className="w-12 text-center text-lg font-semibold tabular-nums" aria-live="polite">
        {value === 0 && unknown ? (
          <>
            <span aria-hidden>—</span>
            <span className="sr-only">{unknown}</span>
          </>
        ) : (
          value
        )}
      </span>
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
        <div className="space-y-6">
          <div className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted" aria-hidden>
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground">{t('inspector.nothing')}</p>
          </div>
          <div className="border-t border-input pt-5">
            <ShortcutList />
          </div>
        </div>
      )}
      {count === 1 && props.tables[0] && <TableFields key={props.tables[0].key} table={props.tables[0]} {...props} />}
      {count === 1 && props.elements[0] && <ElementFields key={props.elements[0].key} element={props.elements[0]} {...props} />}
      {count > 1 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">{t('inspector.many', { count })}</h3>
          <p className="text-sm text-muted-foreground">{t('inspector.manyHint')}</p>
          <Button
            variant="outline"
            className="h-11 w-full cursor-pointer"
            onClick={() => props.dispatch({ type: 'ROTATE', keys: allKeys() })}
            data-tour="floor-plan-inspector-rotate-all"
          >
            <RotateCw className="mr-2 h-4 w-4" />
            {t('inspector.rotateAll')}
          </Button>
          <Button variant="outline" className="h-11 w-full cursor-pointer" onClick={() => props.onDuplicate(allKeys())} data-tour="floor-plan-inspector-duplicate">
            <Copy className="mr-2 h-4 w-4" />
            {t('inspector.duplicate')}
          </Button>
          <Button variant="ghost" className={REMOVE_CLASS} onClick={() => props.onRemove(allKeys())} data-tour="floor-plan-inspector-remove">
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
  const numberId = useId()
  const [number, setNumber] = useState(table.number)
  const [error, setError] = useState<string | null>(null)
  // El último número guardado: lo que ya se guardó al salir del campo no se vuelve a guardar al desmontarse.
  const saved = useRef(table.number)
  useEffect(() => {
    saved.current = table.number
    setNumber(table.number)
  }, [table.number])

  /** Guarda si es válido; devuelve el motivo si no (vacío o repetido ⇒ no se guarda). */
  const tryCommit = (value: string): string | null => {
    const n = value.trim()
    if (!n) return t('inspector.numberRequired')
    // Contra lo guardado SIN espacios: un número viejo « 5» no es «otro número» ni choca consigo mismo.
    if (n === saved.current.trim()) return null
    if (allNumbers.some(x => x.trim() === n)) return t('inspector.numberTaken', { number: n })
    saved.current = n
    dispatch({ type: 'UPDATE_TABLE', key: table.key, patch: { number: n } })
    return null
  }
  const commitNumber = () => {
    setError(tryCommit(number))
    if (!number.trim()) setNumber(saved.current)
  }
  useCommitOnUnmount(() => {
    tryCommit(number)
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{t('inspector.table', { number: table.number })}</h3>
        {table.hasOpenOrder && (
          // El mismo punto ámbar que la mesa en el plano: se reconoce de un vistazo.
          <Badge variant="outline" className="gap-1.5" data-testid="floor-inspector-open-order">
            <span className="h-2 w-2 rounded-full bg-warning" aria-hidden />
            {t('inspector.openOrder')}
          </Badge>
        )}
      </div>
      <Field label={t('inspector.number')} htmlFor={numberId}>
        <Input
          id={numberId}
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
          aria-describedby={error ? `${numberId}-error` : undefined}
          className="h-11 text-base"
          data-testid="floor-inspector-number"
          data-tour="floor-plan-inspector-number"
        />
        {error && (
          <p id={`${numberId}-error`} className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </Field>
      <Field label={t('inspector.capacity')}>
        {/* 0 = «sin dato» (mesas de SoftRestaurant, R31): se ve «—» y desde aquí sólo se puede subir; nunca se baja a 0. */}
        <Stepper
          value={table.capacity}
          min={1}
          max={99}
          unknown={t('inspector.capacityUnknown')}
          less={t('inspector.fewer')}
          more={t('inspector.more')}
          testId="floor-inspector-capacity"
          tour="floor-plan-inspector-capacity"
          onChange={capacity => dispatch({ type: 'UPDATE_TABLE', key: table.key, patch: { capacity } })}
        />
      </Field>
      <Field label={t('inspector.shape')}>
        <div className="grid grid-cols-3 gap-2" data-tour="floor-plan-inspector-shape">
          {SHAPES.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={table.shape === id}
              aria-label={t(toolLabelKey(`table:${id}` as ToolId))}
              onClick={() => dispatch({ type: 'UPDATE_TABLE', key: table.key, patch: { shape: id } })}
              className={cn(SHAPE_CLASS, table.shape === id ? 'border-foreground bg-foreground text-background' : 'hover:bg-muted')}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </Field>
      <Field label={t('inspector.rotate')}>
        <Button
          variant="outline"
          className="h-11 w-full cursor-pointer"
          aria-label={t('inspector.rotateBy', { degrees: table.rotation })}
          onClick={() => dispatch({ type: 'ROTATE', keys: [table.key] })}
          data-tour="floor-plan-inspector-rotate"
        >
          <RotateCw className="mr-2 h-4 w-4" />
          <span className="tabular-nums">{table.rotation}°</span>
        </Button>
      </Field>
      <Field label={t('inspector.area')}>
        <Select
          value={table.areaKey ?? UNPLACED}
          onValueChange={v => dispatch({ type: 'UPDATE_TABLE', key: table.key, patch: { areaKey: v === UNPLACED ? null : v } })}
        >
          <SelectTrigger className="h-11" aria-label={t('inspector.area')} data-tour="floor-plan-inspector-area">
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
        <Button variant="outline" className="h-11 w-full cursor-pointer" onClick={() => onDuplicate([table.key])} data-tour="floor-plan-inspector-duplicate">
          <Copy className="mr-2 h-4 w-4" />
          {t('inspector.duplicate')}
        </Button>
        <Button
          variant="ghost"
          className={REMOVE_CLASS}
          disabled={table.hasOpenOrder}
          aria-describedby={table.hasOpenOrder ? `${numberId}-blocked` : undefined}
          onClick={() => onRemove([table.key])}
          data-testid="floor-inspector-remove"
          data-tour="floor-plan-inspector-remove"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t('inspector.remove')}
        </Button>
        {table.hasOpenOrder && (
          <p id={`${numberId}-blocked`} className="text-xs leading-relaxed text-muted-foreground">
            {t('inspector.removeBlocked')}
          </p>
        )}
      </div>
    </div>
  )
}

function ElementFields({ element, areas, dispatch, onRemove, onDuplicate }: InspectorProps & { element: DraftElement }) {
  const { t } = useTranslation('floorPlan')
  const labelId = useId()
  const [label, setLabel] = useState(element.label ?? '')
  const saved = useRef(element.label ?? '')
  useEffect(() => {
    saved.current = element.label ?? ''
    setLabel(element.label ?? '')
  }, [element.label])
  const named = element.type === 'LABEL' || element.type === 'SERVICE_AREA' || element.type === 'BAR_COUNTER'
  const sized = element.type === 'BAR_COUNTER' || element.type === 'SERVICE_AREA' || element.type === 'DOOR'
  // El ancho y el alto no pasan del lienzo de su área (el borrador los recorta igual; así el «+» se apaga en la orilla).
  const grid = gridOf(areas.find(a => a.key === element.areaKey)?.floorShape ?? 'WIDE')
  /** Guarda si es válido; un letrero vacío no se guarda (devuelve false). */
  const tryCommit = (value: string): boolean => {
    const v = value.trim()
    if (element.type === 'LABEL' && !v) return false
    // Contra lo guardado SIN espacios: deseleccionar un letrero viejo « Terraza » no es un cambio ni un paso de deshacer.
    if (v === saved.current.trim()) return true
    saved.current = v
    dispatch({ type: 'UPDATE_ELEMENT', key: element.key, patch: { label: v || null } })
    return true
  }
  const commitLabel = () => {
    if (!tryCommit(label)) setLabel(saved.current)
  }
  useCommitOnUnmount(() => {
    if (named) tryCommit(label)
  })
  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold">{t(toolLabelKey(element.type))}</h3>
      {named && (
        <Field label={t('inspector.label')} htmlFor={labelId}>
          <Input
            id={labelId}
            value={label}
            maxLength={40}
            onChange={e => setLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            className="h-11 text-base"
            data-testid="floor-inspector-label"
            data-tour="floor-plan-inspector-label"
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
              tour="floor-plan-inspector-width"
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
              tour="floor-plan-inspector-height"
              onChange={h => dispatch({ type: 'UPDATE_ELEMENT', key: element.key, patch: { h } })}
            />
          </Field>
          {/* Barras, zonas y puertas giran intercambiando ancho y alto: no guardan grados que enseñar (R13). */}
          <Button
            variant="outline"
            className="h-11 w-full cursor-pointer"
            onClick={() => dispatch({ type: 'ROTATE', keys: [element.key] })}
            data-testid="floor-inspector-rotate"
            data-tour="floor-plan-inspector-rotate"
          >
            <RotateCw className="mr-2 h-4 w-4" />
            {t('inspector.rotate')}
          </Button>
        </>
      )}
      <div className="space-y-2 border-t border-input pt-4">
        <Button variant="outline" className="h-11 w-full cursor-pointer" onClick={() => onDuplicate([element.key])} data-tour="floor-plan-inspector-duplicate">
          <Copy className="mr-2 h-4 w-4" />
          {t('inspector.duplicate')}
        </Button>
        <Button variant="ghost" className={REMOVE_CLASS} onClick={() => onRemove([element.key])} data-tour="floor-plan-inspector-remove">
          <Trash2 className="mr-2 h-4 w-4" />
          {t('inspector.removeElement')}
        </Button>
      </div>
    </div>
  )
}
