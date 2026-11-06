/**
 * Pruebas de la ola final (auditoría de Codex y revisión de 15-D). Van aparte para que ningún archivo pase de 500
 * líneas (R25). El editor vive dentro del router de datos, como en la app: así se prueba también la navegación.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
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
// Radix Select necesita pointer capture, que jsdom no tiene: un <select> nativo (aria-label «select»).
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))

const publish = vi.mocked(publishFloorPlan)
const LIMITS = { areas: 30, tables: 500, elements: 1500 }
const withArea: FloorPlanDto = {
  fingerprint: 'aaaaaaaaaaaaaaaa',
  areas: [{ id: 'a1', name: 'Salón', floorShape: 'WIDE', sortOrder: 0, externalId: null }],
  tables: [],
  elements: [],
  limits: LIMITS,
  overLimit: false,
}
const mesa1 = { id: 't1', number: '1', capacity: 4, shape: 'SQUARE' as const, rotation: 0, positionX: 0.5, positionY: 0.5, areaId: 'a1', hasOpenOrder: false }

const dosAreas: FloorPlanDto = {
  ...withArea,
  areas: [...withArea.areas, { id: 'a2', name: 'Terraza', floorShape: 'WIDE', sortOrder: 1, externalId: null }],
  tables: [mesa1, { ...mesa1, id: 't2', number: '2', positionX: 0.8 }],
}

const conflicto = () =>
  Object.assign(new Error('Conflict'), { isAxiosError: true, response: { status: 409, data: { code: 'FLOOR_PLAN_CHANGED', message: 'x' } } })

/** Seleccionar en el lienzo: jsdom no tiene `getScreenCTM`, pero el clic sobre una pieza sí la elige. */
function seleccionar(testId: string, shiftKey = false) {
  fireEvent.pointerDown(screen.getByTestId(testId), { button: 0, pointerId: 1, shiftKey })
  fireEvent.pointerUp(screen.getByTestId('floor-canvas'), { button: 0, pointerId: 1 })
}

