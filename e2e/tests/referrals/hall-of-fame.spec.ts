/**
 * E2E tests for Hall of Fame + Recent Referrals Table (Plan 2 EXTENSION).
 *
 * Covers:
 *   1. ADMIN on /referrals (active state) — sees Hall of Fame with 3 mock entries
 *   2. ADMIN on /referrals (active, no referrals) — sees Hall of Fame empty state
 *   3. ADMIN on /referrals (active) — sees recent referrals table rows + filter by status
 *
 * Navigation: /venues/venue-alpha/referrals
 */

import { test, expect, Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.describe.configure({ mode: 'serial' })
test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

// ─── Fixtures ────────────────────────────────────────────────────

const ADMIN_PERMISSIONS = [
  'home:read',
  'customers:read',
  'referral:read',
  'referral:configure',
]

function makeVenue() {
  return createMockVenue({
    id: 'venue-alpha',
    name: 'Restaurante Alpha',
    slug: 'venue-alpha',
    permissions: ADMIN_PERMISSIONS,
  })
}

const ACTIVE_CONFIG = {
  id: 'rpc-001',
  venueId: 'venue-alpha',
  active: true,
  activatedAt: '2026-05-01T10:00:00.000Z',
  newCustomerDiscountPercent: 10,
  tier1ReferralsRequired: 7,
  tier1RewardPercent: 15,
  tier2ReferralsRequired: 12,
  tier2RewardPercent: 20,
  tier3ReferralsRequired: 20,
  tier3RewardPercent: 25,
  rewardCouponExpiryDays: 90,
  codePrefix: null,
  welcomeMessageTemplate: null,
  tierUpMessageTemplate: null,
}

const SUMMARY_MOCK = {
  referralsThisMonth: 14,
  referralsPrevMonth: 9,
  conversionRate: 0.42,
  qualifiedThisMonth: 6,
  pendingThisMonth: 8,
  couponsEmittedThisMonth: 3,
  topReferrer: {
    id: 'cust-001',
    firstName: 'Sofía',
    lastName: 'Hernández',
    referralCount: 5,
    referralTier: 'TIER_1' as const,
  },
}

const HALL_OF_FAME_MOCK = [
  {
    id: 'cust-001',
    firstName: 'Sofía',
    lastName: 'Hernández',
    referralCount: 12,
    referralTier: 'TIER_2' as const,
    tierUnlockedAt: '2026-04-15T10:00:00.000Z',
  },
  {
    id: 'cust-002',
    firstName: 'Jose',
    lastName: 'Pérez',
    referralCount: 7,
    referralTier: 'TIER_1' as const,
    tierUnlockedAt: '2026-04-20T10:00:00.000Z',
  },
  {
    id: 'cust-003',
    firstName: 'Mariana',
    lastName: 'López',
    referralCount: 3,
    referralTier: null,
    tierUnlockedAt: null,
  },
]

const REFERRALS_LIST_PENDING = [
  {
    id: 'ref-001',
    status: 'PENDING' as const,
    createdAt: '2026-05-25T10:00:00.000Z',
    qualifiedAt: null,
    voidedAt: null,
    forcedOverride: false,
    referrerCustomer: { id: 'cust-001', firstName: 'Sofía', lastName: 'Hernández', referralTier: 'TIER_2' as const },
    referredCustomer: { id: 'cust-100', firstName: 'Carlos', lastName: 'Ruiz' },
    rewardDiscount: null,
  },
]

const REFERRALS_LIST_QUALIFIED = [
  {
    id: 'ref-002',
    status: 'QUALIFIED' as const,
    createdAt: '2026-05-26T10:00:00.000Z',
    qualifiedAt: '2026-05-27T11:00:00.000Z',
    voidedAt: null,
    forcedOverride: false,
    referrerCustomer: { id: 'cust-002', firstName: 'Jose', lastName: 'Pérez', referralTier: 'TIER_1' as const },
    referredCustomer: { id: 'cust-101', firstName: 'Ana', lastName: 'García' },
    rewardDiscount: { id: 'disc-001', value: 15, active: true },
  },
]

const REFERRALS_LIST_ALL = [...REFERRALS_LIST_PENDING, ...REFERRALS_LIST_QUALIFIED]

// ─── Helpers ─────────────────────────────────────────────────────

async function hideDevtools(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const style = document.createElement('style')
    style.textContent = '.tsqd-parent-container { display: none !important; }'
    if (document.head) {
      document.head.appendChild(style)
    } else {
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
    }
  })
}

interface ReferralsMocksOptions {
  hallOfFame?: typeof HALL_OF_FAME_MOCK
  /** If true, /referrals returns the empty list. */
  emptyList?: boolean
}

