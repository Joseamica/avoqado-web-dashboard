/** Pruebas de la ronda de arreglo 1 (15-D): aparte para que ningún archivo pase de 500 líneas (R25). */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FloorPlanEditor } from '../FloorPlanEditor'
import { publishFloorPlan } from '@/services/floorPlan.service'
import type { FloorPlanDto } from '../model/types'

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
const mesa1 = { id: 't1', number: '1', capacity: 4, shape: 'SQUARE' as const, rotation: 0, positionX: 0.5, positionY: 0.5, areaId: 'a1', hasOpenOrder: false }
const withTable: FloorPlanDto = { ...withArea, tables: [mesa1] }
const letrero = { id: 'e1', type: 'LABEL' as const, areaId: 'a1', positionX: 0.1, positionY: 0.1, width: null, height: null, rotation: 0, endX: null, endY: null, label: 'Terraza', color: null }
const dosMesas: FloorPlanDto = { ...withArea, tables: [mesa1, { ...mesa1, id: 't2', number: '2', positionX: 0.8 }], elements: [letrero] }

function renderEditor(plan: FloorPlanDto) {
  const onClose = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const { unmount } = render(
    <QueryClientProvider client={qc}>
      <FloorPlanEditor plan={plan} venueId="v1" onClose={onClose} />
    </QueryClientProvider>,
  )
  return { onClose, unmount }
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
const rechazo422 = (numbers: string[]) =>
  Object.assign(new Error('Unprocessable'), {
    isAxiosError: true,
    response: { status: 422, data: { code: 'TABLES_WITH_OPEN_ORDERS', message: 'x', details: { numbers } } },
  })
/** Pone una mesa cuadrada nueva con la paleta (en jsdom el clic cae en la esquina: no hay getScreenCTM). */
async function ponerMesaNueva(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('floor-tool-table:SQUARE'))
  fireEvent.pointerDown(screen.getByTestId('floor-canvas'), { button: 0, pointerId: 1 })
  fireEvent.pointerUp(screen.getByTestId('floor-canvas'), { button: 0, pointerId: 1 })
}

beforeEach(() => {
  vi.clearAllMocks()
  Element.prototype.setPointerCapture = () => {}
})

