import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FloorPlanEditor } from '../FloorPlanEditor'
import { getFloorPlan, publishFloorPlan } from '@/services/floorPlan.service'
import type { FloorPlanDto, PublishFloorPlanResult } from '../model/types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown>) => (o?.numbers ? `${key}:${o.numbers}` : o?.number ? `${key}:${o.number}` : key),
  }),
}))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/services/floorPlan.service', () => ({ getFloorPlan: vi.fn(), publishFloorPlan: vi.fn() }))

const publish = vi.mocked(publishFloorPlan)
const LIMITS = { areas: 30, tables: 500, elements: 1500 }
const empty: FloorPlanDto = { fingerprint: '0000000000000000', areas: [], tables: [], elements: [], limits: LIMITS, overLimit: false }
const withArea: FloorPlanDto = { ...empty, fingerprint: 'aaaaaaaaaaaaaaaa', areas: [{ id: 'a1', name: 'Salón', floorShape: 'WIDE', sortOrder: 0, externalId: null }] }
const saved = { ...withArea, fingerprint: 'bbbbbbbbbbbbbbbb', publicationId: 'p1', replayed: false }
const mesa1 = { id: 't1', number: '1', capacity: 4, shape: 'SQUARE' as const, rotation: 0, positionX: 0.5, positionY: 0.5, areaId: 'a1', hasOpenOrder: false }
const withTable: FloorPlanDto = { ...withArea, tables: [mesa1] }
const letrero = { id: 'e1', type: 'LABEL' as const, areaId: 'a1', positionX: 0.1, positionY: 0.1, width: null, height: null, rotation: 0, endX: null, endY: null, label: 'Terraza', color: null }
const dosMesas: FloorPlanDto = { ...withArea, tables: [mesa1, { ...mesa1, id: 't2', number: '2', positionX: 0.8 }], elements: [letrero] }
/** Pared que dibujó la PAX antes de que hubiera áreas: llega sin área. */
const paredVieja = { ...letrero, id: 'w-old', type: 'WALL' as const, areaId: null, label: null, endX: 0.5, endY: 0.1 }

function renderEditor(plan: FloorPlanDto = empty) {
  const onClose = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <FloorPlanEditor plan={plan} venueId="v1" onClose={onClose} />
    </QueryClientProvider>,
  )
  return { onClose }
}

async function crearArea(user: ReturnType<typeof userEvent.setup>, opts: { blank?: boolean } = {}) {
  const name = await screen.findByTestId('new-area-name')
  await user.clear(name)
  await user.type(name, 'Salón')
  await user.click(screen.getByTestId(opts.blank ? 'new-area-blank' : 'new-area-create'))
}

/** Seleccionar en el lienzo: jsdom no tiene `getScreenCTM`, pero el clic sobre una pieza sí la elige. */
function seleccionarMesa(number: string) {
  seleccionar(`floor-table-${number}`)
}
/** Como un clic real sobre el lienzo, salvo que aquí el foco no se mueve: el campo del inspector no recibe `blur`. */
function seleccionar(testId: string) {
  fireEvent.pointerDown(screen.getByTestId(testId), { button: 0, pointerId: 1 })
  fireEvent.pointerUp(screen.getByTestId('floor-canvas'), { button: 0, pointerId: 1 })
}
const timeout = () => Object.assign(new Error('timeout of 45000ms exceeded'), { isAxiosError: true, code: 'ECONNABORTED' })

beforeEach(() => {
  vi.clearAllMocks()
  Element.prototype.setPointerCapture = () => {}
})

