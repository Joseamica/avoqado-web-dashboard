/**
 * Pruebas de la pasada en vivo (design-review + full-testing, 9-oct). Van aparte para que ningún archivo pase de 500
 * líneas (R25). El editor vive dentro del router de datos, como en la app: así se prueba también la navegación.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FloorPlanEditor } from '../FloorPlanEditor'
import { publishFloorPlan } from '@/services/floorPlan.service'
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
})
