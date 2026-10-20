import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const m = vi.hoisted(() => ({ denied: [] as string[], role: 'ADMIN' }))

vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => !m.denied.includes(p), role: m.role }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue-1', fullBasePath: '/venues/taqueria' }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: ({ title }: { title: string }) => <h1>{title}</h1> }))
// Lo que la pestaña real del aviso necesita para montarse (su editor y su servicio tienen sus propias pruebas).
vi.mock('@/services/marketing.service', () => ({ default: { getPrivacyNotice: () => Promise.resolve({ notice: null }) } }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => d }) }))
vi.mock('@/pages/Customers/components/PrivacyNoticeModal', () => ({ PrivacyNoticeModal: () => null }))

import VenueEditLayout, { useVenueEditActions } from '../VenueEditLayout'
import PrivacyNotice from '../Edit/PrivacyNotice'

const pintar = () =>
  render(
    <MemoryRouter initialEntries={['/venues/taqueria/settings/local/basic-info']}>
      <VenueEditLayout />
    </MemoryRouter>,
  )

beforeEach(() => {
  m.denied = []
  m.role = 'ADMIN'
})

describe('VenueEditLayout — pestaña «Aviso de privacidad»', () => {
  it('con marketing:manage se ve la pestaña y lleva a settings/local/privacy', () => {
    pintar()
    expect(screen.getByRole('link', { name: 'edit.nav.privacy' })).toHaveAttribute('href', '/venues/taqueria/settings/local/privacy')
  })

  it('sin marketing:manage no se ve (la ruta tampoco lo dejaría pasar)', () => {
    m.denied = ['marketing:manage']
    pintar()
    expect(screen.queryByRole('link', { name: 'edit.nav.privacy' })).toBeNull()
    expect(screen.getByRole('link', { name: 'edit.nav.basicInfo' })).toBeInTheDocument()
  })
})

/** Una pestaña hermana como «Información básica»: deja sus botones en la cabecera compartida y no los quita al salir. */
function PestanaConGuardar() {
  const { setActions } = useVenueEditActions()
  useEffect(() => {
    setActions({ onSave: () => {}, isDirty: true, canEdit: true })
  }, [setActions])
  return <p>PESTANA_ANTERIOR</p>
}

describe('VenueEditLayout — la cabecera al pasar a «Aviso de privacidad»', () => {
  it('🔴 el «Guardar» de la pestaña anterior no se queda en la cabecera del aviso (no guardaría nada de aquí)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/venues/taqueria/settings/local/basic-info']}>
          <Routes>
            <Route path="/venues/taqueria/settings/local" element={<VenueEditLayout />}>
              <Route path="basic-info" element={<PestanaConGuardar />} />
              <Route path="privacy" element={<PrivacyNotice />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('button', { name: 'edit.save' })).toBeEnabled()
    await userEvent.click(screen.getByRole('link', { name: 'edit.nav.privacy' }))
    expect(await screen.findByText('edit.privacy.title')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'edit.save' })).toBeNull())
  })
})
