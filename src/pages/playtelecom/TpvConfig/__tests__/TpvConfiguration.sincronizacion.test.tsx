/**
 * Spec «pantalla del cliente» §13: el guardado por sucursal ENTREGA su respuesta a la pantalla y la pantalla dice a cuántas
 * terminales llegó. Los hijos pesados se simulan; lo que se prueba es el cableado real `mutationFn → onSuccess → toast`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tpvSettingsService, type VenueTpvSettings } from '@/services/tpv-settings.service'
import { AUTH_STATUS_QUERY_KEY } from '@/services/auth.service'
import { TpvConfiguration } from '../TpvConfiguration'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o && ('count' in o || 'updated' in o) ? `${k} ${JSON.stringify(o)}` : k),
    i18n: { language: 'es' },
  }),
}))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
// Las mismas referencias en cada pintada, como las da AuthContext: un objeto nuevo por pintada reiniciaría el formulario.
const auth = vi.hoisted(() => ({ activeVenue: { id: 'v1', name: 'Tienda', slug: 'tienda' }, user: { role: 'OWNER' } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/useStoresAnalysis', () => ({ useStoresStorePerformance: () => ({ data: undefined }) }))
vi.mock('@/services/stockDashboard.service', () => ({ getItemCategories: async () => ({}) }))
vi.mock('@/services/tpv-messages.service', () => ({ getTpvMessages: async () => ({}) }))
const putApi = vi.hoisted(() => vi.fn(async (_url: string, _body: unknown) => ({ data: {} })))
vi.mock('@/api', () => ({
  default: {
    get: async () => ({ data: {} }),
    post: async () => ({ data: {} }),
    put: putApi,
    patch: async () => ({ data: {} }),
  },
}))
vi.mock('@/components/address-autocomplete', () => ({ AddressAutocomplete: () => null }))
vi.mock('@/components/timezone-combobox', () => ({
  TimezoneCombobox: ({ onValueChange }: { onValueChange: (v: string) => void }) => (
    <>
      <button type="button" onClick={() => onValueChange('America/Tijuana')}>
        zona-tijuana
      </button>
      <button type="button" onClick={() => onValueChange('America/Mexico_City')}>
        zona-cdmx
      </button>
    </>
  ),
}))
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

describe('TpvConfiguration — datos de la tienda (D5)', () => {
  const recargar = vi.fn()
  const ubicacionReal = window.location
  beforeEach(() => {
    recargar.mockReset()
    Object.defineProperty(window, 'location', { configurable: true, value: { ...ubicacionReal, reload: recargar } })
  })
  afterEach(() => Object.defineProperty(window, 'location', { configurable: true, value: ubicacionReal }))

  function abrir() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const invalidar = vi.spyOn(qc, 'invalidateQueries')
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/wl/venues/tienda/tpv-config#general']}>
          <TpvConfiguration />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    return invalidar
  }
  const avisoDeRecarga = expect.objectContaining({
    title: 'playtelecom:tpvConfig.timezoneReloadPending',
    duration: Infinity,
    action: expect.anything(),
  })

  it('con otra zona: avisa «guardado», pide /status y ofrece recargar (no recarga sola: la pantalla tiene pestañas y ajustes)', async () => {
    const invalidar = abrir()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'zona-tijuana' }))
    await user.click(screen.getByRole('button', { name: 'common:saveChanges' }))

    await waitFor(() => expect(toast).toHaveBeenCalledWith(avisoDeRecarga))
    expect(toast).toHaveBeenCalledWith({ title: 'playtelecom:tpvConfig.venueInfoSaved' })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: AUTH_STATUS_QUERY_KEY })
    expect(recargar).not.toHaveBeenCalled()
  })

  it('compara la zona que se ENVIÓ: si la regresas a la de antes mientras guarda, igual ofrece recargar', async () => {
    let responder!: () => void
    putApi.mockImplementationOnce(() => new Promise(r => (responder = () => r({ data: {} }))))
    abrir()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'zona-tijuana' }))
    await user.click(screen.getByRole('button', { name: 'common:saveChanges' }))
    await waitFor(() => expect(putApi).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ timezone: 'America/Tijuana' })))
    await user.click(screen.getByRole('button', { name: 'zona-cdmx' }))
    await act(async () => responder())

    await waitFor(() => expect(toast).toHaveBeenCalledWith(avisoDeRecarga))
  })

  it('si sólo cambió el nombre (misma zona), no ofrece recargar', async () => {
    abrir()
    const user = userEvent.setup()
    await user.type(await screen.findByPlaceholderText('Nombre de la tienda'), ' Centro')
    await user.click(screen.getByRole('button', { name: 'common:saveChanges' }))

    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'playtelecom:tpvConfig.venueInfoSaved' }))
    expect(toast).not.toHaveBeenCalledWith(avisoDeRecarga)
  })
})
