/**
 * Spec «pantalla del cliente» §13: el guardado por sucursal ENTREGA su respuesta a la pantalla y la pantalla dice a cuántas
 * terminales llegó. Los hijos pesados se simulan; lo que se prueba es el cableado real `mutationFn → onSuccess → toast`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tpvSettingsService, type VenueTpvSettings } from '@/services/tpv-settings.service'
import { TpvConfiguration } from '../TpvConfiguration'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o && ('count' in o || 'updated' in o) ? `${k} ${JSON.stringify(o)}` : k),
    i18n: { language: 'es' },
  }),
}))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ activeVenue: { id: 'v1', name: 'Tienda', slug: 'tienda' }, user: { role: 'OWNER' } }),
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/useStoresAnalysis', () => ({ useStoresStorePerformance: () => ({ data: undefined }) }))
vi.mock('@/services/stockDashboard.service', () => ({ getItemCategories: async () => ({}) }))
vi.mock('@/services/tpv-messages.service', () => ({ getTpvMessages: async () => ({}) }))
vi.mock('@/api', () => ({
  default: {
    get: async () => ({ data: {} }),
    post: async () => ({ data: {} }),
    put: async () => ({ data: {} }),
    patch: async () => ({ data: {} }),
  },
}))
vi.mock('@/components/address-autocomplete', () => ({ AddressAutocomplete: () => null }))
vi.mock('@/components/timezone-combobox', () => ({ TimezoneCombobox: () => null }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: () => null }))
vi.mock('@/pages/playtelecom/Supervisor/CreateStoreGoalDialog', () => ({ default: () => null }))
vi.mock('../components/OrgCategoryConfigSection', () => ({ default: () => null }))
vi.mock('../components', () => ({
  ModuleToggles: ({ onChange }: { onChange: (k: string, v: boolean) => void }) => (
    <button type="button" onClick={() => onChange('enableCashPayments', false)}>
      cambiar-modulo
    </button>
  ),
  CategoryEditor: () => null,
  PhonePreview: () => null,
  TerminalManagement: () => null,
  MessagesSection: () => null,
  OrgMessagesSection: () => null,
}))
vi.mock('@/services/tpv-settings.service', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/tpv-settings.service')>()
  return { ...real, tpvSettingsService: { ...real.tpvSettingsService, getVenueSettings: vi.fn(), updateVenueSettings: vi.fn() } }
})

const BASE: VenueTpvSettings = {
  attendanceTracking: false,
  trackPromoterLocation: false,
  enableCashPayments: true,
  enableCardPayments: true,
  enableBarcodeScanner: true,
  requireDepositPhoto: false,
  requireFacadePhoto: false,
  expectedCheckInTime: null,
  latenessThresholdMinutes: null,
  geofenceRadiusMeters: null,
  enableSerializedInventory: false,
}

async function guardarYResponder(conteos: { terminalsUpdated?: number; terminalsOmitted?: number }) {
  vi.mocked(tpvSettingsService.updateVenueSettings).mockResolvedValue({ ...BASE, ...conteos })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/wl/venues/tienda/tpv-config#tpv']}>
        <TpvConfiguration />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await user.click(await screen.findByRole('button', { name: 'cambiar-modulo' }))
  await user.click(screen.getByRole('button', { name: 'playtelecom:tpvConfig.saveSync' }))
}

beforeEach(() => {
  toast.mockClear()
  vi.mocked(tpvSettingsService.getVenueSettings).mockResolvedValue({ ...BASE })
})

describe('TpvConfiguration — a cuántas terminales llegó el guardado', () => {
  it('🔴 si NINGUNA terminal recibió el cambio, lo dice fuerte (no «guardado» a secas)', async () => {
    await guardarYResponder({ terminalsUpdated: 0, terminalsOmitted: 2 })
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'playtelecom:tpvConfig.saveResult.noneTitle',
        description: 'playtelecom:tpvConfig.saveResult.none {"count":2}',
      }),
    )
  })
  it('si llegó a todas, dice a cuántas', async () => {
    await guardarYResponder({ terminalsUpdated: 4, terminalsOmitted: 0 })
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: 'playtelecom:tpvConfig.saveResult.title',
        description: 'playtelecom:tpvConfig.saveResult.all {"count":4}',
      }),
    )
  })
})
