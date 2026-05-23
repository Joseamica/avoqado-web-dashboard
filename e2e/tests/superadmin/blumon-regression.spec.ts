import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole } from '../../fixtures/mock-data'

/**
 * Blumon regression — entry point intact.
 *
 * The MerchantSetupPanel replaces the legacy linear AngelPay wizard but
 * Blumon's own flow lives in `BlumonAutoFetchWizard.tsx` and the batch
 * dialog in `BatchAutoFetchDialog.tsx`. The user's hard constraint was
 * "no rompa con nada de Blumon" — this spec proves both entry-points
 * still open their respective dialogs from `/superadmin/merchant-accounts`.
 *
 * It's intentionally small. It does NOT exercise the full Blumon flow; the
 * goal is to catch any accidental wiring break introduced by the
 * setup-panel work.
 */

test.describe('Blumon regression — entry point intact', () => {
  test('Blumon Auto-Fetch button is visible and opens the wizard', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.SUPERADMIN })

    // Page itself: no existing merchant accounts.
    await page.route(
      url => url.pathname.endsWith('/dashboard/superadmin/merchant-accounts/all'),
      route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        }),
    )
    await page.route(
      url => url.pathname.endsWith('/dashboard/superadmin/merchant-accounts'),
      route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        }),
    )

    await page.goto('/superadmin/merchant-accounts')
    const blumonBtn = page.getByRole('button', { name: 'Blumon Auto-Fetch' }).first()
    await expect(blumonBtn).toBeVisible({ timeout: 15_000 })
    // Hide react-query devtools so they don't cover the button on dev.
    await page.addStyleTag({ content: '.tsqd-parent-container { display: none !important; }' })
    await blumonBtn.click()

    // Wizard opened — its DialogTitle is the literal string "Blumon Auto-Fetch".
    // We assert by role+name to avoid colliding with the trigger button.
    await expect(
      page.getByRole('dialog').getByText('Blumon Auto-Fetch', { exact: true }),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('Batch (x10+) button is visible and opens the batch dialog', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.SUPERADMIN })

    await page.route(
      url => url.pathname.endsWith('/dashboard/superadmin/merchant-accounts/all'),
      route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        }),
    )
    await page.route(
      url => url.pathname.endsWith('/dashboard/superadmin/merchant-accounts'),
      route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        }),
    )

    await page.goto('/superadmin/merchant-accounts')
    const batchBtn = page.getByRole('button', { name: /Batch \(x10\+\)/i })
    await expect(batchBtn).toBeVisible({ timeout: 15_000 })
    await page.addStyleTag({ content: '.tsqd-parent-container { display: none !important; }' })
    await batchBtn.click()

    // BatchAutoFetchDialog's DialogTitle reads "Blumon Batch Auto-Fetch".
    await expect(
      page.getByRole('dialog').getByText('Blumon Batch Auto-Fetch'),
    ).toBeVisible({ timeout: 5_000 })
  })
})
