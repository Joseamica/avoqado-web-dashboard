import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import OrgMigrateTerminalWizard from '@/pages/Organization/components/OrgMigrateTerminalWizard'
import { getOrganizationVenues } from '@/services/organization.service'
import { migrateCancelForOrg, migrateStatusForOrg, type OrgTerminal } from '@/services/organizationDashboard.service'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
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

// El texto EXACTO del server (terminal-migration.service.ts, G4 de F0-A).
const MENSAJE =
  'La orden de borrado venció mientras se cancelaba y otra migración pudo tomar la terminal. Actualiza su estado y vuelve a revisarla.'
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

describe('Asistente de migración de la organización — MIGRATION_NOT_CURRENT (G4)', () => {
  it('cancelar una migración que ya no es la vigente enseña el mensaje del SERVIDOR, no el de axios', async () => {
    vi.mocked(migrateCancelForOrg).mockRejectedValue(
      Object.assign(new Error('Request failed with status code 409'), {
        response: { status: 409, data: { message: MENSAJE, code: 'MIGRATION_NOT_CURRENT' } },
      }),
    )
    const user = userEvent.setup()
    pintar()
    await user.click(await screen.findByRole('button', { name: 'terminals.migrate.cancelMigration' }))
    await user.click(await screen.findByRole('button', { name: 'terminals.migrate.cancelConfirmYes' }))
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({ title: 'terminals.migrate.cancelError', description: MENSAJE, variant: 'destructive' }),
    )
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ description: 'Request failed with status code 409' }))
  })
})
