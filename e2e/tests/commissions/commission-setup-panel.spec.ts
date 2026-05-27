/**
 * E2E tests for CommissionSetupPanel (card-grid pattern)
 *
 * Tests the FullScreenModal-based setup panel that opens from
 * the Commissions config tab. Verifies: panel open/close, all 9 cards
 * render, required card validation, dialog interactions for Rate and
 * Name cards, progress tracking, and the create mutation payload.
 */

import { test, expect, Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { setupCommissionMocks } from '../../fixtures/commission-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

// ─── Helpers ─────────────────────────────────────────────────────

function commissionVenue() {
  return createMockVenue({
    id: 'venue-alpha',
    name: 'Restaurante Alpha',
    slug: 'venue-alpha',
    permissions: [
      'menu:read', 'menu:create', 'menu:update', 'menu:delete',
      'teams:read', 'teams:invite', 'teams:update', 'teams:delete',
      'tpv:read', 'tpv:create', 'tpv:update', 'tpv:delete',
      'orders:read', 'orders:update',
      'payments:read',
      'reports:read',
      'settings:read', 'settings:update',
      'commissions:read', 'commissions:create', 'commissions:update',
      'commissions:payout',
    ],
  })
}

async function setupFullMocks(page: Page) {
  const venue = commissionVenue()
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue] })
  await setupCommissionMocks(page)
}

async function navigateToConfigTab(page: Page) {
  await page.goto('/venues/venue-alpha/commissions#config')
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

  // Close React Query devtools if open
  await page.evaluate(() => {
    const devtools = document.querySelector('.tsqd-parent-container')
    if (devtools) (devtools as HTMLElement).style.display = 'none'
    const toggle = document.querySelector('.tsqd-open-btn-container') as HTMLElement
    if (toggle) toggle.style.display = 'none'
  })

  await page.waitForTimeout(1_500)
}

async function openSetupPanel(page: Page) {
  const createBtn = page.getByRole('button', { name: /New Configuration/i })
  await expect(createBtn).toBeVisible({ timeout: 10_000 })
  await createBtn.click({ force: true })

  // Wait for FullScreenModal heading + animation to complete
  await expect(
    page.getByRole('heading', { name: /New Commission Configuration/i }),
  ).toBeVisible({ timeout: 5_000 })

  // Wait for slide-in animation to finish (300ms CSS transition)
  await page.waitForTimeout(500)
}

/**
 * When a card dialog opens INSIDE the FullScreenModal, two role="dialog"
 * elements exist. The inner one (card dialog) is a centered overlay with
 * max-w-lg. Use this helper to locate the inner card dialog.
 */
function innerDialog(page: Page) {
  // The FullScreenModal dialog has class "fixed inset-0", the card dialog has "max-w-lg"
  return page.locator('[role="dialog"].max-w-lg, [role="dialog"] [class*="max-w"]').first()
    // Fallback: get the last (topmost) dialog
    || page.locator('[role="dialog"]').last()
}

/**
 * Get the inner card dialog reliably — it's the second dialog that appears
 * (the FullScreenModal is the first). We use .last() since the card dialog
 * is rendered after the FullScreenModal in DOM order.
 */
async function getCardDialog(page: Page) {
  const dialogs = page.locator('[role="dialog"]')
  // Wait until 2 dialogs exist (FullScreenModal + card dialog)
  await expect(dialogs).toHaveCount(2, { timeout: 5_000 })
  // The card dialog is the second one
  return dialogs.nth(1)
}

// ─── Tests ───────────────────────────────────────────────────────

