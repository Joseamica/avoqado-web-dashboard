import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ModuleProtectedRoute } from '@/routes/ModuleProtectedRoute'
import { useAuth } from '@/context/AuthContext'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'

const toastSpy = vi.fn()

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/use-access', () => ({
  useAccess: vi.fn(),
}))

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: Record<string, unknown>) => options?.defaultValue || 'translated',
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}))

const mockedUseAuth = vi.mocked(useAuth)
const mockedUseAccess = vi.mocked(useAccess)
const mockedUseCurrentVenue = vi.mocked(useCurrentVenue)

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

function renderModuleGuard(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/wl/venues/:slug/supervisor" element={<ModuleProtectedRoute requiredModule="WHITE_LABEL_DASHBOARD" featureCode="SUPERVISOR_DASHBOARD" />}>
          <Route index element={<div>module-protected-content</div>} />
        </Route>
        <Route path="/venues/:slug/home" element={<LocationProbe />} />
        <Route path="/wl/venues/:slug/home" element={<LocationProbe />} />
        <Route path="/venues/:slug/playtelecom" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ModuleProtectedRoute', () => {
  beforeEach(() => {
    toastSpy.mockReset()

    mockedUseAuth.mockReturnValue({
      checkModuleAccess: vi.fn().mockReturnValue(false),
      activeVenue: null,
      staffInfo: { role: 'ADMIN' },
      user: { role: 'ADMIN' },
      isLoading: false,
    } as any)

    mockedUseAccess.mockReturnValue({
      canFeature: vi.fn().mockReturnValue(true),
      isLoading: false,
      role: 'ADMIN',
    } as any)

    mockedUseCurrentVenue.mockReturnValue({
      venueSlug: 'test-venue',
      venue: {
        slug: 'test-venue',
        modules: [{ module: { code: 'WHITE_LABEL_DASHBOARD' }, enabled: false }],
      },
      isLoading: false,
    } as any)
  })

  it('allows SUPERADMIN regardless of module/feature flags', async () => {
    mockedUseAccess.mockReturnValue({
      canFeature: vi.fn().mockReturnValue(false),
      isLoading: false,
      role: 'SUPERADMIN',
    } as any)

    renderModuleGuard('/wl/venues/test-venue/supervisor')

    await waitFor(() => {
      expect(screen.getByText('module-protected-content')).toBeInTheDocument()
    })
  })

  it('redirects WL route without WHITE_LABEL_DASHBOARD module to non-WL home', async () => {
    renderModuleGuard('/wl/venues/test-venue/supervisor')

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/venues/test-venue/home')
    })
  })

  it('redirects to WL home when feature permission is denied', async () => {
    mockedUseCurrentVenue.mockReturnValue({
      venueSlug: 'test-venue',
      venue: {
        slug: 'test-venue',
        modules: [{ module: { code: 'WHITE_LABEL_DASHBOARD' }, enabled: true }],
      },
      isLoading: false,
    } as any)
    mockedUseAccess.mockReturnValue({
      canFeature: vi.fn().mockReturnValue(false),
      isLoading: false,
      role: 'ADMIN',
    } as any)

    renderModuleGuard('/wl/venues/test-venue/supervisor')

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/wl/venues/test-venue/home')
    })
  })

  it('renders content when module and feature access are allowed', async () => {
    mockedUseCurrentVenue.mockReturnValue({
      venueSlug: 'test-venue',
      venue: {
        slug: 'test-venue',
        modules: [{ module: { code: 'WHITE_LABEL_DASHBOARD' }, enabled: true }],
      },
      isLoading: false,
    } as any)
    mockedUseAccess.mockReturnValue({
      canFeature: vi.fn().mockReturnValue(true),
      isLoading: false,
      role: 'ADMIN',
    } as any)

    renderModuleGuard('/wl/venues/test-venue/supervisor')

    await waitFor(() => {
      expect(screen.getByText('module-protected-content')).toBeInTheDocument()
    })
  })
})
