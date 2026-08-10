import { describe, expect, it } from 'vitest'

import { selectAuthenticatedUser } from '@/context/AuthContext'
import type { AuthStatusResponse } from '@/services/auth.service'

const catalogMembership = {
  organizationId: 'org-pits',
  organizationName: 'PITS',
  role: 'VIEWER' as const,
  masterCatalogVisible: true,
}

function statusWithUser(user: AuthStatusResponse['user']): AuthStatusResponse {
  return { authenticated: true, user }
}

describe('AuthContext master-catalog visibility hint', () => {
  it('preserves the optional organization membership payload from auth status', () => {
    const user = {
      id: 'staff-1',
      organizationMemberships: [catalogMembership],
    } as AuthStatusResponse['user']

    expect(selectAuthenticatedUser(statusWithUser(user))?.organizationMemberships).toEqual([catalogMembership])
  })

  it('keeps old auth payloads compatible when memberships are absent', () => {
    const user = { id: 'staff-1' } as AuthStatusResponse['user']

    expect(selectAuthenticatedUser(statusWithUser(user))?.organizationMemberships).toBeUndefined()
  })

  it('never exposes a user from an unauthenticated response', () => {
    const user = { id: 'staff-1', organizationMemberships: [catalogMembership] } as AuthStatusResponse['user']

    expect(selectAuthenticatedUser({ authenticated: false, user })).toBeNull()
  })
})
