// src/hooks/__tests__/useAutoLaunchPlatformWelcomeTour.test.tsx
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StaffRole } from '@/types'
import { useAutoLaunchPlatformWelcomeTour } from '../useAutoLaunchPlatformWelcomeTour'

const m = vi.hoisted(() => ({ start: vi.fn(), cancel: vi.fn(), setValue: vi.fn(), mobile: false }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' }, staffInfo: { role: StaffRole.OWNER } }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ fullBasePath: '/venues/cafe', venue: { status: 'ACTIVE' } }) }))
vi.mock('@/hooks/usePlatformWelcomeTour', () => ({ usePlatformWelcomeTour: () => ({ start: m.start, cancel: m.cancel }) }))
vi.mock('@/hooks/useOnboardingState', () => ({ useOnboardingKey: () => ({ value: false, isLoaded: true, setValue: m.setValue }) }))
vi.mock('@/lib/platform-tour-state', () => ({ getPlatformTourState: () => null }))
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => m.mobile }))

/** El dueño recién dado de alta llega al Home de su negocio por primera vez. */
const enElHome = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/venues/cafe/home']}>{children}</MemoryRouter>

describe('useAutoLaunchPlatformWelcomeTour', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    m.start.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('en computadora, el tour se abre solo la primera vez', () => {
    m.mobile = false
    renderHook(() => useAutoLaunchPlatformWelcomeTour(), { wrapper: enElHome })
    act(() => vi.advanceTimersByTime(2000))
    expect(m.start).toHaveBeenCalledTimes(1)
  })

  it('en celular no se abre solo: taparía la lista de «siguientes pasos» (D18)', () => {
    m.mobile = true
    renderHook(() => useAutoLaunchPlatformWelcomeTour(), { wrapper: enElHome })
    act(() => vi.advanceTimersByTime(2000))
    expect(m.start).not.toHaveBeenCalled()
  })
})
