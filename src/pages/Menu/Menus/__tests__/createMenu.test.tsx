/** Crear menú (página): un menú nuevo nunca tuvo horario en la tienda en línea; apagarla no avisa (revisión final I1). */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const svc = vi.hoisted(() => ({ getMenuCategories: vi.fn(() => Promise.resolve([])), createMenu: vi.fn() }))
vi.mock('@/services/menu.service', () => svc)
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

/** Igual que el asistente: el SERVIDOR sólo lee `availableDays`/`availableFrom`/`availableUntil`; `menuDays` se tiraba (hz D2). */
describe('createMenu — días y horario', () => {
  async function pintarConNombre(user: ReturnType<typeof userEvent.setup>) {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <CreateMenu />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await user.type(await screen.findByPlaceholderText('createMenu.fields.menuNamePlaceholder'), 'D2')
  }

  beforeEach(() => {
    svc.createMenu.mockReset()
    svc.createMenu.mockResolvedValue({ id: 'm1', name: 'FULLTEST D2' })
  })

  it('Lunes y Miércoles 9:00–19:30 se mandan como los guarda la edición', async () => {
    const user = userEvent.setup()
    await pintarConNombre(user)
    await user.click(screen.getByRole('button', { name: 'createMenu.days.mon' }))
    await user.click(screen.getByRole('button', { name: 'createMenu.days.wed' }))
    await user.click(screen.getByRole('button', { name: 'createMenu.buttons.save' }))

    await waitFor(() => expect(svc.createMenu).toHaveBeenCalledTimes(1))
    const cuerpo = svc.createMenu.mock.calls[0][1]
    expect(cuerpo).toMatchObject({ availableDays: ['MON', 'WED'], availableFrom: '09:00', availableUntil: '19:30' })
    expect(cuerpo).not.toHaveProperty('menuDays')
  })

  it('«todo el día» = los días elegidos y sin horas', async () => {
    const user = userEvent.setup()
    await pintarConNombre(user)
    await user.click(screen.getByLabelText('createMenu.fields.allDay'))
    await user.click(screen.getByRole('button', { name: 'createMenu.buttons.save' }))

    await waitFor(() => expect(svc.createMenu).toHaveBeenCalledTimes(1))
    const cuerpo = svc.createMenu.mock.calls[0][1]
    expect(cuerpo).toMatchObject({
      availableDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      availableFrom: null,
      availableUntil: null,
    })
    expect(cuerpo).not.toHaveProperty('menuDays')
  })
})
