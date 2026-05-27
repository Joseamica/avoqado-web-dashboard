import { Page } from '@playwright/test'

const COMMISSIONS_API = '**/api/v1/dashboard/commissions/**'

export interface CommissionMockOptions {
  stats?: Record<string, unknown>
  effectiveConfigs?: unknown[]
  pendingSummaries?: unknown[]
  payouts?: unknown[]
  teamMembers?: unknown[]
  categories?: unknown[]
}

const DEFAULT_STATS = {
  totalPaid: 0,
  totalPending: 0,
  totalApproved: 0,
  activeStaffCount: 0,
}

const MOCK_TEAM_MEMBERS = [
  {
    id: 'staff-001',
    firstName: 'Ana',
    lastName: 'García',
    email: 'ana@test.com',
    role: 'WAITER',
    status: 'ACTIVE',
    photoUrl: null,
  },
  {
    id: 'staff-002',
    firstName: 'Carlos',
    lastName: 'López',
    email: 'carlos@test.com',
    role: 'CASHIER',
    status: 'ACTIVE',
    photoUrl: null,
  },
  {
    id: 'staff-003',
    firstName: 'María',
    lastName: 'Rodríguez',
    email: 'maria@test.com',
    role: 'MANAGER',
    status: 'ACTIVE',
    photoUrl: null,
  },
]

const MOCK_CATEGORIES = [
  { id: 'cat-001', name: 'Bebidas', color: '#2563eb', active: true },
  { id: 'cat-002', name: 'Alimentos', color: '#16a34a', active: true },
  { id: 'cat-003', name: 'Postres', color: '#d97706', active: true },
]

export async function setupCommissionMocks(page: Page, options: CommissionMockOptions = {}) {
  const {
    stats = DEFAULT_STATS,
    effectiveConfigs = [],
    pendingSummaries = [],
    payouts = [],
    teamMembers = MOCK_TEAM_MEMBERS,
    categories = MOCK_CATEGORIES,
  } = options

  // Catch-all for commission endpoints (lowest priority — registered first)
  await page.route(COMMISSIONS_API, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  )

  // Stats
  await page.route('**/api/v1/dashboard/commissions/venues/*/stats', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(stats),
    }),
  )

  // Effective configs
  await page.route('**/api/v1/dashboard/commissions/venues/*/effective-configs', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: effectiveConfigs }),
    }),
  )

  // Pending summaries (two calls: PENDING_APPROVAL + DISPUTED)
  await page.route('**/api/v1/dashboard/commissions/venues/*/summaries*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: pendingSummaries }),
    }),
  )

  // Payouts
  await page.route('**/api/v1/dashboard/commissions/venues/*/payouts*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: payouts }),
    }),
  )

  // Commission calculations (TeamCommissionTable)
  await page.route('**/api/v1/dashboard/commissions/venues/*/calculations*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { total: 0 } }),
    }),
  )

  // Effective payout config
  await page.route('**/api/v1/dashboard/commissions/venues/*/effective-payout-config', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: null }),
    }),
  )

  // Team members (for StaffCard)
  await page.route('**/api/v1/dashboard/venues/*/team?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: teamMembers,
        meta: { page: 1, pageSize: 50, total: teamMembers.length, totalPages: 1 },
      }),
    }),
  )

  await page.route('**/api/v1/dashboard/venues/*/team', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: teamMembers,
          meta: { page: 1, pageSize: 50, total: teamMembers.length, totalPages: 1 },
        }),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  })

  // Categories (for CategoriesCard)
  await page.route('**/api/v1/dashboard/venues/*/categories*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(categories),
    }),
  )

  // Menu categories fallback
  await page.route('**/api/v1/dashboard/venues/*/menu/categories*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(categories),
    }),
  )

  // Goals endpoints
  await page.route('**/api/v1/dashboard/commissions/venues/*/goals*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  )

  // Create config (POST) — return a mock config
  await page.route('**/api/v1/dashboard/commissions/venues/*/configs', (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'config-new-001',
          venueId: 'venue-alpha',
          ...body,
          active: true,
          createdAt: new Date().toISOString(),
        }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })

  // Create tiers batch (POST)
  await page.route('**/api/v1/dashboard/commissions/venues/*/configs/*/tiers/batch', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  )

  // Create override (POST)
  await page.route('**/api/v1/dashboard/commissions/venues/*/configs/*/overrides', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'override-001' }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })
}
