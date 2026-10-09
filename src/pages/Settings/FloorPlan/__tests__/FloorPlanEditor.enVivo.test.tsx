/**
 * Pruebas de la pasada en vivo (design-review + full-testing, 9-oct). Van aparte para que ningún archivo pase de 500
 * líneas (R25). El editor vive dentro del router de datos, como en la app: así se prueba también la navegación.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FloorPlanEditor } from '../FloorPlanEditor'
import { getFloorPlan, publishFloorPlan } from '@/services/floorPlan.service'
import type { FloorPlanDto, PublishFloorPlanResult } from '../model/types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
const dismissals: string[] = []
const toast = vi.fn((opts: { title: string }) => ({ dismiss: () => dismissals.push(opts.title) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/services/floorPlan.service', () => ({ getFloorPlan: vi.fn(), publishFloorPlan: vi.fn() }))

const publish = vi.mocked(publishFloorPlan)
const plan: FloorPlanDto = {
  fingerprint: 'aaaaaaaaaaaaaaaa',
  areas: [{ id: 'a1', name: 'Salón', floorShape: 'WIDE', sortOrder: 0, externalId: null }],
  tables: [{ id: 't1', number: '1', capacity: 4, shape: 'SQUARE', rotation: 0, positionX: 0.5, positionY: 0.5, areaId: 'a1', hasOpenOrder: false }],
  elements: [],
  limits: { areas: 30, tables: 500, elements: 1500 },
  overLimit: false,
}
const saved = (): PublishFloorPlanResult => ({ ...plan, tables: [{ ...plan.tables[0], rotation: 45 }], fingerprint: 'bbbbbbbbbbbbbbbb', publicationId: 'p1', replayed: false })
const conflicto = () => Object.assign(new Error('Conflict'), { isAxiosError: true, response: { status: 409, data: { code: 'FLOOR_PLAN_CHANGED', message: 'x' } } })
const sinRed = () => Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' })

/** El editor en `/plano`, con `/otra` detrás en el historial (para «Atrás»). */
function renderEditor() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter(
    [
      {
        path: '/plano',
        element: (
          <QueryClientProvider client={qc}>
            <FloorPlanEditor plan={plan} venueId="v1" onClose={vi.fn()} />
          </QueryClientProvider>
        ),
      },
      { path: '/otra', element: <p>otra página</p> },
    ],
    { initialEntries: ['/otra', '/plano'], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return { router }
}

/** Gira la mesa 1 (un cambio sin guardar). jsdom no tiene `getScreenCTM`, pero el clic sobre una pieza sí la elige. */
async function girarMesa(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.pointerDown(screen.getByTestId('floor-table-1'), { button: 0, pointerId: 1 })
  fireEvent.pointerUp(screen.getByTestId('floor-canvas'), { button: 0, pointerId: 1 })
  await user.keyboard('r')
}

beforeEach(() => {
  vi.clearAllMocks()
  dismissals.length = 0
  Element.prototype.setPointerCapture = () => {}
})

describe('FloorPlanEditor — pasada en vivo', () => {
  // FINDING-006: «No se guardó: no hay conexión» seguía a la vista junto a «Plano guardado» (o junto al 409) del reintento.
  it('un guardado nuevo quita el aviso anterior: «sin conexión» no se queda junto a «Plano guardado»', async () => {
    const user = userEvent.setup()
    publish.mockRejectedValueOnce(sinRed()).mockResolvedValueOnce(saved())
    renderEditor()
    await girarMesa(user)
    await user.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'editor.offline' })))
    expect(dismissals).toEqual([])
    await user.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'editor.saved' })))
    expect(dismissals).toEqual(['editor.offline'])
  })

  // m1 (revisión de la ola final): Atrás durante el guardado espera; si llega un 409, se abrían DOS diálogos encimados
  // («Alguien más cambió el plano» y «¿Salir sin guardar?»). Ahora el 409 cancela esa salida y queda uno solo.
  it('m1: si el guardado que hacía esperar a «Atrás» trae un 409, sólo se ve el conflicto y la salida se cancela', async () => {
    const user = userEvent.setup()
    let falla: (e: unknown) => void = () => {}
    publish.mockReturnValueOnce(new Promise((_, reject) => (falla = reject)))
    const { router } = renderEditor()
    await girarMesa(user)
    await user.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1))
    await act(async () => router.navigate(-1))
    await act(async () => falla(conflicto()))
    expect(await screen.findByText('editor.conflictTitle')).toBeInTheDocument()
    expect(screen.queryByText('editor.unsavedTitle')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'editor.keepEditing' }))
    await waitFor(() => expect(screen.queryByText('editor.conflictTitle')).not.toBeInTheDocument())
    expect(screen.queryByText('editor.unsavedTitle')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/plano')
    // Para salir se vuelve a pedir, y como hay cambios, pregunta.
    await act(async () => router.navigate(-1))
    expect(await screen.findByText('editor.unsavedTitle')).toBeInTheDocument()
  })

  // m2: «Atrás» mientras se recarga el plano preguntaba «¿Salir sin guardar?» de más (el borrador ya se iba a perder).
  it('m2: Atrás durante la recarga espera: si llega el plano se va sola, y si falla pregunta', async () => {
    const user = userEvent.setup()
    let llega: (p: FloorPlanDto) => void = () => {}
    let falla: (e: unknown) => void = () => {}
    publish.mockRejectedValueOnce(conflicto()).mockRejectedValueOnce(conflicto())
    vi.mocked(getFloorPlan)
      .mockReturnValueOnce(new Promise(resolve => (llega = resolve)))
      .mockReturnValueOnce(new Promise((_, reject) => (falla = reject)))
    const { router } = renderEditor()
    await girarMesa(user)
    await user.click(screen.getByTestId('floor-plan-save'))
    await user.click(await screen.findByTestId('floor-plan-reload'))
    await act(async () => router.navigate(-1))
    expect(screen.queryByText('editor.unsavedTitle')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/plano')
    await act(async () => llega({ ...plan, fingerprint: 'cccccccccccccccc' }))
    expect(await screen.findByText('otra página')).toBeInTheDocument()
    // Otra vuelta, ahora la recarga falla: la salida que esperaba pregunta (el borrador sigue ahí).
    await act(async () => router.navigate(1))
    await girarMesa(user)
    await user.click(screen.getByTestId('floor-plan-save'))
    await user.click(await screen.findByTestId('floor-plan-reload'))
    await act(async () => router.navigate(-1))
    expect(screen.queryByText('editor.unsavedTitle')).not.toBeInTheDocument()
    await act(async () => falla(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' })))
    expect(await screen.findByText('editor.unsavedTitle')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/plano')
  })

  // /full-testing: sin cookie, con el permiso quitado o sin el plan, el aviso traía el texto del servidor en inglés.
  it.each([
    [401, { message: 'No authentication token provided' }, 'editor.sessionExpired'],
    [403, { message: "Permission 'tables:configure' required", required: 'tables:configure' }, 'page.noPermission'],
    [403, { message: 'This venue does not have access to the TABLE_SERVICE feature.', featureCode: 'TABLE_SERVICE' }, 'editor.planLocked'],
    [500, { message: 'Algo salió mal en el servidor' }, 'Algo salió mal en el servidor'],
  ])('un %i al guardar se explica en el idioma del dashboard', async (status, data, description) => {
    const user = userEvent.setup()
    publish.mockRejectedValueOnce(Object.assign(new Error('x'), { isAxiosError: true, response: { status, data } }))
    renderEditor()
    await girarMesa(user)
    await user.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'editor.genericError', description, variant: 'destructive' })))
  })
})
