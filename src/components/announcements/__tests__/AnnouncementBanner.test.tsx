import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/setup'
import type { Announcement } from '@/services/announcement.service'
import { almacenLocalConMemoria } from './almacenLocal'
import { AnnouncementBanner } from '../AnnouncementBanner'
import { AnnouncementGate } from '../AnnouncementGate'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'staff-ana' } }) }))

const anuncio: Announcement = {
  id: 'c0000000000000000000000001',
  title: 'Novedad',
  body: 'Texto',
  priority: 'NORMAL',
  showAsBanner: true,
  showAsModal: true,
}

beforeEach(() => {
  almacenLocalConMemoria()
  server.use(
    http.get('*/api/v1/dashboard/announcements/home', () =>
      HttpResponse.json({ success: true, data: { banner: anuncio, modal: anuncio } })),
    http.post('*/api/v1/dashboard/announcements/:id/dismiss', () => HttpResponse.error()),
  )
})
afterEach(cleanup)

function montar(conVentana = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AnnouncementBanner />
        {conVentana ? <AnnouncementGate /> : null}
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AnnouncementBanner — cierre sin red', () => {
  it('cerrar desde la X del banner sin red no reabre la ventana tras recargar', async () => {
    montar(false)
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar aviso' }))
    await waitFor(() => expect(localStorage.getItem('avoqado:anuncios-cerrados:staff-ana')).toContain(anuncio.id))
    cleanup()
    montar()
    await waitFor(() => expect(screen.queryByText('Novedad')).not.toBeInTheDocument())
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Novedad')).not.toBeInTheDocument()
  })
})
