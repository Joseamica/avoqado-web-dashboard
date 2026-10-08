// E6a-fix3 C5 (hermano de «marcar pagado»): sin red, activar o desactivar una sede se queda EN PAUSA y se manda solo al volver la
// red. Hooks REALES, QueryClient real y la red apagada con `onlineManager`; sólo el servicio es simulado.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ParticipacionSedeDialog } from '../components/ParticipacionSedeDialog'

const m = vi.hoisted(() => ({ activar: vi.fn(), desactivar: vi.fn(), preview: vi.fn(), toast: vi.fn(), onClose: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => d }) }))
vi.mock('@/services/staffPay.service', () => ({
  staffPayService: {
    participationPreview: (...a: unknown[]) => m.preview(...a),
    activateSede: (...a: unknown[]) => m.activar(...a),
    deactivateSede: (...a: unknown[]) => m.desactivar(...a),
  },
}))

const CERO = { clases: { n: 0, total: '0.00', pendientesDeValoracion: 0 }, comisiones: { n: 0, total: '0.00' }, propinas: { n: 0, total: '0.00' } }
const SEDE = {
  venueId: 's1', nombre: 'Norte', zona: 'America/Mexico_City', tienePlan: true, estado: 'SIN_ACTIVAR', desde: null, hasta: null,
  minimo: '2026-10-01', puedeActivar: true, puedeDesactivar: true, fueraEstePeriodo: CERO,
}
const BASE = { fecha: '2026-10-08', minimo: '2026-10-01', maximo: '2026-10-08', zona: 'America/Mexico_City' }

beforeEach(() => {
  vi.clearAllMocks()
  m.activar.mockResolvedValue({ ventana: { venueId: 's1', desde: '2026-10-08', hasta: null } })
  m.desactivar.mockResolvedValue({ ventana: { venueId: 's1', desde: '2026-10-01', hasta: '2026-10-08' } })
})
afterEach(() => onlineManager.setOnline(true))

const confirmarSinRed = async (accion: 'activar' | 'desactivar') => {
  m.preview.mockResolvedValue(
    accion === 'activar' ? { ...BASE, accion, entran: CERO, quedanFuera: CERO } : { ...BASE, accion, dejanDeEntrar: CERO, permanecen: CERO },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <ParticipacionSedeDialog sede={SEDE as never} accion={accion} onClose={m.onClose} />
    </QueryClientProvider>,
  )
  const confirmar = await screen.findByRole('button', { name: /sedes\.dialogo\.confirmar/ })
  await waitFor(() => expect(confirmar).toBeEnabled())
  onlineManager.setOnline(false)
  fireEvent.click(confirmar)
  await screen.findByText('offline.willSendSede')
}
const volverLaRed = () =>
  act(async () => {
    onlineManager.setOnline(true)
    await new Promise(r => setTimeout(r, 50))
  })

describe.each([
  ['activar', () => m.activar],
  ['desactivar', () => m.desactivar],
] as const)('%s una sede sin red (C5)', (accion, llamada) => {
  it('🔴 en pausa dice que se enviará al volver la red, y «Cancelar» sigue disponible', async () => {
    await confirmarSinRed(accion)
    expect(llamada()).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'closed.cancel' })).toBeEnabled()
  })
  it('🔴 cancelar en pausa es de verdad: al volver la red NO cambia la sede', async () => {
    await confirmarSinRed(accion)
    fireEvent.click(screen.getByRole('button', { name: 'closed.cancel' }))
    expect(m.onClose).toHaveBeenCalledTimes(1)
    await volverLaRed()
    expect(llamada()).not.toHaveBeenCalled()
  })
  it('🔴 cerrar con Escape en pausa también lo cancela (no sólo el botón)', async () => {
    await confirmarSinRed(accion)
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(m.onClose).toHaveBeenCalledTimes(1))
    await volverLaRed()
    expect(llamada()).not.toHaveBeenCalled()
  })
  it('sin cancelar, al volver la red se manda una vez', async () => {
    await confirmarSinRed(accion)
    await volverLaRed()
    await waitFor(() => expect(llamada()).toHaveBeenCalledTimes(1))
  })
})

// G2 (hermano): abrir el diálogo de una sede YA sin red dejaba un esqueleto «cargando» para siempre; cambiar la fecha sin red
// dejaba los montos y el botón de la fecha ANTERIOR, encendido. Ahora dice que se calcula al volver la red y no deja confirmar
// una fecha que no se calculó.
describe('la vista previa de una sede sin red (G2)', () => {
  const pintar = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <ParticipacionSedeDialog sede={SEDE as never} accion="activar" onClose={m.onClose} />
      </QueryClientProvider>,
    )
  const confirmar = () => screen.getByRole('button', { name: /sedes\.dialogo\.confirmar/ })
  it('🔴 abierto ya sin red: dice que se calcula al volver la red (no un esqueleto sin fin), y al volver la red trae los montos', async () => {
    m.preview.mockImplementation(async (_v: string, _s: string, _a: string, fecha?: string) => ({ ...BASE, fecha: fecha ?? BASE.fecha, accion: 'activar', entran: CERO, quedanFuera: CERO }))
    onlineManager.setOnline(false)
    pintar()
    expect(await screen.findByText('offline.willCalculate')).toBeInTheDocument()
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
    expect(confirmar()).toBeDisabled()
    expect(m.preview).not.toHaveBeenCalled()
    await volverLaRed()
    await waitFor(() => expect(confirmar()).toBeEnabled())
    expect(screen.queryByText('offline.willCalculate')).toBeNull()
  })
  it('🔴 cambiar la fecha sin red: no deja confirmar con los montos de la fecha anterior; al volver la red calcula la nueva', async () => {
    m.preview.mockImplementation(async (_v: string, _s: string, _a: string, fecha?: string) => ({ ...BASE, fecha: fecha ?? BASE.fecha, accion: 'activar', entran: CERO, quedanFuera: CERO }))
    pintar()
    await waitFor(() => expect(confirmar()).toBeEnabled())
    onlineManager.setOnline(false)
    fireEvent.change(screen.getByLabelText('sedes.dialogo.desde'), { target: { value: '2026-10-05' } })
    expect(await screen.findByText('offline.willCalculate')).toBeInTheDocument()
    expect(confirmar()).toBeDisabled()
    await volverLaRed()
    await waitFor(() => expect(confirmar()).toBeEnabled())
    expect(confirmar()).toHaveTextContent('2026-10-05')
  })
})
