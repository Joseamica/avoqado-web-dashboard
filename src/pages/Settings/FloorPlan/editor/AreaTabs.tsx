import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { DraftArea, FloorShape } from '../model/types'

export interface AreaTabsProps {
  areas: DraftArea[]
  activeKey: string | null
  tableCount: Record<string, number>
  /** Tope de áreas del plano: al llegar, «Nueva área» se apaga y lo dice. */
  maxAreas: number
  onSelect: (key: string) => void
  onAdd: () => void
  onRename: (key: string, name: string) => void
  onShape: (key: string, shape: FloorShape) => void
  onMove: (key: string, direction: -1 | 1) => void
  onRemove: (key: string) => void
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('es-MX') === b.trim().toLocaleLowerCase('es-MX')

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

export function AreaTabs({ areas, activeKey, tableCount, maxAreas, onSelect, onAdd, onRename, onShape, onMove, onRemove }: AreaTabsProps) {
  const { t } = useTranslation('floorPlan')
  // `error`: por qué no se puede guardar ese nombre (vacío o repetido). El campo se queda abierto hasta corregirlo o Esc.
  const [editing, setEditing] = useState<{ key: string; name: string; error?: string } | null>(null)
  // Enter cierra el campo y luego llega su `blur`: sin esto el nombre se guardaría dos veces (dos pasos de deshacer).
  const editingKey = useRef<string | null>(null)
  // El área que se va a borrar se conserva mientras el aviso se cierra, para que su nombre no parpadee vacío.
  const [removing, setRemoving] = useState<DraftArea | null>(null)
  const [removeOpen, setRemoveOpen] = useState(false)

  const startEditing = (a: DraftArea) => {
    editingKey.current = a.key
    setEditing({ key: a.key, name: a.name })
  }
  const stopEditing = () => {
    editingKey.current = null
    setEditing(null)
  }
  const commitRename = () => {
    if (!editing || editingKey.current !== editing.key) return
    const name = editing.name.trim()
    const current = areas.find(a => a.key === editing.key)
    // Antes se descartaba en silencio: ahora se dice por qué y el campo sigue abierto.
    const error = !name ? t('newArea.nameRequired') : areas.some(a => a.key !== editing.key && sameName(a.name, name)) ? t('newArea.nameTaken') : undefined
    if (error) {
      setEditing({ ...editing, error })
      return
    }
    if (current && current.name !== name) onRename(editing.key, name)
    stopEditing()
  }
  const atLimit = areas.length >= maxAreas

  return (
    <div className="flex flex-wrap items-center gap-2" data-tour="floor-plan-areas">
      {areas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 rounded-full border border-border bg-muted/60 px-1 py-1">
          {areas.map((a, i) => {
            const active = a.key === activeKey
            const tables = tableCount[a.key] ?? 0
            if (editing?.key === a.key) {
              const errorId = `floor-area-rename-error-${i}`
              return (
                <div key={a.key} className="relative">
                  <Input
                    autoFocus
                    value={editing.name}
                    maxLength={60}
                    aria-label={t('areas.rename')}
                    aria-invalid={!!editing.error}
                    aria-describedby={editing.error ? errorId : undefined}
                    onChange={e => setEditing({ key: a.key, name: e.target.value })}
                    onBlur={commitRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') {
                        // El editor no se cierra con este Esc (ver FloorPlanEditor): sólo se cancela el cambio de nombre.
                        e.stopPropagation()
                        stopEditing()
                      }
                    }}
                    className="h-8 w-44 rounded-full"
                    data-testid="floor-area-rename"
                  />
                  {editing.error && (
                    <p
                      id={errorId}
                      role="alert"
                      className="absolute left-2 top-full z-10 mt-1.5 whitespace-nowrap rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground shadow-md"
                      data-testid="floor-area-rename-error"
                    >
                      {editing.error}
                    </p>
                  )}
                </div>
              )
            }
            return (
              <div key={a.key} className={cn('flex items-center rounded-full', active && 'bg-foreground text-background')}>
                <button
                  type="button"
                  onClick={() => onSelect(a.key)}
                  onDoubleClick={() => startEditing(a)}
                  aria-pressed={active}
                  title={t('areas.renameHint')}
                  data-testid={`floor-area-tab-${a.name}`}
                  className={cn('cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium', FOCUS_RING, !active && 'text-muted-foreground hover:text-foreground')}
                >
                  {a.name}
                  <span className="sr-only">{t('areas.tableCount', { count: tables })}</span>
                </button>
                {active && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={t('areas.options', { name: a.name })}
                        className={cn('mr-0.5 grid h-7 w-7 cursor-pointer place-items-center rounded-full hover:bg-background/20', FOCUS_RING)}
                        data-tour="floor-plan-area-options"
                      >
                        <Ellipsis className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuItem onSelect={() => startEditing(a)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {t('areas.rename')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>{t('areas.shape')}</DropdownMenuLabel>
                      <DropdownMenuRadioGroup value={a.floorShape} onValueChange={v => onShape(a.key, v as FloorShape)}>
                        {(['WIDE', 'SQUARE', 'TALL'] as const).map(s => (
                          <DropdownMenuRadioItem key={s} value={s}>
                            {t(`shapes.${s}`)}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled={i === 0} onSelect={() => onMove(a.key, -1)}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        {t('areas.moveLeft')}
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={i === areas.length - 1} onSelect={() => onMove(a.key, 1)}>
                        <ChevronRight className="mr-2 h-4 w-4" />
                        {t('areas.moveRight')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={tables > 0}
                        onSelect={() => {
                          setRemoving(a)
                          setRemoveOpen(true)
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('areas.delete')}
                      </DropdownMenuItem>
                      {tables > 0 && <p className="px-2 pb-2 text-xs text-muted-foreground">{t('areas.deleteBlocked')}</p>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )
          })}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 cursor-pointer rounded-full border-dashed"
        onClick={onAdd}
        disabled={atLimit}
        data-tour="floor-plan-add-area"
      >
        <Plus className="mr-1 h-4 w-4" />
        {t('areas.add')}
      </Button>
      {atLimit && (
        <span className="text-xs text-muted-foreground" data-testid="floor-areas-full">
          {t('limits.areas', { max: maxAreas })}
        </span>
      )}
      {areas.find(a => a.key === activeKey)?.external && <Badge variant="outline">{t('page.fromPos')}</Badge>}

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('areas.deleteTitle', { name: removing?.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t('areas.deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('editor.keepEditing')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing) onRemove(removing.key)
                setRemoveOpen(false)
              }}
            >
              {t('areas.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
