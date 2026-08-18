import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { KYCProtectedRoute } from '@/routes/KYCProtectedRoute'
import { useAuth } from '@/context/AuthContext'

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

function renderKycGuard(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/wl/venues/:slug/orders" element={<KYCProtectedRoute />}>
          <Route index element={<div>operational-content</div>} />
        </Route>
        <Route path="/venues/:slug/orders" element={<KYCProtectedRoute />}>
          <Route index element={<div>operational-content</div>} />
        </Route>
        <Route path="/wl/venues/:slug/kyc-required" element={<LocationProbe />} />
        <Route path="/venues/:slug/kyc-required" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('KYCProtectedRoute', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      user: { role: 'ADMIN' },
      activeVenue: {
        status: 'LIVE',
        kycStatus: 'NOT_SUBMITTED',
      },
    } as any)
  })

  it('allows SUPERADMIN even when venue KYC is not verified', async () => {
    mockedUseAuth.mockReturnValue({
      user: { role: 'SUPERADMIN' },
      activeVenue: {
        status: 'LIVE',
        kycStatus: 'NOT_SUBMITTED',
      },
    } as any)

    renderKycGuard('/wl/venues/test-venue/orders')

    await waitFor(() => {
      expect(screen.getByText('operational-content')).toBeInTheDocument()
    })
  })

  it('redirects WL routes to /wl/venues/:slug/kyc-required when blocked', async () => {
    renderKycGuard('/wl/venues/test-venue/orders')

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/wl/venues/test-venue/kyc-required')
    })
  })

  it('redirects regular venue routes to /venues/:slug/kyc-required when blocked', async () => {
    renderKycGuard('/venues/test-venue/orders')

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/venues/test-venue/kyc-required')
    })
  })

  it('waits instead of redirecting while the session is still loading', async () => {
    // The session resolves in seconds against a real API, and until it does
    // `activeVenue` is null — which the KYC predicate reads as "blocked". Without
    // the isLoading check every deep link bounced to kyc-required (and on to
    // home) before the guard could know the venue's actual KYC status.
    mockedUseAuth.mockReturnValue({
      user: undefined,
      activeVenue: null,
      isLoading: true,
    } as any)

    renderKycGuard('/venues/test-venue/orders')

    await waitFor(() => {
      expect(screen.getByText('operational-content')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('location')).not.toBeInTheDocument()
  })

  it('resuelve el venue por el slug de la URL cuando activeVenue aún no se fijó (deep link en frío)', async () => {
    // /full-testing 2026-08-18: la sesión termina de cargar (isLoading=false) UN render antes de que
    // AuthContext fije activeVenue desde el slug (useEffect). En ese render el guard leía null,
    // redirigía a kyc-required, y esa página —al ver el venue VERIFIED— mandaba a /home. Resultado:
    // pegar /venues/el-atole/orders en el navegador siempre aterrizaba en home.
    mockedUseAuth.mockReturnValue({
      user: { role: 'ADMIN' },
      activeVenue: null,
      isLoading: false,
      getVenueBySlug: (slug: string) => (slug === 'test-venue' ? { slug, status: 'LIVE', kycStatus: 'VERIFIED' } : null),
    } as any)

    renderKycGuard('/venues/test-venue/orders')

    await waitFor(() => {
      expect(screen.getByText('operational-content')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('location')).not.toBeInTheDocument()
  })

  it('con activeVenue null y un slug que NO resuelve, no manda a kyc-required (AuthContext redirige al default)', async () => {
    mockedUseAuth.mockReturnValue({
      user: { role: 'ADMIN' },
      activeVenue: null,
      isLoading: false,
      getVenueBySlug: () => null,
    } as any)

    renderKycGuard('/venues/otro/orders')

    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByTestId('location')).not.toBeInTheDocument()
  })

  it('still redirects once loading finishes and the venue is blocked', async () => {
    mockedUseAuth.mockReturnValue({
      user: { role: 'ADMIN' },
      activeVenue: { status: 'LIVE', kycStatus: 'NOT_SUBMITTED' },
      isLoading: false,
    } as any)

    renderKycGuard('/venues/test-venue/orders')

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/venues/test-venue/kyc-required')
    })
  })

  it('renders content when venue kycStatus is VERIFIED', async () => {
    mockedUseAuth.mockReturnValue({
      user: { role: 'ADMIN' },
      activeVenue: {
        status: 'LIVE',
        kycStatus: 'VERIFIED',
      },
    } as any)

    renderKycGuard('/venues/test-venue/orders')

    await waitFor(() => {
      expect(screen.getByText('operational-content')).toBeInTheDocument()
    })
  })
})
