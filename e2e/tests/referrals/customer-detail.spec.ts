/**
 * E2E tests for the Customer Detail ReferralCard (Plan 2 EXTENSION).
 *
 * Personas:
 *   1. ADMIN viewing a customer WITH a referral code (state A) — sees code, copy, WhatsApp, progress bar
 *   2. ADMIN viewing a customer WITH tier (state B) — sees tier badge + "Has referred N people"
 *   3. ADMIN viewing a legacy customer (referralCode = null, state C) — sees "Activate code now" button
 *   4. VIEWER (only referral:read) viewing state C — does NOT see the activate button
 *
 * Navigation: /venues/venue-alpha/customers/:customerId
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
  'customers:update',
  'customers:delete',
  'loyalty:adjust',
  'loyalty:read',
  'referral:read',
  'referral:configure',
]

const VIEWER_PERMISSIONS = ['home:read', 'customers:read', 'loyalty:read', 'referral:read']

function makeVenue(permissions: string[]) {
  return createMockVenue({
    id: 'venue-alpha',
    name: 'Restaurante Alpha',
    slug: 'venue-alpha',
    permissions,
  })
}

const BASE_CUSTOMER = {
  id: 'cust-001',
  venueId: 'venue-alpha',
  firstName: 'Mariana',
  lastName: 'López',
  email: 'mariana@test.com',
  phone: '+525555550000',
  totalSpent: 2500,
  averageOrderValue: 250,
  visitCount: 10,
  lastVisit: '2026-05-20T10:00:00.000Z',
  loyaltyPoints: 100,
  customerGroupId: null,
  customerGroup: null,
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-05-20T10:00:00.000Z',
  pendingOrderCount: 0,
  pendingBalance: 0,
  orders: [],
}

const CUSTOMER_STATE_A = {
  ...BASE_CUSTOMER,
  referralCode: 'ALPHA-MARI8K7',
  referralCount: 2,
  referralTier: null,
  tierUnlockedAt: null,
  referredByCustomerId: 'cust-002',
  referredByCustomer: { id: 'cust-002', firstName: 'Jose', lastName: 'Pérez' },
}

const CUSTOMER_STATE_B = {
  ...BASE_CUSTOMER,
  referralCode: 'ALPHA-MARI8K7',
  referralCount: 9,
  referralTier: 'TIER_1' as const,
  tierUnlockedAt: '2026-03-23T00:00:00.000Z',
  referredByCustomerId: 'cust-002',
  referredByCustomer: { id: 'cust-002', firstName: 'Jose', lastName: 'Pérez' },
}

const CUSTOMER_STATE_C = {
  ...BASE_CUSTOMER,
  referralCode: null,
  referralCount: 0,
  referralTier: null,
  tierUnlockedAt: null,
  referredByCustomerId: null,
  referredByCustomer: null,
}

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

async function setupCustomerMocks(
  page: Page,
  customer: Record<string, unknown>,
): Promise<{ generateCodeHits: number }> {
  const state = { generateCodeHits: 0 }

  // Customer detail (GET /:customerId)
  await page.route('**/api/v1/dashboard/venues/*/customers/cust-001', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(customer),
      })
    }
    return route.continue()
  })

  // Customer groups (used by edit dialog) — empty list
  await page.route('**/api/v1/dashboard/venues/*/customer-groups*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        meta: { totalCount: 0, pageSize: 100, currentPage: 1, totalPages: 0, hasNextPage: false, hasPrevPage: false },
      }),
    }),
  )

  // Loyalty transactions — empty list
  await page.route('**/api/v1/dashboard/venues/*/loyalty/customers/*/transactions*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        meta: { totalCount: 0, pageSize: 50, currentPage: 1, totalPages: 0, hasNextPage: false, hasPrevPage: false },
        currentBalance: 0,
      }),
    }),
  )

  // Loyalty config
  await page.route('**/api/v1/dashboard/venues/*/loyalty/config', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'lc-001',
        venueId: 'venue-alpha',
        pointsPerDollar: 1,
        pointsPerVisit: 0,
        redemptionRate: 0.1,
        minPointsRedeem: 100,
        pointsExpireDays: null,
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    }),
  )

  // Credit pack purchases — empty
  await page.route('**/api/v1/dashboard/venues/*/credit-packs/customers/*/purchases', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  )

  // Referrals customer history — empty list (only hit on expand)
  await page.route(
    '**/api/v1/dashboard/venues/*/referrals/customers/*/referrals',
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
  )

  // Generate code endpoint (State C activation)
  await page.route(
    '**/api/v1/dashboard/venues/*/referrals/customers/*/generate-code',
    route => {
      if (route.request().method() === 'POST') {
        state.generateCodeHits++
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ referralCode: 'ALPHA-MARI8K7' }),
        })
      }
      return route.continue()
    },
  )

  return state
}