/** El editor en `/plano`, con `/otra` detrás en el historial (para «Atrás»). */
function renderEditor(plan: FloorPlanDto) {
  const onClose = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter(
    [
      {
        path: '/plano',
        element: (
          <QueryClientProvider client={qc}>
            <FloorPlanEditor plan={plan} venueId="v1" onClose={onClose} />
          </QueryClientProvider>
        ),
      },
      { path: '/otra', element: <p>otra página</p> },
    ],
    { initialEntries: ['/otra', '/plano'], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return { onClose, router }
}

beforeEach(() => {
  vi.clearAllMocks()
  Element.prototype.setPointerCapture = () => {}
})

describe('FloorPlanEditor — ola final', () => {
  // Codex P1-1: la mesa se iba a Terraza, el lienzo seguía en Salón con ella seleccionada; Shift+clic en la 2 y Supr
  // borraban las dos, incluida la que ya no se veía.
  it('D1: cambiar la mesa de área desde el inspector abre esa pestaña con la mesa; lo de la otra área ya no queda a mano', async () => {
    const user = userEvent.setup()
    renderEditor(dosAreas)
    seleccionar('floor-table-1')
    await user.selectOptions(screen.getByRole('combobox', { name: 'select' }), 'a2')
    const lienzo = screen.getByTestId('floor-canvas')
    expect(within(lienzo).getByTestId('floor-table-1')).toBeInTheDocument()
    expect(within(lienzo).queryByTestId('floor-table-2')).not.toBeInTheDocument()
    expect(screen.getByText('inspector.table:1')).toBeInTheDocument()
    await user.keyboard('{Delete}')
    // Supr quitó sólo la que se ve; la 2 sigue en Salón.
    await user.click(screen.getByTestId('floor-area-tab-Salón'))
    expect(within(screen.getByTestId('floor-canvas')).getByTestId('floor-table-2')).toBeInTheDocument()
  })

  // R31: la sincronización de SoftRestaurant crea mesas con capacity 0. El servidor ya acepta 0–99.
  it('D4: una mesa con 0 personas se ve «sin dato» (—) en el inspector; con + pasa a 1, nunca vuelve a 0', async () => {
    const user = userEvent.setup()
    renderEditor({ ...withArea, tables: [{ ...mesa1, capacity: 0 }] })
    seleccionar('floor-table-1')
    const personas = screen.getByTestId('floor-inspector-capacity')
    expect(personas).toHaveTextContent('—')
    expect(personas).toHaveTextContent('inspector.capacityUnknown')
    expect(personas).not.toHaveTextContent('0')
    expect(within(personas).getByRole('button', { name: 'inspector.fewer' })).toBeDisabled()
    await user.click(within(personas).getByRole('button', { name: 'inspector.more' }))
    expect(personas).toHaveTextContent('1')
    expect(within(personas).getByRole('button', { name: 'inspector.fewer' })).toBeDisabled()
  })

  it('D4: con una mesa en 0 que nadie tocó, mover una pared se guarda y la mesa viaja con 0', async () => {
    const user = userEvent.setup()
    const pared = { id: 'w1', type: 'WALL' as const, areaId: 'a1', positionX: 0.1, positionY: 0.1, width: null, height: null, rotation: 0, endX: 0.3, endY: 0.1, label: null, color: null }
    const plan = { ...withArea, tables: [{ ...mesa1, capacity: 0 }], elements: [pared] }
    publish.mockResolvedValueOnce({ ...plan, fingerprint: 'bbbbbbbbbbbbbbbb', publicationId: 'p1', replayed: false })
    renderEditor(plan)
    seleccionar('floor-element-w1')
    await user.keyboard('{ArrowRight}')
    await user.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1))
    const body = publish.mock.calls[0][1]
    expect(body.tables).toEqual([expect.objectContaining({ id: 't1', capacity: 0 })])
    expect(body.elements[0].positionX).toBeGreaterThan(0.1)
  })

  // m1 de 15-D: el lienzo se desmonta con la vista del mesero; al volver olvidaba que el botón tenía el foco por teclado.
  it('D6: ir y volver de la vista del mesero con Espacio, y el tercer Espacio sigue pulsando el botón (no mueve el plano)', async () => {
    const user = userEvent.setup()
    renderEditor({ ...withArea, tables: [mesa1] })
    const vista = screen.getByRole('button', { name: 'editor.waiterView' })
    for (let i = 0; i < 20 && document.activeElement !== vista; i++) await user.tab()
    expect(vista).toHaveFocus()
    await user.keyboard(' ')
    expect(screen.getByTestId('floor-plan-waiter-preview')).toBeInTheDocument()
    await user.keyboard(' ')
    expect(screen.getByTestId('floor-canvas')).toBeInTheDocument()
    await user.keyboard(' ')
    expect(screen.getByTestId('floor-plan-waiter-preview')).toBeInTheDocument()
  })

  // Codex P1-2: el diálogo se cerraba al instante, se seguía editando, y al llegar el GET el LOAD borraba esas ediciones
  // con dirty=false (sin aviso).
  it('D2: «Recargar el plano» deja el área de trabajo quieta hasta que llega el plano; lo que se intente entretanto no se aplica', async () => {
    const user = userEvent.setup()
    publish.mockRejectedValueOnce(conflicto())
    let llega: (p: FloorPlanDto) => void = () => {}
    vi.mocked(getFloorPlan).mockReturnValueOnce(new Promise(resolve => (llega = resolve)))
    renderEditor({ ...withArea, tables: [mesa1] })
    seleccionar('floor-table-1')
    await user.keyboard('r')
    await user.click(screen.getByTestId('floor-plan-save'))
    await user.click(await screen.findByTestId('floor-plan-reload'))
    const guardar = screen.getByTestId('floor-plan-save')
    expect(screen.getByTestId('floor-plan-workspace')).toHaveAttribute('inert')
    expect(guardar).toHaveTextContent('editor.reloading')
    expect(guardar).toBeDisabled()
    expect(screen.getByRole('button', { name: 'editor.undo' })).toBeDisabled()
    // Girar otra vez mientras llega: no se aplica (antes giraba, y el plano que llegaba lo borraba sin decir nada).
    await user.keyboard('r')
    expect(screen.getByText('45°')).toBeInTheDocument()
    llega({ ...withArea, fingerprint: 'cccccccccccccccc', tables: [{ ...mesa1, number: '7' }] })
    expect(await screen.findByTestId('floor-table-7')).toBeInTheDocument()
    expect(screen.getByTestId('floor-plan-workspace')).not.toHaveAttribute('inert')
    expect(guardar).toHaveTextContent('editor.save')
    expect(guardar).toBeDisabled() // lo que se ve es lo guardado
  })

  it('D2: si la recarga falla, se dice, el área de trabajo vuelve y el borrador sigue ahí', async () => {
    const user = userEvent.setup()
    publish.mockRejectedValueOnce(conflicto())
    vi.mocked(getFloorPlan).mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }))
    renderEditor({ ...withArea, tables: [mesa1] })
    seleccionar('floor-table-1')
    await user.keyboard('r')
    await user.click(screen.getByTestId('floor-plan-save'))
    await user.click(await screen.findByTestId('floor-plan-reload'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'page.loadError', variant: 'destructive' })))
    expect(screen.getByTestId('floor-plan-workspace')).not.toHaveAttribute('inert')
    expect(screen.getByText('45°')).toBeInTheDocument()
    expect(screen.getByTestId('floor-plan-save')).toBeEnabled()
  })

  // Codex P1-3: React Router desmontaba el editor sin pasar por «¿Salir sin guardar?» y `beforeunload` no salta en una
  // navegación interna: el borrador se perdía.
  it('D3: Atrás con cambios sin guardar pregunta; «Seguir editando» y Esc se quedan con el borrador; «Salir sin guardar» se va', async () => {
    const user = userEvent.setup()
    const { router } = renderEditor({ ...withArea, tables: [mesa1] })
    seleccionar('floor-table-1')
    await user.keyboard('r')
    await act(async () => router.navigate(-1))
    expect(await screen.findByText('editor.unsavedTitle')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/plano')
    await user.click(screen.getByRole('button', { name: 'editor.keepEditing' }))
    await waitFor(() => expect(screen.queryByText('editor.unsavedTitle')).not.toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/plano')
    expect(screen.getByText('45°')).toBeInTheDocument()
    await act(async () => router.navigate(-1))
    await screen.findByText('editor.unsavedTitle')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText('editor.unsavedTitle')).not.toBeInTheDocument())
    expect(screen.getByTestId('floor-canvas')).toBeInTheDocument()
    await act(async () => router.navigate(-1))
    await user.click(await screen.findByTestId('floor-plan-discard'))
    expect(await screen.findByText('otra página')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/otra')
  })

  it('D3: sin cambios, Atrás se va sin preguntar', async () => {
    const { router } = renderEditor({ ...withArea, tables: [mesa1] })
    await act(async () => router.navigate(-1))
    expect(await screen.findByText('otra página')).toBeInTheDocument()
    expect(screen.queryByText('editor.unsavedTitle')).not.toBeInTheDocument()
  })

  it('D3: mientras se guarda no se navega; si el guardado sale bien la salida sigue sola, y si falla pregunta', async () => {
    const user = userEvent.setup()
    let termina: (r: PublishFloorPlanResult) => void = () => {}
    let falla: (e: unknown) => void = () => {}
    publish.mockReturnValueOnce(new Promise(resolve => (termina = resolve))).mockReturnValueOnce(new Promise((_, reject) => (falla = reject)))
    const plan = { ...withArea, tables: [mesa1] }
    const { router } = renderEditor(plan)
    seleccionar('floor-table-1')
    await user.keyboard('r')
    await user.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1))
    await act(async () => router.navigate(-1))
    expect(router.state.location.pathname).toBe('/plano')
    expect(screen.queryByText('editor.unsavedTitle')).not.toBeInTheDocument()
    termina({ ...plan, tables: [{ ...mesa1, rotation: 45 }], fingerprint: 'bbbbbbbbbbbbbbbb', publicationId: 'p1', replayed: false })
    expect(await screen.findByText('otra página')).toBeInTheDocument()
    // Otra vuelta, ahora el guardado falla: la salida que esperaba pregunta.
    await act(async () => router.navigate(1))
    seleccionar('floor-table-1')
    await user.keyboard('r')
    await user.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(2))
    await act(async () => router.navigate(-1))
    expect(screen.queryByText('editor.unsavedTitle')).not.toBeInTheDocument()
    falla(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }))
    expect(await screen.findByText('editor.unsavedTitle')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/plano')
  })

  it('D8: si TODAS las mesas de un número repetido tienen cuenta, «Ver cuáles» las selecciona (antes no seleccionaba nada)', async () => {
    const user = userEvent.setup()
    renderEditor({
      ...withArea,
      tables: [
        { ...mesa1, number: '2', hasOpenOrder: true },
        { ...mesa1, id: 't2', number: '2', positionX: 0.8, hasOpenOrder: true },
      ],
    })
    const aviso = screen.getByTestId('floor-plan-duplicates')
    expect(aviso).not.toHaveTextContent('duplicates.bodyNew')
    await user.click(screen.getByTestId('floor-plan-duplicates-show'))
    expect(screen.getByText('inspector.many')).toBeInTheDocument()
  })
})

