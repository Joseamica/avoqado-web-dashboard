import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { FloorShape } from '../model/types'

export interface NewAreaRequest {
  name: string
  floorShape: FloorShape
  count: number
  capacity: number
  adopt: boolean
}

const SHAPE_ICON: Record<FloorShape, { w: number; h: number }> = { WIDE: { w: 30, h: 18 }, SQUARE: { w: 22, h: 22 }, TALL: { w: 14, h: 24 } }

// Diálogo chico DENTRO del editor de pantalla completa (por eso Dialog y no otro FullScreenModal encima).
export function NewAreaDialog({
  open,
  first,
  existingNames,
  adoptCount,
  maxTables,
  onCancel,
  onCreate,
}: {
  open: boolean
  first: boolean
  existingNames: string[]
  adoptCount: number
  /** Mesas nuevas que todavía caben en el plano (el tope del servidor menos las que ya hay). */
  maxTables: number
  onCancel: () => void
  onCreate: (req: NewAreaRequest) => void
}) {
  const { t } = useTranslation('floorPlan')
  const tableCap = Math.max(0, Math.min(60, maxTables))
  const [name, setName] = useState('')
  const [floorShape, setFloorShape] = useState<FloorShape>('WIDE')
  const [count, setCount] = useState<number | undefined>(6)
  const [capacity, setCapacity] = useState<number | undefined>(4)
  const [adopt, setAdopt] = useState(adoptCount > 0)
  const [touched, setTouched] = useState(false)

  // Cada vez que se ABRE empieza limpio. Se ajusta durante el render (no en un efecto que dependa de `t`): un efecto
  // que se repitiera en cada render borraría lo que se va escribiendo.
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName(first ? t('newArea.namePlaceholder') : '')
      setFloorShape('WIDE')
      setCount(adoptCount > 0 ? 0 : Math.min(6, tableCap))
      setCapacity(4)
      setAdopt(adoptCount > 0)
      setTouched(false)
    }
  }

  const trimmed = name.trim()
  const error = !trimmed
    ? t('newArea.nameRequired')
    : existingNames.some(n => n.trim().toLocaleLowerCase('es-MX') === trimmed.toLocaleLowerCase('es-MX'))
      ? t('newArea.nameTaken')
      : null
  const submit = (blank: boolean) => {
    setTouched(true)
    if (error) return
    onCreate({
      name: trimmed,
      floorShape,
      count: blank ? 0 : Math.min(tableCap, count ?? 0),
      capacity: Math.min(20, Math.max(1, capacity ?? 4)),
      adopt: !blank && adopt,
    })
  }
  const numberInput = (value: number | undefined, set: (v: number | undefined) => void, max: number, testId: string, label: string) => (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      value={value ?? ''}
      aria-label={label}
      onChange={e => {
        const raw = e.target.value
        const n = parseInt(raw, 10)
        set(raw === '' || Number.isNaN(n) ? undefined : Math.max(0, Math.min(max, n)))
      }}
      disabled={max === 0}
      className="h-12 w-20 text-center text-base"
      data-testid={testId}
      data-tour={`floor-plan-${testId}`}
    />
  )

  return (
    <Dialog open={open} onOpenChange={o => !o && onCancel()}>
      <DialogContent className="sm:max-w-lg" hasTitle>
        <DialogHeader>
          <DialogTitle>{t(first ? 'newArea.titleFirst' : 'newArea.title')}</DialogTitle>
          <DialogDescription>{t('newArea.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <label htmlFor="new-area-name" className="text-sm font-medium">
              {t('newArea.name')}
            </label>
            <Input
              id="new-area-name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit(false)
                }
              }}
              placeholder={t('newArea.namePlaceholder')}
              maxLength={60}
              className="h-12 text-base"
              data-testid="new-area-name"
              data-tour="floor-plan-new-area-name"
              data-autofocus
              aria-invalid={touched && !!error}
            />
            {touched && error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('newArea.shape')}</p>
            <div className="grid grid-cols-3 gap-3" data-tour="floor-plan-new-area-shape">
              {(['WIDE', 'SQUARE', 'TALL'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={floorShape === s}
                  onClick={() => setFloorShape(s)}
                  data-testid={`new-area-shape-${s}`}
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-3 text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    floorShape === s ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted',
                  )}
                >
                  <svg width={34} height={26} viewBox="0 0 34 26" aria-hidden>
                    <rect
                      x={(34 - SHAPE_ICON[s].w) / 2}
                      y={(26 - SHAPE_ICON[s].h) / 2}
                      width={SHAPE_ICON[s].w}
                      height={SHAPE_ICON[s].h}
                      rx={2}
                      className={cn('fill-none', floorShape === s ? 'stroke-primary' : 'stroke-foreground')}
                      strokeWidth={1.8}
                    />
                  </svg>
                  {t(`shapes.${s}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('newArea.tables')}</p>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {numberInput(count, setCount, tableCap, 'new-area-count', t('newArea.tables'))}
              <span className="text-muted-foreground">{t('newArea.tablesOf')}</span>
              {numberInput(capacity, setCapacity, 20, 'new-area-capacity', t('newArea.people'))}
              <span className="text-muted-foreground">{t('newArea.people')}</span>
            </div>
            {tableCap < 60 && (
              <p className="text-xs text-muted-foreground" data-testid="new-area-table-cap">
                {tableCap === 0 ? t('newArea.noRoom') : t('newArea.room', { count: tableCap })}
              </p>
            )}
          </div>
          {adoptCount > 0 && (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-input p-3 text-sm">
              <Checkbox checked={adopt} onCheckedChange={v => setAdopt(v === true)} data-testid="new-area-adopt" />
              {t('newArea.adopt', { count: adoptCount })}
            </label>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" className="cursor-pointer" onClick={() => submit(true)} data-testid="new-area-blank" data-tour="floor-plan-new-area-blank">
            {t('newArea.blank')}
          </Button>
          <Button type="button" className="cursor-pointer" onClick={() => submit(false)} data-testid="new-area-create" data-tour="floor-plan-new-area-create">
            {t('newArea.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
