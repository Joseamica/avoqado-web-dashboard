/**
 * E2E tests for the Free-plan seat cap on the Teams page.
 *
 * Flow — Free venue at the 2-seat cap (seat-status `allowed: false`):
 *   clicking the "Invite Member" CTA must show the seat-cap upsell dialog
 *   ("You've reached your Free plan limit" + "Upgrade to Pro") INSTEAD of the
 *   invite form.
 *
 * Control — venue with available seats (`allowed: true`): the same CTA opens
 *   the normal invite form.
 *
 * Seat status is mocked via the `seatStatus` option of setupApiMocks
 * (GET /venues/:id/plan/seat-status). App E2E locale is English.
 */

import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, VENUE_ALPHA } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

// ─── Tests ──────────────────────────────────────────────────────

test.describe('Free-plan seat cap — invite paywall', () => {
  test('at the cap: Invite CTA opens the upsell dialog instead of the invite form', async ({ page }) => {
    await setupApiMocks(page, {
      userRole: StaffRole.OWNER,
      venues: [VENUE_ALPHA],
      planState: { hasPlan: false, state: 'none', planTier: 'GRATIS', grandfathered: false },
      // Free venue at the 2-seat cap → invites blocked.
      seatStatus: { cap: 2, active: 2, pending: 0, current: 2, allowed: false, exempt: false },
    })

    await page.goto(`/venues/${VENUE_ALPHA.slug}/team`)

    const inviteBtn = page.locator('#invite-member-button')
    await inviteBtn.waitFor({ state: 'visible', timeout: 15_000 })
    await inviteBtn.click()

    // Upsell dialog (team:seatCap.* keys) — NOT the invite form
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/you've reached your free plan limit/i)).toBeVisible({ timeout: 5_000 })
    await expect(dialog.getByText(/the free plan allows 2 users/i)).toBeVisible()
    await expect(dialog.getByRole('button', { name: /upgrade to pro/i })).toBeVisible()

    // The invite form must NOT be shown
    await expect(page.getByText('Invite Team Member')).toHaveCount(0)
    await expect(page.locator('#email')).toHaveCount(0)
  })

  test('upsell CTA navigates to the billing/subscriptions plan portal', async ({ page }) => {
    await setupApiMocks(page, {
      userRole: StaffRole.OWNER,
      venues: [VENUE_ALPHA],
      planState: { hasPlan: false, state: 'none', planTier: 'GRATIS', grandfathered: false },
      seatStatus: { cap: 2, active: 2, pending: 0, current: 2, allowed: false, exempt: false },
    })

    await page.goto(`/venues/${VENUE_ALPHA.slug}/team`)

    const inviteBtn = page.locator('#invite-member-button')
    await inviteBtn.waitFor({ state: 'visible', timeout: 15_000 })
    await inviteBtn.click()

    await page.locator('[data-tour="team-seatcap-upgrade"]').click()
    await expect(page).toHaveURL(/\/settings\/billing\/subscriptions/, { timeout: 10_000 })
  })

  test('under the cap: Invite CTA opens the normal invite form', async ({ page }) => {
    await setupApiMocks(page, {
      userRole: StaffRole.OWNER,
      venues: [VENUE_ALPHA],
      planState: { hasPlan: false, state: 'none', planTier: 'GRATIS', grandfathered: false },
      // 1 of 2 seats used → invites allowed.
      seatStatus: { cap: 2, active: 1, pending: 0, current: 1, allowed: true, exempt: false },
    })

    await page.goto(`/venues/${VENUE_ALPHA.slug}/team`)

    const inviteBtn = page.locator('#invite-member-button')
    await inviteBtn.waitFor({ state: 'visible', timeout: 15_000 })
    await inviteBtn.click()

    // The invite FullScreenModal opens with the form
    await expect(page.getByRole('heading', { name: 'Invite Team Member' })).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('#email')).toBeVisible()

    // And no seat-cap upsell
    await expect(page.getByText(/you've reached your free plan limit/i)).toHaveCount(0)
  })
})
