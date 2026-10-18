import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Pestaña «TPV» de /organizations/:orgId/settings. Guarda los valores por defecto de TPV de la organización y el
 * servidor los empuja a TODAS las terminales de todas las sucursales; desde el 17-oct sólo los cambia el dueño de la
 * organización (`esDuenoDeEstaOrganizacionOSuperadmin`). La página deja entrar también al OWNER de UNA sucursal, así
 * que aquí se pregunta lo mismo que el servidor (`isOrganizationOwner`): quien no lo es ve los ajustes en sólo lectura
 * y por qué. Y si el servidor contesta un 4xx, el toast dice SU mensaje, no el genérico.
 */

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const auth: { user: any; activeVenue: any } = { user: null, activeVenue: { id: 'venue-a', organizationId: 'org-1' } }
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))

const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

const mutateAsync = vi.fn()
type Lectura = { data: any; isLoading: boolean; isError: boolean; isSuccess: boolean }
const LISTA: Lectura = { data: {}, isLoading: false, isError: false, isSuccess: true }
let lectura: Lectura = LISTA
vi.mock('@/hooks/useStoresAnalysis', () => ({
  useOrgTpvDefaults: () => lectura,
  useOrgTpvStats: () => ({ data: { totalTerminals: 2, venues: [] } }),
  useUpsertOrgTpvDefaults: () => ({ mutateAsync, isPending: false }),
}))

// Los 35 controles no son lo que se prueba aquí: basta ver si les llega `disabled` y poder cambiar uno.
vi.mock('@/components/tpv/TpvSettingsFields', () => ({
  TpvSettingsFields: ({ disabled, onUpdate }: { disabled?: boolean; onUpdate: (u: object) => void }) => (
    <button type="button" data-testid="campos" disabled={!!disabled} onClick={() => onUpdate({ enableCardPayments: false })}>
      campos
    </button>
  ),
}))

import { OrgTpvConfigSection } from '@/pages/Organization/OrganizationSettings'

const DUENO_DE_TIENDA = { role: 'OWNER', organizationMemberships: [{ organizationId: 'org-1', role: 'MEMBER' }] }
const DUENO_DE_LA_ORG = { role: 'OWNER', organizationMemberships: [{ organizationId: 'org-1', role: 'OWNER' }] }
const guardar = () => screen.getByRole('button', { name: /tpvSettings\.saveAndApply/ })

beforeEach(() => {
  vi.clearAllMocks()
  lectura = LISTA
})

describe('pestaña TPV de la organización — sólo el dueño de la org la cambia', () => {
  it('🔴 el dueño de UNA tienda ve los ajustes en sólo lectura, con el porqué y a quién pedírselo', () => {
    auth.user = DUENO_DE_TIENDA
    render(<OrgTpvConfigSection orgId="org-1" />)

    expect(screen.getByText('settings.tpvSoloDuenoOrg')).toBeInTheDocument()
    expect(screen.getByTestId('campos')).toBeDisabled()
    expect(guardar()).toBeDisabled()
  })

  it('el dueño de la org los cambia y guarda (sin la línea de sólo lectura)', async () => {
    auth.user = DUENO_DE_LA_ORG
    mutateAsync.mockResolvedValue({ terminalsUpdated: 2 })
    render(<OrgTpvConfigSection orgId="org-1" />)

    expect(screen.queryByText('settings.tpvSoloDuenoOrg')).toBeNull()
    fireEvent.click(screen.getByTestId('campos'))
    fireEvent.click(guardar())

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ enableCardPayments: false })))
  })

  it('🔴 un 4xx del servidor sale en el toast con SU mensaje', async () => {
    auth.user = DUENO_DE_LA_ORG
    mutateAsync.mockRejectedValue({
      response: { status: 403, data: { message: 'Sólo el dueño de la organización puede cambiar…', code: 'ORG_OWNER_REQUIRED' } },
    })
    render(<OrgTpvConfigSection orgId="org-1" />)
    fireEvent.click(screen.getByTestId('campos'))
    fireEvent.click(guardar())

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Sólo el dueño de la organización puede cambiar…', variant: 'destructive' }),
      ),
    )
  })

  it('regresión: sin respuesta del servidor (red) queda el mensaje genérico', async () => {
    auth.user = DUENO_DE_LA_ORG
    mutateAsync.mockRejectedValue(new Error('Network Error'))
    render(<OrgTpvConfigSection orgId="org-1" />)
    fireEvent.click(screen.getByTestId('campos'))
    fireEvent.click(guardar())

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'tpvSettings.updateError' })))
  })

  it.each([
    ['cargando', { data: undefined, isLoading: true, isError: false, isSuccess: false }],
    // Sin respuesta todavía y sin «cargando» (la consulta aún no arranca): los campos se pintan con valores de fábrica.
    ['sin respuesta todavía', { data: undefined, isLoading: false, isError: false, isSuccess: false }],
  ])('🔴 mientras la lectura no ha respondido (%s) no se edita ni se guarda (Codex, ronda 3)', (_l, pendiente) => {
    auth.user = DUENO_DE_LA_ORG
    lectura = pendiente
    render(<OrgTpvConfigSection orgId="org-1" />)

    screen.queryByTestId('campos') && fireEvent.click(screen.getByTestId('campos'))
    expect(guardar()).toBeDisabled()
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('🔴 si la lectura falló, no deja guardar los valores de fábrica encima de los reales', () => {
    auth.user = DUENO_DE_LA_ORG
    lectura = { data: undefined, isLoading: false, isError: true, isSuccess: false }
    render(<OrgTpvConfigSection orgId="org-1" />)

    expect(screen.getByText('settings.tpvLoadError')).toBeInTheDocument()
    // Ni siquiera se pintan: unos valores de fábrica en pantalla dirían algo que no es cierto.
    expect(screen.queryByTestId('campos')).toBeNull()
    expect(guardar()).toBeDisabled()
  })
})
