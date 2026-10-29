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

const NUEVOS = ['RESERVATION_NO_SHOW_SUMMARY', 'RESERVATION_NEEDS_REVIEW']

const pintar = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <NotificationPreferences5 />
    </QueryClientProvider>,
  )
}
const abrir = async (categoria: string) => {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`categories\\.${categoria}`) }))
}
/** La fila de un tipo: el contenedor que trae su nombre, su descripción, su interruptor y sus botones de canal. */
const fila = (tipo: string) => screen.getByText(`types.${tipo}`).closest('div[class*="px-4"]') as HTMLElement

beforeEach(() => {
  svc.getPreferences.mockResolvedValue([])
  svc.updatePreferences.mockResolvedValue(undefined)
  svc.updateManyPreferences.mockResolvedValue(undefined)
})

describe('preferencias de notificación — los avisos de «No Show» sólo dejan elegir el correo', () => {
  it.each(NUEVOS)('%s: sólo el botón de Correo; sin Web y sin el interruptor del tipo', async tipo => {
    pintar()
    await abrir('reservations')

    const f = fila(tipo)
    expect(within(f).getByRole('button', { name: /channelNames\.EMAIL/ })).toBeInTheDocument()
    expect(within(f).queryByRole('button', { name: /channelNames\.IN_APP/ })).toBeNull()
    expect(within(f).queryByRole('switch')).toBeNull()
  })

  it('los demás tipos siguen igual: interruptor y los dos canales', async () => {
    pintar()
    await abrir('orders')

    const f = fila('NEW_ORDER')
    expect(within(f).getByRole('switch')).toBeInTheDocument()
    expect(within(f).getByRole('button', { name: /channelNames\.IN_APP/ })).toBeInTheDocument()
    expect(within(f).getByRole('button', { name: /channelNames\.EMAIL/ })).toBeInTheDocument()
  })

  it('apagar el correo de un aviso nuevo deja la campanita (canales = [IN_APP])', async () => {
    pintar()
    await abrir('reservations')

    fireEvent.click(within(fila('RESERVATION_NO_SHOW_SUMMARY')).getByRole('button', { name: /channelNames\.EMAIL/ }))

    await waitFor(() => expect(svc.updatePreferences).toHaveBeenCalledWith({ type: 'RESERVATION_NO_SHOW_SUMMARY', channels: ['IN_APP'] }, 'v1'))
  })

  it('el interruptor general de Web NO toca los avisos nuevos (no se puede apagar su campanita)', async () => {
    pintar()
    await screen.findByText('channels')

    // Los dos primeros interruptores son los generales: Web y Correo.
    fireEvent.click(screen.getAllByRole('switch')[0])
    fireEvent.click(await screen.findByRole('button', { name: 'disable' }))

    await waitFor(() => expect(svc.updateManyPreferences).toHaveBeenCalled())
    const cambios = svc.updateManyPreferences.mock.calls[0][0] as { type: string; channels: string[] }[]
    expect(cambios.length).toBeGreaterThan(0)
    for (const tipo of NUEVOS) expect(cambios.map(c => c.type)).not.toContain(tipo)
  })

  it('el interruptor general de Correo SÍ alcanza a los avisos nuevos y les deja la campanita', async () => {
    pintar()
    await screen.findByText('channels')

    fireEvent.click(screen.getAllByRole('switch')[1])
    fireEvent.click(await screen.findByRole('button', { name: 'disable' }))

    await waitFor(() => expect(svc.updateManyPreferences).toHaveBeenCalled())
    const cambios = svc.updateManyPreferences.mock.calls[0][0] as { type: string; channels: string[] }[]
    for (const tipo of NUEVOS) expect(cambios.find(c => c.type === tipo)?.channels).toEqual(['IN_APP'])
  })
})