describe('FloorPlanEditor', () => {
  it('el arranque rápido crea el área con sus mesas y se guarda el plano completo', async () => {
    const user = userEvent.setup()
    publish.mockResolvedValue(saved)
    renderEditor()
    await crearArea(user)
    expect(screen.getAllByTestId(/^floor-table-/)).toHaveLength(6)
    await user.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1))
    const [venueId, body] = publish.mock.calls[0]
    expect(venueId).toBe('v1')
    expect(body.baseFingerprint).toBe(empty.fingerprint)
    expect(body.areas).toEqual([expect.objectContaining({ name: 'Salón', floorShape: 'WIDE', sortOrder: 0 })])
    expect(body.tables).toHaveLength(6)
    expect(body.tables.every(t => t.areaRef === body.areas[0].clientId && (t.positionX as number) > 0 && (t.positionX as number) < 1)).toBe(true)
  })

  it('si falla la red, avisa y el reintento usa el MISMO folio', async () => {
    const user = userEvent.setup()
    publish.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' })).mockResolvedValueOnce(saved)
    renderEditor()
    await crearArea(user, { blank: true })
    await user.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'editor.offline', variant: 'destructive' })))
    await user.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(2))
    expect(publish.mock.calls[1][1].saveId).toBe(publish.mock.calls[0][1].saveId)
  })

  // Prueba real del 9-oct (Task 14): con el navegador sin red (navigator.onLine = false), TanStack dejaba el guardado EN
  // PAUSA antes de llamar al servidor: «Guardando…» para siempre, sin aviso y sin el tope de 45 s; y al volver la red
  // publicaba solo, aunque la persona ya hubiera salido con «Salir sin guardar».
  it('sin red (el navegador lo sabe), Guardar no se queda en pausa: intenta, avisa «sin conexión» y al volver la red no publica solo', async () => {
    const user = userEvent.setup()
    publish.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }))
    onlineManager.setOnline(false)
    try {
      renderEditor()
      await crearArea(user, { blank: true })
      await user.click(screen.getByTestId('floor-plan-save'))
      await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'editor.offline', variant: 'destructive' })))
      expect(publish).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('floor-plan-workspace')).not.toHaveAttribute('inert')
      expect(screen.getByTestId('floor-plan-save')).toBeEnabled()
    } finally {
      onlineManager.setOnline(true)
    }
    // Volvió la red: nada se manda sin que la persona lo pida.
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(publish).toHaveBeenCalledTimes(1)
  })

  it('sin red, «Recargar el plano» tras un 409 tampoco se queda en pausa: avisa que no se pudo cargar', async () => {
    const user = userEvent.setup()
    publish.mockRejectedValueOnce(
      Object.assign(new Error('Conflict'), { isAxiosError: true, response: { status: 409, data: { code: 'FLOOR_PLAN_CHANGED', message: 'x' } } }),
    )
    vi.mocked(getFloorPlan).mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }))
    renderEditor()
    await crearArea(user, { blank: true })
    await user.click(screen.getByTestId('floor-plan-save'))
    await screen.findByText('editor.conflictTitle')
    onlineManager.setOnline(false)
    try {
      await user.click(screen.getByTestId('floor-plan-reload'))
      await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'page.loadError', variant: 'destructive' })))
      expect(getFloorPlan).toHaveBeenCalledTimes(1)
    } finally {
      onlineManager.setOnline(true)
    }
  })

  it('un 409 muestra el aviso de cambio ajeno', async () => {
    const user = userEvent.setup()
    publish.mockRejectedValueOnce(
      Object.assign(new Error('Conflict'), { isAxiosError: true, response: { status: 409, data: { code: 'FLOOR_PLAN_CHANGED', message: 'x' } } }),
    )
    renderEditor()
    await crearArea(user, { blank: true })
    await user.click(screen.getByTestId('floor-plan-save'))
    expect(await screen.findByText('editor.conflictTitle')).toBeInTheDocument()
  })

  it('un 422 dice qué mesas tienen cuenta abierta (aviso que se queda); un error que no es de red no se disfraza de «sin conexión»', async () => {
    const user = userEvent.setup()
    publish
      .mockRejectedValueOnce(
        Object.assign(new Error('Unprocessable'), {
          isAxiosError: true,
          response: { status: 422, data: { code: 'TABLES_WITH_OPEN_ORDERS', message: 'x', details: { numbers: ['4', '7'] } } },
        }),
      )
      .mockRejectedValueOnce(new Error('boom'))
    renderEditor()
    await crearArea(user, { blank: true })
    await user.click(screen.getByTestId('floor-plan-save'))
    expect(await screen.findByTestId('floor-plan-open-orders')).toHaveTextContent('openOrders.title:4, 7')
    // 4 y 7 no estaban en el plano guardado (vacío): no hay nada que regresar, así que no se ofrece.
    expect(screen.queryByTestId('floor-plan-restore-tables')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'editor.genericError', variant: 'destructive' })))
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'editor.offline' }))
  })

  it('sin áreas sí se puede guardar si no queda nada sin área', async () => {
    const user = userEvent.setup()
    renderEditor()
    await crearArea(user, { blank: true })
    await user.click(screen.getByRole('button', { name: 'editor.undo' }))
    expect(screen.queryByTestId(/^floor-area-tab-/)).not.toBeInTheDocument()
    expect(screen.getByTestId('floor-plan-save')).toBeEnabled()
  })

  it('con elementos viejos sin área, Guardar se apaga hasta que haya un área (el servidor los archivaría)', async () => {
    const user = userEvent.setup()
    renderEditor({ ...empty, elements: [paredVieja] })
    await crearArea(user, { blank: true })
    expect(screen.getByTestId('floor-plan-save')).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'editor.undo' }))
    expect(screen.getByTestId('floor-plan-save')).toBeDisabled()
  })

  it('Esc con una herramienta activa la suelta y NO cierra; con nada activo y sin cambios, cierra', async () => {
    const user = userEvent.setup()
    const { onClose } = renderEditor(withArea)
    await user.click(screen.getByTestId('floor-tool-WALL'))
    expect(screen.getByTestId('floor-tool-WALL')).toHaveAttribute('aria-pressed', 'true')
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('floor-tool-WALL')).toHaveAttribute('aria-pressed', 'false')
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('Esc mientras se escribe el nombre de un área cancela el cambio de nombre, no cierra el editor', async () => {
    const user = userEvent.setup()
    const { onClose } = renderEditor(withArea)
    await user.dblClick(screen.getByTestId('floor-area-tab-Salón'))
    expect(screen.queryByTestId('floor-area-tab-Salón')).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('floor-area-tab-Salón')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('mientras se guarda, el plano no cambia: lo que se guarda es lo que queda', async () => {
    const user = userEvent.setup()
    let finish: (r: PublishFloorPlanResult) => void = () => {}
    publish.mockReturnValueOnce(new Promise(resolve => (finish = resolve)))
    renderEditor(withTable)
    seleccionarMesa('1')
    await user.keyboard('r')
    await user.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1))
    // Quitar la mesa mientras el servidor contesta se perdería al cargar su respuesta: no se permite.
    await user.keyboard('{Delete}')
    expect(screen.getByTestId('floor-table-1')).toBeInTheDocument()
    finish({ ...withTable, tables: [{ ...mesa1, rotation: 45 }], fingerprint: 'cccccccccccccccc', publicationId: 'p2', replayed: false })
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'editor.saved' })))
    expect(screen.getAllByTestId(/^floor-table-/)).toHaveLength(1)
    expect(screen.getByTestId('floor-plan-save')).toBeDisabled()
  })

  it('lo escrito en el inspector se guarda aunque el clic vaya directo a otra pieza del lienzo', async () => {
    const user = userEvent.setup()
    renderEditor(dosMesas)
    seleccionarMesa('1')
    expect(screen.getByRole('button', { name: 'inspector.duplicate' })).toBeInTheDocument()
    const numero = screen.getByTestId('floor-inspector-number')
    await user.clear(numero)
    await user.type(numero, '9')
    seleccionarMesa('2')
    expect(screen.getByTestId('floor-table-9')).toBeInTheDocument()
    expect(screen.queryByTestId('floor-table-1')).not.toBeInTheDocument()
    // Un número repetido no se guarda, ni al salir así.
    const otro = screen.getByTestId('floor-inspector-number')
    await user.clear(otro)
    await user.type(otro, '9')
    seleccionar('floor-element-e1')
    expect(screen.getByTestId('floor-table-2')).toBeInTheDocument()
    // El nombre de un letrero, igual.
    const nombre = screen.getByTestId('floor-inspector-label')
    await user.clear(nombre)
    await user.type(nombre, 'Patio')
    seleccionarMesa('9')
    expect(screen.getByText('Patio')).toBeInTheDocument()
    // Un solo paso de deshacer por cambio: deshacer dos veces deja el letrero y la mesa como estaban.
    await user.click(screen.getByRole('button', { name: 'editor.undo' }))
    await user.click(screen.getByRole('button', { name: 'editor.undo' }))
    expect(screen.getByText('Terraza')).toBeInTheDocument()
    expect(screen.getByTestId('floor-table-1')).toBeInTheDocument()
  })

  it('un guardado que se cuelga se rinde como «sin conexión» y el editor vuelve a dejar editar', async () => {
    const user = userEvent.setup()
    publish.mockRejectedValueOnce(timeout())
    renderEditor(withTable)
    seleccionarMesa('1')
    await user.keyboard('r')
    await user.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'editor.offline', variant: 'destructive' })))
    expect(screen.getByTestId('floor-plan-workspace')).not.toHaveAttribute('inert')
    expect(screen.getByTestId('floor-plan-save')).toBeEnabled()
    await user.keyboard('r')
    expect(screen.getByText('90°')).toBeInTheDocument()
  })

  it('mientras se guarda, el área de trabajo queda inerte y crear un área no finge que funcionó', async () => {
    const user = userEvent.setup()
    let finish: (r: PublishFloorPlanResult) => void = () => {}
    publish.mockReturnValueOnce(new Promise(resolve => (finish = resolve)))
    renderEditor(withTable)
    seleccionarMesa('1')
    await user.keyboard('r')
    await user.click(screen.getByRole('button', { name: 'areas.add' }))
    const name = await screen.findByTestId('new-area-name')
    // Forzado: Guardar queda detrás del diálogo; así se prueba que la acción que se cuela no miente.
    fireEvent.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('floor-plan-workspace')).toHaveAttribute('inert')
    await user.type(name, 'Patio')
    await user.click(screen.getByTestId('new-area-blank'))
    expect(screen.getByTestId('new-area-name')).toBeInTheDocument()
    expect(screen.queryByTestId('floor-area-tab-Patio')).not.toBeInTheDocument()
    finish({ ...withTable, fingerprint: 'cccccccccccccccc', publicationId: 'p2', replayed: false })
    await waitFor(() => expect(screen.getByTestId('floor-plan-workspace')).not.toHaveAttribute('inert'))
  })

  it('Esc sale de la vista del mesero sin cerrar el editor', async () => {
    const user = userEvent.setup()
    const { onClose } = renderEditor(withTable)
    await user.click(screen.getByRole('button', { name: 'editor.waiterView' }))
    expect(screen.getByTestId('floor-plan-waiter-preview')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('floor-plan-waiter-preview')).not.toBeInTheDocument()
    expect(screen.getByTestId('floor-canvas')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('si se borra el área mientras se ve la vista del mesero, Esc ya no tiene vista que cerrar: pregunta antes de salir', async () => {
    const user = userEvent.setup()
    const { onClose } = renderEditor(withArea)
    await user.click(screen.getByRole('button', { name: 'editor.waiterView' }))
    await user.click(screen.getByRole('button', { name: 'areas.options' }))
    await user.click(await screen.findByRole('menuitem', { name: 'areas.delete' }))
    await user.click(await screen.findByRole('button', { name: 'areas.deleteConfirm' }))
    await waitFor(() => expect(screen.queryByTestId('floor-area-tab-Salón')).not.toBeInTheDocument())
    await user.keyboard('{Escape}')
    expect(await screen.findByText('editor.unsavedTitle')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('sin un área abierta no se enseña la bandeja «Sin acomodar» (tocarla no haría nada)', async () => {
    const user = userEvent.setup()
    renderEditor({ ...empty, tables: [{ ...mesa1, areaId: null, positionX: null, positionY: null }] })
    await screen.findByTestId('new-area-name')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByTestId('new-area-name')).not.toBeInTheDocument())
    expect(screen.queryByTestId('floor-plan-unplaced')).not.toBeInTheDocument()
  })
  it('H2: tras un 422 de cuenta abierta, «Regresar las mesas» repone las que nombró el servidor tal como estaban, en un paso', async () => {
    const user = userEvent.setup()
    publish.mockRejectedValueOnce(
      Object.assign(new Error('Unprocessable'), {
        isAxiosError: true,
        response: { status: 422, data: { code: 'TABLES_WITH_OPEN_ORDERS', message: 'x', details: { numbers: ['2'] } } },
      }),
    )
    renderEditor(dosMesas)
    seleccionarMesa('2')
    await user.keyboard('{Delete}')
    expect(screen.queryByTestId('floor-table-2')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('floor-plan-save'))
    expect(await screen.findByTestId('floor-plan-open-orders')).toHaveTextContent('openOrders.title:2')
    expect(publish.mock.calls[0][1].tables.map(t => t.id)).toEqual(['t1'])
    await user.click(screen.getByTestId('floor-plan-restore-tables'))
    expect(screen.queryByTestId('floor-plan-open-orders')).not.toBeInTheDocument()
    // Donde estaba en el plano guardado (0.8 × 40 = 32; 0.5 × 25 = 12.5), con su punto de cuenta abierta y seleccionada.
    expect(screen.getByTestId('floor-table-2')).toHaveAttribute('transform', 'rotate(0 32 12.5)')
    expect(screen.getByTestId('floor-open-order-2')).toBeInTheDocument()
    expect(screen.getByText('inspector.table:2')).toBeInTheDocument()
    // Ya se sabe que tiene cuenta: Supr no la vuelve a quitar.
    await user.keyboard('{Delete}')
    expect(screen.getByTestId('floor-table-2')).toBeInTheDocument()
    // Regresarla es UN paso de deshacer.
    await user.click(screen.getByRole('button', { name: 'editor.undo' }))
    expect(screen.queryByTestId('floor-table-2')).not.toBeInTheDocument()
  })

  it('Esc con un aviso a la vista (p. ej. «Plano guardado») lo cierra Y sigue con lo del editor: un solo Esc para salir', async () => {
    const user = userEvent.setup()
    publish.mockResolvedValueOnce({ ...withTable, tables: [{ ...mesa1, rotation: 45 }], fingerprint: 'cccccccccccccccc', publicationId: 'p2', replayed: false })
    const { onClose } = renderEditor(withTable)
    seleccionarMesa('1')
    await user.keyboard('r')
    await user.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'editor.saved' })))
    const aviso = toast.mock.calls.find(([o]) => o.title === 'editor.saved')?.[0] as { onEscapeKeyDown: (e: KeyboardEvent) => void }
    // Radix le da el Esc al aviso (es la capa de arriba). Antes el editor no se enteraba y hacían falta dos.
    await user.click(screen.getByTestId('floor-tool-WALL'))
    const primero = new KeyboardEvent('keydown', { key: 'Escape' })
    aviso.onEscapeKeyDown(primero)
    aviso.onEscapeKeyDown(primero) // el mismo Esc entregado dos veces (aviso con el foco) cuenta una sola vez
    await waitFor(() => expect(screen.getByTestId('floor-tool-WALL')).toHaveAttribute('aria-pressed', 'false'))
    expect(onClose).not.toHaveBeenCalled()
    aviso.onEscapeKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('con el plano en el tope (limits del servidor) no deja agregar más y lo dice', async () => {
    const user = userEvent.setup()
    renderEditor({ ...dosMesas, limits: { areas: 1, tables: 2, elements: 1 } })
    expect(screen.getByTestId('floor-tool-table:SQUARE')).toBeDisabled()
    expect(screen.getByTestId('floor-tools-full-tables')).toHaveTextContent('limits.tables')
    expect(screen.getByTestId('floor-tool-WALL')).toBeDisabled()
    expect(screen.getByTestId('floor-tools-full-elements')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'areas.add' })).toBeDisabled()
    expect(screen.getByTestId('floor-areas-full')).toHaveTextContent('limits.areas')
    seleccionarMesa('1')
    await user.keyboard('{Control>}d{/Control}')
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'limits.tables' }))
    expect(screen.getAllByTestId(/^floor-table-/)).toHaveLength(2)
  })

  it('renombrar un área con nombre vacío o repetido dice por qué y deja el campo abierto', async () => {
    const user = userEvent.setup()
    renderEditor({ ...withArea, areas: [...withArea.areas, { id: 'a2', name: 'Terraza', floorShape: 'WIDE', sortOrder: 1, externalId: null }] })
    await user.dblClick(screen.getByTestId('floor-area-tab-Salón'))
    const campo = screen.getByTestId('floor-area-rename')
    await user.clear(campo)
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('floor-area-rename-error')).toHaveTextContent('newArea.nameRequired')
    expect(screen.getByTestId('floor-area-rename')).toHaveAttribute('aria-invalid', 'true')
    await user.type(campo, ' terraza ')
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('floor-area-rename-error')).toHaveTextContent('newArea.nameTaken')
    expect(screen.queryByTestId('floor-area-tab-Salón')).not.toBeInTheDocument() // sigue editándose
    await user.clear(campo)
    await user.type(campo, 'Patio')
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('floor-area-tab-Patio')).toBeInTheDocument()
    expect(screen.queryByTestId('floor-area-rename-error')).not.toBeInTheDocument()
  })

  it('un letrero o una mesa con espacios de más no cuentan como cambio al deseleccionarlos', async () => {
    const user = userEvent.setup()
    renderEditor({ ...dosMesas, tables: [{ ...mesa1, number: ' 1 ' }], elements: [{ ...letrero, label: ' Terraza ' }] })
    seleccionar('floor-element-e1')
    seleccionar('floor-table- 1') // (Testing Library recorta los espacios del testid)
    // El número con el foco y luego fuera: antes chocaba consigo mismo («Ya hay una mesa 1»).
    await user.click(screen.getByTestId('floor-inspector-number'))
    await user.tab()
    expect(screen.queryByText(/inspector.numberTaken/)).not.toBeInTheDocument()
    seleccionar('floor-element-e1')
    expect(screen.getByRole('button', { name: 'editor.undo' })).toBeDisabled()
    expect(screen.getByTestId('floor-plan-save')).toBeDisabled()
  })

  it('una flecha sostenida es UN paso de deshacer, y deshacer vuelve a la pestaña donde se hizo el cambio', async () => {
    const user = userEvent.setup()
    const dosAreas: FloorPlanDto = {
      ...withArea,
      areas: [...withArea.areas, { id: 'a2', name: 'Terraza', floorShape: 'WIDE', sortOrder: 1, externalId: null }],
      tables: [mesa1, { ...mesa1, id: 't2', number: '2', areaId: 'a2' }],
    }
    renderEditor(dosAreas)
    seleccionarMesa('1')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    for (let i = 0; i < 3; i++) fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true })
    expect(screen.getByTestId('floor-table-1')).toHaveAttribute('transform', 'rotate(0 24 12.5)')
    // Otra pestaña; deshacer regresa a Salón para que se VEA lo que se deshizo.
    await user.click(screen.getByTestId('floor-area-tab-Terraza'))
    expect(screen.queryByTestId('floor-table-1')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'editor.undo' }))
    expect(screen.getByTestId('floor-table-1')).toHaveAttribute('transform', 'rotate(0 20 12.5)')
    expect(screen.getByRole('button', { name: 'editor.undo' })).toBeDisabled() // la ráfaga entera era un solo paso
  })

  it('deshacer/rehacer, el lienzo y el inspector tienen nombre y data-tour', () => {
    renderEditor(withTable)
    expect(screen.getByRole('button', { name: 'editor.undo' })).toHaveAttribute('data-tour', 'floor-plan-undo')
    expect(screen.getByRole('button', { name: 'editor.redo' })).toHaveAttribute('data-tour', 'floor-plan-redo')
    expect(screen.getByRole('img', { name: 'canvas.label' })).toBe(screen.getByTestId('floor-canvas'))
    seleccionarMesa('1')
    expect(screen.getByRole('button', { name: 'inspector.duplicate' })).toHaveAttribute('data-tour', 'floor-plan-inspector-duplicate')
    expect(screen.getByTestId('floor-inspector-remove')).toHaveAttribute('data-tour', 'floor-plan-inspector-remove')
    expect(screen.getByTestId('floor-inspector-capacity')).toHaveAttribute('data-tour', 'floor-plan-inspector-capacity')
    // El campo del número tiene su etiqueta de verdad.
    expect(screen.getByLabelText('inspector.number')).toBe(screen.getByTestId('floor-inspector-number'))
  })
})
