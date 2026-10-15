/**
 * En el cajón de una terminal del panel de ORGANIZACIÓN, «Borrar de fábrica» y «Editar comercios» son
 * del DUEÑO DE LA ORGANIZACIÓN.
 *
 * El servidor (15-oct) exige en `POST /organizations/:orgId/terminals/:terminalId/command` que
 * FACTORY_RESET y UPDATE_MERCHANT los mande el dueño de la organización: fila ACTIVA de
 * `StaffOrganization` con rol OWNER, o un superadmin. La página entera ya está detrás de
 * `OrganizationLayout`, pero ésa deja pasar a quien es OWNER de UNA sucursal de la org, que no es lo
 * mismo: el botón le daría un 403. Aquí se pregunta lo mismo que el servidor, con la membresía de
 * organización que trae la sesión (`user.organizationMemberships`), igual que `canManageOrganizationCourses`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EffectiveDeviceCapabilities } from '@/services/tpv.service'
import type { OrgTerminal } from '@/services/organizationDashboard.service'
import type { User } from '@/types'
import { TpvCommandType } from '@/types/tpv-commands'
import { OrgTerminalDrawer } from '../OrgTerminalDrawer'

// `mockReset: true` borra los vi.fn() entre pruebas: el estado vive en una variable y la fábrica es una función plana.
let usuario: Partial<User> | null = null

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: usuario }),
}))

vi.mock('@/services/organizationDashboard.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/organizationDashboard.service')>()),
  getOrgTerminalById: () => Promise.resolve(null),
  getOrgAppVersions: () => Promise.resolve([]),
}))

vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatDateTime: (value: string) => value }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es' },
  }),
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const ORG = 'org-1'

const capacidades: EffectiveDeviceCapabilities = {
  requiresActivation: true,
  canManagePaymentConfiguration: true,
  canAcceptTerminalPaymentRequests: false,
  customerDisplay: { presence: 'UNKNOWN', invertibility: 'UNKNOWN', canRequestInversion: false, observedAt: null, stale: true },
  supportedRemoteCommands: [TpvCommandType.RESTART, TpvCommandType.FACTORY_RESET],
}

const terminal: OrgTerminal = {
  id: 'device-1',
  name: 'Caja',
  serialNumber: null,
  type: 'TPV_ANDROID',
  status: 'ACTIVE',
  brand: null,
  model: null,
  version: null,
  lastHeartbeat: null,
  ipAddress: null,
  healthScore: null,
  isLocked: false,
  assignedMerchantIds: [],
  activatedAt: '2026-10-01T00:00:00.000Z',
  activationCode: null,
  activationCodeExpiry: null,
  venue: { id: 'venue-1', name: 'Sucursal', slug: 'sucursal' },
  capabilities: capacidades,
  customerDisplayInverted: false,
  customerDisplayRequest: null,
  selfRegistered: false,
} as OrgTerminal

function membresia(organizationId: string, role: 'OWNER' | 'ADMIN' | 'VIEWER' | 'MEMBER') {
  return { organizationId, organizationName: 'Org', role, masterCatalogVisible: false }
}

function abrirCajon() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <OrgTerminalDrawer
        orgId={ORG}
        terminalId={terminal.id}
        fromCache={terminal}
        onClose={() => undefined}
        onCommand={() => undefined}
        onEditMerchants={() => undefined}
        onMigrate={() => undefined}
      />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByText('terminals.drawer.dangerZone'))
}

const BORRADO = 'terminals.actions.factoryReset'
const COMERCIOS = 'terminals.drawer.merchantsEdit'
// «Migrar a otra sucursal» (ronda 3): el servidor lo exige con requireOrgOwner; la página deja entrar a más gente.
const MIGRAR = 'terminals.actions.migrate'

describe('OrgTerminalDrawer · acciones del dueño de la organización', () => {
  beforeEach(() => {
    usuario = null
  })

  it('el dueño de la organización ve «Borrar de fábrica», «Editar comercios» y «Migrar»', () => {
    usuario = { role: 'ADMIN' as User['role'], organizationMemberships: [membresia(ORG, 'OWNER')] }
    abrirCajon()

    expect(screen.getByText(BORRADO)).toBeInTheDocument()
    expect(screen.getByText(COMERCIOS)).toBeInTheDocument()
    expect(screen.getByText(MIGRAR)).toBeInTheDocument()
  })

  it.each([
    [
      '🔴 el OWNER de una sucursal que NO es dueño de la organización',
      { role: 'OWNER', organizationMemberships: [membresia(ORG, 'MEMBER')] },
    ],
    ['🔴 el ADMIN de la organización', { role: 'ADMIN', organizationMemberships: [membresia(ORG, 'ADMIN')] }],
    ['🔴 el dueño de OTRA organización', { role: 'OWNER', organizationMemberships: [membresia('org-otra', 'OWNER')] }],
    ['🔴 una sesión de un servidor viejo sin membresías (falla cerrado)', { role: 'OWNER' }],
  ])('%s no los ve', (_label, sesion) => {
    usuario = sesion as Partial<User>
    abrirCajon()

    expect(screen.queryByText(BORRADO)).not.toBeInTheDocument()
    expect(screen.queryByText(COMERCIOS)).not.toBeInTheDocument()
    expect(screen.queryByText(MIGRAR)).not.toBeInTheDocument()
    // Lo demás del cajón no cambia.
    expect(screen.getByText('terminals.actions.restart')).toBeInTheDocument()
  })

  it('el superadmin sí los ve', () => {
    usuario = { role: 'SUPERADMIN' as User['role'], organizationMemberships: [] }
    abrirCajon()

    expect(screen.getByText(BORRADO)).toBeInTheDocument()
    expect(screen.getByText(COMERCIOS)).toBeInTheDocument()
    expect(screen.getByText(MIGRAR)).toBeInTheDocument()
  })
})
