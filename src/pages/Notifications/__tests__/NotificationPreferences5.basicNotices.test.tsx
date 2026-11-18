import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const svc = vi.hoisted(() => ({ getPreferences: vi.fn(), updatePreferences: vi.fn(), updateManyPreferences: vi.fn() }))
vi.mock('@/services/notification.service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/notification.service')>()
  return {
    ...actual,
    getPreferences: (...a: unknown[]) => svc.getPreferences(...a),
    updatePreferences: (...a: unknown[]) => svc.updatePreferences(...a),
    updateManyPreferences: (...a: unknown[]) => svc.updateManyPreferences(...a),
  }
})
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k, i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import NotificationPreferences5 from '../NotificationPreferences5'

const TIPO = 'SUBSCRIPTION_CANCELLED'
const pintar = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NotificationPreferences5 />
    </QueryClientProvider>,
  )
const fila = () => screen.getByText(`types.${TIPO}`).closest('div[class*="px-4"]') as HTMLElement
const correo = () => within(fila()).getByRole('button', { name: /channelNames\.EMAIL/ })

beforeEach(() => {
  svc.getPreferences.mockReset().mockResolvedValue([])
  svc.updatePreferences.mockReset().mockResolvedValue(undefined)
})

// Plan Básico (R8): «Avisos del fin de tu prueba y de tu plan» — cada cambio manda sus canales explícitos.
describe('preferencias — avisos sin cobro del Plan Básico', () => {
  it('sólo el botón de Correo, sin interruptor del tipo (la campanita siempre queda)', async () => {
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: /categories\.admin/ }))
    expect(correo()).toBeInTheDocument()
    expect(within(fila()).queryByRole('button', { name: /channelNames\.IN_APP/ })).toBeNull()
    expect(within(fila()).queryByRole('switch')).toBeNull()
  })

  it('apagar el correo manda channels [IN_APP]', async () => {
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: /categories\.admin/ }))
    fireEvent.click(correo())
    await waitFor(() => expect(svc.updatePreferences).toHaveBeenCalledWith({ type: TIPO, channels: ['IN_APP'] }, 'v1'))
  })

  it('prenderlo otra vez manda channels [IN_APP, EMAIL]', async () => {
    svc.getPreferences.mockResolvedValue([{ type: TIPO, enabled: true, channels: ['IN_APP'], priority: 'NORMAL' }])
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: /categories\.admin/ }))
    fireEvent.click(correo())
    await waitFor(() => expect(svc.updatePreferences).toHaveBeenCalledWith({ type: TIPO, channels: ['IN_APP', 'EMAIL'] }, 'v1'))
  })
})
