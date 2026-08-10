import { describe, expect, it } from 'vitest'
import type { AgnosticDataRouteObject } from '@remix-run/router'

import router from '@/routes/router'

function topLevelDashboardChildren(): AgnosticDataRouteObject[] {
  const root = router.routes[0]
  const protectedDashboard = root.children?.find(route => route.children?.some(child => child.path === '/organizations/:orgId'))
  return (protectedDashboard?.children ?? []) as AgnosticDataRouteObject[]
}

describe('master catalog organization navigation', () => {
  it('mounts the catalog as a sibling before the OWNER-only organization tree', () => {
    const routes = topLevelDashboardChildren()
    const catalogIndex = routes.findIndex(route => route.path === '/organizations/:orgId/master-catalog')
    const ownerIndex = routes.findIndex(route => route.path === '/organizations/:orgId')

    expect(catalogIndex).toBeGreaterThanOrEqual(0)
    expect(ownerIndex).toBeGreaterThan(catalogIndex)
    expect('element' in (routes[catalogIndex]?.children?.[0] ?? {})).toBe(true)
  })
})
