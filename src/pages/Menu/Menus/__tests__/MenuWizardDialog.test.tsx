/**
 * Asistente de menú nuevo: un menú nuevo nunca tuvo horario en la tienda en línea, así que no hay nada que avisar al dejarla
 * apagada (revisión final I1: «+ Nuevo menú» desde «Qué muestra cada aparato» nace sin tienda y avisaba desde el paso 1).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const svc = vi.hoisted(() => ({ getMenuCategories: vi.fn(), createMenu: vi.fn() }))
vi.mock('@/services/menu.service', () => svc)
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}))

import { MenuWizardDialog } from '../components/MenuWizardDialog'

const AVISO = 'menus.dondeSeUsa.avisoHorario'

function pintar(defaults?: { appliesToDevices: boolean; appliesToOnline: boolean }) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MenuWizardDialog open onOpenChange={vi.fn()} defaults={defaults} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  svc.getMenuCategories.mockResolvedValue([])
})

describe('MenuWizardDialog — ¿Dónde se usa?', () => {
  it('nacido sólo con Aparatos (desde «Qué muestra cada aparato») no avisa del horario', async () => {
    pintar({ appliesToDevices: true, appliesToOnline: false })
    await screen.findByText('menus.dondeSeUsa.title')
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
  })

  it('apagar la tienda en línea en un menú nuevo no avisa del horario', async () => {
    const user = userEvent.setup()
    pintar()
    await screen.findByText('menus.dondeSeUsa.title')
    await user.click(screen.getByRole('checkbox', { name: /menus.dondeSeUsa.tiendaEnLinea/ }))
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
  })
})

/**
 * El SERVIDOR sólo lee `availableDays` (códigos MON…SUN), `availableFrom` y `availableUntil` (como la edición). El asistente
 * mandaba `menuDays`, que el SERVIDOR tira en silencio: el menú quedaba «siempre disponible» y abría la tienda en línea todo el
 * día (hz D2, 2-nov).
 */
describe('MenuWizardDialog — días y horario', () => {
  async function llegarAlHorario(user: ReturnType<typeof userEvent.setup>) {
    pintar()
    await user.type(await screen.findByPlaceholderText('createMenu.fields.menuNamePlaceholder'), 'D2')
    await user.click(screen.getByRole('button', { name: 'next' }))
    await screen.findByText('createMenu.fields.allDay')
  }

  async function terminar(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'next' }))
    await user.click(await screen.findByRole('button', { name: 'wizard.finish' }))
  }

  beforeEach(() => {
    svc.createMenu.mockReset()
    svc.createMenu.mockResolvedValue({ id: 'm1', name: 'FULLTEST D2' })
  })

  it('Lunes y Miércoles 9:00–19:30 se mandan como los guarda la edición', async () => {
    const user = userEvent.setup()
    await llegarAlHorario(user)
    await user.click(screen.getByRole('button', { name: 'createMenu.days.mon' }))
    await user.click(screen.getByRole('button', { name: 'createMenu.days.wed' }))
    await terminar(user)

    expect(svc.createMenu).toHaveBeenCalledTimes(1)
    const cuerpo = svc.createMenu.mock.calls[0][1]
    expect(cuerpo).toMatchObject({ availableDays: ['MON', 'WED'], availableFrom: '09:00', availableUntil: '19:30' })
    expect(cuerpo).not.toHaveProperty('menuDays')
  })

  it('«todo el día» = los días elegidos y sin horas', async () => {
    const user = userEvent.setup()
    await llegarAlHorario(user)
    await user.click(screen.getByRole('switch'))
    await terminar(user)

    const cuerpo = svc.createMenu.mock.calls[0][1]
    expect(cuerpo).toMatchObject({
      availableDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      availableFrom: null,
      availableUntil: null,
    })
    expect(cuerpo).not.toHaveProperty('menuDays')
  })
})
