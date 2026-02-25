import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Minus, Plus, RotateCcw, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════

export type SpotIconType = 'circle' | 'bike' | 'mat' | 'reformer' | 'bed' | 'chair' | 'generic'

export interface LayoutSpot {
  id: string
  row: number
  col: number
  label: string
  enabled: boolean
}

export interface LayoutConfig {
  iconType: SpotIconType
  rows: number
  cols: number
  showInstructor?: boolean
  spots: LayoutSpot[]
}

interface ClassLayoutEditorProps {
  value: LayoutConfig | null
  onChange: (layout: LayoutConfig | null) => void
}

// ═══════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════

const ICON_TYPES: { value: SpotIconType; labelKey: string }[] = [
  { value: 'circle', labelKey: 'layout.iconCircle' },
  { value: 'bike', labelKey: 'layout.iconBike' },
  { value: 'mat', labelKey: 'layout.iconMat' },
  { value: 'reformer', labelKey: 'layout.iconReformer' },
  { value: 'bed', labelKey: 'layout.iconBed' },
  { value: 'chair', labelKey: 'layout.iconChair' },
]

const DEFAULT_ROWS = 4
const DEFAULT_COLS = 6

function generateSpots(rows: number, cols: number): LayoutSpot[] {
  const spots: LayoutSpot[] = []
  let counter = 1
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      spots.push({
        id: String(counter),
        row: r,
        col: c,
        label: String(counter),
        enabled: true,
      })
      counter++
    }
  }
  return spots
}

function renumberSpots(spots: LayoutSpot[]): LayoutSpot[] {
  let counter = 1
  return spots.map(s => {
    if (s.enabled) {
      return { ...s, id: String(counter), label: String(counter++) }
    }
    return { ...s, id: `disabled-${s.row}-${s.col}`, label: '' }
  })
}

// ═══════════════════════════════════════════════════
// Spot Icon SVGs
// ═══════════════════════════════════════════════════

function SpotIcon({ type, size = 20 }: { type: SpotIconType; size?: number }) {
  switch (type) {
    case 'bike':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="5" cy="18" r="3" /><circle cx="19" cy="18" r="3" />
          <path d="M12 18V8l-3 3m3-3 3 3" /><circle cx="12" cy="5" r="2" />
        </svg>
      )
    case 'mat':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
      )
    case 'reformer':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2" y="8" width="20" height="8" rx="1.5" />
          <line x1="7" y1="8" x2="7" y2="16" /><line x1="17" y1="8" x2="17" y2="16" />
          <circle cx="4" cy="19" r="1" /><circle cx="20" cy="19" r="1" />
        </svg>
      )
    case 'bed':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M2 4v16" /><path d="M22 4v16" />
          <path d="M2 8h20" /><path d="M2 16h20" />
          <path d="M6 8v8" />
        </svg>
      )
    case 'chair':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 19v-3" /><path d="M18 19v-3" />
          <rect x="5" y="10" width="14" height="6" rx="2" />
          <path d="M5 10V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4" />
        </svg>
      )
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
        </svg>
      )
  }
}

// ═══════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════