test.describe('Commission Setup Panel', () => {
  test('1 — Config tab shows create button for OWNER', async ({ page }) => {
    await setupFullMocks(page)
    await navigateToConfigTab(page)

    await expect(
      page.getByRole('button', { name: /New Configuration/i }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('2 — Clicking create opens FullScreenModal with 9 setup cards', async ({ page }) => {
    await setupFullMocks(page)
    await navigateToConfigTab(page)
    await openSetupPanel(page)

    const cardTitles = [
      'Commission Rate',
      'Name & Validity',
      'Staff',
      'Calculation Base',
      'Categories',
      'Summary Period',
      'Tiered Commission',
      'Rates by Role',
      'Commission Limits',
    ]

    for (const title of cardTitles) {
      await expect(
        page.getByRole('heading', { name: title, level: 3 }),
      ).toBeVisible({ timeout: 5_000 })
    }
  })

  test('3 — Name card shows "Pending", Rate card shows "Ready" by default', async ({ page }) => {
    await setupFullMocks(page)
    await navigateToConfigTab(page)
    await openSetupPanel(page)

    // Rate card is valid by default (3% > 0)
    await expect(
      page.getByRole('button', { name: /Commission Rate.*Ready/i }),
    ).toBeVisible({ timeout: 5_000 })

    // Name card is empty — shows "Pending"
    await expect(
      page.getByRole('button', { name: /Name & Validity.*Pending/i }),
    ).toBeVisible({ timeout: 5_000 })

    // Progress: "1 de 2"
    await expect(page.getByText(/1 de 2/)).toBeVisible({ timeout: 3_000 })
  })

  test('4 — Create button is disabled until required cards are filled', async ({ page }) => {
    await setupFullMocks(page)
    await navigateToConfigTab(page)
    await openSetupPanel(page)

    const submitBtn = page.getByRole('button', { name: /Create Configuration/i })
    await expect(submitBtn).toBeVisible({ timeout: 5_000 })
    await expect(submitBtn).toBeDisabled()
  })

  test('5 — Rate card opens dialog with percentage/fixed toggle', async ({ page }) => {
    await setupFullMocks(page)
    await navigateToConfigTab(page)
    await openSetupPanel(page)

    // Click the rate card
    const rateCard = page.getByRole('button', { name: /Commission Rate/i }).first()
    await rateCard.scrollIntoViewIfNeeded()
    await rateCard.click()

    // Get the inner card dialog (not the FullScreenModal)
    const dialog = await getCardDialog(page)

    // Percentage/fixed toggle
    await expect(dialog.getByText(/Percentage/i)).toBeVisible()
    await expect(dialog.getByText(/Fixed amount/i)).toBeVisible()

    // Number input
    await expect(dialog.locator('input[type="number"]').first()).toBeVisible()

    // Switch to fixed
    await dialog.getByText(/Fixed amount/i).click()
    await page.waitForTimeout(300)
    await expect(dialog.locator('input[type="number"]').first()).toBeVisible()

    // Recipient options (labels are descriptive, not technical)
    await expect(dialog.getByText(/Who attended/i).first()).toBeVisible()
  })

  test('6 — Rate card dialog save keeps "Ready" badge', async ({ page }) => {
    await setupFullMocks(page)
    await navigateToConfigTab(page)
    await openSetupPanel(page)

    const rateCard = page.getByRole('button', { name: /Commission Rate/i }).first()
    await rateCard.scrollIntoViewIfNeeded()
    await rateCard.click()

    const dialog = await getCardDialog(page)

    // Change the rate
    const percentInput = dialog.locator('input[type="number"]').first()
    await percentInput.fill('5')

    await dialog.getByRole('button', { name: /Save/i }).click()

    // Wait for dialog to close (only FullScreenModal remains)
    await expect(page.locator('[role="dialog"]')).toHaveCount(1, { timeout: 3_000 })

    // Card shows updated rate with "Ready"
    await expect(
      page.getByRole('button', { name: /Commission Rate.*Ready/i }),
    ).toBeVisible({ timeout: 3_000 })
  })

  test('7 — Name card opens dialog, fill name and save', async ({ page }) => {
    await setupFullMocks(page)
    await navigateToConfigTab(page)
    await openSetupPanel(page)

    const nameCard = page.getByRole('button', { name: /Name & Validity/i }).first()
    await nameCard.scrollIntoViewIfNeeded()
    await nameCard.click()

    const dialog = await getCardDialog(page)

    // Fill name — Input has no explicit type="text", use placeholder
    const nameInput = dialog.getByPlaceholder(/Waiter Commission/i)
    await expect(nameInput).toBeVisible()
    await nameInput.fill('Comisión Meseros Q2')

    // Save
    await dialog.getByRole('button', { name: /Save/i }).click()
    await expect(page.locator('[role="dialog"]')).toHaveCount(1, { timeout: 3_000 })

    // Card shows the name
    await expect(page.getByText('Comisión Meseros Q2')).toBeVisible({ timeout: 3_000 })
  })

  test('8 — Filling name completes progress to 2 de 2 and enables submit', async ({ page }) => {
    await setupFullMocks(page)
    await navigateToConfigTab(page)
    await openSetupPanel(page)

    // Initial: 1 de 2
    await expect(page.getByText(/1 de 2/)).toBeVisible({ timeout: 5_000 })

    // Fill name card
    const nameCard = page.getByRole('button', { name: /Name & Validity/i }).first()
    await nameCard.scrollIntoViewIfNeeded()
    await nameCard.click()

    const dialog = await getCardDialog(page)
    await dialog.getByPlaceholder(/Waiter Commission/i).fill('Comisión Test')
    await dialog.getByRole('button', { name: /Save/i }).click()
    await expect(page.locator('[role="dialog"]')).toHaveCount(1, { timeout: 3_000 })

    // Progress: 2 de 2
    await expect(page.getByText(/2 de 2/)).toBeVisible({ timeout: 3_000 })

    // Create button enabled
    await expect(
      page.getByRole('button', { name: /Create Configuration/i }),
    ).toBeEnabled()
  })

  test('9 — Close button closes the panel and resets state', async ({ page }) => {
    await setupFullMocks(page)
    await navigateToConfigTab(page)
    await openSetupPanel(page)

    // Fill name
    const nameCard = page.getByRole('button', { name: /Name & Validity/i }).first()
    await nameCard.scrollIntoViewIfNeeded()
    await nameCard.click()

    const dialog = await getCardDialog(page)
    await dialog.getByPlaceholder(/Waiter Commission/i).fill('Should Reset')
    await dialog.getByRole('button', { name: /Save/i }).click()
    await expect(page.locator('[role="dialog"]')).toHaveCount(1, { timeout: 3_000 })

    // 2 de 2
    await expect(page.getByText(/2 de 2/)).toBeVisible({ timeout: 3_000 })

    // Close via "Cerrar" button
    await page.getByRole('button', { name: /Cerrar/i }).click()

    // Panel gone (0 dialogs)
    await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 3_000 })

    // Re-open: reset to 1 de 2
    await openSetupPanel(page)
    await expect(page.getByText(/1 de 2/)).toBeVisible({ timeout: 3_000 })
  })

  test('10 — Submitting sends correct POST payload', async ({ page }) => {
    await setupFullMocks(page)

    // Capture the POST
    let capturedBody: Record<string, unknown> | null = null
    await page.route(
      (url) => url.pathname.includes('/commissions/') && url.pathname.endsWith('/configs'),
      async (route) => {
        if (route.request().method() === 'POST') {
          capturedBody = route.request().postDataJSON()
          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'config-captured',
              venueId: 'venue-alpha',
              ...capturedBody,
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
      },
    )

    await navigateToConfigTab(page)
    await openSetupPanel(page)

    // Fill name card (rate already valid)
    const nameCard = page.getByRole('button', { name: /Name & Validity/i }).first()
    await nameCard.scrollIntoViewIfNeeded()
    await nameCard.click()

    const dialog = await getCardDialog(page)
    await dialog.getByPlaceholder(/Waiter Commission/i).fill('Comisión E2E Test')
    await dialog.getByRole('button', { name: /Save/i }).click()
    await expect(page.locator('[role="dialog"]')).toHaveCount(1, { timeout: 3_000 })

    // Submit
    const submitBtn = page.getByRole('button', { name: /Create Configuration/i })
    await expect(submitBtn).toBeEnabled({ timeout: 3_000 })
    await submitBtn.click()

    // Wait for POST
    await page.waitForTimeout(2_000)

    // Verify payload
    expect(capturedBody).not.toBeNull()
    expect(capturedBody!.name).toBe('Comisión E2E Test')
    expect(capturedBody!.calcType).toBe('PERCENTAGE')
    expect(capturedBody!.defaultRate).toBeCloseTo(0.03, 4)
    expect(capturedBody!.recipient).toBe('SERVER')
    expect(capturedBody!.aggregationPeriod).toBe('MONTHLY')
    expect(capturedBody!.includeTax).toBe(false)
    expect(capturedBody!.includeTips).toBe(false)
    expect(capturedBody!.includeDiscount).toBe(false)
    expect(capturedBody!.filterByCategories).toBe(false)
  })

  test('11 — MANAGER without commissions:create does NOT see create button', async ({ page }) => {
    const managerVenue = createMockVenue({
      id: 'venue-alpha',
      name: 'Restaurante Alpha',
      slug: 'venue-alpha',
      permissions: [
        'menu:read',
        'teams:read',
        'orders:read',
        'payments:read',
        'reports:read',
        'commissions:read',
      ],
    })
    await setupApiMocks(page, { userRole: StaffRole.MANAGER, venues: [managerVenue] })
    await setupCommissionMocks(page)

    await page.goto('/venues/venue-alpha/commissions#config')
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    await page.waitForTimeout(2_000)

    await expect(
      page.getByRole('button', { name: /New Configuration/i }),
    ).not.toBeVisible({ timeout: 5_000 })
  })

  test('12 — Calculation base card opens dialog with 3 toggles', async ({ page }) => {
    await setupFullMocks(page)
    await navigateToConfigTab(page)
    await openSetupPanel(page)

    // Click calc base card
    const calcCard = page.getByRole('button', { name: /Calculation Base/i }).first()
    await calcCard.scrollIntoViewIfNeeded()
    await calcCard.click()

    const dialog = await getCardDialog(page)

    // Tax, Tips, Discounts toggles
    await expect(dialog.getByText(/Tax/i).first()).toBeVisible()
    await expect(dialog.getByText(/Tips/i).first()).toBeVisible()
    await expect(dialog.getByText(/Discount/i).first()).toBeVisible()

    // Close
    await dialog.getByRole('button', { name: /Save/i }).click()
    await expect(page.locator('[role="dialog"]')).toHaveCount(1, { timeout: 3_000 })
  })
})
