/**
 * Pruebas de la ola final (auditoría de Codex y revisión de 15-D). Van aparte para que ningún archivo pase de 500
 * líneas (R25). El editor vive dentro del router de datos, como en la app: así se prueba también la navegación.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FloorPlanEditor } from '../FloorPlanEditor'
import type { FloorPlanDto } from '../model/types'

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
