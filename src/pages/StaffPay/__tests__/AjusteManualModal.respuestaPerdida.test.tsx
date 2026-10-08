// E6a-fix2 D1 [DINERO] (full-testing E6a): el servidor guardaba el ajuste, la respuesta no llegaba, la pantalla decía «Algo
// salió mal» y no releía; el dueño cerraba el modal, veía la tabla sin el ajuste, lo capturaba otra vez y el modal nuevo traía
// OTRA clave: dos ajustes, se pagaba dos veces. Con los hooks REALES y un QueryClient real (sólo el servicio es simulado), y un
// «servidor» de mentira que guarda por clave como el de verdad (misma clave ⇒ devuelve el que ya guardó, `yaExistia`).
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AjusteManualModal } from '../components/AjusteManualModal'
import { olvidarBorradoresEnDuda } from '../llaveDelAjuste'

const m = vi.hoisted(() => ({ add: vi.fn(), toast: vi.fn(), preview: vi.fn(), team: vi.fn(), access: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => d, venueTimezone: 'America/Mexico_City' }) }))
vi.mock('../useNombreSede', () => ({ useNombreSede: () => (id: string) => id }))
vi.mock('@/components/ui/full-screen-modal', () => ({
  FullScreenModal: ({ open, children, actions, onClose }: { open: boolean; children: ReactNode; actions?: ReactNode; onClose: () => void }) =>
    open ? (
      <div>
        <button type="button" onClick={onClose}>
          cerrar-modal
        </button>
        {actions}
        {children}
      </div>
    ) : null,
}))
vi.mock('@/components/search-combobox', () => ({
  SearchCombobox: ({ items, onSelect }: { items: Array<{ id: string; label: string }>; onSelect: (i: unknown) => void }) => (
    <div>
      {items.map(i => (
        <button key={i.id} type="button" onClick={() => onSelect(i)}>
          {i.label}
        </button>
      ))}
    </div>
  ),
}))
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))
vi.mock('@/services/team.service', () => ({ teamService: { getTeamMembers: (...a: unknown[]) => m.team(...a) } }))
vi.mock('@/services/staffPay.service', () => ({
  staffPayService: {
    addAdjustment: (...a: unknown[]) => m.add(...a),
    adjustmentPreview: (...a: unknown[]) => m.preview(...a),
    access: (...a: unknown[]) => m.access(...a),
    report: vi.fn(),
  },
}))

const cliente = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
const abrir = (qc: QueryClient, onOpenChange: (o: boolean) => void = vi.fn()) =>
  render(
    <QueryClientProvider client={qc}>
      <AjusteManualModal open onOpenChange={onOpenChange} sedes={['v1']} fecha="2026-10-08" etiqueta="octubre 2026" />
    </QueryClientProvider>,
  )
const guardar = () => screen.getByRole('button', { name: 'manualAdjust.save' })
async function llenar(monto = '25') {
  fireEvent.click(await screen.findByRole('button', { name: 'Carlos QA' }))
  fireEvent.change(screen.getByLabelText('manualAdjust.amount'), { target: { value: monto } })
  fireEvent.change(screen.getByLabelText('manualAdjust.reason'), { target: { value: 'FULLTEST dup' } })
}
type Cuerpo = { clientKey: string; staffId: string; sede: string; amount: number; reason: string }
/**
 * Guarda por clave, como el servidor: la misma clave devuelve el ajuste que ya guardó (`yaExistia`). `perder` es el número de
 * llamada (1, 2…) cuya respuesta se pierde DESPUÉS de guardar (el servidor sí lo guardó; al navegador no le llega nada).
 */
function servidor(perder: number[] = [1]) {
  const guardados = new Map<string, Cuerpo>()
  let n = 0
  m.add.mockImplementation(async (_venueId: string, b: Cuerpo) => {
    n++
    const yaExistia = guardados.has(b.clientKey)
    if (!yaExistia) guardados.set(b.clientKey, b)
    if (perder.includes(n)) throw new Error('Network Error')
    return { id: `e-${b.clientKey}`, periodId: 'p10', periodo: { start: '2026-10-01', end: '2026-10-31' }, staffId: b.staffId, sede: b.sede, amount: `${b.amount}`, reason: b.reason, yaExistia }
  })
  return guardados
}
const clave = (i: number) => (m.add.mock.calls[i][1] as Cuerpo).clientKey

