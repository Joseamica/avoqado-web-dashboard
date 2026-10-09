import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { Eye, Pencil, Plus, Redo2, Undo2 } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { getFloorPlan, publishFloorPlan } from '@/services/floorPlan.service'
import { AreaTabs } from './editor/AreaTabs'
import { FloorCanvas } from './editor/FloorCanvas'
import { Inspector } from './editor/Inspector'
import { NewAreaDialog, type NewAreaRequest } from './editor/NewAreaDialog'
import { ToolPalette } from './editor/ToolPalette'
import { UnplacedTray } from './editor/UnplacedTray'
import { WaiterPreview } from './editor/WaiterPreview'
import { editorReducer, initEditorState, type EditorAction } from './model/editorReducer'
import { clamp, gridOf, nextTableNumber, nextTableNumbers, placeTable, quickStartLayout } from './model/floorGeometry'
import { docToPayload, dtoToDoc } from './model/planMapping'
import type { DraftTable, EditorDoc, FloorPlanDto, TableShape, ToolId } from './model/types'

const newKey = () => `tmp-${crypto.randomUUID()}`
const ELEMENT_SIZE = { BAR_COUNTER: { w: 8, h: 2 }, SERVICE_AREA: { w: 8, h: 6 }, DOOR: { w: 3, h: 1 } } as const

/** Campos donde las teclas son del texto: ni los atajos ni Esc del editor actúan ahí. */
const TYPING = 'input, textarea, select, [contenteditable="true"]'
/** Además, controles que ya usan flechas, Supr o letras (menús, listas, selects) y los avisos de confirmación. */
const OWN_KEYS = `${TYPING}, [role="menu"], [role="listbox"], [role="combobox"], [aria-haspopup="menu"], [role="alertdialog"]`
const within = (target: EventTarget | null, selector: string) => !!(target as HTMLElement | null)?.closest?.(selector)

export interface FloorPlanEditorProps {
  plan: FloorPlanDto
  venueId: string
  venueName?: string
  onClose: () => void
}

