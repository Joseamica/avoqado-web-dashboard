/**
 * El encabezado de la campanita no dice «No hay notificaciones» encima de una lista con avisos (C10, guía de Shopify).
 * Al abrirla se marcan todas como leídas: con el contador en 0, el encabezado decía «No hay notificaciones» mientras la
 * lista enseñaba tres.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const estado = vi.hoisted(() => ({ unreadCount: 0, notifications: [] as Array<Record<string, unknown>> }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { count?: number }) => (o?.count !== undefined ? `${k} ${o.count}` : k) }),
}))
vi.mock('@/context/NotificationContext', () => ({
  useNotificationBadge: () => ({ unreadCount: estado.unreadCount, hasUnread: estado.unreadCount > 0 }),
  useNotifications: () => ({ notifications: estado.notifications, markAsRead: vi.fn(), markAllAsRead: vi.fn(), loading: false }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ fullBasePath: '/venues/demo', venueSlug: 'demo' }) }))
vi.mock('@/services/notification.service', () => ({ formatNotificationTime: () => 'hace 3 min' }))
vi.mock('@/components/announcements/AnnouncementModal', () => ({ AnnouncementModal: () => null }))

import { NotificationBell } from '../NotificationBell'

const aviso = (id: string) => ({
  id,
  title: `Aviso ${id}`,
  message: 'Algo pasó',
  isRead: true,
  priority: 'NORMAL',
  type: 'GENERAL',
  createdAt: '2026-10-09T12:00:00.000Z',
  actionUrl: '/venues/demo/settings/integrations/shopify',
})

async function abrir() {
  render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: /bell/ }))
}

describe('NotificationBell — encabezado', () => {
  it('🔴 con avisos ya leídos dice que están leídos, nunca «No hay notificaciones»', async () => {
    estado.unreadCount = 0
    estado.notifications = [aviso('1'), aviso('2')]
    await abrir()
    expect(await screen.findByText('allRead')).toBeInTheDocument()
    expect(screen.queryByText('none')).toBeNull()
    expect(screen.getByText('Aviso 1')).toBeInTheDocument()
  })

  it('sin avisos sí dice «No hay notificaciones» (encabezado y lista)', async () => {
    estado.unreadCount = 0
    estado.notifications = []
    await abrir()
    expect((await screen.findAllByText('none')).length).toBe(2)
  })

  it('con avisos sin leer dice cuántos', async () => {
    estado.unreadCount = 2
    estado.notifications = [aviso('1'), aviso('2')]
    await abrir()
    expect(await screen.findByText('unread_count 2')).toBeInTheDocument()
  })
})
