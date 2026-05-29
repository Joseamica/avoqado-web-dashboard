/**
 * E2E tests for the Referrals MVP page (Plan 2).
 *
 * Covers three personas against /venues/venue-alpha/referrals:
 *   1. ADMIN — inactive state → sees + clicks activate button → success banner appears
 *   2. VIEWER — inactive state → page renders but activate CTA is hidden (permission gate)
 *   3. OWNER — already-active state → sees pause button + summary metrics
 *
 * Backend endpoints mocked:
 *   GET  /api/v1/dashboard/venues/:venueId/referrals/config   ({ active: false } or full config)
 *   POST /api/v1/dashboard/venues/:venueId/referrals/activate ({ ok: true })
 *   GET  /api/v1/dashboard/venues/:venueId/referrals/summary  (summary object)
 *
 * Navigation: /venues/venue-alpha/referrals
 */

import { test, expect, Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

// ─── Config ──────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' })
test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

// ─── Fixtures ────────────────────────────────────────────────────

const ADMIN_PERMISSIONS = [
  'home:read',
  'customers:read',
  'referral:read',
  'referral:configure',
  'referral:override-existing-customer',
  'referral:void-manual',
  'referral:export-csv',
]

const VIEWER_PERMISSIONS = [
  'home:read',
  'customers:read',
  'referral:read',
]

function makeVenue(permissions: string[]) {
  return createMockVenue({
    id: 'venue-alpha',
    name: 'Restaurante Alpha',
    slug: 'venue-alpha',
    permissions,
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

/**
 * Mock the referrals API. `state` selects which config the GET /config endpoint returns.
 * Returns the array of captured activate POST bodies (for assertion).
 */
async function setupReferralsMocks(
  page: Page,
  state: 'inactive' | 'active',
): Promise<{ captured: unknown[] }> {
  const captured: unknown[] = []

  // POST /activate — capture the body, return ok
  await page.route('**/api/v1/dashboard/venues/*/referrals/activate', async route => {
    if (route.request().method() === 'POST') {
      try {
        captured.push(route.request().postDataJSON())
      } catch {
        captured.push(route.request().postData())
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    }
    return route.continue()
  })

  // POST /deactivate
  await page.route('**/api/v1/dashboard/venues/*/referrals/deactivate', route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    }
    return route.continue()
  })

  // GET /summary
  await page.route('**/api/v1/dashboard/venues/*/referrals/summary', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SUMMARY_MOCK),
    }),
  )

  // GET /config — selectable state
  await page.route('**/api/v1/dashboard/venues/*/referrals/config', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state === 'active' ? ACTIVE_CONFIG : { active: false }),
    }),
  )

  return { captured }
}

async function navigateToReferrals(page: Page): Promise<void> {
  await page.goto('/venues/venue-alpha/referrals')
  await page.waitForLoadState('networkidle').catch(() => {
    // ignore — some bg sockets may never settle in CI
  })
}

// ─── Tests ───────────────────────────────────────────────────────

test.describe('Referrals MVP — multi-persona', () => {
  test('1 — ADMIN sees activate CTA on inactive state and can submit', async ({ page }) => {
    await hideDevtools(page)
    await setupApiMocks(page, {
      userRole: StaffRole.ADMIN,
      venues: [makeVenue(ADMIN_PERMISSIONS)],
    })
    const { captured } = await setupReferralsMocks(page, 'inactive')

    await navigateToReferrals(page)

    // Page title visible
    await expect(
      page.getByRole('heading', { name: /Programa de Referidos|Referral Program/i }).first(),
    ).toBeVisible({ timeout: 15_000 })

    // The activation header copy is visible (inactive flow)
    await expect(
      page.getByText(/Activar el programa de referidos|Activate the referral program/i).first(),
    ).toBeVisible()

    // Submit button is visible (PermissionGate allows it for ADMIN)
    const submitBtn = page.locator('[data-tour="referrals-activate-btn"]')
    await expect(submitBtn).toBeVisible()
    await expect(submitBtn).toBeEnabled()

    // Default tier values populated
    await expect(page.locator('#tier1Required')).toHaveValue('7')
    await expect(page.locator('#tier1Reward')).toHaveValue('15')
    await expect(page.locator('#tier3Reward')).toHaveValue('25')
    await expect(page.locator('#rewardCouponExpiryDays')).toHaveValue('90')

    // Click submit → triggers POST /activate
    await submitBtn.click()

    // Wait for the captured payload
    await expect.poll(() => captured.length, { timeout: 10_000 }).toBeGreaterThan(0)

    // Payload sanity: defaults round-tripped
    const body = captured[0] as Record<string, number>
    expect(body.newCustomerDiscountPercent).toBe(10)
    expect(body.tier1ReferralsRequired).toBe(7)
    expect(body.tier3RewardPercent).toBe(25)
    expect(body.rewardCouponExpiryDays).toBe(90)
  })

  test('2 — VIEWER renders the page but does NOT see the activate CTA', async ({ page }) => {
    await hideDevtools(page)
    await setupApiMocks(page, {
      userRole: StaffRole.VIEWER,
      venues: [makeVenue(VIEWER_PERMISSIONS)],
    })
    await setupReferralsMocks(page, 'inactive')

    await navigateToReferrals(page)

    // Title still renders
    await expect(
      page.getByRole('heading', { name: /Programa de Referidos|Referral Program/i }).first(),
    ).toBeVisible({ timeout: 15_000 })

    // Activation header copy is still shown (page is read-only for VIEWER)
    await expect(
      page.getByText(/Activar el programa de referidos|Activate the referral program/i).first(),
    ).toBeVisible()

    // The activate button must NOT be present (permission gate hides it)
    await expect(page.locator('[data-tour="referrals-activate-btn"]')).toHaveCount(0)

    // The "no permission" notice is shown instead
    await expect(
      page.getByText(/No tienes permisos para configurar|You don't have permission to configure/i).first(),
    ).toBeVisible()
  })

  test('3 — OWNER sees summary + pause button on active state', async ({ page }) => {
    await hideDevtools(page)
    await setupApiMocks(page, {
      userRole: StaffRole.OWNER,
      venues: [makeVenue(ADMIN_PERMISSIONS)],
    })
    await setupReferralsMocks(page, 'active')

    await navigateToReferrals(page)

    // Title visible
    await expect(
      page.getByRole('heading', { name: /Programa de Referidos|Referral Program/i }).first(),
    ).toBeVisible({ timeout: 15_000 })

    // "Activo desde / Active since" banner
    await expect(page.getByText(/Activo desde|Active since/i).first()).toBeVisible()

    // Pause button visible (OWNER has referral:configure via wildcard)
    const pauseBtn = page.locator('[data-tour="referrals-pause-btn"]')
    await expect(pauseBtn).toBeVisible()

    // Summary metrics rendered
    await expect(page.getByText(/Referidos este mes|Referrals this month/i).first()).toBeVisible()
    await expect(page.getByText('14').first()).toBeVisible() // referralsThisMonth value

    // Conversion percentage rendered
    await expect(page.getByText(/Conversión|Conversion/i).first()).toBeVisible()
    await expect(page.getByText('42%').first()).toBeVisible()

    // Top referrer rendered
    await expect(page.getByText(/Top referidor|Top referrer/i).first()).toBeVisible()
    await expect(page.getByText(/Sofía Hernández/).first()).toBeVisible()
  })
})