export function FloorPlanEditor({ plan, venueId, venueName, onClose }: FloorPlanEditorProps) {
  const { t } = useTranslation('floorPlan')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(editorReducer, plan, p => initEditorState(dtoToDoc(p)))
  const [base, setBase] = useState(plan.fingerprint)
  const [tool, setTool] = useState<ToolId>('select')
  const [preview, setPreview] = useState(false)
  const [newAreaOpen, setNewAreaOpen] = useState(() => plan.areas.length === 0)
  const [confirmClose, setConfirmClose] = useState(false)
  const [conflict, setConflict] = useState(false)
  // El mismo folio mientras el borrador no cambie: un reintento tras un error de red no se confunde con «alguien más cambió».
  const attempt = useRef<{ doc: EditorDoc; saveId: string } | null>(null)
  // Mientras el servidor contesta, el plano no se toca: al llegar la respuesta se carga el plano guardado, y lo que se
  // hubiera cambiado entretanto se perdería sin aviso.
  const saving = useRef(false)
  const edit = useCallback((action: EditorAction) => {
    if (!saving.current) dispatch(action)
  }, [])

  const { doc, selection, activeAreaKey, dirty } = state
  const activeArea = doc.areas.find(a => a.key === activeAreaKey) ?? null
  const inPreview = preview && activeArea !== null
  const areaTables = useMemo(() => doc.tables.filter(x => x.areaKey === activeAreaKey && x.x !== null), [doc.tables, activeAreaKey])
  const areaElements = useMemo(() => doc.elements.filter(e => e.areaKey === activeAreaKey), [doc.elements, activeAreaKey])
  const trayTables = useMemo(() => doc.tables.filter(x => x.areaKey === null || (x.areaKey === activeAreaKey && x.x === null)), [doc.tables, activeAreaKey])
  const tableCount = useMemo(() => Object.fromEntries(doc.areas.map(a => [a.key, doc.tables.filter(x => x.areaKey === a.key).length])), [doc])
  const allNumbers = useMemo(() => doc.tables.map(x => x.number), [doc.tables])
  const selectedTables = useMemo(() => doc.tables.filter(x => selection.includes(x.key)), [doc.tables, selection])
  const selectedElements = useMemo(() => doc.elements.filter(e => selection.includes(e.key)), [doc.elements, selection])

  const placeTool = useCallback(
    (toolId: ToolId, x: number, y: number) => {
      if (!activeArea || toolId === 'select' || toolId === 'WALL') return
      const { cols, rows } = gridOf(activeArea.floorShape)
      if (toolId.startsWith('table:')) {
        const shape = toolId.slice(6) as TableShape
        const capacity = shape === 'RECTANGLE' ? 6 : 4
        edit({
          type: 'ADD_TABLE',
          table: {
            key: newKey(),
            number: nextTableNumber(allNumbers),
            capacity,
            shape,
            rotation: 0,
            areaKey: activeArea.key,
            ...placeTable(x, y, shape, capacity, 0, cols, rows),
            legacy: null,
            hasOpenOrder: false,
          },
        })
        return
      }
      if (toolId === 'LABEL') {
        edit({
          type: 'ADD_ELEMENT',
          element: {
            key: newKey(),
            type: 'LABEL',
            areaKey: activeArea.key,
            x: clamp(x, 0, cols - 1),
            y: clamp(y, 0, rows - 1),
            w: null,
            h: null,
            rotation: 0,
            x2: null,
            y2: null,
            label: t('elementDefaults.LABEL'),
            color: null,
          },
        })
        return
      }
      const type = toolId as keyof typeof ELEMENT_SIZE
      const { w, h } = ELEMENT_SIZE[type]
      edit({
        type: 'ADD_ELEMENT',
        element: {
          key: newKey(),
          type,
          areaKey: activeArea.key,
          x: clamp(Math.round(x - w / 2), 0, cols - w),
          y: clamp(Math.round(y - h / 2), 0, rows - h),
          w,
          h,
          rotation: 0,
          x2: null,
          y2: null,
          label: type === 'DOOR' ? null : t(`elementDefaults.${type}`),
          color: null,
        },
      })
    },
    [activeArea, allNumbers, edit, t],
  )

  const duplicate = useCallback(
    (keys: string[]) => {
      const numbers = [...allNumbers]
      const clones = keys.map(sourceKey => {
        const isTable = doc.tables.some(x => x.key === sourceKey)
        const number = isTable ? nextTableNumber(numbers) : undefined
        if (number) numbers.push(number)
        return { sourceKey, key: newKey(), number }
      })
      edit({ type: 'DUPLICATE', clones })
    },
    [allNumbers, doc.tables, edit],
  )

  const remove = useCallback(
    (keys: string[]) => {
      if (saving.current) return
      if (doc.tables.some(x => keys.includes(x.key) && x.hasOpenOrder)) toast({ title: t('inspector.removeBlocked') })
      edit({ type: 'REMOVE', keys })
    },
    [doc.tables, edit, t, toast],
  )

  const createArea = (req: NewAreaRequest) => {
    const key = newKey()
    const g = gridOf(req.floorShape)
    const tableShape: TableShape = req.capacity <= 4 ? 'SQUARE' : 'RECTANGLE'
    const adopted = req.adopt ? doc.tables.filter(x => x.areaKey === null) : []
    const slots = quickStartLayout(req.count + adopted.filter(a => !a.legacy).length, req.capacity, tableShape, req.floorShape)
    let slot = 0
    const created: DraftTable[] = nextTableNumbers(allNumbers, req.count).map(number => {
      const p = slots[slot++]
      return { key: newKey(), number, capacity: req.capacity, shape: tableShape, rotation: 0, areaKey: key, x: p?.x ?? null, y: p?.y ?? null, legacy: null, hasOpenOrder: false }
    })
    const moved: DraftTable[] = adopted.map(a => {
      if (a.legacy) return { ...a, areaKey: key, legacy: null, ...placeTable(a.legacy.nx * g.cols, a.legacy.ny * g.rows, a.shape, a.capacity, a.rotation, g.cols, g.rows) }
      const p = slots[slot++]
      return { ...a, areaKey: key, ...(p ? placeTable(p.x, p.y, a.shape, a.capacity, a.rotation, g.cols, g.rows) : { x: null, y: null }) }
    })
    edit({ type: 'ADD_AREA', area: { key, name: req.name, floorShape: req.floorShape, sortOrder: doc.areas.length, external: false }, tables: [...created, ...moved] })
    setNewAreaOpen(false)
  }

  const save = useMutation({
    // async: si armar el cuerpo truena (no debería: Guardar se apaga sin áreas), es un error del guardado, no un crash.
    mutationFn: async () => {
      if (attempt.current?.doc !== doc) attempt.current = { doc, saveId: crypto.randomUUID() }
      return publishFloorPlan(venueId, docToPayload(doc, attempt.current.saveId, base))
    },
    onMutate: () => {
      saving.current = true
    },
    onSettled: () => {
      saving.current = false
    },
    onSuccess: result => {
      attempt.current = null
      setBase(result.fingerprint)
      dispatch({ type: 'LOAD', doc: dtoToDoc(result), activeIndex: Math.max(0, doc.areas.findIndex(a => a.key === activeAreaKey)) })
      queryClient.setQueryData(['floor-plan', venueId], result)
      toast({ title: t('editor.saved') })
    },
    onError: error => {
      // Sin respuesta del servidor = no llegó (red). Cualquier otra cosa que no venga del servidor es un error genérico.
      if (!isAxiosError(error)) return toast({ title: t('editor.genericError'), variant: 'destructive' })
      if (!error.response) return toast({ title: t('editor.offline'), variant: 'destructive' })
      const data = (error.response.data ?? {}) as { code?: string; message?: string; details?: { numbers?: string[] } }
      if (error.response.status === 409 && data.code === 'FLOOR_PLAN_CHANGED') return setConflict(true)
      if (error.response.status === 422 && data.code === 'TABLES_WITH_OPEN_ORDERS') {
        return toast({ title: t('editor.openOrders', { numbers: (data.details?.numbers ?? []).join(', ') }), variant: 'destructive' })
      }
      toast({ title: t('editor.genericError'), description: data.message, variant: 'destructive' })
    },
  })

  const reload = async () => {
    try {
      const fresh = await queryClient.fetchQuery({ queryKey: ['floor-plan', venueId], queryFn: () => getFloorPlan(venueId), staleTime: 0 })
      attempt.current = null
      setBase(fresh.fingerprint)
      dispatch({ type: 'LOAD', doc: dtoToDoc(fresh) })
      setTool('select')
    } catch {
      // El aviso de conflicto ya se cerró: el borrador sigue aquí y el siguiente «Guardar» lo vuelve a ofrecer.
      toast({ title: t('page.loadError'), variant: 'destructive' })
    } finally {
      setConflict(false)
    }
  }

  // Atajos de teclado (no actúan mientras se escribe en un campo, ni sobre menús, listas o avisos).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (within(e.target, OWN_KEYS)) return
      if (newAreaOpen || confirmClose || conflict || inPreview || saving.current) return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z') {
        e.preventDefault()
        edit({ type: e.shiftKey ? 'REDO' : 'UNDO' })
      } else if (mod && key === 'y') {
        e.preventDefault()
        edit({ type: 'REDO' })
      } else if (mod && key === 'd') {
        e.preventDefault()
        if (selection.length) duplicate(selection)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length) {
        e.preventDefault()
        remove(selection)
      } else if (key === 'r' && !mod && !e.altKey && selection.length) {
        edit({ type: 'ROTATE', keys: selection })
      } else if (e.key.startsWith('Arrow') && selection.length) {
        e.preventDefault()
        const step = e.shiftKey ? 5 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        edit({ type: 'MOVE', keys: selection, dx, dy })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection, duplicate, remove, edit, newAreaOpen, confirmClose, conflict, inPreview])

  // Cerrar la pestaña con cambios sin guardar también pregunta.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const requestClose = () => (dirty ? setConfirmClose(true) : onClose())
  const onEscapeKeyDown = (e: KeyboardEvent) => {
    // Esc dentro de un campo es del campo (p. ej. cancela el nombre nuevo de un área): nunca cierra el editor.
    if (within(e.target, TYPING)) {
      e.preventDefault()
      return
    }
    // Esc primero suelta lo que esté activo; sólo con nada activo cierra (y con cambios, pregunta).
    if (tool !== 'select' || selection.length || preview) {
      e.preventDefault()
      setTool('select')
      dispatch({ type: 'SELECT', keys: [] })
      setPreview(false)
    }
  }

  return (
    <FullScreenModal
      open
      onClose={requestClose}
      onEscapeKeyDown={onEscapeKeyDown}
      // Igual que el valor por defecto (no mover el foco al abrir), pero pasarlo le quita al contenedor el contorno de
      // foco: al hacer clic en el lienzo (que no recibe foco) el foco cae en el modal y lo enmarcaba en azul.
      onOpenAutoFocus={e => e.preventDefault()}
      title={t('editor.title')}
      subtitle={venueName}
      contentClassName="bg-muted/30"
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="cursor-pointer"
            aria-label={t('editor.undo')}
            disabled={!state.past.length || save.isPending}
            onClick={() => edit({ type: 'UNDO' })}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="cursor-pointer"
            aria-label={t('editor.redo')}
            disabled={!state.future.length || save.isPending}
            onClick={() => edit({ type: 'REDO' })}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={inPreview ? 'secondary' : 'outline'}
            className="cursor-pointer"
            disabled={!activeArea}
            onClick={() => setPreview(!inPreview)}
            data-tour="floor-plan-waiter-view"
          >
            {inPreview ? <Pencil className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {t(inPreview ? 'editor.backToEditor' : 'editor.waiterView')}
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            // Sin áreas no se guarda: los elementos viejos sin área no tendrían dónde vivir y el servidor los archivaría.
            disabled={!dirty || save.isPending || doc.areas.length === 0}
            onClick={() => save.mutate()}
            data-testid="floor-plan-save"
            data-tour="floor-plan-save"
          >
            {dirty && !save.isPending && doc.areas.length > 0 && <span aria-hidden className="mr-2 h-2 w-2 rounded-full bg-warning" />}
            {t(save.isPending ? 'editor.saving' : 'editor.save')}
          </Button>
        </div>
      }
    >
      <div className={cn('flex h-full min-h-0 flex-col gap-3 p-4', save.isPending && 'pointer-events-none')} aria-busy={save.isPending}>
        <AreaTabs
          areas={doc.areas}
          activeKey={activeAreaKey}
          tableCount={tableCount}
          onSelect={key => dispatch({ type: 'SET_ACTIVE_AREA', key })}
          onAdd={() => setNewAreaOpen(true)}
          onRename={(key, name) => edit({ type: 'UPDATE_AREA', key, patch: { name } })}
          onShape={(key, floorShape) => edit({ type: 'UPDATE_AREA', key, patch: { floorShape } })}
          onMove={(key, direction) => edit({ type: 'MOVE_AREA', key, direction })}
          onRemove={key => edit({ type: 'REMOVE_AREA', key })}
        />
        {inPreview && activeArea ? (
          <WaiterPreview area={activeArea} tables={areaTables} elements={areaElements} />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[13rem_minmax(0,1fr)_18rem] gap-3">
            <ToolPalette tool={tool} onTool={setTool} disabled={!activeArea} />
            <div className="flex min-h-0 flex-col gap-3">
              {activeArea ? (
                <FloorCanvas
                  area={activeArea}
                  tables={areaTables}
                  elements={areaElements}
                  selection={selection}
                  tool={tool}
                  onSelect={keys => dispatch({ type: 'SELECT', keys })}
                  onMove={(keys, dx, dy) => edit({ type: 'MOVE', keys, dx, dy })}
                  onPlaceTool={placeTool}
                  onCreateWall={(x1, y1, x2, y2) =>
                    edit({
                      type: 'ADD_ELEMENT',
                      element: { key: newKey(), type: 'WALL', areaKey: activeArea.key, x: x1, y: y1, w: null, h: null, rotation: 0, x2, y2, label: null, color: null },
                    })
                  }
                  onPlaceTable={(key, x, y) => edit({ type: 'PLACE_TABLE', key, areaKey: activeArea.key, x, y })}
                  onToolDone={() => setTool('select')}
                />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-input bg-card">
                  <p className="text-sm text-muted-foreground">{t('editor.noArea')}</p>
                  <Button className="cursor-pointer" onClick={() => setNewAreaOpen(true)} data-tour="floor-plan-create-area">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('editor.createArea')}
                  </Button>
                </div>
              )}
              <UnplacedTray
                tables={trayTables}
                onPlace={key => {
                  if (!activeArea) return
                  const g = gridOf(activeArea.floorShape)
                  edit({ type: 'PLACE_TABLE', key, areaKey: activeArea.key, x: g.cols / 2, y: g.rows / 2 })
                }}
              />
            </div>
            <Inspector
              areas={doc.areas}
              allNumbers={allNumbers}
              tables={selectedTables}
              elements={selectedElements}
              dispatch={edit}
              onRemove={remove}
              onDuplicate={duplicate}
            />
          </div>
        )}
      </div>

      <NewAreaDialog
        open={newAreaOpen}
        first={doc.areas.length === 0}
        existingNames={doc.areas.map(a => a.name)}
        adoptCount={doc.tables.filter(x => x.areaKey === null).length}
        onCancel={() => setNewAreaOpen(false)}
        onCreate={createArea}
      />

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('editor.unsavedTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('editor.unsavedBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('editor.keepEditing')}</AlertDialogCancel>
            <AlertDialogAction onClick={onClose} data-testid="floor-plan-discard">
              {t('editor.unsavedConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={conflict} onOpenChange={setConflict}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('editor.conflictTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('editor.conflictBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('editor.keepEditing')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void reload()} data-testid="floor-plan-reload">
              {t('editor.reload')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FullScreenModal>
  )
}
