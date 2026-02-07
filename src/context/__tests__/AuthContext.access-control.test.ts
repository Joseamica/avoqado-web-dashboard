import { describe, expect, it } from 'vitest'
import { StaffRole } from '@/types'
import { hasVenueAccessForSlug } from '@/context/AuthContext'

const venueA = { id: 'v1', slug: 'venue-a' }
const venueB = { id: 'v2', slug: 'venue-b' }
const venueC = { id: 'v3', slug: 'venue-c' }

describe('AuthContext access control', () => {
  it('returns false when user is null', () => {
    expect(hasVenueAccessForSlug(null, StaffRole.ADMIN, [venueA] as any, 'venue-a')).toBe(false)
  })

  it('returns false when slug is empty', () => {
    const user = { venues: [venueA] }
    expect(hasVenueAccessForSlug(user as any, StaffRole.ADMIN, [venueA] as any, '')).toBe(false)
  })

  it('SUPERADMIN checks access against allVenues', () => {
    const superadmin = { venues: [venueA] }
    expect(hasVenueAccessForSlug(superadmin as any, StaffRole.SUPERADMIN, [venueA, venueB] as any, 'venue-b')).toBe(true)
  })

  it('SUPERADMIN is denied for non-existing venue slug', () => {
    const superadmin = { venues: [venueA] }
    expect(hasVenueAccessForSlug(superadmin as any, StaffRole.SUPERADMIN, [venueA, venueB] as any, 'missing')).toBe(false)
  })

  it('OWNER is scoped to user.venues (not allVenues)', () => {
    const owner = { venues: [venueA, venueB] }
    expect(hasVenueAccessForSlug(owner as any, StaffRole.OWNER, [venueA, venueB, venueC] as any, 'venue-c')).toBe(false)
    expect(hasVenueAccessForSlug(owner as any, StaffRole.OWNER, [venueA, venueB, venueC] as any, 'venue-b')).toBe(true)
  })

  it('non-superadmin roles are scoped to user.venues', () => {
    const manager = { venues: [venueA] }
    expect(hasVenueAccessForSlug(manager as any, StaffRole.MANAGER, [venueA, venueB] as any, 'venue-a')).toBe(true)
    expect(hasVenueAccessForSlug(manager as any, StaffRole.MANAGER, [venueA, venueB] as any, 'venue-b')).toBe(false)
  })
})
