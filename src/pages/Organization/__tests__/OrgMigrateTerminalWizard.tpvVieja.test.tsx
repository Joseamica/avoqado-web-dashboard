import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import OrgMigrateTerminalWizard from '@/pages/Organization/components/OrgMigrateTerminalWizard'
import { getOrganizationVenues } from '@/services/organization.service'
import { migrateStatusForOrg, type OrgTerminal } from '@/services/organizationDashboard.service'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/services/organization.service', () => ({ getOrganizationVenues: vi.fn() }))
vi.mock('@/services/organizationDashboard.service', () => ({
  getOrgMerchantAccounts: vi.fn(),
  migratePreflightForOrg: vi.fn(),
  migrateExecuteForOrg: vi.fn(),
  migrateStatusForOrg: vi.fn(),
  migrateCancelForOrg: vi.fn(),
  migrateDiscardForOrg: vi.fn(),
}))
vi.mock('@/pages/Organization/components/OrgStaffAccessStep', () => ({ default: () => null }))

const terminal = { id: 'term-1', name: 'Caja PAX', venue: { id: 'venue-a', name: 'Centro' } } as unknown as OrgTerminal

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <OrgMigrateTerminalWizard
        open
        onOpenChange={() => {}}
        orgId="org-1"
        terminal={terminal}
        resumeMigration={{ inProgress: true, commandId: 'cmd-1', fromVenueId: 'venue-a', toVenueId: 'venue-b' }}
      />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getOrganizationVenues).mockResolvedValue([])
  vi.mocked(migrateStatusForOrg).mockResolvedValue({
    commandStatus: 'SENT',
    commandDelivered: false,
    reboundAfterWipe: false,
    currentlyOnline: false,
    onlineUnderNewVenue: false,
    confirmed: false,
    elapsedMs: 1_000,
  })
})

// D1 (3-nov-2026, PlayTelecom TPV 2841653101): una TPV con la app vieja sólo recibe el borrado con alguien dentro de sesión.
// Cuando el asistente se queda esperando, el aviso no puede culpar al internet: dice qué hacer, según si ya le llegó.
const ONCE_MIN = 11 * 60 * 1000

describe('Asistente de migración — aviso de espera para una TPV con la app vieja', () => {
  const estado = (over: Record<string, unknown>) =>
    vi.mocked(migrateStatusForOrg).mockResolvedValue({
      commandStatus: 'PENDING',
      commandDelivered: false,
      reboundAfterWipe: false,
      currentlyOnline: true,
      onlineUnderNewVenue: true,
      confirmed: false,
      elapsedMs: ONCE_MIN,
      ...over,
    })

  it('TPV nueva: el aviso de siempre (encendida y con internet)', async () => {
    estado({ legacyApp: false })
    pintar()
    expect(await screen.findByText('terminals.migrate.timeoutTitle')).toBeInTheDocument()
  })

  it('TPV vieja, borrado todavía cancelable: cancelar, entrar con PIN de la sucursal actual y volver a migrar', async () => {
    estado({ legacyApp: true, commandStatus: 'PENDING', cancellable: true })
    pintar()
    expect(await screen.findByText('terminals.migrate.timeoutTitleLegacy')).toBeInTheDocument()
    expect(screen.getByText('terminals.migrate.timeoutBodyLegacy')).toBeInTheDocument()
    expect(screen.queryByText('terminals.migrate.timeoutTitle')).not.toBeInTheDocument()
  })

  // Codex r3: un SENT del protocolo viejo ya no se cancela aunque `commandDelivered` sea false; el texto no puede pedirlo.
  it.each([
    ['SENT (salió pero no confirmó)', { commandStatus: 'SENT', commandDelivered: false }],
    ['COMPLETED (confirmó antes de borrarse)', { commandStatus: 'COMPLETED', commandDelivered: true }],
  ])('TPV vieja, borrado %s: no manda a cancelar; si ya aparece en la nueva, quedó', async (_caso, over) => {
    estado({ legacyApp: true, cancellable: false, ...over })
    pintar()
    expect(await screen.findByText('terminals.migrate.timeoutTitleLegacyDelivered')).toBeInTheDocument()
    expect(screen.queryByText('terminals.migrate.timeoutBodyLegacy')).not.toBeInTheDocument()
  })
})
