// E6a-fix4 C5 (hermano de los envíos de pago al personal): sin red, «Ajustar el pago» de una clase se queda EN PAUSA y se manda
// solo al volver la red. Se dice, y cerrar la ventana lo cancela de verdad. Hooks REALES, QueryClient real y la red apagada con
// `onlineManager`; sólo el servicio es simulado.
import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PagoDeClaseDto } from '@/types/staffPay'
import { AjustePagoClaseModal } from '../components/AjustePagoClaseModal'

const m = vi.hoisted(() => ({ adjust: vi.fn(), toast: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => d }) }))
vi.mock('@/components/ui/full-screen-modal', () => ({
  FullScreenModal: ({ open, children, actions, onClose }: { open: boolean; children: ReactNode; actions?: ReactNode; onClose: () => void }) =>
    open ? (
      <div>
        <button type="button" onClick={onClose}>
          cerrar-ventana
        </button>
        {actions}
        {children}
      </div>
    ) : null,
}))
vi.mock('@/services/staffPay.service', () => ({ staffPayService: { adjustClass: (...a: unknown[]) => m.adjust(...a) } }))

const ACTUAL = {
  classSessionId: 'c1',
  estado: 'OK',
  motivo: null,
  monto: '430.00',
  conteo: 6,
  conteoCalculado: 6,
  maxCount: 10,
  countMode: 'BOOKED',
  staffName: 'Ana',
  payLevelName: 'Coach',
  ajuste: null,
  anclada: false,
} as unknown as PagoDeClaseDto

beforeEach(() => {
  vi.clearAllMocks()
  m.adjust.mockResolvedValue(ACTUAL)
})
afterEach(() => onlineManager.setOnline(true))

const guardarSinRed = async () => {
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <AjustePagoClaseModal sessionId="c1" actual={ACTUAL} modo="monto" onClose={onClose} />
    </QueryClientProvider>,
  )
  fireEvent.change(screen.getByLabelText('adjust.amount'), { target: { value: '500' } })
  fireEvent.change(screen.getByLabelText('adjust.reason'), { target: { value: 'Cubrió una clase' } })
  onlineManager.setOnline(false)
  fireEvent.click(screen.getByRole('button', { name: 'adjust.save' }))
  await screen.findByText('offline.willSendAdjustment')
  return onClose
}
const volverLaRed = () =>
  act(async () => {
    onlineManager.setOnline(true)
    await new Promise(r => setTimeout(r, 50))
  })

describe('ajustar el pago de una clase sin red (C5)', () => {
  it('🔴 en pausa dice que se enviará al volver la red, y la ventana se puede cerrar', async () => {
    await guardarSinRed()
    expect(m.adjust).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'cerrar-ventana' })).toBeEnabled()
  })
  it('🔴 cerrar la ventana en pausa es de verdad: al volver la red NO se guarda', async () => {
    const onClose = await guardarSinRed()
    fireEvent.click(screen.getByRole('button', { name: 'cerrar-ventana' }))
    expect(onClose).toHaveBeenCalled()
    await volverLaRed()
    expect(m.adjust).not.toHaveBeenCalled()
  })
  it('sin cerrar, al volver la red se guarda una vez y la ventana se cierra', async () => {
    const onClose = await guardarSinRed()
    await volverLaRed()
    await waitFor(() => expect(m.adjust).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(m.toast).toHaveBeenCalledWith({ title: 'adjust.saved' })
  })
})
