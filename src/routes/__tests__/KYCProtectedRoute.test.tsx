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
