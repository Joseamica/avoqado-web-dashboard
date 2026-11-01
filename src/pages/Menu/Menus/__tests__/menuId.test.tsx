/**
 * Editar un menú (menuId.tsx), en lo que toca a «Menú del aparato»:
 *   - el aviso del horario sólo sale si lo GUARDADO tenía la tienda en línea (revisión final I1);
 *   - guardar, prender/apagar y borrar refrescan la pestaña «Qué muestra cada aparato» (Codex DASHBOARD r1 #2).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const svc = vi.hoisted(() => ({
  getMenu: vi.fn(),
  getMenuCategories: vi.fn(),
  updateMenu: vi.fn(),
  deleteMenu: vi.fn(),
}))
vi.mock('@/services/menu.service', () => svc)
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}))

import MenuId from '../menuId'

const AVISO = 'menus.dondeSeUsa.avisoHorario'
const menu = (extra: Record<string, unknown> = {}) => ({
  id: 'm1',
  name: 'Desayunos',
  active: true,
  type: 'REGULAR',
  appliesToDevices: true,
  appliesToOnline: true,
  availableFrom: '08:00',
  availableUntil: '12:00',
  availableDays: ['MON'],
  categories: [],
  ...extra,
})

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidar = vi.spyOn(qc, 'invalidateQueries')
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/menus/m1']}>
        <Routes>
          <Route path="/menus/:menuId" element={<MenuId />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return invalidar
}

const refrescaAparatos = (invalidar: ReturnType<typeof pintar>) => {
  expect(invalidar).toHaveBeenCalledWith({ queryKey: ['device-menus', 'v1'] })
  expect(invalidar).toHaveBeenCalledWith({ queryKey: ['device-menu-options', 'v1'] })
}

beforeEach(() => {
  svc.getMenu.mockResolvedValue(menu())
  svc.getMenuCategories.mockResolvedValue([])
  svc.updateMenu.mockImplementation((_v: string, _id: string, data: Record<string, unknown>) => Promise.resolve(menu(data)))
  svc.deleteMenu.mockResolvedValue(undefined)
})

describe('menuId — Menú del aparato', () => {
  it('un menú que ya era sólo de aparatos no avisa del horario de la tienda en línea', async () => {
    svc.getMenu.mockResolvedValue(menu({ appliesToOnline: false }))
    pintar()
    await screen.findByText('menus.dondeSeUsa.title')
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
  })

  it('si la tienda en línea usaba el horario, al apagarla avisa', async () => {
    const user = userEvent.setup()
    pintar()
    await screen.findByText('menus.dondeSeUsa.title')
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /menus.dondeSeUsa.tiendaEnLinea/ }))
    expect(screen.getByText(AVISO)).toBeInTheDocument()
  })

  it('prender o apagar el menú refresca la pestaña de aparatos', async () => {
    const user = userEvent.setup()
    const invalidar = pintar()
    await screen.findByText('menus.dondeSeUsa.title')
    await user.click(screen.getByRole('switch'))
    await waitFor(() => expect(svc.updateMenu).toHaveBeenCalledWith('v1', 'm1', { active: false }))
    await waitFor(() => refrescaAparatos(invalidar))
  })

  it('guardar el menú refresca la pestaña de aparatos', async () => {
    const user = userEvent.setup()
    const invalidar = pintar()
    await screen.findByText('menus.dondeSeUsa.title')
    await user.click(screen.getByRole('checkbox', { name: /menus.dondeSeUsa.tiendaEnLinea/ }))
    await user.click(screen.getByRole('button', { name: 'menuId.buttons.save' }))
    await waitFor(() => expect(svc.updateMenu).toHaveBeenCalledWith('v1', 'm1', expect.objectContaining({ appliesToOnline: false })))
    await waitFor(() => refrescaAparatos(invalidar))
  })

  it('borrar el menú refresca la pestaña de aparatos', async () => {
    const user = userEvent.setup()
    const invalidar = pintar()
    await screen.findByText('menus.dondeSeUsa.title')
    await user.click(screen.getByRole('button', { name: 'menuId.dialogs.deleteButton' }))
    await user.click(await screen.findByRole('button', { name: 'menuId.dialogs.deleteButton' }))
    await waitFor(() => expect(svc.deleteMenu).toHaveBeenCalledWith('v1', 'm1'))
    await waitFor(() => refrescaAparatos(invalidar))
  })
})
