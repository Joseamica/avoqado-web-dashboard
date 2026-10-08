// E6a-fix3 C5 (hermano de «marcar pagado»): sin red, TanStack deja el cambio de propinas EN PAUSA y lo manda solo al volver la red;
// el diálogo se congelaba con «Cancelar» apagado y sin decir nada. Hooks REALES, QueryClient real y la red apagada con `onlineManager`.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InterruptorPropinas } from '../components/InterruptorPropinas'

const m = vi.hoisted(() => ({ setTips: vi.fn(), toast: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/services/staffPay.service', () => ({ staffPayService: { setTips: (...a: unknown[]) => m.setTips(...a) } }))

beforeEach(() => {
  vi.clearAllMocks()
  m.setTips.mockResolvedValue({ encendidas: true })
})
afterEach(() => onlineManager.setOnline(true))

const abrirYConfirmarSinRed = async () => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <InterruptorPropinas encendidas={false} />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole('switch'))
  const confirmar = await screen.findByRole('button', { name: 'tips.onConfirm' })
  onlineManager.setOnline(false)
  fireEvent.click(confirmar)
  await screen.findByText('offline.willSendTips')
}
const volverLaRed = () =>
  act(async () => {
    onlineManager.setOnline(true)
    await new Promise(r => setTimeout(r, 50))
  })

describe('propinas sin red (C5)', () => {
  it('🔴 en pausa dice que se enviará al volver la red, y «Cancelar» sigue disponible', async () => {
    await abrirYConfirmarSinRed()
    expect(m.setTips).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'closed.cancel' })).toBeEnabled()
  })
  it('🔴 cancelar en pausa es de verdad: al volver la red NO se cambia, y se puede volver a intentar', async () => {
    await abrirYConfirmarSinRed()
    fireEvent.click(screen.getByRole('button', { name: 'closed.cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await volverLaRed()
    expect(m.setTips).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('switch'))
    fireEvent.click(await screen.findByRole('button', { name: 'tips.onConfirm' }))
    await waitFor(() => expect(m.setTips).toHaveBeenCalledTimes(1))
  })
  it('sin cancelar, al volver la red se manda una vez', async () => {
    await abrirYConfirmarSinRed()
    await volverLaRed()
    await waitFor(() => expect(m.setTips).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'tips.turnedOn' }))
  })
})
