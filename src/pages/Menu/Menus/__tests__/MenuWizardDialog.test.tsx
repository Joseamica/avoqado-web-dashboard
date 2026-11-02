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
