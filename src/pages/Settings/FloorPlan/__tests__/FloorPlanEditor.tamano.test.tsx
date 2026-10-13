/**
 * Tamaño libre de la mesa en el inspector (spec 2026-10-12): + y − en cuadros, «Automático (por personas)» y lo que viaja
 * en el PUT. Va aparte para que ningún archivo de pruebas pase de 500 líneas (R25).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FloorPlanEditor } from '../FloorPlanEditor'
import { publishFloorPlan } from '@/services/floorPlan.service'
import type { FloorPlanDto, FloorPlanTableDto } from '../model/types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o?.number ? `${key}:${o.number}` : key) }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/services/floorPlan.service', () => ({ getFloorPlan: vi.fn(), publishFloorPlan: vi.fn() }))
// Radix Select necesita pointer capture, que jsdom no tiene: un <select> nativo.
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))

const publish = vi.mocked(publishFloorPlan)
const plan = (mesa: Partial<FloorPlanTableDto> = {}): FloorPlanDto => ({
  fingerprint: 'aaaaaaaaaaaaaaaa',
  areas: [{ id: 'a1', name: 'Salón', floorShape: 'WIDE', sortOrder: 0, externalId: null }],
  tables: [{ id: 't1', number: '1', capacity: 4, shape: 'RECTANGLE', rotation: 0, positionX: 0.5, positionY: 0.5, areaId: 'a1', hasOpenOrder: false, ...mesa }],
  elements: [],
  limits: { areas: 30, tables: 500, elements: 1500 },
  overLimit: false,
})

/** Seleccionar en el lienzo: jsdom no tiene `getScreenCTM`, pero el clic sobre una pieza sí la elige. */
function seleccionar(testId: string) {
  fireEvent.pointerDown(screen.getByTestId(testId), { button: 0, pointerId: 1 })
  fireEvent.pointerUp(screen.getByTestId('floor-canvas'), { button: 0, pointerId: 1 })
}

function renderEditor(p: FloorPlanDto) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter(
    [
      {
        path: '/plano',
        element: (
          <QueryClientProvider client={qc}>
            <FloorPlanEditor plan={p} venueId="v1" onClose={vi.fn()} />
          </QueryClientProvider>
        ),
      },
    ],
    { initialEntries: ['/plano'] },
  )
  render(<RouterProvider router={router} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  Element.prototype.setPointerCapture = () => {}
})

describe('FloorPlanEditor — tamaño libre de la mesa', () => {
  it('la larga de 4 enseña Ancho 6 y Alto 4; con − queda en 5, aparece «Automático» y al tocarlo vuelve a 6', async () => {
    const user = userEvent.setup()
    renderEditor(plan())
    seleccionar('floor-table-1')
    const ancho = screen.getByTestId('floor-inspector-width')
    expect(ancho).toHaveTextContent('6')
    expect(screen.getByTestId('floor-inspector-height')).toHaveTextContent('4')
    expect(screen.queryByTestId('floor-inspector-size-auto')).not.toBeInTheDocument()
    await user.click(within(ancho).getByRole('button', { name: 'inspector.decreaseWidth' }))
    expect(screen.getByTestId('floor-inspector-width')).toHaveTextContent('5')
    await user.click(screen.getByTestId('floor-inspector-size-auto'))
    expect(screen.getByTestId('floor-inspector-width')).toHaveTextContent('6')
    expect(screen.queryByTestId('floor-inspector-size-auto')).not.toBeInTheDocument()
  })

  it('redonda: un solo control «Tamaño»; cambiar la forma quita el tamaño propio', async () => {
    const user = userEvent.setup()
    renderEditor(plan({ shape: 'ROUND' }))
    seleccionar('floor-table-1')
    expect(screen.queryByTestId('floor-inspector-width')).not.toBeInTheDocument()
    const tamano = screen.getByTestId('floor-inspector-size')
    expect(tamano).toHaveTextContent('4')
    await user.click(within(tamano).getByRole('button', { name: 'inspector.increaseSize' }))
    expect(screen.getByTestId('floor-inspector-size')).toHaveTextContent('5')
    await user.click(within(screen.getByTestId('floor-plan-inspector')).getByRole('button', { name: 'tools.TABLE_SQUARE' }))
    expect(screen.getByTestId('floor-inspector-size')).toHaveTextContent('4')
    expect(screen.queryByTestId('floor-inspector-size-auto')).not.toBeInTheDocument()
  })

  it('el PUT lleva el tamaño normalizado a SU área', async () => {
    const user = userEvent.setup()
    const p = plan()
    publish.mockResolvedValueOnce({ ...p, fingerprint: 'bbbbbbbbbbbbbbbb', publicationId: 'p1', replayed: false })
    renderEditor(p)
    seleccionar('floor-table-1')
    await user.click(within(screen.getByTestId('floor-inspector-width')).getByRole('button', { name: 'inspector.decreaseWidth' }))
    await user.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1))
    // Salón es ancha (40 × 25): 5 / 40 y 4 / 25.
    expect(publish.mock.calls[0][1].tables[0]).toMatchObject({ id: 't1', width: 0.125, height: 0.16 })
  })

  it('una mesa que se manda a «Sin acomodar» ya no enseña tamaño ni «Automático»', async () => {
    const user = userEvent.setup()
    renderEditor(plan())
    seleccionar('floor-table-1')
    await user.click(within(screen.getByTestId('floor-inspector-width')).getByRole('button', { name: 'inspector.decreaseWidth' }))
    expect(screen.getByTestId('floor-inspector-size-auto')).toBeInTheDocument()
    await user.selectOptions(within(screen.getByTestId('floor-plan-inspector')).getByRole('combobox'), '__unplaced')
    expect(screen.getByTestId('floor-plan-inspector')).toBeInTheDocument()
    for (const id of ['floor-inspector-width', 'floor-inspector-height', 'floor-inspector-size', 'floor-inspector-size-auto']) {
      expect(screen.queryByTestId(id)).not.toBeInTheDocument()
    }
  })

  // Ola final F1 y F2
  it('«+»/«−» se apagan cuando el siguiente tamaño no cabe con la mesa girada', () => {
    // 25 × 10 girada 90° en un área ancha (40 × 25): ocupa 10 de ancho × 25 de alto, el área entera de alto.
    renderEditor(plan({ rotation: 90, width: 0.625, height: 0.4 }))
    seleccionar('floor-table-1')
    const ancho = screen.getByTestId('floor-inspector-width')
    expect(within(ancho).getByRole('button', { name: 'inspector.increaseWidth' })).toBeDisabled()
    expect(within(ancho).getByRole('button', { name: 'inspector.decreaseWidth' })).toBeEnabled()
    const alto = screen.getByTestId('floor-inspector-height')
    expect(within(alto).getByRole('button', { name: 'inspector.increaseHeight' })).toBeEnabled()
    expect(within(alto).getByRole('button', { name: 'inspector.decreaseHeight' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /inspector.rotateBy/ })).toBeEnabled()
  })

  it('una mesa girada que no cabe: sus dos botones apagados; «Girar» sigue (a 180° sí cabe) y «Automático» también', () => {
    renderEditor(plan({ rotation: 45, width: 1, height: 1 }))
    seleccionar('floor-table-1')
    const ancho = screen.getByTestId('floor-inspector-width')
    expect(within(ancho).getByRole('button', { name: 'inspector.increaseWidth' })).toBeDisabled()
    expect(within(ancho).getByRole('button', { name: 'inspector.decreaseWidth' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /inspector.rotateBy/ })).toBeEnabled()
    expect(screen.getByTestId('floor-inspector-size-auto')).toBeEnabled()
  })
})
