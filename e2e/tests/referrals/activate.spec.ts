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

const VIEWER_PERMISSIONS = ['home:read', 'customers:read', 'referral:read']

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
async function setupReferralsMocks(page: Page, state: 'inactive' | 'active'): Promise<{ captured: unknown[] }> {
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
    await expect(page.getByRole('heading', { name: /Programa de Referidos|Referral Program/i }).first()).toBeVisible({ timeout: 15_000 })

    // The activation header copy is visible (inactive flow)
    await expect(page.getByText(/Activar el programa de referidos|Activate the referral program/i).first()).toBeVisible()

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
    const body = captured[0] as {
      newCustomerDiscountPercent: number
      tier1ReferralsRequired: number
      rewardCouponExpiryDays: number
      tiers: Array<{ tierLevel: number; rewardType: string; recurrence: string; rewardPercent: number }>
    }
    expect(body.newCustomerDiscountPercent).toBe(10)
    expect(body.tier1ReferralsRequired).toBe(7)
    expect(body.tiers).toContainEqual({
      tierLevel: 3,
      rewardType: 'PERCENT_COUPON',
      recurrence: 'ONE_TIME',
      rewardPercent: 25,
    })
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
    await expect(page.getByRole('heading', { name: /Programa de Referidos|Referral Program/i }).first()).toBeVisible({ timeout: 15_000 })

    // Activation header copy is still shown (page is read-only for VIEWER)
    await expect(page.getByText(/Activar el programa de referidos|Activate the referral program/i).first()).toBeVisible()

    // The activate button must NOT be present (permission gate hides it)
    await expect(page.locator('[data-tour="referrals-activate-btn"]')).toHaveCount(0)

    // The "no permission" notice is shown instead
    await expect(page.getByText(/No tienes permisos para configurar|You don't have permission to configure/i).first()).toBeVisible()
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
    await expect(page.getByRole('heading', { name: /Programa de Referidos|Referral Program/i }).first()).toBeVisible({ timeout: 15_000 })

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

  // ─── D28 (hz:be99f328:D28): pausa, reactivar y editar premio y vigencia, viendo el resultado SIN recargar ───────────
  test('4 — en pausa enseña lo guardado y «Reactivar» lo prende sin recargar, por /reactivate', async ({ page }) => {
    await hideDevtools(page)
    await setupApiMocks(page, { userRole: StaffRole.ADMIN, venues: [makeVenue(ADMIN_PERMISSIONS)] })
    const llamadas = await setupStatefulReferralsMocks(page, { ...SAVED_CONFIG, active: false })

    await page.goto('/venues/venue-alpha/referrals')
    await expect(page.getByText(/Programa en pausa|Program paused/i).first()).toBeVisible({ timeout: 15_000 })
    // Lo guardado, no los números de fábrica: 12 %, nivel 2 con producto gratis, 30 días.
    await expect(page.getByText('12%').first()).toBeVisible()
    await expect(page.getByText(/Nivel 2 · 9 referidos → 1× Smoothie verde gratis|Level 2 · 9 referrals → 1× Smoothie verde free/).first()).toBeVisible()
    await expect(page.locator('[data-tour="referrals-activate-btn"]')).toHaveCount(0)

    await page.locator('[data-tour="referrals-reactivate-btn"]').click()

    await expect(page.getByText(/Activo desde|Active since/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-tour="referrals-pause-btn"]')).toBeVisible()
    await expect(page.getByText(/Nivel 2 · 9 referidos → 1× Smoothie verde gratis|Level 2 · 9 referrals → 1× Smoothie verde free/).first()).toBeVisible()
    expect(llamadas.reactivate).toBe(1)
    expect(llamadas.activate).toBe(0)
  })

  test('5 — activo: «Editar» cambia el premio al referido y se ve sin recargar', async ({ page }) => {
    await hideDevtools(page)
    await setupApiMocks(page, { userRole: StaffRole.ADMIN, venues: [makeVenue(ADMIN_PERMISSIONS)] })
    const llamadas = await setupStatefulReferralsMocks(page, { ...SAVED_CONFIG, active: true })

    await page.goto('/venues/venue-alpha/referrals')
    await expect(page.getByText('12%').first()).toBeVisible({ timeout: 15_000 })

    await page.locator('[data-tour="referrals-new-customer-discount-edit-btn"]').click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('#basicsDiscount').fill('18')
    await dialog.getByRole('button', { name: /Guardar cambios|Save changes/i }).click()

    await expect(page.getByText('18%').first()).toBeVisible({ timeout: 10_000 })
    expect(llamadas.patches).toEqual([{ newCustomerDiscountPercent: 18 }])
  })
})

// Config guardada de un negocio que ya armó su programa (con un producto gratis en el nivel 2).
const SAVED_CONFIG = {
  ...ACTIVE_CONFIG,
  newCustomerDiscountPercent: '12',
  tier1ReferralsRequired: 5,
  tier2ReferralsRequired: 9,
  tier3ReferralsRequired: 15,
  rewardCouponExpiryDays: 30,
  tierRewards: [
    { id: 'tr-1', configId: 'rpc-001', tierLevel: 1, rewardType: 'PERCENT_COUPON', recurrence: 'ONE_TIME', rewardPercent: '15', rewardProductId: null, rewardQuantity: 1, active: true, createdAt: '2026-05-01T10:00:00.000Z' },
    { id: 'tr-2', configId: 'rpc-001', tierLevel: 2, rewardType: 'FREE_PRODUCT', recurrence: 'ONE_TIME', rewardPercent: null, rewardProductId: 'prod-smoothie', rewardQuantity: 1, active: true, createdAt: '2026-05-01T10:00:00.000Z' },
    { id: 'tr-3', configId: 'rpc-001', tierLevel: 3, rewardType: 'PERCENT_COUPON', recurrence: 'ONE_TIME', rewardPercent: '25', rewardProductId: null, rewardQuantity: 1, active: true, createdAt: '2026-05-01T10:00:00.000Z' },
  ],
}

/** Un «servidor» con memoria: lo que se reactiva o se guarda es lo que la página vuelve a leer. */
async function setupStatefulReferralsMocks(page: Page, inicial: Record<string, unknown>) {
  let config = { ...inicial }
  const llamadas = { reactivate: 0, activate: 0, patches: [] as unknown[] }
  await page.route('**/api/v1/dashboard/venues/*/referrals/summary', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SUMMARY_MOCK) }),
  )
  await page.route('**/api/v1/dashboard/venues/*/referrals/hall-of-fame*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/api/v1/dashboard/venues/*/products/prod-smoothie*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'prod-smoothie', name: 'Smoothie verde' }) }),
  )
  await page.route('**/api/v1/dashboard/venues/*/referrals/activate', route => {
    llamadas.activate++
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
  await page.route('**/api/v1/dashboard/venues/*/referrals/reactivate', route => {
    llamadas.reactivate++
    config = { ...config, active: true }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, reactivated: true }) })
  })
  await page.route('**/api/v1/dashboard/venues/*/referrals/config', route => {
    if (route.request().method() === 'PATCH') {
      const patch = route.request().postDataJSON()
      llamadas.patches.push(patch)
      config = { ...config, ...patch }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) })
  })
  return llamadas
}

