/**
 * E2E tests for the Pro→Free downgrade "choose who stays" flow.
 *
 * Flow — venue on an active PRO plan with 4 active users (Free cap = 2):
 *   the plan portal's Free card shows "Switch to Free"; clicking it fetches
 *   the downgrade preview (`required: true`) and opens the
 *   DowngradeReconcileDialog where the owner picks who stays:
 *     • title from billing:plan.downgrade.title ("Choose who stays")
 *     • the OWNER row is pre-selected AND locked (can't be unchecked)
 *     • counter starts at "1/2 selected"
 *     • selecting one more → "2/2 selected" and the remaining rows disable
 *
 * Endpoints mocked via setupApiMocks options: `planState` (PRO active) and
 * `downgradePreview` (required, 4 staff). App E2E locale is English.
 */

import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

// ─── Fixtures ────────────────────────────────────────────────────

const BILLING_VENUE = createMockVenue({
  id: 'venue-alpha',
  name: 'Restaurante Alpha',
  slug: 'venue-alpha',
  permissions: [
    'home:read',
    'menu:read',
    'teams:read', 'teams:invite',
    'orders:read', 'orders:update',
    'payments:read',
    'reports:read',
    'settings:read', 'settings:update',
    'billing:read', 'billing:subscriptions:read',
  ],
})

const PRO_PLAN_STATE = {
  hasPlan: true,
  state: 'active' as const,
  planTier: 'PRO' as const,
  planName: 'Avoqado Pro',
  interval: 'month' as const,
  price: { base: 999, gross: 1158.84, currency: 'MXN' as const },
  currentPeriodEnd: '2026-07-01T00:00:00.000Z',
  stripeSubscriptionId: 'sub_test_e2e_001',
  grandfathered: false,
}

const DOWNGRADE_PREVIEW = {
  required: true,
  cap: 2,
  currentActive: 4,
  keepMax: 2,
  staff: [
    {
      staffVenueId: 'sv-owner',
      staffId: 'staff-001',
      name: 'Olivia Owner',
      email: 'owner@test.com',
      role: 'OWNER',
      isOwner: true,
      lastActiveAt: '2026-06-08T12:00:00.000Z',
    },
    {
      staffVenueId: 'sv-002',
      staffId: 'staff-002',
      name: 'Walter Waiter',
      email: 'walter@test.com',
      role: 'WAITER',
      isOwner: false,
      lastActiveAt: '2026-06-07T12:00:00.000Z',
    },
    {
      staffVenueId: 'sv-003',
      staffId: 'staff-003',
      name: 'Carla Cashier',
      email: 'carla@test.com',
      role: 'CASHIER',
      isOwner: false,
      lastActiveAt: '2026-06-06T12:00:00.000Z',
    },
    {
      staffVenueId: 'sv-004',
      staffId: 'staff-004',
      name: 'Manny Manager',
      email: 'manny@test.com',
      role: 'MANAGER',
      isOwner: false,
      lastActiveAt: null,
    },
  ],
}

// ─── Helpers ────────────────────────────────────────────────────

async function openDowngradeDialog(page: import('@playwright/test').Page) {
  await page.goto('/venues/venue-alpha/settings/billing/subscriptions')

  // Plan picker renders the Free card with the downgrade CTA (current tier is PRO)
  const freeCard = page.locator('[data-tour="plan-card-free"]')
  await freeCard.waitFor({ state: 'visible', timeout: 15_000 })

  await freeCard.getByRole('button', { name: /switch to free/i }).click()

  // Preview (required: true) opens the reconcile FullScreenModal
  await expect(page.getByRole('heading', { name: 'Choose who stays' })).toBeVisible({ timeout: 10_000 })
}

// ─── Tests ──────────────────────────────────────────────────────

test.describe('Pro→Free downgrade — choose who stays', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page, {
      userRole: StaffRole.OWNER,
      venues: [BILLING_VENUE],
      planState: PRO_PLAN_STATE,
      downgradePreview: DOWNGRADE_PREVIEW,
    })
    // Hide TanStack Query devtools overlay that intercepts pointer events in dev mode
    await page.addInitScript(() => {
      const style = document.createElement('style')
      style.textContent = '.tsqd-parent-container { display: none !important; }'
      if (document.head) document.head.appendChild(style)
      else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
    })
  })

  test('"Switch to Free" opens the reconcile modal with the owner pre-selected and locked', async ({ page }) => {
    await openDowngradeDialog(page)

    // All 4 roster rows render
    await expect(page.getByText('Olivia Owner')).toBeVisible()
    await expect(page.getByText('Walter Waiter')).toBeVisible()
    await expect(page.getByText('Carla Cashier')).toBeVisible()
    await expect(page.getByText('Manny Manager')).toBeVisible()

    // Owner row: pre-selected, badged, and its checkbox locked
    const ownerRow = page.locator('[data-tour="downgrade-staff-sv-owner"]')
    await expect(ownerRow).toHaveAttribute('aria-pressed', 'true')
    await expect(ownerRow.getByText(/you \/ owner/i)).toBeVisible()
    await expect(ownerRow.getByRole('checkbox')).toBeDisabled()

    // Counter starts with only the owner selected
    await expect(page.getByText('1/2 selected')).toBeVisible()

    // Clicking the owner row must NOT deselect it (locked).
    // force: the row is aria-disabled (locked), which Playwright treats as
    // non-actionable — we click anyway to prove it's a no-op. force:true skips
    // auto-scrolling, so scroll first or the click errors out of viewport.
    await ownerRow.scrollIntoViewIfNeeded()
    await ownerRow.click({ force: true })
    await expect(ownerRow).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('1/2 selected')).toBeVisible()
  })

  test('selecting one more user fills the cap and disables the remaining rows', async ({ page }) => {
    await openDowngradeDialog(page)
    await expect(page.getByText('1/2 selected')).toBeVisible()

    // Pick Walter → cap (2/2) reached
    await page.locator('[data-tour="downgrade-staff-sv-002"]').click()
    await expect(page.getByText('2/2 selected')).toBeVisible()
    await expect(page.locator('[data-tour="downgrade-staff-sv-002"]')).toHaveAttribute('aria-pressed', 'true')

    // Remaining non-selected rows are disabled
    const carla = page.locator('[data-tour="downgrade-staff-sv-003"]')
    const manny = page.locator('[data-tour="downgrade-staff-sv-004"]')
    await expect(carla).toHaveAttribute('aria-disabled', 'true')
    await expect(manny).toHaveAttribute('aria-disabled', 'true')
    await expect(carla.getByRole('checkbox')).toBeDisabled()
    await expect(manny.getByRole('checkbox')).toBeDisabled()

    // Clicking a disabled row doesn't change the selection (force: bypass
    // Playwright's enabled check — the click must be a functional no-op).
    // force:true skips auto-scrolling, so scroll into view first.
    await carla.scrollIntoViewIfNeeded()
    await carla.click({ force: true })
    await expect(page.getByText('2/2 selected')).toBeVisible()
    await expect(carla).toHaveAttribute('aria-pressed', 'false')

    // Deselecting Walter frees a slot again — rows re-enable
    await page.locator('[data-tour="downgrade-staff-sv-002"]').click()
    await expect(page.getByText('1/2 selected')).toBeVisible()
    await expect(carla).toHaveAttribute('aria-disabled', 'false')
  })
})
