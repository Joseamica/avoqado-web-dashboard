import type { Page } from '@playwright/test'
import { createAuthStatusResponse, createMockUser, StaffRole, VENUE_ALPHA, VENUE_BETA } from './mock-data'

export const SERVICE_COURSE_VENUES = [VENUE_ALPHA, VENUE_BETA].map((v, i) => ({
  ...v,
  name: i === 0 ? 'Roma' : 'Condesa',
  organization: { ...v.organization, name: 'La Mesa' },
  permissions: [
    ...new Set([
      ...v.permissions,
      'settings:read',
      'settings:manage',
      'discounts:read',
      'billing:read',
      'activity:read',
      'printers:read',
      'receipt-layout:read',
      'tender-types:read',
      'area-tickets:configure',
      'tables:read',
      'tables:manage',
      'customers:read',
      'customer-groups:read',
      'loyalty:read',
      'reviews:read',
      'coupons:read',
      'upsells:read',
    ]),
  ],
}))

/** In-memory fixtures only: real forms and routing, no shared database or API. */
export async function setupServiceCourseMocks(page: Page, enabled = true) {
  const organizationId = VENUE_ALPHA.organizationId
  const user = {
    ...createMockUser(StaffRole.OWNER, SERVICE_COURSE_VENUES),
    organizationMemberships: [{ organizationId, organizationName: 'La Mesa', role: 'OWNER', masterCatalogVisible: false }],
  }
  await page.route('**/api/v1/dashboard/auth/status', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(createAuthStatusResponse(user)) }),
  )
  await page.route(`**/api/v1/organizations/${organizationId}/stats`, route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ id: organizationId, name: 'La Mesa', venueCount: 2, staffCount: 1 }),
    }),
  )
  let shared = [
    { id: 'immediate', label: 'Inmediato', kind: 'IMMEDIATE' },
    { id: 'appetizers', label: 'Aperitivos', kind: 'STANDARD' },
    { id: 'mains', label: 'Principales', kind: 'STANDARD' },
    { id: 'desserts', label: 'Postres', kind: 'STANDARD' },
  ]
  let orgRevision = 1
  const own = new Map<string, typeof shared | null>()
  const revisions = new Map<string, number>()
  await page.route('**/api/v1/dashboard/*/*/service-courses', async route => {
    const url = new URL(route.request().url())
    const segments = url.pathname.split('/')
    const id = segments.at(-2)!
    const isOrg = segments.at(-3) === 'organizations'
    const venue = SERVICE_COURSE_VENUES.find(v => v.id === id)
    if (isOrg ? id !== organizationId : !venue) return route.fulfill({ status: 404, body: '{}' })
    const list = own.get(id)
    const venueRevision = revisions.get(id) ?? 0
    const revision = isOrg ? `o:${orgRevision}` : list ? `v:${venueRevision}` : `o:${orgRevision}:v:${venueRevision}`
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      if (!enabled) return route.fulfill({ status: 403, body: JSON.stringify({ code: 'FEATURE_ACCESS_REQUIRED' }) })
      if (body.expectedRevision !== revision) return route.fulfill({ status: 409, body: JSON.stringify({ code: 'SERVICE_COURSES_STALE' }) })
      if (isOrg) {
        shared = body.courses
        orgRevision++
      } else {
        own.set(id, body.courses)
        revisions.set(id, venueRevision + 1)
      }
    }
    const savedList = own.get(id)
    const savedRevision = revisions.get(id) ?? 0
    const data = {
      schemaVersion: 1,
      organizationId,
      organizationName: 'La Mesa',
      enabled,
      ...(isOrg
        ? { totalVenues: 2, inheritingVenues: SERVICE_COURSE_VENUES.filter(v => !own.get(v.id)).length }
        : { venueId: id, venueName: venue!.name, hasOwnConfiguration: !!savedList }),
      source: isOrg || !savedList ? 'ORGANIZATION' : 'VENUE',
      revision: isOrg ? `o:${orgRevision}` : savedList ? `v:${savedRevision}` : `o:${orgRevision}:v:${savedRevision}`,
      courses: isOrg ? shared : (savedList ?? shared),
      limits: { maxCourses: 32, maxLabelLength: 60 },
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
  })
}