async function navigateToCustomer(page: Page, customerId = 'cust-001'): Promise<void> {
  await page.goto(`/venues/venue-alpha/customers/${customerId}`)
  await page.waitForLoadState('networkidle').catch(() => {
    // ignore — bg sockets may never settle in CI
  })
}

// ─── Tests ───────────────────────────────────────────────────────

test.describe('CustomerDetail ReferralCard — multi-state', () => {
  test('1 — ADMIN viewing customer with code (state A) sees code, copy, WhatsApp, progress', async ({
    page,
  }) => {
    await hideDevtools(page)
    await setupApiMocks(page, {
      userRole: StaffRole.ADMIN,
      venues: [makeVenue(ADMIN_PERMISSIONS)],
    })
    await setupCustomerMocks(page, CUSTOMER_STATE_A)

    await navigateToCustomer(page)

    // Card visible
    const card = page.locator('[data-testid="referral-card"]')
    await expect(card).toBeVisible({ timeout: 15_000 })

    // Code shown
    await expect(page.locator('[data-testid="referral-card-code"]')).toHaveText('ALPHA-MARI8K7')

    // Copy + WhatsApp buttons visible
    await expect(page.locator('[data-testid="referral-card-copy-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="referral-card-whatsapp-btn"]')).toBeVisible()

    // WhatsApp link includes the code (the data-testid is on the <a> itself via asChild)
    const whatsappHref = await page
      .locator('[data-testid="referral-card-whatsapp-btn"]')
      .getAttribute('href')
    expect(whatsappHref).toContain('wa.me')
    expect(whatsappHref).toContain('ALPHA-MARI8K7')

    // Progress bar visible (state A — 2 of 7)
    await expect(page.locator('[data-testid="referral-card-progress"]')).toBeVisible()
    await expect(
      page.getByText(/2 de 7 hacia Nivel 1|2 of 7 toward Level 1/).first(),
    ).toBeVisible()

    // Referred by line visible
    await expect(
      page.getByText(/Referida por Jose Pérez|Referred by Jose Pérez/).first(),
    ).toBeVisible()
  })

  test('2 — ADMIN viewing customer with TIER_1 (state B) sees tier badge + has-referred count', async ({
    page,
  }) => {
    await hideDevtools(page)
    await setupApiMocks(page, {
      userRole: StaffRole.ADMIN,
      venues: [makeVenue(ADMIN_PERMISSIONS)],
    })
    await setupCustomerMocks(page, CUSTOMER_STATE_B)

    await navigateToCustomer(page)

    const card = page.locator('[data-testid="referral-card"]')
    await expect(card).toBeVisible({ timeout: 15_000 })

    // Tier badge present (state B header)
    await expect(
      page.getByText(/Nivel 1|Level 1/).first(),
    ).toBeVisible()

    // Has referred 9 people (count > 0 → toggle visible)
    await expect(
      page.getByText(/Ha referido a 9 personas|Has referred 9 people/).first(),
    ).toBeVisible()

    // The toggle is clickable
    await expect(page.locator('[data-testid="referral-card-toggle-list"]')).toBeVisible()
  })

  test('3 — ADMIN viewing legacy customer (state C) sees Activate code button', async ({
    page,
  }) => {
    await hideDevtools(page)
    await setupApiMocks(page, {
      userRole: StaffRole.ADMIN,
      venues: [makeVenue(ADMIN_PERMISSIONS)],
    })
    const mockState = await setupCustomerMocks(page, CUSTOMER_STATE_C)

    await navigateToCustomer(page)

    const card = page.locator('[data-testid="referral-card"]')
    await expect(card).toBeVisible({ timeout: 15_000 })

    // State C copy
    await expect(
      page
        .getByText(/aún no tiene código activo|doesn't have an active code yet/i)
        .first(),
    ).toBeVisible()

    // Activate button visible
    const activateBtn = page.locator('[data-testid="referral-card-activate-btn"]')
    await expect(activateBtn).toBeVisible()
    await expect(activateBtn).toBeEnabled()

    // Click triggers POST
    await activateBtn.click()
    await expect.poll(() => mockState.generateCodeHits, { timeout: 5_000 }).toBeGreaterThan(0)
  })

  test('4 — VIEWER viewing legacy customer does NOT see Activate code button', async ({
    page,
  }) => {
    await hideDevtools(page)
    await setupApiMocks(page, {
      userRole: StaffRole.VIEWER,
      venues: [makeVenue(VIEWER_PERMISSIONS)],
    })
    await setupCustomerMocks(page, CUSTOMER_STATE_C)

    await navigateToCustomer(page)

    const card = page.locator('[data-testid="referral-card"]')
    await expect(card).toBeVisible({ timeout: 15_000 })

    // State C copy still visible (read-only)
    await expect(
      page
        .getByText(/aún no tiene código activo|doesn't have an active code yet/i)
        .first(),
    ).toBeVisible()

    // The activate button is NOT present (permission gate hides it)
    await expect(page.locator('[data-testid="referral-card-activate-btn"]')).toHaveCount(0)
  })
})
