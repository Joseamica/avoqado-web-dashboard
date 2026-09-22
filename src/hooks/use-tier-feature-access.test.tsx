import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseAccess = vi.fn()
const mockUseCurrentVenue = vi.fn()
const mockUseQuery = vi.fn()

vi.mock('@/hooks/use-access', () => ({ useAccess: () => mockUseAccess() }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => mockUseCurrentVenue() }))
vi.mock('@tanstack/react-query', () => ({ useQuery: (options: unknown) => mockUseQuery(options) }))

import { planTierQueryKey, useTierFeatureAccess } from './use-tier-feature-access'

describe('useTierFeatureAccess entitlement resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAccess.mockReturnValue({
      canFeature: vi.fn(() => false),
      role: 'OWNER',
      isWhiteLabelEnabled: false,
    })
    mockUseCurrentVenue.mockReturnValue({
      venueId: 'venue-1',
      venue: { id: 'venue-1', status: 'ACTIVE' },
    })
  })

  it('keeps existing fail-open access but does not mark an unresolved tier request as resolved', () => {
    mockUseQuery.mockImplementation((options: { queryKey: string[] }) => {
      if (options.queryKey[2] === 'planTier') {
        return { data: undefined, isLoading: false, isSuccess: false }
      }
      return { data: { activeFeatures: [] }, isLoading: false, isSuccess: true }
    })

    const { result } = renderHook(() => useTierFeatureAccess('CASH_RECONCILIATION'))

    expect(result.current.hasAccess).toBe(true)
    expect(result.current.isResolved).toBe(false)
  })

  it('reports a positive resolved denial for a normal FREE venue', () => {
    mockUseQuery.mockImplementation((options: { queryKey: string[] }) => {
      if (options.queryKey[2] === 'planTier') {
        return { data: { tier: 'FREE', exempt: false }, isLoading: false, isSuccess: true }
      }
      return { data: { activeFeatures: [] }, isLoading: false, isSuccess: true }
    })

    const { result } = renderHook(() => useTierFeatureAccess('CASH_RECONCILIATION'))

    expect(result.current.hasAccess).toBe(false)
    expect(result.current.isResolved).toBe(true)
    expect(result.current.requiredTier).toBe('PRO')
  })

  it('treats a demo bypass as positively resolved without issuing a tier request', () => {
    mockUseCurrentVenue.mockReturnValue({
      venueId: 'venue-demo',
      venue: { id: 'venue-demo', status: 'LIVE_DEMO' },
    })
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, isSuccess: false })

    const { result } = renderHook(() => useTierFeatureAccess('CASH_RECONCILIATION'))

    expect(result.current.hasAccess).toBe(true)
    expect(result.current.isResolved).toBe(true)
  })
  it('🔴 R4-8: con grantedFeatureCodes, una concesión vieja en la caché de /features NO gana', () => {
    mockUseQuery.mockImplementation((options: { queryKey: string[] }) => {
      if (options.queryKey[2] === 'planTier') {
        return { data: { tier: 'FREE', exempt: false, grantedFeatureCodes: [] }, isLoading: false, isSuccess: true }
      }
      // Caché de antes: la suelta de CFDI seguía activa. La consulta está deshabilitada, pero sus datos quedan.
      return { data: { activeFeatures: [{ feature: { code: 'CFDI' }, grantedByBasePlan: false }] }, isLoading: false, isSuccess: true }
    })

    const { result } = renderHook(() => useTierFeatureAccess('CFDI'))

    expect(result.current.hasAccess).toBe(false)
  })

  it('🔴 R4-8: la clave del plan-tier cuelga de venueFeatures (invalidar compras o bajas la refresca)', () => {
    expect(planTierQueryKey('v1').slice(0, 2)).toEqual(['venueFeatures', 'v1'])
  })
})
