/**
 * Pruebas de la ola final (auditoría de Codex y revisión de 15-D). Van aparte para que ningún archivo pase de 500
 * líneas (R25). El editor vive dentro del router de datos, como en la app: así se prueba también la navegación.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
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
