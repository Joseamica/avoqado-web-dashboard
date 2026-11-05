import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const svc = vi.hoisted(() => ({
  getPreferences: vi.fn(),
  updateManyPreferences: vi.fn(),
  getAnnouncementEmailPreference: vi.fn(),
  setAnnouncementEmailPreference: vi.fn(),
}))
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/services/notification.service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/notification.service')>()
  return {
    ...actual,
    getPreferences: (...a: unknown[]) => svc.getPreferences(...a),
    updateManyPreferences: (...a: unknown[]) => svc.updateManyPreferences(...a),
    getAnnouncementEmailPreference: (...a: unknown[]) => svc.getAnnouncementEmailPreference(...a),
    setAnnouncementEmailPreference: (...a: unknown[]) => svc.setAnnouncementEmailPreference(...a),
  }
})
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k, i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

import NotificationPreferences5 from '../NotificationPreferences5'

const pintar = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <NotificationPreferences5 />
    </QueryClientProvider>,
  )
}
const interruptor = () => screen.getByRole('switch', { name: 'fromAvoqado.emailAnnouncements' })

beforeEach(() => {
  toast.mockReset()
  svc.getPreferences.mockResolvedValue([])
  svc.updateManyPreferences.mockResolvedValue(undefined)
  svc.getAnnouncementEmailPreference.mockResolvedValue({ enabled: true })
  svc.setAnnouncementEmailPreference.mockResolvedValue({ enabled: false })
})

describe('preferencias: sección «De Avoqado»', () => {
  it('mientras carga va deshabilitado y luego refleja enabled', async () => {
    let resolver: (v: { enabled: boolean }) => void = () => {}
    svc.getAnnouncementEmailPreference.mockReturnValue(new Promise(r => (resolver = r)))
    pintar()
    expect(await screen.findByRole('switch', { name: 'fromAvoqado.emailAnnouncements' })).toBeDisabled()
    resolver({ enabled: false })
    await screen.findByRole('switch', { name: 'fromAvoqado.emailAnnouncements' })
    await waitFor(() => expect(interruptor()).toBeEnabled())
    expect(interruptor()).toHaveAttribute('aria-checked', 'false')
  })

  it('cambiarlo llama PUT con enabled:false', async () => {
    pintar()
    await screen.findByRole('switch', { name: 'fromAvoqado.emailAnnouncements' })
    await waitFor(() => expect(interruptor()).toBeEnabled())
    expect(interruptor()).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(interruptor())
    await waitFor(() => expect(svc.setAnnouncementEmailPreference).toHaveBeenCalledWith(false))
  })

  it('si el PUT falla, regresa a su valor y avisa del error', async () => {
    svc.setAnnouncementEmailPreference.mockRejectedValue(new Error('boom'))
    pintar()
    await screen.findByRole('switch', { name: 'fromAvoqado.emailAnnouncements' })
    await waitFor(() => expect(interruptor()).toBeEnabled())
    fireEvent.click(interruptor())
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })))
    await waitFor(() => expect(interruptor()).toHaveAttribute('aria-checked', 'true'))
  })

  it('el interruptor general de correo no llama al de anuncios', async () => {
    pintar()
    await screen.findByRole('switch', { name: 'fromAvoqado.emailAnnouncements' })
    await waitFor(() => expect(interruptor()).toBeEnabled())
    const generales = screen.getAllByRole('switch').filter(s => s !== interruptor())
    fireEvent.click(generales[1])
    fireEvent.click(await screen.findByRole('button', { name: 'disable' }))
    await waitFor(() => expect(svc.updateManyPreferences).toHaveBeenCalled())
    expect(svc.setAnnouncementEmailPreference).not.toHaveBeenCalled()
  })
})
