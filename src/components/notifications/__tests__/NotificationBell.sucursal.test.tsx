/**
 * Tocar un aviso de OTRA sucursal abre esa sucursal, no la que está abierta (Codex, apps viejas, 29-oct).
 * Antes: viendo B, el aviso de una reserva de A abría /venues/B/reservations/<id> y no la encontraba.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const estado = vi.hoisted(() => ({ notifications: [] as Array<Record<string, unknown>> }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/context/NotificationContext', () => ({
  useNotificationBadge: () => ({ unreadCount: 1, hasUnread: true }),
  useNotifications: () => ({ notifications: estado.notifications, markAsRead: vi.fn(), markAllAsRead: vi.fn(), loading: false }),
}))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ fullBasePath: '/venues/sucursal-b', venueBasePath: '/venues', venueSlug: 'sucursal-b' }),
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ allVenues: [{ id: 'venue-a', slug: 'sucursal-a' }, { id: 'venue-b', slug: 'sucursal-b' }] }),
}))
vi.mock('@/services/notification.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/notification.service')>()),
  formatNotificationTime: () => 'hace 1 min',
}))
vi.mock('@/components/announcements/AnnouncementModal', () => ({ AnnouncementModal: () => null }))

import { NotificationBell } from '../NotificationBell'

const aviso = (extra: Record<string, unknown>) => ({
  id: 'n1',
  title: 'Corrigieron una llegada',
  message: 'Ana sí llegó',
  isRead: false,
  priority: 'NORMAL',
  createdAt: new Date().toISOString(),
  actionUrl: 'reservations/r1',
  ...extra,
})

const original = window.location
beforeEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: { href: '' } })
})
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: original })
})

async function tocarElAviso() {
  render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button'))
  await userEvent.click(await screen.findByText('Corrigieron una llegada'))
}

describe('Campanita: el aviso abre su sucursal', () => {
  it('aviso de la lista (trae venue.slug) de otra sucursal', async () => {
    estado.notifications = [aviso({ venue: { id: 'venue-a', name: 'A', slug: 'sucursal-a' } })]
    await tocarElAviso()
    expect(window.location.href).toBe('/venues/sucursal-a/reservations/r1')
  })

  it('aviso recién llegado por socket (sólo venueId)', async () => {
    estado.notifications = [aviso({ venueId: 'venue-a' })]
    await tocarElAviso()
    expect(window.location.href).toBe('/venues/sucursal-a/reservations/r1')
  })
})
