import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FloorPlanEditor } from '../FloorPlanEditor'
import { publishFloorPlan } from '@/services/floorPlan.service'
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
  fireEvent.pointerDown(screen.getByTestId(`floor-table-${number}`), { button: 0, pointerId: 1 })
  fireEvent.pointerUp(screen.getByTestId('floor-canvas'), { button: 0, pointerId: 1 })
}

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

  it('un 422 dice qué mesas tienen cuenta abierta; un error que no es de red no se disfraza de «sin conexión»', async () => {
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
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'editor.openOrders:4, 7', variant: 'destructive' })))
    await user.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'editor.genericError', variant: 'destructive' })))
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'editor.offline' }))
  })

  it('sin ninguna área no se puede guardar (los elementos viejos no tendrían dónde vivir)', async () => {
    const user = userEvent.setup()
    renderEditor()
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
})
