/**
 * E2E tests for plan-tier feature gating (FeatureGate paywall + sidebar badges).
 *
 * Flow 1 — Free venue (planTier GRATIS, grandfathered: false, no feature grants):
 *   the Reservations page (PRO feature `RESERVATIONS`) shows the FeatureGate
 *   paywall card, the content behind is blurred + NOT interactable, and the
 *   sidebar "Reservations" item carries the Pro star badge
 *   (aria-label "Included in the Pro Plan").
 *
 * Flow 2 — Grandfathered legacy venue (same plan, grandfathered: true):
 *   exempt from ALL tier monetization → page renders WITHOUT the paywall and
 *   the sidebar carries NO tier badge.
 *
 * Plan endpoints are mocked via the `planState` option of setupApiMocks
 * (GET /venues/:id/plan + /features). The app's E2E locale is English
 * (i18n fallback 'en' under Playwright's default en-US Chromium).
 */

import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { setupReservationMocks, createMockReservation } from '../../fixtures/reservation-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

// ─── Fixtures ────────────────────────────────────────────────────

const TIER_VENUE = createMockVenue({
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
    'reservations:read', 'reservations:create', 'reservations:update', 'reservations:delete',
  ],
  modules: [
    { module: { id: 'mod-team', code: 'TEAM', name: 'Team Management' }, enabled: true },
    { module: { id: 'mod-res', code: 'RESERVATIONS', name: 'Reservations' }, enabled: true },
  ],
})

const RESERVATIONS = [
  createMockReservation({ id: 'res-001', status: 'CONFIRMED', guestName: 'Alice Smith' }),
  createMockReservation({ id: 'res-002', status: 'PENDING', guestName: 'Bob Jones' }),
]

const PRO_BADGE_LABEL = 'Included in the Pro Plan'
const PREMIUM_BADGE_LABEL = 'Included in the Premium Plan'

// ─── Tests ──────────────────────────────────────────────────────

test.describe('FeatureGate paywall — Free venue', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page, {
      userRole: StaffRole.OWNER,
      venues: [TIER_VENUE],
      // Free venue, NOT grandfathered → PRO features must paywall.
      planState: { hasPlan: false, state: 'none', planTier: 'GRATIS', grandfathered: false },
    })
    await setupReservationMocks(page, { reservations: RESERVATIONS })
    // Hide TanStack Query devtools overlay that intercepts pointer events in dev mode
    await page.addInitScript(() => {
      const style = document.createElement('style')
      style.textContent = '.tsqd-parent-container { display: none !important; }'
      if (document.head) document.head.appendChild(style)
      else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
    })
  })

  test('reservations page shows the "Included in Pro" paywall card', async ({ page }) => {
    await page.goto('/venues/venue-alpha/reservations')

    // Paywall card: tier tag + upgrade CTA (billing:featureGate.* keys)
    await expect(page.getByText(/included in pro/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /upgrade to pro/i })).toBeVisible()
  })

  test('gated page content is blurred and NOT interactable', async ({ page }) => {
    await page.goto('/venues/venue-alpha/reservations')
    await expect(page.getByText(/included in pro/i)).toBeVisible({ timeout: 15_000 })

    // The teaser wrapper hides the content from the a11y tree and blocks pointer events.
    const newBtn = page.locator('[data-tour="reservations-new-btn"]')
    const teaser = page.locator('div[aria-hidden="true"]').filter({ has: newBtn })
    await expect(teaser).toHaveClass(/pointer-events-none/)

    // Functional check: the create CTA behind the gate cannot receive a click.
    let blocked = false
    try {
      await newBtn.click({ trial: true, timeout: 2_000 })
    } catch {
      blocked = true
    }
    expect(blocked, 'create button behind the paywall must not be clickable').toBe(true)
  })

  test('sidebar shows the Pro star badge on the Reservations item', async ({ page }) => {
    await page.goto('/venues/venue-alpha/reservations')
    await expect(page.getByText(/included in pro/i)).toBeVisible({ timeout: 15_000 })

    // The main rail slides off-screen while inside the reservations section, so
    // assert the badge is attached (rendered) rather than on-screen visible.
    const badge = page.locator(`[data-tour="sidebar-reservations"] [aria-label="${PRO_BADGE_LABEL}"]`)
    await expect(badge).toHaveCount(1)
  })
})

test.describe('FeatureGate bypass — grandfathered legacy venue', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page, {
      userRole: StaffRole.OWNER,
      venues: [TIER_VENUE],
      // Same Free tier but grandfathered → exempt from ALL tier monetization.
      planState: { hasPlan: false, state: 'none', planTier: 'GRATIS', grandfathered: true },
    })
    await setupReservationMocks(page, { reservations: RESERVATIONS })
    await page.addInitScript(() => {
      const style = document.createElement('style')
      style.textContent = '.tsqd-parent-container { display: none !important; }'
      if (document.head) document.head.appendChild(style)
      else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
    })
  })

  test('reservations page renders WITHOUT the paywall and stays interactable', async ({ page }) => {
    await page.goto('/venues/venue-alpha/reservations')

    // Real page content loads (mocked reservations are listed)
    await expect(page.getByText('Alice Smith')).toBeVisible({ timeout: 15_000 })

    // No paywall card
    await expect(page.getByText(/included in pro/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /upgrade to pro/i })).toHaveCount(0)

    // The create CTA is reachable through the a11y tree and clickable (no aria-hidden teaser)
    const newBtn = page.locator('[data-tour="reservations-new-btn"]')
    await expect(newBtn).toBeVisible()
    await newBtn.click({ trial: true })
  })

  test('sidebar shows NO tier badge on the Reservations item', async ({ page }) => {
    await page.goto('/venues/venue-alpha/reservations')
    await expect(page.getByText('Alice Smith')).toBeVisible({ timeout: 15_000 })

    // The nav item renders (desktop rail + sub-sidebar header may duplicate it)
    const item = page.locator('[data-tour="sidebar-reservations"]')
    expect(await item.count()).toBeGreaterThan(0)
    // ...but with NO tier badge anywhere on it
    await expect(item.locator(`[aria-label="${PRO_BADGE_LABEL}"]`)).toHaveCount(0)
    await expect(item.locator(`[aria-label="${PREMIUM_BADGE_LABEL}"]`)).toHaveCount(0)
  })
})