beforeEach(() => {
  vi.clearAllMocks()
  olvidarBorradoresEnDuda()
  m.team.mockResolvedValue({ data: [{ staffId: 's-carlos', firstName: 'Carlos', lastName: 'QA', email: 'carlos@qa.mx' }], meta: { totalCount: 1, hasNextPage: false } })
  m.preview.mockResolvedValue(undefined)
  m.access.mockResolvedValue({ enabled: true, activado: true, startDate: '2026-09-01', propinasEncendidas: false })
})

describe('ajuste manual con la respuesta perdida (D1)', () => {
  it('🔴 sin respuesta: no se cierra, dice que no sabe si se guardó, y reintentar manda la MISMA clave (un solo ajuste)', async () => {
    const guardados = servidor()
    const onOpenChange = vi.fn()
    abrir(cliente(), onOpenChange)
    await llenar()
    fireEvent.click(guardar())
    expect(await screen.findByText('manualAdjust.uncertain')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(m.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'errors.generic' }))
    await waitFor(() => expect(guardar()).toBeEnabled())
    fireEvent.click(guardar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(clave(1)).toBe(clave(0))
    expect(guardados.size).toBe(1)
    // Se dice que ya estaba: no se presenta como uno nuevo.
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('manualAdjust.alreadySaved') }))
  })

  it('🔴 cerrar el modal y capturar LO MISMO otra vez viaja con la misma clave: el servidor no guarda dos', async () => {
    const guardados = servidor()
    const qc = cliente()
    const primero = abrir(qc)
    await llenar()
    fireEvent.click(guardar())
    await waitFor(() => expect(m.add).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(guardar()).toBeEnabled())
    primero.unmount()
    const onOpenChange = vi.fn()
    abrir(qc, onOpenChange)
    await llenar()
    // El modal nuevo avisa que ese mismo ajuste quedó en duda.
    expect(screen.getByText('manualAdjust.uncertain')).toBeInTheDocument()
    fireEvent.click(guardar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(clave(1)).toBe(clave(0))
    expect(guardados.size).toBe(1)
  })

  it('un ajuste que SÍ se guardó gasta su clave: otro idéntico después es OTRO ajuste, no un reintento', async () => {
    const guardados = servidor([])
    const qc = cliente()
    const onOpenChange = vi.fn()
    const primero = abrir(qc, onOpenChange)
    await llenar()
    fireEvent.click(guardar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    primero.unmount()
    const otro = vi.fn()
    abrir(qc, otro)
    await llenar()
    expect(screen.queryByText('manualAdjust.uncertain')).toBeNull()
    fireEvent.click(guardar())
    await waitFor(() => expect(otro).toHaveBeenCalledWith(false))
    expect(clave(1)).not.toBe(clave(0))
    expect(guardados.size).toBe(2)
  })

  it('la clave en duda no viaja con OTRO borrador (otro monto): ése es otro ajuste', async () => {
    servidor()
    const qc = cliente()
    const primero = abrir(qc)
    await llenar('25')
    fireEvent.click(guardar())
    await waitFor(() => expect(m.add).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(guardar()).toBeEnabled())
    primero.unmount()
    abrir(qc)
    await llenar('30')
    expect(screen.queryByText('manualAdjust.uncertain')).toBeNull()
    fireEvent.click(guardar())
    await waitFor(() => expect(m.add).toHaveBeenCalledTimes(2))
    expect(clave(1)).not.toBe(clave(0))
  })

  it('un rechazo con desenlace (409) saca al borrador de la duda: corregirlo y volver a capturarlo estrena clave', async () => {
    m.add.mockRejectedValueOnce({ response: { status: 409, data: { code: 'PERIODO_CERRADO', message: 'Ese periodo ya está cerrado' } } })
    m.add.mockResolvedValueOnce({ id: 'e1', periodId: 'p', periodo: { start: '2026-10-01', end: '2026-10-31' }, yaExistia: false })
    const qc = cliente()
    const primero = abrir(qc)
    await llenar()
    fireEvent.click(guardar())
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'Ese periodo ya está cerrado', variant: 'destructive' }))
    expect(screen.queryByText('manualAdjust.uncertain')).toBeNull()
    primero.unmount()
    abrir(qc)
    await llenar()
    fireEvent.click(guardar())
    await waitFor(() => expect(m.add).toHaveBeenCalledTimes(2))
    expect(clave(1)).not.toBe(clave(0))
  })
})
