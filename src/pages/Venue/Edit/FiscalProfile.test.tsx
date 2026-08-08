import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Regression test for the root cause of the CFDI rejection incident: the "Razón social"
 * field of this screen must NEVER be prefilled with the venue's commercial name. That
 * comfort-prefill is exactly what produced "La Galaterie" (typo, from `Venue.name`) instead
 * of "LA GALETERIE" (the SAT-registered legal name) — 5 consecutive SAT rejections before
 * anyone understood why.
 *
 * `useCurrentVenue` below is mocked to return a venue whose `name` is deliberately the WRONG
 * (typo'd) value on purpose, mirroring the incident. If the component ever regresses to
 * reading `venue.name` as a default, these tests fail loudly.
 */

const mockGetProfile = vi.fn()
const mockUpdateProfile = vi.fn()
const mockUploadConstancia = vi.fn()
const mockToast = vi.fn()
const mockCan = vi.fn()

vi.mock('@/services/fiscalProfile.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/fiscalProfile.service')>('@/services/fiscalProfile.service')
  return {
    ...actual,
    fiscalProfileService: {
      getProfile: (...args: unknown[]) => mockGetProfile(...args),
      updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
      uploadConstancia: (...args: unknown[]) => mockUploadConstancia(...args),
    },
  }
})

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({
    // 🔴 Deliberately the WRONG/typo'd commercial name — see file header.
    venue: { id: 'venue-1', name: 'La Galaterie', slug: 'la-galaterie' },
    venueId: 'venue-1',
    venueSlug: 'la-galaterie',
    fullBasePath: '/venues/la-galaterie',
  }),
}))

vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: mockCan }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => d }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import FiscalProfile from './FiscalProfile'

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <FiscalProfile />
    </QueryClientProvider>,
  )
}

describe('FiscalProfile — la razón social nunca se prellena con el nombre del venue', () => {
  beforeEach(() => {
    mockCan.mockReturnValue(true)
  })

  it('deja "Razón social" vacío cuando el venue todavía no capturó su perfil fiscal', async () => {
    mockGetProfile.mockResolvedValue(null)
    renderPage()

    const razonSocialInput = await screen.findByPlaceholderText('edit.fiscal.placeholders.razonSocial')
    await waitFor(() => expect(razonSocialInput).toHaveValue(''))
    expect(razonSocialInput).not.toHaveValue('La Galaterie')
  })

  it('prellena "Razón social" con el perfil fiscal guardado, nunca con el nombre comercial del venue', async () => {
    mockGetProfile.mockResolvedValue({
      id: 'profile-1',
      rfc: 'ABC010101AB1',
      razonSocial: 'LA GALETERIE',
      regimenFiscal: '612',
      codigoPostal: '76000',
      defaultUsoCfdi: 'G03',
      email: null,
      constanciaUrl: null,
      validationStatus: 'PENDING',
      validatedAt: null,
    })
    renderPage()

    const razonSocialInput = await screen.findByPlaceholderText('edit.fiscal.placeholders.razonSocial')
    await waitFor(() => expect(razonSocialInput).toHaveValue('LA GALETERIE'))
    // El nombre del venue (mockeado arriba a propósito distinto) nunca debe aparecer aquí.
    expect(razonSocialInput).not.toHaveValue('La Galaterie')
  })
})

/**
 * Regresión: si el GET del perfil fiscal falla, la pantalla NUNCA debe mostrar el
 * formulario vacío normal — eso es visualmente idéntico a "todavía no he capturado mis
 * datos" e invita al dueño a sobrescribir un perfil ya válido con datos tecleados de
 * memoria (el mismo tipo de accidente que originó este proyecto). Debe mostrarse la key
 * `edit.fiscal.loadError` en su lugar.
 */
describe('FiscalProfile — el fallo del GET nunca se disfraza de formulario vacío', () => {
  beforeEach(() => {
    mockCan.mockReturnValue(true)
  })

  it('muestra el aviso de error (no el formulario) cuando falla el GET del perfil fiscal', async () => {
    mockGetProfile.mockRejectedValue(new Error('500'))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('edit.fiscal.loadError')).toBeInTheDocument()
    })
    // El formulario vacío NUNCA debe aparecer en este caso — el dueño no debe creer que
    // simplemente no ha capturado nada todavía.
    expect(screen.queryByPlaceholderText('edit.fiscal.placeholders.razonSocial')).not.toBeInTheDocument()
  })
})
