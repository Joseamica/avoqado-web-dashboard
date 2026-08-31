import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, Outlet, RouterProvider, useLocation, useNavigationType } from 'react-router-dom'

import { useAuth } from '@/context/AuthContext'
import { useAccess } from '@/hooks/use-access'
import LegacyRedirect from '@/routes/LegacyRedirect'
import { createVenueRoutes } from '@/routes/venueRoutes'

vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/hooks/use-access', () => ({ useAccess: vi.fn() }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? 'translated',
  }),
}))

vi.mock('@/pages/KYCSetupRequired', () => ({
  KYCSetupRequired: () => <div>kyc-blocked</div>,
}))

vi.mock('@/routes/lazyComponents', async importOriginal => {
  const actual = await importOriginal<typeof import('@/routes/lazyComponents')>()
  const { useLocation, useNavigationType, useParams } = await import('react-router-dom')

  function DevicePageProbe({ page }: { page: 'list' | 'order' | 'detail' }) {
    const location = useLocation()
    const navigationType = useNavigationType()
    const params = useParams()

    return (
      <div>
        <span data-testid="device-page">{page}</span>
        <span data-testid="route-param">{params.id ?? params.tpvId ?? ''}</span>
        <span data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</span>
        <span data-testid="navigation-type">{navigationType}</span>
      </div>
    )
  }

  return {
    ...actual,
    Tpv: () => <DevicePageProbe page="list" />,
    TerminalOrderDetail: () => <DevicePageProbe page="order" />,
    TpvId: () => <DevicePageProbe page="detail" />,
  }
})

const mockedUseAuth = vi.mocked(useAuth)
const mockedUseAccess = vi.mocked(useAccess)

function LocationProbe() {
  const location = useLocation()
  const navigationType = useNavigationType()
  return (
    <div>
      <span data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</span>
      <span data-testid="navigation-type">{navigationType}</span>
    </div>
  )
}

function renderVenueRoute(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/venues/:slug',
        element: <Outlet />,
        children: createVenueRoutes(),
      },
      {
        path: '/wl/venues/:slug',
        element: <Outlet />,
        children: createVenueRoutes(),
      },
    ],
    { initialEntries: [initialPath] },
  )

  return render(<RouterProvider router={router} future={{ v7_startTransition: true }} />)
}

describe('canonical device routes', () => {
  beforeEach(() => {
    mockedUseAccess.mockReturnValue({
      can: (permission: string) => permission === 'tpv:read',
      canAny: () => false,
      canAll: () => false,
      isLoading: false,
      role: 'ADMIN',
    } as any)
    mockedUseAuth.mockReturnValue({
      activeVenue: { slug: 'cafe', status: 'LIVE', kycStatus: 'VERIFIED' },
      getVenueBySlug: (slug: string) => ({ slug, status: 'LIVE', kycStatus: 'VERIFIED' }),
      checkVenueAccess: () => true,
      isAuthenticated: true,
      isLoading: false,
      user: { role: 'ADMIN' },
    } as any)
  })

  it.each([
    ['/venues/cafe/devices', 'list', ''],
    ['/venues/cafe/devices/orders/order-7', 'order', 'order-7'],
    ['/venues/cafe/devices/device-7', 'detail', 'device-7'],
  ])('renders the existing page at %s', async (path, expectedPage, expectedParam) => {
    renderVenueRoute(path)

    await waitFor(() => expect(screen.getByTestId('device-page')).toHaveTextContent(expectedPage))
    expect(screen.getByTestId('route-param')).toHaveTextContent(expectedParam)
  })

  it.each([
    ['/venues/cafe/tpv?from=legacy#summary', '/venues/cafe/devices?from=legacy#summary', 'list'],
    ['/venues/cafe/tpv/orders/order-7?from=legacy#payment', '/venues/cafe/devices/orders/order-7?from=legacy#payment', 'order'],
    ['/venues/cafe/tpv/device-7?action=buy#commands', '/venues/cafe/devices/device-7?action=buy#commands', 'detail'],
    ['/wl/venues/cafe/tpv?from=legacy#summary', '/wl/venues/cafe/devices?from=legacy#summary', 'list'],
    ['/wl/venues/cafe/tpv/orders/order-7?from=legacy#payment', '/wl/venues/cafe/devices/orders/order-7?from=legacy#payment', 'order'],
    ['/wl/venues/cafe/tpv/device-7?action=buy#commands', '/wl/venues/cafe/devices/device-7?action=buy#commands', 'detail'],
  ])('redirects legacy %s with replace to %s', async (legacyPath, expectedPath, expectedPage) => {
    renderVenueRoute(legacyPath)

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(expectedPath))
    expect(screen.getByTestId('device-page')).toHaveTextContent(expectedPage)
    expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE')
  })

  it.each(['/venues/cafe/devices', '/venues/cafe/tpv'])('does not expose %s without tpv:read', async path => {
    mockedUseAccess.mockReturnValue({
      can: () => false,
      canAny: () => false,
      canAll: () => false,
      isLoading: false,
      role: 'VIEWER',
    } as any)

    renderVenueRoute(path)

    await waitFor(() => expect(screen.queryByTestId('device-page')).not.toBeInTheDocument())
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })

  it.each(['/venues/cafe/devices', '/venues/cafe/tpv'])('does not let %s bypass blocked KYC', async path => {
    mockedUseAuth.mockReturnValue({
      activeVenue: { slug: 'cafe', status: 'LIVE', kycStatus: 'NOT_SUBMITTED' },
      getVenueBySlug: (slug: string) => ({ slug, status: 'LIVE', kycStatus: 'NOT_SUBMITTED' }),
      checkVenueAccess: () => true,
      isAuthenticated: true,
      isLoading: false,
      user: { role: 'ADMIN' },
    } as any)

    renderVenueRoute(path)

    await waitFor(() => expect(screen.getByText('kyc-blocked')).toBeInTheDocument())
    expect(screen.queryByTestId('device-page')).not.toBeInTheDocument()
  })

  it('keeps unrelated static redirects compatible without preserving query or hash', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/venues/:slug/legacy',
          element: <LegacyRedirect to="settings/profile" />,
        },
        {
          path: '/venues/:slug/settings/profile',
          element: <LocationProbe />,
        },
      ],
      { initialEntries: ['/venues/cafe/legacy?discard=yes#old'] },
    )

    render(<RouterProvider router={router} future={{ v7_startTransition: true }} />)

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/venues/cafe/settings/profile'))
    expect(screen.getByTestId('location')).not.toHaveTextContent('?discard=yes')
    expect(screen.getByTestId('location')).not.toHaveTextContent('#old')
    expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE')
  })
})
