// E6a-fix2 C4 (full-testing E6a): el servidor cerró el periodo y la respuesta se perdió; la pantalla decía «Algo salió mal.
// Intenta de nuevo.» con el modal abierto. Ahora dice que no sabe, relee y, si cerró, lo dice. Con los hooks REALES y un
// QueryClient real (sólo el servicio es simulado): la relectura la hace la invalidación del hook, como en la app.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CerrarPeriodoModal } from '../components/CerrarPeriodoModal'

const m = vi.hoisted(() => ({ preview: vi.fn(), close: vi.fn(), toast: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => d }) }))
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
vi.mock('@/services/staffPay.service', () => ({
  staffPayService: {
    closePreview: (...a: unknown[]) => m.preview(...a),
    close: (...a: unknown[]) => m.close(...a),
    sedes: vi.fn(),
  },
}))

const OK = {
  periodo: { id: null, start: '2026-09-01', end: '2026-09-30', venueIds: ['v1'] }, puedeCerrar: true, bloqueos: [], clases: 21, excluidas: 0,
  personas: 7, totalServicios: '6370.00', totalAjustes: '0.00', total: '6370.00', huerfanas: 0, huella: 'h1',
}
const YA_CERRADO = { ...OK, puedeCerrar: false, bloqueos: [{ codigo: 'YA_CERRADO' }] }
const sinRed = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
function diferida<T>() {
  let soltar: (v: T) => void = () => undefined
  let fallar: (e: unknown) => void = () => undefined
  const promesa = new Promise<T>((s, f) => {
    soltar = s
    fallar = f
  })
  return { promesa, soltar, fallar }
}
const abrir = (onOpenChange: (o: boolean) => void = vi.fn()) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <CerrarPeriodoModal open fecha="2026-09-01" etiqueta="septiembre 2026" onOpenChange={onOpenChange} onCerrado={vi.fn()} />
    </QueryClientProvider>,
  )
const cerrar = () => screen.getByRole('button', { name: /close\.confirmNamed/ })

beforeEach(() => vi.clearAllMocks())
afterEach(() => onlineManager.setOnline(true))