// m-a: «Cambios sin guardar» era «hubo historial desde que se cargó»: todo commit, deshacer o rehacer prendía `dirty`.
// Ahora es «el borrador guardaría algo distinto de lo guardado» (los campos que viajan en el PUT).
describe('FloorPlanEditor — ronda m-a: sin cambios = igual a lo guardado', () => {
  /** Sin cambios pendientes: ni leyenda ni punto, Guardar apagado, y Atrás se va sin preguntar. */
  async function sinCambios(router: ReturnType<typeof renderEditor>['router']) {
    expect(screen.queryByTestId('floor-plan-unsaved')).not.toBeInTheDocument()
    expect(screen.getByTestId('floor-plan-save')).toBeDisabled()
    await act(async () => router.navigate(-1))
    expect(await screen.findByText('otra página')).toBeInTheDocument()
    expect(screen.queryByText('editor.unsavedTitle')).not.toBeInTheDocument()
  }

  it('regresar la mesa tras un 422 no deja cambios pendientes (su única diferencia, la marca de cuenta, no viaja)', async () => {
    const user = userEvent.setup()
    publish.mockRejectedValueOnce(
      Object.assign(new Error('Unprocessable'), {
        isAxiosError: true,
        response: { status: 422, data: { code: 'TABLES_WITH_OPEN_ORDERS', message: 'x', details: { numbers: ['2'] } } },
      }),
    )
    const { router } = renderEditor({ ...withArea, tables: dosAreas.tables })
    seleccionar('floor-table-2')
    await user.keyboard('{Delete}')
    await user.click(screen.getByTestId('floor-plan-save'))
    await user.click(await screen.findByTestId('floor-plan-restore-tables'))
    expect(screen.getByTestId('floor-open-order-2')).toBeInTheDocument()
    await sinCambios(router)
  })

  it('cambiar y deshacer no deja cambios pendientes ni detiene Atrás', async () => {
    const user = userEvent.setup()
    const { router } = renderEditor({ ...withArea, tables: [mesa1] })
    seleccionar('floor-table-1')
    await user.keyboard('r')
    expect(screen.getByTestId('floor-plan-save')).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'editor.undo' }))
    await sinCambios(router)
  })

  it('un cambio de verdad sigue pendiente; ir y volver al mismo lugar no lo es', async () => {
    const user = userEvent.setup()
    const { router } = renderEditor({ ...withArea, tables: [mesa1] })
    seleccionar('floor-table-1')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByTestId('floor-plan-unsaved')).toBeInTheDocument()
    await user.keyboard('{ArrowLeft}')
    expect(screen.queryByTestId('floor-plan-unsaved')).not.toBeInTheDocument()
    expect(screen.getByTestId('floor-plan-save')).toBeDisabled()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByTestId('floor-plan-unsaved')).toBeInTheDocument()
    expect(screen.getByTestId('floor-plan-save')).toBeEnabled()
    await act(async () => router.navigate(-1))
    expect(await screen.findByText('editor.unsavedTitle')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/plano')
  })
})
