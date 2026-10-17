import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * «Configuración TPV» de la organización (/organizations/:orgId/org-config): checador, cobro en efectivo/tarjeta,
 * escáner y cambaceo para TODAS las sucursales (`PUT/DELETE org-attendance-config`). Desde el 17-oct sólo los cambia
 * el dueño de la organización; el OWNER de una sola tienda entra a la página, así que aquí se pregunta lo mismo que el
 * servidor (`isOrganizationOwner`). Quien no lo es ve la configuración en sólo lectura y por qué; un 4xx del servidor
 * sale en el toast con su mensaje.
 */

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const auth: { user: any } = { user: null }
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ role: 'OWNER' }) }))
vi.mock('@/hooks/use-current-organization', () => ({ useCurrentOrganization: () => ({ isOwner: true, orgId: 'org-1' }) }))

const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

const CONFIG = {
  attendanceTracking: true,
  requireFacadePhoto: false,
  requireDepositPhoto: false,
  enableCashPayments: true,
  enableCardPayments: true,
  enableBarcodeScanner: true,
  trackPromoterLocation: false,
  expectedCheckInTime: '09:00',
  latenessThresholdMinutes: 30,
  geofenceRadiusMeters: 500,
  promoterLocationStartHour: 11,
  promoterLocationEndHour: 18,
}
let lectura: { data: any; isLoading: boolean; isError: boolean } = { data: CONFIG, isLoading: false, isError: false }
const guardar = vi.fn()
const borrar = vi.fn()
vi.mock('@/hooks/useOrganizationConfig', () => ({
  useOrgAttendanceConfig: () => lectura,
  useUpsertOrgAttendanceConfig: () => ({ mutateAsync: guardar, isPending: false }),
  useDeleteOrgAttendanceConfig: () => ({ mutateAsync: borrar, isPending: false }),
  useOrgPromoterLocationSettings: () => ({ data: [], isLoading: false }),
  useUpdateVenuePromoterLocationSettings: () => ({ mutate: vi.fn(), isPending: false }),
}))

import OrgTpvConfigSection from '@/pages/playtelecom/TpvConfig/components/OrgTpvConfigSection'

const NS = 'playtelecom:tpvConfig.orgTpvConfig'
const DUENO_DE_TIENDA = { role: 'OWNER', organizationMemberships: [{ organizationId: 'org-1', role: 'MEMBER' }] }
const DUENO_DE_LA_ORG = { role: 'OWNER', organizationMemberships: [{ organizationId: 'org-1', role: 'OWNER' }] }
const botonGuardar = () => screen.getByRole('button', { name: new RegExp(`${NS}\\.save$`) })
const botonRestaurar = () => screen.getByRole('button', { name: new RegExp(`${NS}\\.reset$`) })

beforeEach(() => {
  vi.clearAllMocks()
  lectura = { data: CONFIG, isLoading: false, isError: false }
})

describe('configuración TPV/checador de la organización — sólo el dueño de la org la cambia', () => {
  it('🔴 el dueño de UNA tienda la ve en sólo lectura, con el porqué y a quién pedírselo', () => {
    auth.user = DUENO_DE_TIENDA
    render(<OrgTpvConfigSection />)

    expect(screen.getByText(`${NS}.soloDuenoOrg`)).toBeInTheDocument()
    for (const interruptor of screen.getAllByRole('switch')) expect(interruptor).toBeDisabled()
    expect(screen.getByDisplayValue('09:00')).toBeDisabled()
    expect(botonGuardar()).toBeDisabled()
    expect(botonRestaurar()).toBeDisabled()
  })

  it('el dueño de la org la cambia y guarda', async () => {
    auth.user = DUENO_DE_LA_ORG
    guardar.mockResolvedValue({})
    render(<OrgTpvConfigSection />)

    expect(screen.queryByText(`${NS}.soloDuenoOrg`)).toBeNull()
    expect(screen.getAllByRole('switch')[0]).toBeEnabled()
    fireEvent.click(botonGuardar())

    await waitFor(() => expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ enableCardPayments: true })))
  })

  it('🔴 un 4xx del servidor sale en el toast con SU mensaje', async () => {
    auth.user = DUENO_DE_LA_ORG
    guardar.mockRejectedValue({ response: { status: 403, data: { message: 'Sólo el dueño de la organización…' } } })
    render(<OrgTpvConfigSection />)
    fireEvent.click(botonGuardar())

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sólo el dueño de la organización…', variant: 'destructive' })),
    )
  })

  it('regresión: sin respuesta del servidor queda el mensaje genérico', async () => {
    auth.user = DUENO_DE_LA_ORG
    guardar.mockRejectedValue(new Error('Network Error'))
    render(<OrgTpvConfigSection />)
    fireEvent.click(botonGuardar())

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: `${NS}.error` })))
  })

  it('🔴 si la lectura falló, no deja guardar los valores de fábrica encima de los reales', () => {
    auth.user = DUENO_DE_LA_ORG
    lectura = { data: undefined, isLoading: false, isError: true }
    render(<OrgTpvConfigSection />)

    expect(screen.getByText(`${NS}.loadError`)).toBeInTheDocument()
    expect(botonGuardar()).toBeDisabled()
    // Ni siquiera se pintan: unos valores de fábrica en pantalla dirían algo que no es cierto.
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    expect(screen.queryByText(`${NS}.noConfig`)).toBeNull()
  })
})
