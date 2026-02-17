/**
 * E2E tests for Org-Level Bulk Upload in BulkUploadDialog
 *
 * Tests the org-level toggle in the BulkUploadDialog component,
 * verifying permission gating, category filtering, and correct API calls.
 */

import { test, expect, Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { setupInventoryMocks } from '../../fixtures/inventory-mocks'
import {
  StaffRole,
  PLAYTELECOM_VENUE_ALPHA,
  PLAYTELECOM_VENUE_BETA,
} from '../../fixtures/mock-data'

// Increase test timeout and viewport for page loading
test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

// ─── Helpers ─────────────────────────────────────────────────────

async function navigateToStockPage(page: Page) {
  await page.goto(`/venues/${PLAYTELECOM_VENUE_ALPHA.slug}/playtelecom/stock`)

  // Wait for the page to load
  await page.waitForSelector('main', { state: 'visible', timeout: 15_000 })

  // Close React Query devtools if open
  await page.evaluate(() => {
    const devtoolsPanel = document.querySelector('.tsqd-parent-container')
    if (devtoolsPanel) (devtoolsPanel as HTMLElement).style.display = 'none'
    const toggleBtn = document.querySelector('[aria-label="Open React Query Devtools"]') as HTMLElement
      || document.querySelector('.tsqd-open-btn-container') as HTMLElement
    if (toggleBtn) toggleBtn.style.display = 'none'
  })

  await page.waitForTimeout(2_000)
}

async function openBulkUploadDialog(page: Page) {
  const uploadBtn = page.getByRole('button', { name: /cargar|upload|inventario/i })
  await uploadBtn.waitFor({ state: 'visible', timeout: 10_000 })
  await uploadBtn.click({ force: true })

  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  return dialog
}

async function setupOwnerWithInventory(page: Page) {
  const venues = [PLAYTELECOM_VENUE_ALPHA, PLAYTELECOM_VENUE_BETA]
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues })
  await setupInventoryMocks(page)
}

async function setupManagerWithInventory(page: Page) {
  const managerVenue = {
    ...PLAYTELECOM_VENUE_ALPHA,
    role: StaffRole.MANAGER,
    permissions: [
      'menu:read', 'menu:create', 'menu:update',
      'teams:read',
      'tpv:read', 'tpv:create', 'tpv:update',
      'orders:read', 'orders:update',
      'payments:read',
      'reports:read',
      'settings:read',
      'inventory:read', 'inventory:create',
      'serialized-inventory:create',
      // NOTE: no 'inventory:org-manage'
    ],
    modules: [
      { module: { id: 'mod-team', code: 'TEAM', name: 'Team Management' }, enabled: true },
      { module: { id: 'mod-inv', code: 'SERIALIZED_INVENTORY', name: 'Serialized Inventory' }, enabled: true },
    ],
  }
  await setupApiMocks(page, { userRole: StaffRole.MANAGER, venues: [managerVenue] })
  await setupInventoryMocks(page)
}

/** Check if this is an API request matching a given path segment */
function isApiPath(url: URL, segment: string): boolean {
  return url.pathname.includes('/api/') && url.pathname.includes(segment)
}

// ─── Tests ───────────────────────────────────────────────────────

test.describe('Bulk Upload - Org Level Toggle', () => {
  test('1 — OWNER sees org-level toggle in BulkUploadDialog', async ({ page }) => {
    await setupOwnerWithInventory(page)
    await navigateToStockPage(page)

    const dialog = await openBulkUploadDialog(page)

    // Org toggle should be visible
    await expect(dialog.getByText(/Registrar a nivel organización/i)).toBeVisible()
    await expect(dialog.getByText(/Los items estarán disponibles en todas las tiendas/i)).toBeVisible()
  })

  test('2 — MANAGER does NOT see org-level toggle', async ({ page }) => {
    await setupManagerWithInventory(page)
    await navigateToStockPage(page)

    const dialog = await openBulkUploadDialog(page)

    // Org toggle should NOT be visible
    await expect(dialog.getByText(/Registrar a nivel organización/i)).not.toBeVisible()
  })

  test('3 — Enabling org toggle sends to org-bulk-upload endpoint', async ({ page }) => {
    await setupOwnerWithInventory(page)

    // Intercept bulk upload endpoints using function matchers (cross-origin safe)
    let orgUploadCalled = false
    let venueUploadCalled = false

    await page.route(
      (url) => isApiPath(url, '/org-bulk-upload'),
      async (route) => {
        orgUploadCalled = true
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { success: true, created: 2, duplicates: [], errors: [], total: 2 },
          }),
        })
      },
    )

    await page.route(
      (url) => isApiPath(url, '/bulk-upload') && !url.pathname.includes('/org-bulk-upload'),
      async (route) => {
        venueUploadCalled = true
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { success: true, created: 2, duplicates: [], errors: [], total: 2 },
          }),
        })
      },
    )

    await navigateToStockPage(page)
    const dialog = await openBulkUploadDialog(page)

    // Enable org toggle (should already be a switch button)
    const orgToggle = dialog.locator('button[role="switch"]')
    await expect(orgToggle).toBeVisible({ timeout: 5_000 })
    await orgToggle.click({ force: true })

    // Select a category from the dropdown
    const categoryTrigger = dialog.locator('[role="combobox"]').first()
    await categoryTrigger.click({ force: true })

    // Wait for options to appear and select the first one
    const option = page.locator('[role="option"]').first()
    await expect(option).toBeVisible({ timeout: 5_000 })
    await option.click({ force: true })

    // Enter serial numbers in manual mode
    const textarea = dialog.locator('textarea')
    await textarea.fill('8952140063000001234\n8952140063000001235')

    // Submit
    const uploadBtn = dialog.getByRole('button', { name: /cargar/i }).last()
    await uploadBtn.click({ force: true })

    // Wait for request
    await page.waitForTimeout(2_000)

    expect(orgUploadCalled).toBe(true)
    expect(venueUploadCalled).toBe(false)
  })

  test('4 — Without org toggle, sends to venue bulk-upload endpoint', async ({ page }) => {
    await setupOwnerWithInventory(page)

    let venueUploadCalled = false

    await page.route(
      (url) => isApiPath(url, '/bulk-upload') && !url.pathname.includes('/org-bulk-upload'),
      async (route) => {
        venueUploadCalled = true
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { success: true, created: 2, duplicates: [], errors: [], total: 2 },
          }),
        })
      },
    )

    await navigateToStockPage(page)
    const dialog = await openBulkUploadDialog(page)

    // Don't enable org toggle — leave it off

    // Select a category
    const categoryTrigger = dialog.locator('[role="combobox"]').first()
    await categoryTrigger.click({ force: true })

    const option = page.locator('[role="option"]').first()
    await expect(option).toBeVisible({ timeout: 5_000 })
    await option.click({ force: true })

    // Enter serial numbers
    const textarea = dialog.locator('textarea')
    await textarea.fill('8952140063000001234\n8952140063000001235')

    // Submit
    const uploadBtn = dialog.getByRole('button', { name: /cargar/i }).last()
    await uploadBtn.click({ force: true })

    await page.waitForTimeout(2_000)
    expect(venueUploadCalled).toBe(true)
  })
})
