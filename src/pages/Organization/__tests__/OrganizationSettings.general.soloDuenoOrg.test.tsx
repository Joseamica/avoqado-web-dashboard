import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Pestaña «General» de /organizations/:orgId/settings (nombre, correo, teléfono, RFC, facturación). Desde la ronda 3
 * el servidor sólo deja cambiar estos datos al dueño de la organización (`PUT /api/v1/organizations/:orgId`), pero la
 * página deja entrar también al OWNER de UNA sucursal. Regla «apagado se ve y se explica»: quien no es dueño de la org
 * ve el formulario en sólo lectura, con el porqué y a quién pedírselo; y un 4xx sale en el toast con su mensaje.
 */

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const auth: { user: any; activeVenue: any } = { user: null, activeVenue: null }
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))

const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

const actualizar = vi.fn()
vi.mock('@/services/organization.service', () => ({
  getOrganization: vi.fn(async () => ({
    id: 'org-1',
    name: 'Org Uno',
    email: 'hola@orguno.mx',
    phone: '5551234567',
    taxId: null,
    billingEmail: null,
  })),
  updateOrganization: (...args: unknown[]) => actualizar(...args),
}))

import OrganizationSettings from '@/pages/Organization/OrganizationSettings'

const DUENO_DE_TIENDA = { role: 'OWNER', organizationMemberships: [{ organizationId: 'org-1', role: 'MEMBER' }] }
const DUENO_DE_LA_ORG = { role: 'OWNER', organizationMemberships: [{ organizationId: 'org-1', role: 'OWNER' }] }

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/organizations/org-1/settings']}>
        <Routes>
          <Route path="/organizations/:orgId/settings" element={<OrganizationSettings />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const campoNombre = () => screen.findByDisplayValue('Org Uno')
const guardar = () => screen.getByRole('button', { name: /settings\.save/ })

beforeEach(() => vi.clearAllMocks())

describe('pestaña General de la organización — sólo el dueño de la org la cambia', () => {
  it('🔴 el dueño de UNA tienda ve los datos en sólo lectura, con el porqué y a quién pedírselo', async () => {
    auth.user = DUENO_DE_TIENDA
    pintar()

    expect(await campoNombre()).toBeDisabled()
    expect(screen.getByText('settings.generalSoloDuenoOrg')).toBeInTheDocument()
    expect(guardar()).toBeDisabled()
  })

  it('el dueño de la org los cambia y guarda (sin la línea de sólo lectura)', async () => {
    auth.user = DUENO_DE_LA_ORG
    actualizar.mockResolvedValue({})
    pintar()

    const nombre = await campoNombre()
    expect(screen.queryByText('settings.generalSoloDuenoOrg')).toBeNull()
    fireEvent.change(nombre, { target: { value: 'Org Uno Nueva' } })
    await waitFor(() => expect(guardar()).toBeEnabled())
    fireEvent.click(guardar())

    await waitFor(() => expect(actualizar).toHaveBeenCalledWith('org-1', expect.objectContaining({ name: 'Org Uno Nueva' })))
  })

  it('🔴 un 4xx del servidor sale en el toast con SU mensaje', async () => {
    auth.user = DUENO_DE_LA_ORG
    actualizar.mockRejectedValue({
      response: { status: 403, data: { message: 'Sólo el dueño de la organización puede cambiar los datos…', code: 'ORG_OWNER_REQUIRED' } },
    })
    pintar()

    fireEvent.change(await campoNombre(), { target: { value: 'Org Uno Nueva' } })
    await waitFor(() => expect(guardar()).toBeEnabled())
    fireEvent.click(guardar())

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Sólo el dueño de la organización puede cambiar los datos…', variant: 'destructive' }),
      ),
    )
  })
})