export function ClassLayoutEditor({ value, onChange }: ClassLayoutEditorProps) {
  const { t } = useTranslation('menu')

  const enabled = value != null
  const layout = value ?? {
    iconType: 'circle' as SpotIconType,
    rows: DEFAULT_ROWS,
    cols: DEFAULT_COLS,
    spots: generateSpots(DEFAULT_ROWS, DEFAULT_COLS),
  }

  const enabledCount = useMemo(
    () => layout.spots.filter(s => s.enabled).length,
    [layout.spots],
  )

  const handleToggle = useCallback((checked: boolean) => {
    if (checked) {
      onChange({
        iconType: 'circle',
        rows: DEFAULT_ROWS,
        cols: DEFAULT_COLS,
        showInstructor: true,
        spots: generateSpots(DEFAULT_ROWS, DEFAULT_COLS),
      })
    } else {
      onChange(null)
    }
  }, [onChange])

  const handleIconTypeChange = useCallback((iconType: SpotIconType) => {
    onChange({ ...layout, iconType })
  }, [layout, onChange])

  const handleResize = useCallback((newRows: number, newCols: number) => {
    const clamped = {
      rows: Math.max(1, Math.min(20, newRows)),
      cols: Math.max(1, Math.min(20, newCols)),
    }
    const spots = generateSpots(clamped.rows, clamped.cols)
    for (const spot of spots) {
      const prev = layout.spots.find(s => s.row === spot.row && s.col === spot.col)
      if (prev) spot.enabled = prev.enabled
    }
    const numbered = renumberSpots(spots)
    onChange({
      ...layout,
      rows: clamped.rows,
      cols: clamped.cols,
      spots: numbered,
    })
  }, [layout, onChange])

  const handleSpotToggle = useCallback((row: number, col: number) => {
    const updatedSpots = layout.spots.map(s =>
      s.row === row && s.col === col ? { ...s, enabled: !s.enabled } : s,
    )
    onChange({ ...layout, spots: renumberSpots(updatedSpots) })
  }, [layout, onChange])

  const handleReset = useCallback(() => {
    onChange({
      ...layout,
      spots: generateSpots(layout.rows, layout.cols),
    })
  }, [layout, onChange])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">
            {t('layout.title', { defaultValue: 'Mapa de lugares' })}
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('layout.description', { defaultValue: 'Configura el acomodo visual de los lugares de tu clase' })}
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} />
      </div>

      {enabled && (
        <div className="rounded-xl border border-input overflow-hidden">
          {/* Toolbar */}
          <div className="bg-muted/40 border-b border-input p-4 space-y-4">
            {/* Row 1: Icon type picker */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                {t('layout.iconType', { defaultValue: 'Tipo de icono' })}
              </Label>
              <TooltipProvider delayDuration={200}>
                <div className="flex gap-1.5">
                  {ICON_TYPES.map(it => (
                    <Tooltip key={it.value}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleIconTypeChange(it.value)}
                          className={cn(
                            'h-9 w-9 rounded-lg border-2 flex items-center justify-center transition-all',
                            layout.iconType === it.value
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-transparent bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          <SpotIcon type={it.value} size={18} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {t(it.labelKey, { defaultValue: it.value })}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </div>

            {/* Row 2: Dimensions + Instructor toggle + Reset */}
            <div className="flex items-end gap-6 flex-wrap">
              {/* Grid dimensions */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {t('layout.gridSize', { defaultValue: 'Tamaño del grid' })}
                </Label>
                <div className="flex items-center gap-1.5 bg-background rounded-lg border border-input p-1">
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="h-7 w-7 rounded-md"
                    onClick={() => handleResize(layout.rows - 1, layout.cols)}
                    disabled={layout.rows <= 1}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-5 text-center text-sm font-semibold tabular-nums">{layout.rows}</span>
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="h-7 w-7 rounded-md"
                    onClick={() => handleResize(layout.rows + 1, layout.cols)}
                    disabled={layout.rows >= 20}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>

                  <span className="text-muted-foreground text-xs font-medium px-0.5">×</span>

                  <Button
                    type="button" variant="ghost" size="icon"
                    className="h-7 w-7 rounded-md"
                    onClick={() => handleResize(layout.rows, layout.cols - 1)}
                    disabled={layout.cols <= 1}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-5 text-center text-sm font-semibold tabular-nums">{layout.cols}</span>
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="h-7 w-7 rounded-md"
                    onClick={() => handleResize(layout.rows, layout.cols + 1)}
                    disabled={layout.cols >= 20}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Instructor toggle */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {t('layout.instructor', { defaultValue: 'Instructor' })}
                </Label>
                <div className="flex items-center gap-2 h-9">
                  <Switch
                    checked={layout.showInstructor ?? false}
                    onCheckedChange={(checked) => onChange({ ...layout, showInstructor: checked })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {t('layout.showInstructor', { defaultValue: 'Mostrar al frente' })}
                  </span>
                </div>
              </div>

              <div className="flex-1" />

              {/* Reset */}
              <Button
                type="button" variant="ghost" size="sm"
                className="h-8 gap-1.5 text-xs text-muted-foreground"
                onClick={handleReset}
              >
                <RotateCcw className="h-3 w-3" />
                {t('layout.reset', { defaultValue: 'Reiniciar' })}
              </Button>
            </div>
          </div>

          {/* Grid area */}
          <div className="flex flex-col items-center gap-4 p-6 bg-background">
            {/* Instructor — separate element at the front */}
            {layout.showInstructor && (
              <div className="flex flex-col items-center gap-1.5 mb-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center shadow-sm shadow-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <span className="text-[11px] font-medium text-primary">
                  {t('layout.instructorLabel', { defaultValue: 'Instructor' })}
                </span>
              </div>
            )}

            {/* Student spots grid */}
            <div
              className="inline-grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: layout.rows }).map((_, row) =>
                Array.from({ length: layout.cols }).map((_, col) => {
                  const spot = layout.spots.find(s => s.row === row && s.col === col)
                  const isEnabled = spot?.enabled ?? true

                  return (
                    <button
                      key={`${row}-${col}`}
                      type="button"
                      className={cn(
                        'w-12 h-12 rounded-xl border-2 flex flex-col items-center justify-center transition-all text-xs font-medium',
                        isEnabled
                          ? 'border-input bg-background hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm cursor-pointer'
                          : 'border-transparent bg-muted/40 text-muted-foreground/30 cursor-pointer hover:bg-muted/60',
                      )}
                      onClick={() => handleSpotToggle(row, col)}
                    >
                      {isEnabled ? (
                        <>
                          <SpotIcon type={layout.iconType} size={16} />
                          <span className="text-[10px] leading-none mt-0.5 tabular-nums">{spot?.label}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground/20 text-[10px]">—</span>
                      )}
                    </button>
                  )
                }),
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-muted/30 border-t border-input px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded border-2 border-input bg-background" />
                <span className="text-[11px] text-muted-foreground">
                  {t('layout.legendActive', { defaultValue: 'Activo' })}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-muted/60" />
                <span className="text-[11px] text-muted-foreground">
                  {t('layout.legendDisabled', { defaultValue: 'Desactivado' })}
                </span>
              </div>
            </div>
            <span className="text-xs font-medium tabular-nums">
              {t('layout.spotsCount', {
                defaultValue: '{{count}} lugares activos',
                count: enabledCount,
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
