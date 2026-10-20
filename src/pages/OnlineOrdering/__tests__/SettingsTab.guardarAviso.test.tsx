import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Con el editor del aviso DE VERDAD (no el doble de `SettingsTab.test.tsx`): la revisión en el navegador (20-oct) encontró que
 * tras «Guardar aviso» el editor se quedaba abierto y la lista de pasos no cambiaba hasta cerrarlo con la X.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, string>) => (o ? `${key}|${Object.values(o).join(',')}` : key) }),
}))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'venue-1', venueSlug: 'taqueria', fullBasePath: '/venues/taqueria' }),
}))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatTime: (d: string) => d, formatDate: (d: string) => d }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true, canAny: () => true, canAll: () => true, role: 'ADMIN' }) }))
vi.mock('@/pages/Reservations/components/OperatingHoursEditor', () => ({ OperatingHoursEditor: () => null }))
vi.mock('qrcode.react', () => ({ QRCodeCanvas: () => null }))

const getSettings = vi.fn()
vi.mock('@/services/onlineOrdering.service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/onlineOrdering.service')>()
  return { ...actual, getSettings: (...a: unknown[]) => getSettings(...a), updateSettings: vi.fn() }
})
const getPrivacyNotice = vi.fn()
const updatePrivacyNotice = vi.fn()
vi.mock('@/services/marketing.service', () => ({
  default: {
    getPrivacyNotice: (...a: unknown[]) => getPrivacyNotice(...a),
    updatePrivacyNotice: (...a: unknown[]) => updatePrivacyNotice(...a),
  },
}))

import { SettingsTab } from '../components/SettingsTab'

const settings = (privacyNotice: boolean) => ({
  enabled: false,
  minOrderAmount: 50,
  defaultPrepMinutes: 20,
  acceptsPayAtPickup: true,
  manualPause: false,
  pausedUntil: null,
  hours: null,
  lastInboxPollAt: null,
  store: { status: 'DISABLED', reason: 'NOT_ENABLED', pausedUntil: null, manualPause: false },
  requirements: { address: true, phone: true, privacyNotice },
})
const plantilla = {
  id: null,
  content: null,
  draftContent: 'Propuesta del aviso',
  contentHash: null,
  language: 'es',
  createdAt: null,
  esPlantilla: true,
}

beforeEach(() => {
  getSettings.mockReset()
  getPrivacyNotice.mockReset()
  updatePrivacyNotice.mockReset()
})

describe('SettingsTab + el editor real del aviso', () => {
  it('🔴 al guardar el aviso desde Pedidos en línea, el editor se cierra solo y la lista dice «Todo listo» con el foco en ella', async () => {
    getSettings.mockResolvedValueOnce(settings(false)).mockResolvedValue(settings(true))
    getPrivacyNotice.mockResolvedValue({ notice: plantilla })
    updatePrivacyNotice.mockResolvedValue({ notice: { ...plantilla, id: 'n1', content: 'Propuesta del aviso', esPlantilla: false } })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <SettingsTab />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'settings.requirements.privacyNotice.action' }))
    const texto = await screen.findByTestId('privacy-notice-textarea')
    await waitFor(() => expect(texto).toHaveValue('Propuesta del aviso'))
    await userEvent.click(screen.getByTestId('privacy-notice-save'))

    await waitFor(() => expect(screen.queryByTestId('privacy-notice-save')).toBeNull())
    expect(updatePrivacyNotice).toHaveBeenCalledWith('venue-1', { content: 'Propuesta del aviso', language: 'es' })
    expect(await screen.findByText('settings.requirements.allSet')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'settings.enable' })).toBeEnabled()
    await waitFor(() => expect(document.activeElement).toHaveTextContent('settings.requirements.allSet'))
  })

  it('al cerrar el editor real con la X sin guardar, el foco vuelve al botón que lo abrió (Radix no lo devuelve: no hay Dialog.Trigger)', async () => {
    getSettings.mockResolvedValue(settings(false))
    getPrivacyNotice.mockResolvedValue({ notice: plantilla })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <SettingsTab />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'settings.requirements.privacyNotice.action' }))
    await screen.findByTestId('privacy-notice-textarea')
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    await waitFor(() => expect(screen.queryByTestId('privacy-notice-save')).toBeNull())
    expect(updatePrivacyNotice).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'settings.requirements.privacyNotice.action' })),
    )
  })
})