describe('cerrar el periodo con la respuesta perdida (C4)', () => {
  it('🔴 dice que no sabe y relee; si el servidor SÍ cerró, lo dice y se cierra el modal', async () => {
    const relectura = diferida<typeof YA_CERRADO>()
    m.preview.mockResolvedValueOnce(OK).mockReturnValueOnce(relectura.promesa)
    m.close.mockRejectedValue(sinRed())
    const onOpenChange = vi.fn()
    abrir(onOpenChange)
    await waitFor(() => expect(cerrar()).toBeEnabled())
    fireEvent.click(cerrar())
    expect(await screen.findByText('close.uncertainChecking')).toBeInTheDocument()
    expect(m.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'errors.generic' }))
    await act(async () => relectura.soltar(YA_CERRADO))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(m.toast).toHaveBeenCalledWith({ title: 'close.uncertainClosed' })
    expect(m.close).toHaveBeenCalledTimes(1)
  })

  it('🔴 si al releer NO se cerró, lo dice y deja volver a intentar con la huella nueva', async () => {
    m.preview.mockResolvedValueOnce(OK).mockResolvedValue({ ...OK, huella: 'h2' })
    m.close.mockRejectedValueOnce(sinRed()).mockResolvedValueOnce({ periodId: 'p9', yaCerrado: false, total: '6370.00' })
    const onOpenChange = vi.fn()
    abrir(onOpenChange)
    await waitFor(() => expect(cerrar()).toBeEnabled())
    fireEvent.click(cerrar())
    expect(await screen.findByText('close.uncertainNotClosed')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    await waitFor(() => expect(cerrar()).toBeEnabled())
    fireEvent.click(cerrar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(m.close).toHaveBeenLastCalledWith('v1', expect.objectContaining({ huellaEsperada: 'h2' }))
  })

  it('🔴 si tampoco hay red para releer, dice que lo revise al volver la conexión; al reintentar y ver que cerró, lo dice', async () => {
    // La vista previa reintenta una vez (`retry: 1`): las dos lecturas fallan.
    m.preview.mockResolvedValueOnce(OK).mockRejectedValueOnce(sinRed()).mockRejectedValueOnce(sinRed()).mockResolvedValue(YA_CERRADO)
    m.close.mockRejectedValue(sinRed())
    const onOpenChange = vi.fn()
    abrir(onOpenChange)
    await waitFor(() => expect(cerrar()).toBeEnabled())
    fireEvent.click(cerrar())
    expect(await screen.findByText('close.uncertainOffline', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'period.retry' }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(m.toast).toHaveBeenCalledWith({ title: 'close.uncertainClosed' })
  })
})

// E6a-fix2 C5: sin red, TanStack deja el cierre EN PAUSA y lo manda solo al volver la red. Se dice; y cerrar la ventana mientras
// está en pausa lo cancela de verdad (la petición nunca salió): al volver la red no se cierra el periodo.
describe('cerrar el periodo sin red (C5)', () => {
  it('🔴 en pausa dice que se enviará al volver la red', async () => {
    m.preview.mockResolvedValue(OK)
    abrir()
    await waitFor(() => expect(cerrar()).toBeEnabled())
    onlineManager.setOnline(false)
    fireEvent.click(cerrar())
    expect(await screen.findByText('offline.willSendClose')).toBeInTheDocument()
    expect(m.close).not.toHaveBeenCalled()
  })

  it('🔴 cerrar la ventana en pausa cancela: al volver la red NO se cierra el periodo', async () => {
    m.preview.mockResolvedValue(OK)
    const onOpenChange = vi.fn()
    abrir(onOpenChange)
    await waitFor(() => expect(cerrar()).toBeEnabled())
    onlineManager.setOnline(false)
    fireEvent.click(cerrar())
    await screen.findByText('offline.willSendClose')
    fireEvent.click(screen.getByRole('button', { name: 'cerrar-modal' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    await act(async () => {
      onlineManager.setOnline(true)
      await new Promise(r => setTimeout(r, 50))
    })
    expect(m.close).not.toHaveBeenCalled()
  })

  it('🔴 si la red se cae justo después de perder la respuesta, la relectura en pausa dice que lo revise al volver la conexión', async () => {
    m.preview.mockResolvedValueOnce(OK).mockResolvedValue(YA_CERRADO)
    m.close.mockImplementation(async () => {
      onlineManager.setOnline(false)
      throw sinRed()
    })
    const onOpenChange = vi.fn()
    abrir(onOpenChange)
    await waitFor(() => expect(cerrar()).toBeEnabled())
    fireEvent.click(cerrar())
    expect(await screen.findByText('close.uncertainOffline')).toBeInTheDocument()
    await act(async () => {
      onlineManager.setOnline(true)
      await new Promise(r => setTimeout(r, 50))
    })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(m.toast).toHaveBeenCalledWith({ title: 'close.uncertainClosed' })
  })
})

// G2 (guía E6c): abrir «Cerrar periodo» YA sin red decía «No se pudo calcular el cierre.» en rojo, con «Reintentar» y sin
// mencionar la red (la vista previa queda EN PAUSA, sin datos ni error). Ahora dice que se calcula al volver la red, sin rojo.
describe('abrir el cierre ya sin red (G2)', () => {
  it('🔴 dice que el cierre se calcula cuando vuelva la red (no un error en rojo), y al volver la red lo calcula', async () => {
    m.preview.mockResolvedValue(OK)
    onlineManager.setOnline(false)
    abrir()
    const aviso = await screen.findByText('offline.willCalculateClose')
    expect(aviso.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByText('close.previewError')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(m.preview).not.toHaveBeenCalled()
    expect(cerrar()).toBeDisabled()
    await act(async () => {
      onlineManager.setOnline(true)
      await new Promise(r => setTimeout(r, 50))
    })
    await waitFor(() => expect(cerrar()).toBeEnabled())
    expect(screen.queryByText('offline.willCalculateClose')).toBeNull()
  })
})
