import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockUseAccess = vi.fn()
const mockUseVenueTier = vi.fn()
vi.mock('@/hooks/use-access', () => ({ useAccess: () => mockUseAccess() }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useVenueTier: () => mockUseVenueTier() }))

import { useOnlineOrderingStatus } from './use-online-ordering-status'

const setup = (perms: string[], opts: { role?: string; hasPlan?: boolean; loading?: boolean } = {}) => {
  mockUseAccess.mockReturnValue({ can: (p: string) => perms.includes(p), role: opts.role ?? 'MANAGER' })
  mockUseVenueTier.mockReturnValue({ hasFeatureAccess: () => opts.hasPlan ?? true, isLoading: opts.loading ?? false })
  return renderHook(() => useOnlineOrderingStatus()).result.current
}

describe('useOnlineOrderingStatus', () => {
  beforeEach(() => {
    mockUseAccess.mockReset()
    mockUseVenueTier.mockReset()
  })

  it('mapea cada permiso a su can*', () => {
    const r = setup(['online-orders:manage', 'orders:update', 'orders:cancel-unpaid', 'online-orders:pause'])
    expect(r).toMatchObject({ canManage: true, canAnswer: true, canCancel: true, canPause: true, keepsStoreOpen: true, hasPlan: true, tierLoading: false })
  })

  it('sólo orders:read ⇒ nada de lo demás', () => {
    const r = setup(['orders:read'])
    expect(r).toMatchObject({ canManage: false, canAnswer: false, canCancel: false, canPause: false, keepsStoreOpen: false })
  })

  it('hasPlan y tierLoading vienen de useVenueTier', () => {
    expect(setup([], { hasPlan: false }).hasPlan).toBe(false)
    expect(setup([], { loading: true }).tierLoading).toBe(true)
  })

  it('superadmin no mantiene la tienda abierta (el servidor no late para él)', () => {
    const r = setup(['orders:update'], { role: 'SUPERADMIN' })
    expect(r.canAnswer).toBe(true)
    expect(r.keepsStoreOpen).toBe(false)
  })
})
