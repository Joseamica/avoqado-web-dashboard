import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { Eye, Pencil, Plus, Redo2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { getFloorPlan, publishFloorPlan } from '@/services/floorPlan.service'
import { AreaTabs } from './editor/AreaTabs'
import { FloorCanvas } from './editor/FloorCanvas'
import { IconAction } from './editor/IconAction'
import { Inspector } from './editor/Inspector'
import { NewAreaDialog } from './editor/NewAreaDialog'
import { ConflictDialog, LeaveDialog } from './editor/EditorDialogs'
import { DuplicateNumbersNotice, OpenOrdersNotice } from './editor/EditorNotices'
import { ToolPalette } from './editor/ToolPalette'
import { UnplacedTray } from './editor/UnplacedTray'
import { useKeyboardFocus } from './editor/useKeyboardFocus'
import { useLeaveGuard } from './editor/useLeaveGuard'
import { WaiterPreview } from './editor/WaiterPreview'
import { restorableNumbers, useEditorActions } from './editor/useEditorActions'
import { MOD_KEY, TYPING, useEditorShortcuts, within } from './editor/useEditorShortcuts'
import { duplicateNumbers, keysToRenumber } from './model/docHelpers'
import { editorReducer, initEditorState, type EditorAction } from './model/editorReducer'
import { gridOf } from './model/floorGeometry'
import { roomLeft } from './model/limits'
import { docToPayload, dtoToDoc } from './model/planMapping'
import type { EditorDoc, FloorPlanDto, ToolId } from './model/types'

export interface FloorPlanEditorProps {
  plan: FloorPlanDto
  venueId: string
  venueName?: string
  /** Pestaña que se abre primero (la tarjeta del área que se tocó en la página). */
  initialAreaKey?: string | null
  onClose: () => void
}

export function FloorPlanEditor({ plan, venueId, venueName, initialAreaKey, onClose }: FloorPlanEditorProps) {
  const { t } = useTranslation('floorPlan')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(editorReducer, plan, p => {
    const doc = dtoToDoc(p)
    return initEditorState(doc, Math.max(0, doc.areas.findIndex(a => a.key === initialAreaKey)))
  })
  // El último plano que el servidor confirmó (al abrir, al guardar o al recargar): su huella va en el PUT, sus topes
  // limitan lo que se agrega, y de él se regresan las mesas que un 422 no dejó quitar.
  const [saved, setSaved] = useState(plan)
  const savedTables = useMemo(() => dtoToDoc(saved).tables, [saved])
  const [tool, setTool] = useState<ToolId>('select')
  const [preview, setPreview] = useState(false)
  const [newAreaOpen, setNewAreaOpen] = useState(() => plan.areas.length === 0)
  const [confirmClose, setConfirmClose] = useState(false)
  const [conflict, setConflict] = useState(false)
  /** Mesas que el servidor no dejó quitar (422 de cuenta abierta): el aviso se queda hasta regresarlas o cerrarlo. */
  const [openOrders, setOpenOrders] = useState<string[] | null>(null)
  // El mismo folio mientras el borrador no cambie: un reintento tras un error de red no se confunde con «alguien más cambió».
  const attempt = useRef<{ doc: EditorDoc; saveId: string } | null>(null)
  // Mientras el servidor contesta (al guardar o al recargar), el plano no se toca: al llegar la respuesta se carga el
  // plano del servidor, y lo que se hubiera cambiado entretanto se perdería sin aviso.
  const locked = useRef(false)
  /** «Recargar el plano» tras un 409 en curso: como al guardar, el área de trabajo queda quieta (D2, Codex P1-2). */
  const [reloading, setReloading] = useState(false)
  /** Aplica un cambio al borrador; mientras se guarda o recarga lo descarta y devuelve `false` (no se finge que se hizo). */
  const edit = useCallback((action: EditorAction): boolean => {
    if (locked.current) return false
    dispatch(action)
    return true
  }, [])
  /**
   * Un botón tocado con el RATÓN suelta el foco (`detail > 0`; con teclado es 0): si no, Espacio (la mano del lienzo) lo
   * volvería a accionar. Así Espacio es de un botón sólo si llegó a él con el teclado. Vale para todo el editor.
   */
  const blurAfterPointerClick = (e: ReactMouseEvent) => {
    if (e.detail === 0) return
    const control = (e.target as HTMLElement).closest?.('button, [role="button"]')
    if (control instanceof HTMLElement && control === document.activeElement) control.blur()
  }
  // Lo lleva el editor y no el lienzo: el lienzo se desmonta con la vista del mesero (m1 de 15-D).
  const keyboardFocus = useKeyboardFocus()
  // `pointer-events-none` sólo frena el ratón: `inert` también saca del Tab lo que no se puede usar mientras se guarda.
  // (React 18 no conoce el atributo: se pone a mano.)
  const workspace = useRef<HTMLDivElement>(null)

  const { doc, selection, activeAreaKey, dirty } = state
  const activeArea = doc.areas.find(a => a.key === activeAreaKey) ?? null
  const inPreview = preview && activeArea !== null
  // Elementos viejos sin área (la PAX los dibujaba antes de que hubiera áreas): sin un área que los reciba, el plano no
  // se puede guardar — el servidor los archivaría. Sin ellos, un plano sin áreas sí se guarda.
  const orphanElements = useMemo(() => doc.elements.some(e => !doc.areas.some(a => a.key === e.areaKey)), [doc])
  const areaTables = useMemo(() => doc.tables.filter(x => x.areaKey === activeAreaKey && x.x !== null), [doc.tables, activeAreaKey])
  const areaElements = useMemo(() => doc.elements.filter(e => e.areaKey === activeAreaKey), [doc.elements, activeAreaKey])
  const trayTables = useMemo(() => doc.tables.filter(x => x.areaKey === null || (x.areaKey === activeAreaKey && x.x === null)), [doc.tables, activeAreaKey])
  const tableCount = useMemo(() => Object.fromEntries(doc.areas.map(a => [a.key, doc.tables.filter(x => x.areaKey === a.key).length])), [doc])
  const allNumbers = useMemo(() => doc.tables.map(x => x.number), [doc.tables])
  const selectedTables = useMemo(() => doc.tables.filter(x => selection.includes(x.key)), [doc.tables, selection])
  const selectedElements = useMemo(() => doc.elements.filter(e => selection.includes(e.key)), [doc.elements, selection])
  const room = useMemo(() => roomLeft(doc, saved.limits), [doc, saved.limits])
  // Dos mesas con el mismo número (p. ej. la que se regresó tras un 422 y una nueva que tomó su número): no se guarda.
  const dupes = useMemo(() => duplicateNumbers(doc.tables), [doc.tables])
  const dupeKeysToFix = useMemo(() => keysToRenumber(dupes, doc.tables), [dupes, doc.tables])

  // El Esc del editor (lo arma `escape`, más abajo).
  const escapeRef = useRef<(e: KeyboardEvent) => void>(() => {})
  const lastEscape = useRef<KeyboardEvent | null>(null)
  // Un aviso puede quedar a la vista después de cerrar el editor: su Esc ya no debe llamar a este editor.
  useEffect(
    () => () => {
      escapeRef.current = () => {}
    },
    [],
  )
  // El último aviso: un guardado nuevo lo quita. Antes «No se guardó: no hay conexión» seguía a la vista junto a
  // «Plano guardado» o junto a «Alguien más cambió el plano» del reintento (pasada en vivo, 9-oct).
  const lastNotice = useRef<{ dismiss: () => void } | null>(null)
  /**
   * Un aviso del editor. Mientras está a la vista, Radix le da a él el Esc (es la capa de arriba) y el editor no lo
   * recibía: tras «Plano guardado» hacían falta dos Esc para salir. Ahora ese Esc cierra el aviso Y sigue con lo que
   * haría el editor (soltar lo activo o cerrar).
   */
  const notify = useCallback(
    (opts: { title: string; description?: string; variant?: 'default' | 'destructive' }) => {
      lastNotice.current = toast({ ...opts, onEscapeKeyDown: (e: KeyboardEvent) => escapeRef.current(e) }) ?? null
    },
    [toast],
  )
  const clearNotice = () => {
    lastNotice.current?.dismiss()
    lastNotice.current = null
  }

  const { placeTool, createWall, duplicate, remove, createArea, restoreTables } = useEditorActions({
    doc,
    activeArea,
    allNumbers,
    edit,
    notify,
    room,
    limits: saved.limits,
    savedTables,
  })
  const restorable = useMemo(() => (openOrders ? restorableNumbers(openOrders, doc, savedTables) : []), [openOrders, doc, savedTables])

  const save = useMutation({
    // Online-only a propósito (spec §8): sin red se INTENTA y se avisa (también al recargar). Con el modo por defecto TanStack
    // lo pausaba si el navegador sabe que no hay red: «Guardando…» sin fin y, al volver, publicaba solo (prueba real 9-oct).
    networkMode: 'always',
    // async: si armar el cuerpo truena (no debería: Guardar se apaga mientras haya elementos sin área), es un error del
    // guardado, no un crash.
    mutationFn: async () => {
      if (attempt.current?.doc !== doc) attempt.current = { doc, saveId: crypto.randomUUID() }
      return publishFloorPlan(venueId, docToPayload(doc, attempt.current.saveId, saved.fingerprint))
    },
    onMutate: () => {
      locked.current = true
      clearNotice()
    },
    onSettled: () => {
      locked.current = false
    },
    onSuccess: result => {
      attempt.current = null
      setSaved(result)
      setOpenOrders(null)
      dispatch({ type: 'LOAD', doc: dtoToDoc(result), activeIndex: Math.max(0, doc.areas.findIndex(a => a.key === activeAreaKey)) })
      queryClient.setQueryData(['floor-plan', venueId], result)
      notify({ title: t('editor.saved') })
    },
    onError: error => {
      // Sin respuesta del servidor = no llegó (red). Cualquier otra cosa que no venga del servidor es un error genérico.
      if (!isAxiosError(error)) return notify({ title: t('editor.genericError'), variant: 'destructive' })
      if (!error.response) return notify({ title: t('editor.offline'), variant: 'destructive' })
      const data = (error.response.data ?? {}) as { code?: string; message?: string; details?: { numbers?: string[] } }
      if (error.response.status === 409 && data.code === 'FLOOR_PLAN_CHANGED') return setConflict(true)
      if (error.response.status === 422 && data.code === 'TABLES_WITH_OPEN_ORDERS') {
        const numbers = data.details?.numbers ?? []
        const named = new Set(numbers.map(n => n.trim()))
        // Ya se sabe que tienen cuenta: deshacer no debe regresarlas sin su marca (y sin que Supr las pueda quitar otra vez).
        dispatch({ type: 'MARK_OPEN_ORDERS', keys: savedTables.filter(x => named.has(x.number.trim())).map(x => x.key) })
        return setOpenOrders(numbers)
      }
      notify({ title: t('editor.genericError'), description: data.message, variant: 'destructive' })
    },
  })

  const busy = save.isPending || reloading
  // El borrador de este render: la recarga compara contra él al llegar la respuesta.
  const latestDoc = useRef(doc)
  useEffect(() => {
    latestDoc.current = doc
  }, [doc])

  /**
   * Tras un 409: trae el plano de la otra persona y lo carga (se pierden los cambios, como dice el aviso). Mientras llega,
   * el área de trabajo queda quieta: antes el aviso se cerraba, se seguía editando y el plano que llegaba borraba esas
   * ediciones sin decir nada (D2). Y una respuesta nunca pisa un borrador que cambió después de pedirla. Si falla, se
   * dice y el borrador se queda; el siguiente «Guardar» vuelve a ofrecer recargar.
   */
  const reload = async () => {
    setConflict(false)
    setReloading(true)
    locked.current = true
    const asked = latestDoc.current
    try {
      const fresh = await queryClient.fetchQuery({
        queryKey: ['floor-plan', venueId],
        queryFn: () => getFloorPlan(venueId),
        staleTime: 0,
        networkMode: 'always',
      })
      if (latestDoc.current !== asked) return notify({ title: t('page.loadError'), variant: 'destructive' })
      attempt.current = null
      setSaved(fresh)
      setOpenOrders(null)
      dispatch({ type: 'LOAD', doc: dtoToDoc(fresh) })
      setTool('select')
    } catch {
      notify({ title: t('page.loadError'), variant: 'destructive' })
    } finally {
      locked.current = false
      setReloading(false)
    }
  }

  useEffect(() => {
    workspace.current?.toggleAttribute('inert', busy)
  }, [busy])

  // Atrás del navegador, un enlace o cerrar la pestaña: el mismo «¿Salir sin guardar?» que cerrar el editor (D3).
  // Recargar es como guardar: el borrador está por cambiar, «Atrás» espera en vez de preguntar de más (m2).
  const leaveGuard = useLeaveGuard({ dirty, saving: busy, conflict })
  const askLeave = confirmClose || leaveGuard.asking
  const stay = () => {
    setConfirmClose(false)
    leaveGuard.stay()
  }

  useEditorShortcuts({ enabled: !(newAreaOpen || askLeave || conflict || inPreview || busy), selection, edit, duplicate, remove })

  // Esc: primero suelta lo activo (herramienta, selección, vista del mesero); con nada activo, cierra (y con cambios,
  // pregunta). Dentro de un campo es del campo. Lo usan el modal y los avisos (ver `notify`).
  const escape = (target: EventTarget | null): 'field' | 'busy' | 'released' | 'close' => {
    if (within(target, TYPING)) return 'field'
    if (newAreaOpen || askLeave || conflict) return 'busy'
    if (tool !== 'select' || selection.length || inPreview) {
      setTool('select')
      dispatch({ type: 'SELECT', keys: [] })
      setPreview(false)
      return 'released'
    }
    return 'close'
  }
  const requestClose = () => (dirty ? setConfirmClose(true) : onClose())
  escapeRef.current = (e: KeyboardEvent) => {
    // Radix entrega el mismo Esc dos veces si el aviso tiene el foco: se atiende una.
    if (lastEscape.current === e) return
    lastEscape.current = e
    if (escape(e.target) === 'close') requestClose()
  }

  const onEscapeKeyDown = (e: KeyboardEvent) => {
    // 'close' deja que el modal se cierre (y `onClose` del modal pregunta si hay cambios); lo demás no lo cierra.
    if (escape(e.target) !== 'close') e.preventDefault()
  }

  return (
    <FullScreenModal
      open
      onClose={requestClose}
      onEscapeKeyDown={onEscapeKeyDown}
      // Igual que el valor por defecto (no mover el foco al abrir), pero pasarlo le quita al contenedor el contorno de
      // foco: al hacer clic en el lienzo (que no recibe foco) el foco cae en el modal y lo enmarcaba en azul.
      onOpenAutoFocus={e => e.preventDefault()}
      closeButtonTestId="floor-editor-close"
      title={t('editor.title')}
      subtitle={venueName}
      contentClassName="bg-muted/30"
      actions={
        <div className="flex items-center gap-2" onClickCapture={blurAfterPointerClick}>
          {dirty && !busy && (
            <span className="mr-1 hidden text-xs text-muted-foreground xl:inline" data-testid="floor-plan-unsaved">
              {t('editor.unsaved')}
            </span>
          )}
          <IconAction
            label={t('editor.undo')}
            shortcut={`${MOD_KEY} Z`}
            disabled={!state.past.length || busy}
            onClick={() => edit({ type: 'UNDO' })}
            data-tour="floor-plan-undo"
          >
            <Undo2 className="h-4 w-4" />
          </IconAction>
          <IconAction
            label={t('editor.redo')}
            shortcut={`${MOD_KEY} ⇧ Z`}
            disabled={!state.future.length || busy}
            onClick={() => edit({ type: 'REDO' })}
            data-tour="floor-plan-redo"
          >
            <Redo2 className="h-4 w-4" />
          </IconAction>
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
            disabled={!dirty || busy || orphanElements || dupes.length > 0}
            onClick={() => save.mutate()}
            data-testid="floor-plan-save"
            data-tour="floor-plan-save"
          >
            {dirty && !busy && !orphanElements && !dupes.length && <span aria-hidden className="mr-2 h-2 w-2 rounded-full bg-warning" />}
            {t(save.isPending ? 'editor.saving' : reloading ? 'editor.reloading' : 'editor.save')}
          </Button>
        </div>
      }
    >
      <div
        ref={workspace}
        className={cn('flex h-full min-h-0 flex-col gap-3 p-4', busy && 'pointer-events-none')}
        aria-busy={busy}
        onClickCapture={blurAfterPointerClick}
        data-testid="floor-plan-workspace"
      >
        <AreaTabs
          areas={doc.areas}
          activeKey={activeAreaKey}
          tableCount={tableCount}
          maxAreas={saved.limits.areas}
          onSelect={key => dispatch({ type: 'SET_ACTIVE_AREA', key })}
          onAdd={() => setNewAreaOpen(true)}
          onRename={(key, name) => edit({ type: 'UPDATE_AREA', key, patch: { name } })}
          onShape={(key, floorShape) => edit({ type: 'UPDATE_AREA', key, patch: { floorShape } })}
          onMove={(key, direction) => edit({ type: 'MOVE_AREA', key, direction })}
          onRemove={key => edit({ type: 'REMOVE_AREA', key })}
          onRenameRejected={reason => notify({ title: reason })}
        />
        {openOrders && (
          <OpenOrdersNotice
            numbers={openOrders}
            canRestore={restorable.length > 0}
            onRestore={() => {
              // Lo que no se pudo regresar (no cupo, o no está en el plano guardado) se queda en el aviso.
              const left = restoreTables(openOrders)
              setOpenOrders(left.length ? left : null)
            }}
            onDismiss={() => setOpenOrders(null)}
          />
        )}
        {dupes.length > 0 && (
          <DuplicateNumbersNotice
            numbers={dupes.map(g => g.number)}
            newOneTaken={dupeKeysToFix.length < dupes.reduce((n, g) => n + g.keys.length, 0)}
            onShow={() => dispatch({ type: 'REVEAL', keys: dupeKeysToFix })}
          />
        )}
        {inPreview && activeArea ? (
          <WaiterPreview area={activeArea} tables={areaTables} elements={areaElements} />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[13rem_minmax(0,1fr)_18rem] gap-3">
            <ToolPalette tool={tool} onTool={setTool} disabled={!activeArea} room={room} limits={saved.limits} />
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
                  onCreateWall={createWall}
                  onPlaceTable={(key, x, y) => edit({ type: 'PLACE_TABLE', key, areaKey: activeArea.key, x, y })}
                  onToolDone={() => setTool('select')}
                  keyboardFocus={keyboardFocus}
                />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-input bg-card px-6 text-center">
                  <div className="space-y-1">
                    <p className="text-base font-semibold">{t('editor.noAreaTitle')}</p>
                    <p className="mx-auto max-w-sm text-sm text-muted-foreground">{t(orphanElements ? 'editor.orphans' : 'editor.noArea')}</p>
                  </div>
                  <Button className="cursor-pointer" onClick={() => setNewAreaOpen(true)} disabled={room.areas <= 0} data-tour="floor-plan-create-area">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('editor.createArea')}
                  </Button>
                </div>
              )}
              {/* Sin un área abierta no hay dónde ponerlas: la bandeja aparece al crear o elegir una. */}
              {activeArea && (
                <UnplacedTray
                  tables={trayTables}
                  onPlace={key => {
                    const g = gridOf(activeArea.floorShape)
                    edit({ type: 'PLACE_TABLE', key, areaKey: activeArea.key, x: g.cols / 2, y: g.rows / 2 })
                  }}
                />
              )}
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
        maxTables={room.tables}
        onCancel={() => setNewAreaOpen(false)}
        onCreate={req => {
          // Si no se aplicó (guardado en curso o sin lugar), el diálogo sigue abierto con lo escrito: no se finge que se creó.
          if (!createArea(req)) return
          setNewAreaOpen(false)
          setPreview(false)
        }}
      />

      <LeaveDialog open={askLeave} onStay={stay} onLeave={leaveGuard.asking ? leaveGuard.leave : onClose} />
      <ConflictDialog open={conflict} onStay={() => setConflict(false)} onReload={() => void reload()} />
    </FullScreenModal>
  )
}
