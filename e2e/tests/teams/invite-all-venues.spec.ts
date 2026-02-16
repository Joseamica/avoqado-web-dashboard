import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, VENUE_ALPHA } from '../../fixtures/mock-data'

// ─── Helpers ────────────────────────────────────────────────────

/** Navigate to Teams page and open the invite modal */
async function openInviteModal(page: import('@playwright/test').Page) {
  await page.goto(`/venues/${VENUE_ALPHA.slug}/team`)

  // Wait for the team page to load and the invite button to appear
  const inviteBtn = page.locator('#invite-member-button')
  await inviteBtn.waitFor({ state: 'visible', timeout: 15_000 })
  await inviteBtn.click()

  // Wait for the FullScreenModal to appear (Radix Dialog)
  await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5_000 })
}

/** Select a role in the invite form's role combobox */
async function selectRole(page: import('@playwright/test').Page, role: string) {
  // The Select trigger is a button with role="combobox"
  const trigger = page.locator('[role="dialog"]').locator('[role="combobox"]')
  await trigger.click()

  // Wait for the dropdown content to appear and click the option
  const option = page.locator(`[role="option"]`).filter({ hasText: new RegExp(role, 'i') })
  await option.click()
}

// ─── Tests ──────────────────────────────────────────────────────

test.describe('Invite to All Venues checkbox', () => {
  test('1 — OWNER role with 2+ venues: checkbox visible, NO amber warning', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER })
    await openInviteModal(page)
    await selectRole(page, 'Owner')

    // Checkbox should be visible
    const checkbox = page.locator('#inviteToAllVenues')
    await expect(checkbox).toBeVisible()

    // "Dar acceso a todos los establecimientos" text visible
    await expect(page.getByText(/dar acceso a todos los establecimientos/i)).toBeVisible()

    // Amber warning about role downgrade should NOT be visible for OWNER
    await expect(page.getByText(/si la persona ya tiene un rol más alto/i)).not.toBeVisible()
  })

  test('2 — ADMIN role with 2+ venues: checkbox visible + amber warning', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER })
    await openInviteModal(page)
    await selectRole(page, 'Admin')

    const checkbox = page.locator('#inviteToAllVenues')
    await expect(checkbox).toBeVisible()

    // Amber role-downgrade warning IS visible for ADMIN
    await expect(page.getByText(/si la persona ya tiene un rol más alto/i)).toBeVisible()
  })

  test('3 — MANAGER role with 2+ venues: checkbox visible + amber warning', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER })
    await openInviteModal(page)
    await selectRole(page, 'Manager')

    const checkbox = page.locator('#inviteToAllVenues')
    await expect(checkbox).toBeVisible()

    await expect(page.getByText(/si la persona ya tiene un rol más alto/i)).toBeVisible()
  })

  test('4 — WAITER role: checkbox NOT visible', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER })
    await openInviteModal(page)
    await selectRole(page, 'Waiter')

    const checkbox = page.locator('#inviteToAllVenues')
    await expect(checkbox).not.toBeVisible()
  })

  test('5 — CASHIER role: checkbox NOT visible', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER })
    await openInviteModal(page)
    await selectRole(page, 'Cashier')

    const checkbox = page.locator('#inviteToAllVenues')
    await expect(checkbox).not.toBeVisible()
  })

  test('6 — KITCHEN / HOST / VIEWER roles: checkbox NOT visible', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER })
    await openInviteModal(page)

    for (const role of ['Kitchen', 'Host', 'Viewer']) {
      await selectRole(page, role)
      const checkbox = page.locator('#inviteToAllVenues')
      await expect(checkbox).not.toBeVisible()
    }
  })

  test('7 — Switching ADMIN → WAITER → ADMIN resets checkbox to unchecked', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER })
    await openInviteModal(page)

    // Select ADMIN → checkbox visible
    await selectRole(page, 'Admin')
    const checkbox = page.locator('#inviteToAllVenues')
    await expect(checkbox).toBeVisible()

    // Check the checkbox
    await checkbox.click()
    await expect(checkbox).toBeChecked()

    // Switch to WAITER → checkbox should disappear
    await selectRole(page, 'Waiter')
    await expect(checkbox).not.toBeVisible()

    // Switch back to ADMIN → checkbox should re-appear but be unchecked
    await selectRole(page, 'Admin')
    await expect(checkbox).toBeVisible()
    await expect(checkbox).not.toBeChecked()
  })

  test('8 — Check checkbox + submit: POST body contains inviteToAllVenues: true', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER })

    // Intercept the invite POST to capture the request body
    let capturedBody: Record<string, unknown> | null = null
    await page.route('**/api/v1/dashboard/venues/*/team', async (route) => {
      if (route.request().method() === 'POST') {
        capturedBody = route.request().postDataJSON()
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Invitation sent',
            invitation: {
              id: 'inv-001',
              email: 'all-venues@test.com',
              role: StaffRole.ADMIN,
              status: 'PENDING',
              expiresAt: '2026-03-16T00:00:00.000Z',
              createdAt: '2026-02-16T00:00:00.000Z',
            },
            emailSent: true,
            isTPVOnly: false,
          }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }),
      })
    })

    await openInviteModal(page)

    // Fill form fields
    await page.fill('#email', 'all-venues@test.com')
    await page.fill('#firstName', 'Test')
    await page.fill('#lastName', 'User')

    // Select ADMIN role
    await selectRole(page, 'Admin')

    // Check the "all venues" checkbox
    const checkbox = page.locator('#inviteToAllVenues')
    await checkbox.click()
    await expect(checkbox).toBeChecked()

    // Click the submit button in the FullScreenModal header (right side actions area)
    const submitBtn = page.locator('[role="dialog"] header').getByRole('button', { name: /send|enviar/i })
    await submitBtn.click()

    // Wait for the POST request to be captured
    await page.waitForTimeout(1_000)

    expect(capturedBody).not.toBeNull()
    expect(capturedBody!.inviteToAllVenues).toBe(true)
  })

  test('9 — Only 1 venue in org: checkbox NOT visible even for OWNER', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venueCount: 1 })
    await page.goto('/venues/venue-gen-0/team')

    const inviteBtn = page.locator('#invite-member-button')
    await inviteBtn.waitFor({ state: 'visible', timeout: 15_000 })
    await inviteBtn.click()
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5_000 })

    await selectRole(page, 'Owner')

    const checkbox = page.locator('#inviteToAllVenues')
    await expect(checkbox).not.toBeVisible()
  })
})
