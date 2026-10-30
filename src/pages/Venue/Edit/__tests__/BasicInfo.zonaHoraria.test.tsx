// D5 (30-oct): al guardar otra zona horaria en Configuración, el panel seguía con la anterior hasta recargar, sin decir
// nada. Casi todas las pantallas arman su rango con la zona al abrirse: si la zona guardada no es la que usa el panel, se
// ofrece recargar con un botón. No recarga sola: al terminar un guardado puede caer encima de algo a medio capturar.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BasicInfo from '../BasicInfo'

const h = vi.hoisted(() => ({
  acciones: null as null | { onSave: () => void },
  put: vi.fn(async (_url: string, _body: unknown) => ({ data: {} })),
  toast: vi.fn(),
}))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/api', () => ({
  default: {
    get: async () => ({
      data: {
        id: 'v1',
        name: 'Smoke Shop',
        address: 'Centro',
        city: 'Cancún',
        state: 'Quintana Roo',
        country: 'MX',
        zipCode: '77500',
        type: 'RETAIL_STORE',
        timezone: 'America/Cancun',
        currency: 'MXN',
        settings: {},
      },
    }),
    put: h.put,
    post: async () => ({ data: {} }),
    patch: async () => ({ data: {} }),
  },
}))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', venueSlug: 'cancun', fullBasePath: '/venues/cancun' }),
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ activeVenue: { id: 'v1', timezone: 'America/Cancun' } }) }))
vi.mock('../../VenueEditLayout', () => ({
  useVenueEditActions: () => ({ setActions: (a: { onSave: () => void }) => (h.acciones = a) }),
}))
vi.mock('@/components/address-autocomplete', () => ({ AddressAutocomplete: () => null }))
vi.mock('@/components/timezone-combobox', () => ({
  TimezoneCombobox: ({ onValueChange }: { onValueChange: (v: string) => void }) => (
    <button type="button" onClick={() => onValueChange('America/Tijuana')}>
      zona-tijuana
    </button>
  ),
}))
vi.mock('../components/CashReconciliationSetting', () => ({ CashReconciliationSetting: () => null }))
vi.mock('../components/ExchangesSetting', () => ({ ExchangesSetting: () => null }))
vi.mock('../components/ManagerPinOverrideSetting', () => ({ ManagerPinOverrideSetting: () => null }))

const recargar = vi.fn()
const ubicacionReal = window.location
beforeEach(() => {
  recargar.mockReset()
  h.put.mockClear()
  h.toast.mockClear()
  Object.defineProperty(window, 'location', { configurable: true, value: { ...ubicacionReal, reload: recargar } })
})
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: ubicacionReal })
})

async function abrir() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <BasicInfo />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findByRole('button', { name: 'zona-tijuana' })
}

describe('Guardar la información del local (D5)', () => {
  it('si la zona guardada no es la que usa el panel, avisa con un botón que recarga (no recarga sola)', async () => {
    await abrir()
    await userEvent.click(screen.getByRole('button', { name: 'zona-tijuana' }))
    await act(async () => h.acciones!.onSave())

    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'edit.toast.timezoneReloadPending', duration: Infinity })),
    )
    expect(h.put).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1', expect.objectContaining({ timezone: 'America/Tijuana' }))
    expect(recargar).not.toHaveBeenCalled()

    const aviso = h.toast.mock.calls.find(([a]) => a.title === 'edit.toast.timezoneReloadPending')![0]
    render(aviso.action)
    await userEvent.click(screen.getByText('edit.toast.reload'))
    expect(recargar).toHaveBeenCalledTimes(1)
  })

  it('si la zona es la misma (cambió otro dato), no avisa ni recarga', async () => {
    await abrir()
    await act(async () => h.acciones!.onSave())

    await waitFor(() => expect(h.put).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'edit.toast.updateSuccess' })))
    expect(h.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'edit.toast.timezoneReloadPending' }))
    expect(recargar).not.toHaveBeenCalled()
  })
})
