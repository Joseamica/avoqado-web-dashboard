import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Dashboard from './dashboard'

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    authorizeVenue: vi.fn(),
    allVenues: [],
  }),
}))

vi.mock('./hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({
    venue: null,
    venueSlug: 'centro',
    fullBasePath: '/venues/centro',
    isLoading: true,
    hasVenueAccess: false,
  }),
}))

vi.mock('./hooks/useInventoryWelcomeTour', () => ({ useInventoryWelcomeTourOrchestrator: vi.fn() }))
vi.mock('./hooks/useAutoLaunchPlatformWelcomeTour', () => ({ useAutoLaunchPlatformWelcomeTour: vi.fn() }))
vi.mock('./hooks/useHomeChecklistAutoMark', () => ({ useHomeChecklistAutoMark: vi.fn() }))
vi.mock('./hooks/useTourProgressSync', () => ({ useTourProgressSync: vi.fn() }))
vi.mock('./hooks/useDemoTour', () => ({ useDemoTour: vi.fn() }))
vi.mock('./hooks/useAtomicTourListener', () => ({
  consumeAtomicTourReturnPath: vi.fn(),
  usePeekAtomicTourCompletion: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('Dashboard loading state', () => {
  it('uses the shared branded loader while the venue is loading', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByRole('status')).toHaveTextContent('dashboardShell.loadingVenue')
    expect(container.querySelector('svg.avoqado-loader')).toBeInTheDocument()
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument()
  })
})
