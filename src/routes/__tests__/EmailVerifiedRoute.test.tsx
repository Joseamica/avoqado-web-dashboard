import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { EmailVerifiedRoute } from '@/routes/EmailVerifiedRoute'
import { useAuth } from '@/context/AuthContext'

const toastSpy = vi.fn()

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}))

const mockedUseAuth = vi.mocked(useAuth)

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

function renderGuard(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<LocationProbe />} />
        <Route path="/auth/verify-email" element={<LocationProbe />} />
        <Route path="/protected" element={<EmailVerifiedRoute />}>
          <Route index element={<div>protected-content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('EmailVerifiedRoute', () => {
  beforeEach(() => {
    toastSpy.mockReset()
    mockedUseAuth.mockReset()
  })

  it('redirects unauthenticated users to login with returnTo', async () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
    } as any)

    renderGuard('/protected?tab=security')

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/login?returnTo=%2Fprotected%3Ftab%3Dsecurity')
    })
  })

  it('redirects authenticated but unverified users to verify-email', async () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        email: 'qa.user@avoqado.test',
        emailVerified: false,
      },
    } as any)

    renderGuard('/protected')

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/auth/verify-email?email=qa.user%40avoqado.test')
    })

    expect(toastSpy).toHaveBeenCalled()
  })

  it('renders protected content for verified users', async () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        email: 'qa.user@avoqado.test',
        emailVerified: true,
      },
    } as any)

    renderGuard('/protected')

    await waitFor(() => {
      expect(screen.getByText('protected-content')).toBeInTheDocument()
    })
  })
})
