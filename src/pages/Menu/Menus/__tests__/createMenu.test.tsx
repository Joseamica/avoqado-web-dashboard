/** Crear menú (página): un menú nuevo nunca tuvo horario en la tienda en línea; apagarla no avisa (revisión final I1). */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/menu.service', () => ({ getMenuCategories: vi.fn(() => Promise.resolve([])), createMenu: vi.fn() }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}))

import CreateMenu from '../createMenu'

describe('createMenu — ¿Dónde se usa?', () => {
  it('apagar la tienda en línea en un menú nuevo no avisa del horario', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <CreateMenu />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await screen.findByText('menus.dondeSeUsa.title')
    await user.click(screen.getByRole('checkbox', { name: /menus.dondeSeUsa.tiendaEnLinea/ }))
    expect(screen.queryByText('menus.dondeSeUsa.avisoHorario')).not.toBeInTheDocument()
  })
})