describe('FloorPlanEditor — ronda de arreglo 1 de la tarea 15-D', () => {
  it('I1: regresar una mesa cuyo número ya tomó una nueva no deja un repetido en silencio: lo dice, no guarda y lleva a la nueva', async () => {
    const user = userEvent.setup()
    publish.mockRejectedValueOnce(rechazo422(['2']))
    renderEditor(dosMesas)
    seleccionarMesa('2')
    await user.keyboard('{Delete}')
    await ponerMesaNueva(user) // la siguiente libre vuelve a ser «2»
    expect(screen.getAllByTestId('floor-table-2')).toHaveLength(1)
    await user.click(screen.getByTestId('floor-plan-save'))
    await user.click(await screen.findByTestId('floor-plan-restore-tables'))
    expect(screen.getAllByTestId('floor-table-2')).toHaveLength(2)
    const aviso = screen.getByTestId('floor-plan-duplicates')
    expect(aviso).toHaveTextContent('duplicates.title:2')
    expect(aviso).toHaveTextContent('duplicates.bodyNew')
    expect(screen.getByTestId('floor-plan-save')).toBeDisabled()
    // «Ver la nueva» selecciona la que NO tiene cuenta; se le cambia el número y se puede guardar.
    await user.click(screen.getByTestId('floor-plan-duplicates-show'))
    expect(screen.queryByTestId('floor-inspector-open-order')).not.toBeInTheDocument()
    const numero = screen.getByTestId('floor-inspector-number')
    await user.clear(numero)
    await user.type(numero, '3{Enter}')
    expect(screen.queryByTestId('floor-plan-duplicates')).not.toBeInTheDocument()
    expect(screen.getByTestId('floor-plan-save')).toBeEnabled()
  })

  it('M3: tras un 422, deshacer regresa la mesa CON su marca de cuenta abierta (Supr ya no la quita)', async () => {
    const user = userEvent.setup()
    publish.mockRejectedValueOnce(rechazo422(['2']))
    renderEditor(dosMesas)
    seleccionarMesa('2')
    await user.keyboard('{Delete}')
    await user.click(screen.getByTestId('floor-plan-save'))
    await screen.findByTestId('floor-plan-open-orders')
    await user.click(screen.getByRole('button', { name: 'editor.undo' }))
    expect(screen.getByTestId('floor-open-order-2')).toBeInTheDocument()
    seleccionarMesa('2')
    await user.keyboard('{Delete}')
    expect(screen.getByTestId('floor-table-2')).toBeInTheDocument()
  })

  it('M1/M2: regresar respeta el tope de mesas; lo que no cupo se queda en el aviso', async () => {
    const user = userEvent.setup()
    publish.mockRejectedValueOnce(rechazo422(['1', '2']))
    renderEditor({ ...dosMesas, elements: [], limits: { areas: 30, tables: 1, elements: 1500 } })
    seleccionarMesa('1')
    fireEvent.pointerDown(screen.getByTestId('floor-table-2'), { button: 0, pointerId: 1, shiftKey: true })
    fireEvent.pointerUp(screen.getByTestId('floor-canvas'), { button: 0, pointerId: 1 })
    await user.keyboard('{Delete}')
    expect(screen.queryAllByTestId(/^floor-table-/)).toHaveLength(0)
    await user.click(screen.getByTestId('floor-plan-save'))
    await user.click(await screen.findByTestId('floor-plan-restore-tables'))
    expect(screen.getAllByTestId(/^floor-table-/)).toHaveLength(1)
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'limits.tables' }))
    expect(screen.getByTestId('floor-plan-open-orders')).toHaveTextContent('openOrders.title:2')
  })

  it('I3: tras tocar un botón con el ratón (p. ej. «+» del zoom), Espacio es la mano del lienzo, no el botón', async () => {
    const user = userEvent.setup()
    renderEditor(withTable)
    await user.click(screen.getByRole('button', { name: 'canvas.zoomIn' }))
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'canvas.zoomIn' }))
    fireEvent.keyDown(document.activeElement ?? document.body, { code: 'Space' })
    expect(screen.getByTestId('floor-canvas').getAttribute('class')).toContain('cursor-grab')
    fireEvent.keyUp(document.activeElement ?? document.body, { code: 'Space' })
  })

  it('M4: salir del campo con un nombre que no sirve regresa el de antes y dice por qué (no queda un campo sin foco)', async () => {
    const user = userEvent.setup()
    renderEditor(withArea)
    await user.dblClick(screen.getByTestId('floor-area-tab-Salón'))
    await user.clear(screen.getByTestId('floor-area-rename'))
    await user.tab()
    expect(screen.queryByTestId('floor-area-rename')).not.toBeInTheDocument()
    expect(screen.getByTestId('floor-area-tab-Salón')).toBeInTheDocument()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'newArea.nameRequired' }))
  })

  it('M6: el Esc de un aviso que sigue a la vista no llama al editor que ya se cerró', async () => {
    const user = userEvent.setup()
    publish.mockResolvedValueOnce({ ...withTable, fingerprint: 'cccccccccccccccc', publicationId: 'p2', replayed: false })
    const { onClose, unmount } = renderEditor(withTable)
    seleccionarMesa('1')
    await user.keyboard('r')
    await user.click(screen.getByTestId('floor-plan-save'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'editor.saved' })))
    const aviso = toast.mock.calls.find(([o]) => o.title === 'editor.saved')?.[0] as { onEscapeKeyDown: (e: KeyboardEvent) => void }
    unmount()
    aviso.onEscapeKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onClose).not.toHaveBeenCalled()
  })
})
