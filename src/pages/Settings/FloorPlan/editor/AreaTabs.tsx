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
  onSelect: (key: string) => void
  onAdd: () => void
  onRename: (key: string, name: string) => void
  onShape: (key: string, shape: FloorShape) => void
  onMove: (key: string, direction: -1 | 1) => void
  onRemove: (key: string) => void
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('es-MX') === b.trim().toLocaleLowerCase('es-MX')

export function AreaTabs({ areas, activeKey, tableCount, onSelect, onAdd, onRename, onShape, onMove, onRemove }: AreaTabsProps) {
  const { t } = useTranslation('floorPlan')
  const [editing, setEditing] = useState<{ key: string; name: string } | null>(null)
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
    const taken = areas.some(a => a.key !== editing.key && sameName(a.name, name))
    if (name && !taken && current && current.name !== name) onRename(editing.key, name)
    stopEditing()
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-tour="floor-plan-areas">
      {areas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 rounded-full border border-border bg-muted/60 px-1 py-1">
          {areas.map((a, i) => {
            const active = a.key === activeKey
            const tables = tableCount[a.key] ?? 0
            if (editing?.key === a.key) {
              return (
                <Input
                  key={a.key}
                  autoFocus
                  value={editing.name}
                  maxLength={60}
                  aria-label={t('areas.rename')}
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
                  className="h-8 w-40 rounded-full"
                  data-testid="floor-area-rename"
                />
              )
            }
            return (
              <div key={a.key} className={cn('flex items-center rounded-full', active && 'bg-foreground text-background')}>
                <button
                  type="button"
                  onClick={() => onSelect(a.key)}
                  onDoubleClick={() => startEditing(a)}
                  data-testid={`floor-area-tab-${a.name}`}
                  className={cn('cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium', !active && 'text-muted-foreground hover:text-foreground')}
                >
                  {a.name}
                </button>
                {active && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label={t('areas.options')} className="mr-1 cursor-pointer rounded-full p-1 hover:bg-background/20">
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
      <Button type="button" variant="outline" size="sm" className="cursor-pointer rounded-full border-dashed" onClick={onAdd} data-tour="floor-plan-add-area">
        <Plus className="mr-1 h-4 w-4" />
        {t('areas.add')}
      </Button>
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
