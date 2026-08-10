import { describe, expect, it } from 'vitest'

import { getMasterCatalogOrganizationLinks } from '@/features/master-catalog/types'

describe('VenuesSwitcher master-catalog navigation', () => {
  it('includes visible VIEWER memberships without requiring organization ownership', () => {
    expect(
      getMasterCatalogOrganizationLinks({
        organizationMemberships: [
          {
            organizationId: 'org-viewer',
            organizationName: 'PITS',
            role: 'VIEWER',
            masterCatalogVisible: true,
          },
        ],
      } as never),
    ).toEqual([{ organizationId: 'org-viewer', organizationName: 'PITS' }])
  })

  it('omits default-off, malformed, duplicate, and unknown-role memberships', () => {
    expect(
      getMasterCatalogOrganizationLinks({
        organizationMemberships: [
          { organizationId: 'org-hidden', organizationName: 'Hidden', role: 'OWNER', masterCatalogVisible: false },
          { organizationId: 'org-visible', organizationName: 'Visible', role: 'ADMIN', masterCatalogVisible: true },
          { organizationId: 'org-visible', organizationName: 'Duplicate', role: 'ADMIN', masterCatalogVisible: true },
          { organizationId: 'org-unknown', organizationName: 'Unknown', role: 'SUPERADMIN', masterCatalogVisible: true },
        ],
      } as never),
    ).toEqual([{ organizationId: 'org-visible', organizationName: 'Visible' }])
  })

  it('returns no links for an old auth payload without memberships', () => {
    expect(getMasterCatalogOrganizationLinks({} as never)).toEqual([])
  })
})
