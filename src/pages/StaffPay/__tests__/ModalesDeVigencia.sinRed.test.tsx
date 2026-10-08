// E6a-fix3 C5 (hermanos de «marcar pagado», fase 2): sin red, asignar un nivel o publicar una tabla se queda EN PAUSA y se manda solo
// al volver la red. Cerrar la ventana lo cancela de verdad. La vista previa («cambia el pago de N clases») no escribe y lleva su
// propia llave: no se confunde con el envío. Hooks REALES, QueryClient real y la red apagada con `onlineManager`.
import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AsignarNivelModal } from '../components/AsignarNivelModal'
import { PublicarTablaModal } from '../components/PublicarTablaModal'

const m = vi.hoisted(() => ({ assign: vi.fn(), publish: vi.fn(), toast: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: object) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => d }) }))
vi.mock('@/components/ui/full-screen-modal', () => ({
  FullScreenModal: ({ open, children, actions, onClose }: { open: boolean; children: ReactNode; actions?: ReactNode; onClose: () => void }) =>
    open ? (
      <div>
        <button onClick={onClose}>cerrar-ventana</button>
        {actions}
        {children}
      </div>
    ) : null,
}))
vi.mock('@/services/staffPay.service', () => ({
  staffPayService: {
    assign: (...a: unknown[]) => m.assign(...a),
    publish: (...a: unknown[]) => m.publish(...a),
    periods: async () => ({ items: [], antesDe: null, periodicidad: 'MONTHLY' }),
  },
}))

const REGLAS = { coverBonusHours: null, coverBonusAmount: null, lateCancelHours: null }
const casos = [
  {
    nombre: 'asignar nivel',
    llamada: () => m.assign,
    confirmar: 'assign.confirm',
    fecha: 'assign.effectiveFrom',
    calculando: 'assign.effectLoading',
    pintar: (onOpenChange: () => void) => (
      <AsignarNivelModal open onOpenChange={onOpenChange} staffId="s1" staffName="Ana" payLevelId="hc" payLevelName="Head Coach" hoy="2026-10-03" />
    ),
  },
  {
    nombre: 'publicar tabla',
    llamada: () => m.publish,
    confirmar: 'publish.confirm',
    fecha: 'publish.effectiveFrom',
    calculando: 'publish.effectLoading',
    pintar: (onOpenChange: () => void) => (
      <PublicarTablaModal open onOpenChange={onOpenChange} tableId="t1" maxCount={10} grid={{}} reglas={REGLAS} hoy="2026-10-03" />
    ),
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  m.assign.mockResolvedValue({ clasesQueCambian: 3 })
  m.publish.mockResolvedValue({ clasesQueCambian: 3 })
})
afterEach(() => onlineManager.setOnline(true))

const volverLaRed = () =>
  act(async () => {
    onlineManager.setOnline(true)
    await new Promise(r => setTimeout(r, 50))
  })
const escrituras = (llamada: typeof m.assign) => llamada.mock.calls.filter(c => !(c[c.length - 1] as { simular?: boolean }).simular)

describe.each(casos)('$nombre sin red (C5)', ({ llamada, confirmar, fecha, calculando, pintar }) => {
  const abrirYConfirmarSinRed = async () => {
    const onOpenChange = vi.fn()
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{pintar(onOpenChange)}</QueryClientProvider>)
    // La vista previa se calcula con red; luego se apaga.
    await waitFor(() => expect(llamada()).toHaveBeenCalledTimes(1))
    await screen.findByText(/^vigencia\.effectTotal/)
    const boton = screen.getByRole('button', { name: confirmar })
    await waitFor(() => expect(boton).toBeEnabled())
    onlineManager.setOnline(false)
    fireEvent.click(boton)
    await screen.findByText('offline.willSendSaveClose')
    return onOpenChange
  }

  it('🔴 en pausa dice que se enviará al volver la red, y la ventana se puede cerrar', async () => {
    await abrirYConfirmarSinRed()
    expect(escrituras(llamada())).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'cerrar-ventana' })).toBeEnabled()
  })
  it('🔴 cerrar la ventana en pausa es de verdad: al volver la red NO se guarda', async () => {
    const onOpenChange = await abrirYConfirmarSinRed()
    fireEvent.click(screen.getByRole('button', { name: 'cerrar-ventana' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    await volverLaRed()
    expect(escrituras(llamada())).toHaveLength(0)
  })
  it('🔴 la vista previa en pausa (cambiar la fecha sin red) NO se hace pasar por el envío: ni aviso de «se enviará» ni cierre que cancele nada', async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{pintar(vi.fn())}</QueryClientProvider>)
    await screen.findByText(/^vigencia\.effectTotal/)
    onlineManager.setOnline(false)
    fireEvent.change(screen.getByLabelText(fecha), { target: { value: '2026-10-05' } })
    await new Promise(r => setTimeout(r, 80))
    expect(screen.queryByText('offline.willSendSaveClose')).toBeNull()
  })
  // E6a-fix4: la vista previa en pausa se quedaba diciendo «calculando…» sin fin; ahora dice que se calculará al volver la red.
  it('🔴 cambiar la fecha sin red: la vista previa dice que se calculará al volver la red, y al volver la red se calcula', async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{pintar(vi.fn())}</QueryClientProvider>)
    await screen.findByText(/^vigencia\.effectTotal/)
    onlineManager.setOnline(false)
    fireEvent.change(screen.getByLabelText(fecha), { target: { value: '2026-10-05' } })
    expect(await screen.findByText('offline.willCalculate')).toBeInTheDocument()
    expect(screen.queryByText(calculando)).toBeNull()
    await volverLaRed()
    await waitFor(() => expect(screen.queryByText('offline.willCalculate')).toBeNull())
    expect(await screen.findByText(/^vigencia\.effectTotal/)).toBeInTheDocument()
    const llamadas = llamada().mock.calls
    const ultima = llamadas[llamadas.length - 1]
    expect(ultima[ultima.length - 1]).toEqual(expect.objectContaining({ effectiveFrom: '2026-10-05', simular: true }))
  })
  it('sin cerrar, al volver la red se guarda una vez', async () => {
    await abrirYConfirmarSinRed()
    await volverLaRed()
    await waitFor(() => expect(escrituras(llamada())).toHaveLength(1))
    await waitFor(() => expect(m.toast).toHaveBeenCalled())
  })
})