async function setupReferralsPageMocks(page: Page, opts: ReferralsMocksOptions = {}): Promise<void> {
  const hallOfFame = opts.hallOfFame ?? HALL_OF_FAME_MOCK

  // GET /config — active
  await page.route('**/api/v1/dashboard/venues/*/referrals/config', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ACTIVE_CONFIG),
    }),
  )

  // GET /summary
  await page.route('**/api/v1/dashboard/venues/*/referrals/summary', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SUMMARY_MOCK),
    }),
  )

  // GET /hall-of-fame
  await page.route('**/api/v1/dashboard/venues/*/referrals/hall-of-fame*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(hallOfFame),
    }),
  )

  // GET / (list referrals — paginated) — must respond to query-param filter
  await page.route('**/api/v1/dashboard/venues/*/referrals?*', route => {
    if (opts.emptyList) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 25 }),
      })
    }
    const url = new URL(route.request().url())
    const status = url.searchParams.get('status')
    let items = REFERRALS_LIST_ALL
    if (status === 'PENDING') items = REFERRALS_LIST_PENDING
    if (status === 'QUALIFIED') items = REFERRALS_LIST_QUALIFIED
    if (status === 'VOID') items = []
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items, total: items.length, page: 1, pageSize: 25 }),
    })
  })
}

async function navigateToReferrals(page: Page): Promise<void> {
  await page.goto('/venues/venue-alpha/referrals')
  await page.waitForLoadState('networkidle').catch(() => {
    // ignore — bg sockets may never settle in CI
  })
}

// ─── Tests ───────────────────────────────────────────────────────

test.describe('Referrals page — Hall of Fame + Recent table', () => {
  test('1 — ADMIN sees Hall of Fame with 3 entries on active program', async ({ page }) => {
    await hideDevtools(page)
    await setupApiMocks(page, {
      userRole: StaffRole.ADMIN,
      venues: [makeVenue()],
    })
    await setupReferralsPageMocks(page)

    await navigateToReferrals(page)

    // Wait for the active-state heading
    await expect(
      page.getByRole('heading', { name: /Programa de Referidos|Referral Program/i }).first(),
    ).toBeVisible({ timeout: 15_000 })

    // Hall of Fame heading visible
    await expect(page.getByText(/Hall of Fame/).first()).toBeVisible()

    // Grid has 3 entries
    const entries = page.locator('[data-testid="hall-of-fame-entry"]')
    await expect(entries).toHaveCount(3)

    // Top referrer name + count visible inside grid
    await expect(page.getByText(/Sofía Hernández/).first()).toBeVisible()
  })

  test('2 — ADMIN sees Hall of Fame empty state when no referrers exist', async ({ page }) => {
    await hideDevtools(page)
    await setupApiMocks(page, {
      userRole: StaffRole.ADMIN,
      venues: [makeVenue()],
    })
    await setupReferralsPageMocks(page, { hallOfFame: [] })

    await navigateToReferrals(page)

    await expect(
      page.getByRole('heading', { name: /Programa de Referidos|Referral Program/i }).first(),
    ).toBeVisible({ timeout: 15_000 })

    // Empty state container present
    await expect(page.locator('[data-testid="hall-of-fame-empty"]')).toBeVisible()

    // Empty-state copy
    await expect(
      page.getByText(/Aún nadie ha referido|No one has referred anyone yet/).first(),
    ).toBeVisible()
  })

  test('3 — ADMIN sees recent referrals table rows + can filter by status', async ({ page }) => {
    await hideDevtools(page)
    await setupApiMocks(page, {
      userRole: StaffRole.ADMIN,
      venues: [makeVenue()],
    })
    await setupReferralsPageMocks(page)

    await navigateToReferrals(page)

    await expect(
      page.getByRole('heading', { name: /Programa de Referidos|Referral Program/i }).first(),
    ).toBeVisible({ timeout: 15_000 })

    const table = page.locator('[data-testid="recent-referrals-table"]')
    await expect(table).toBeVisible()

    // Both rows visible by default (no filter)
    await expect(table.getByText(/Carlos Ruiz/).first()).toBeVisible()
    await expect(table.getByText(/Ana García/).first()).toBeVisible()

    // Filter to QUALIFIED
    const filter = page.locator('[data-testid="recent-referrals-status-filter"]')
    await filter.click()
    await page.getByRole('option', { name: /Calificado|Qualified/i }).first().click()

    // Only Ana (QUALIFIED) remains; Carlos (PENDING) hidden
    await expect(table.getByText(/Ana García/).first()).toBeVisible()
    await expect(table.locator('text=Carlos Ruiz')).toHaveCount(0)

    // Filter to VOID (mocked empty)
    await filter.click()
    await page.getByRole('option', { name: /Anulado|Void/i }).first().click()
    await expect(page.locator('[data-testid="recent-referrals-empty"]')).toBeVisible()
  })
})
