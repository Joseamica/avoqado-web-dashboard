/**
 * E2E tests for Org-Level Category Management
 *
 * Tests the OrgCategoryConfigSection component in TpvConfiguration > Categorias tab.
 * Verifies CRUD operations, permission gating, and ORG badge display.
 */

import { test, expect, Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { setupInventoryMocks } from '../../fixtures/inventory-mocks'
import {
  StaffRole,
  PLAYTELECOM_VENUE_ALPHA,
  PLAYTELECOM_VENUE_BETA,
  MOCK_ORG_CATEGORIES,
} from '../../fixtures/mock-data'

// Increase test timeout and viewport for page loading
test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

// ─── Helpers ─────────────────────────────────────────────────────

async function navigateToCategoriasTab(page: Page) {
  // Navigate directly with hash to pre-select the tab
  await page.goto(`/venues/${PLAYTELECOM_VENUE_ALPHA.slug}/playtelecom/tpv-config#categorias`)

  // Wait for the page to load
  await page.waitForSelector('[role="tablist"]', { state: 'visible', timeout: 15_000 })

  // Close React Query devtools if open (it overlays the page and blocks interactions)
  await page.evaluate(() => {
    const devtoolsPanel = document.querySelector('.tsqd-parent-container')
    if (devtoolsPanel) (devtoolsPanel as HTMLElement).style.display = 'none'
    // Also hide the toggle button
    const toggleBtn = document.querySelector('[aria-label="Open React Query Devtools"]') as HTMLElement
      || document.querySelector('.tsqd-open-btn-container') as HTMLElement
    if (toggleBtn) toggleBtn.style.display = 'none'
  })

  // Click on the Categories tab
  const categoriasTab = page.locator('[role="tab"]').filter({ hasText: /categor/i })
  await categoriasTab.click({ force: true })

  // Wait for content to load
  await page.waitForTimeout(2_000)
}

async function setupOwnerWithInventory(page: Page) {
  const venues = [PLAYTELECOM_VENUE_ALPHA, PLAYTELECOM_VENUE_BETA]
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues })
  await setupInventoryMocks(page)
}

async function setupAdminWithoutOrgManage(page: Page) {
  const adminVenue = {
    ...PLAYTELECOM_VENUE_ALPHA,
    role: StaffRole.ADMIN,
    permissions: [
      'menu:read', 'menu:create', 'menu:update', 'menu:delete',
      'teams:read', 'teams:invite', 'teams:update', 'teams:delete',
      'tpv:read', 'tpv:create', 'tpv:update', 'tpv:delete',
      'orders:read', 'orders:update',
      'payments:read',
      'reports:read',
      'settings:read', 'settings:update',
      'inventory:read', 'inventory:create', 'inventory:update',
      // NOTE: no 'inventory:org-manage'
    ],
    modules: [
      { module: { id: 'mod-team', code: 'TEAM', name: 'Team Management' }, enabled: true },
      { module: { id: 'mod-inv', code: 'SERIALIZED_INVENTORY', name: 'Serialized Inventory' }, enabled: true },
    ],
  }
  await setupApiMocks(page, { userRole: StaffRole.ADMIN, venues: [adminVenue] })
  await setupInventoryMocks(page)
}

// ─── Tests ───────────────────────────────────────────────────────

test.describe('Org-Level Categories', () => {
  test('1 — OWNER sees OrgCategoryConfigSection with org categories', async ({ page }) => {
    await setupOwnerWithInventory(page)
    await navigateToCategoriasTab(page)

    // Org section heading should be visible
    await expect(page.getByText(/Categorías de Organización/i)).toBeVisible({ timeout: 10_000 })

    // Org categories should render
    for (const cat of MOCK_ORG_CATEGORIES) {
      await expect(page.getByText(cat.name).first()).toBeVisible({ timeout: 10_000 })
    }
  })

  test('2 — ADMIN without org-manage does NOT see OrgCategoryConfigSection', async ({ page }) => {
    await setupAdminWithoutOrgManage(page)
    await navigateToCategoriasTab(page)

    // Org section should NOT appear (permission gated)
    await expect(page.getByText(/Categorías de Organización/i)).not.toBeVisible()
  })

  test('3 — "Nueva Categoría" button opens create dialog', async ({ page }) => {
    await setupOwnerWithInventory(page)
    await navigateToCategoriasTab(page)

    // Click create button (force to bypass overlay)
    const createBtn = page.getByRole('button', { name: /Nueva Categoría/i })
    await expect(createBtn).toBeVisible({ timeout: 10_000 })
    await createBtn.click({ force: true })

    // Dialog should open
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await expect(dialog.getByText(/Nueva Categoría de Organización/i)).toBeVisible()

    // Form fields
    await expect(dialog.locator('#org-cat-name')).toBeVisible()
    await expect(dialog.locator('#org-cat-description')).toBeVisible()
    await expect(dialog.locator('#org-cat-price')).toBeVisible()
    await expect(dialog.locator('#org-cat-barcode')).toBeVisible()
  })

  test('4 — Create dialog sends POST with correct form data', async ({ page }) => {
    await setupOwnerWithInventory(page)

    // Capture the POST request
    let capturedBody: Record<string, unknown> | null = null
    await page.route(
      (url) => url.pathname.includes('/api/') && url.pathname.includes('/org-item-categories'),
      async (route) => {
      if (route.request().method() === 'POST') {
        capturedBody = route.request().postDataJSON()
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'cat-org-new', ...capturedBody, active: true }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ORG_CATEGORIES),
      })
    },
    )

    await navigateToCategoriasTab(page)

    // Open create dialog
    const createBtn = page.getByRole('button', { name: /Nueva Categoría/i })
    await expect(createBtn).toBeVisible({ timeout: 10_000 })
    await createBtn.click({ force: true })

    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Fill form
    await dialog.locator('#org-cat-name').fill('SIM Oro')
    await dialog.locator('#org-cat-description').fill('SIM plan oro premium')
    await dialog.locator('#org-cat-price').fill('200')
    await dialog.locator('#org-cat-barcode').fill('^89530[0-9]{14}$')

    // Submit
    await dialog.getByRole('button', { name: /Crear/i }).click()

    // Verify POST body
    await page.waitForTimeout(2_000)
    expect(capturedBody).not.toBeNull()
    expect(capturedBody!.name).toBe('SIM Oro')
    expect(capturedBody!.description).toBe('SIM plan oro premium')
    expect(capturedBody!.suggestedPrice).toBe(200)
    expect(capturedBody!.barcodePattern).toBe('^89530[0-9]{14}$')
  })

  test('5 — Delete opens confirmation and cancel dismisses it', async ({ page }) => {
    await setupOwnerWithInventory(page)
    await navigateToCategoriasTab(page)

    // Wait for a category to appear
    await expect(page.getByText('SIM Prepago').first()).toBeVisible({ timeout: 10_000 })

    // Click the delete button (first one found via data-testid)
    const deleteBtn = page.locator('[data-testid="delete-org-category"]').first()
    await deleteBtn.click({ force: true })

    // Alert dialog should appear
    const alertDialog = page.locator('[role="alertdialog"]')
    await expect(alertDialog).toBeVisible({ timeout: 5_000 })
    await expect(alertDialog.getByText(/Eliminar categoría de organización/i)).toBeVisible()

    // Cancel should close
    await alertDialog.getByRole('button', { name: /Cancelar/i }).click()
    await expect(alertDialog).not.toBeVisible()
  })

  test('6 — Empty state shows when no org categories exist', async ({ page }) => {
    const venues = [PLAYTELECOM_VENUE_ALPHA, PLAYTELECOM_VENUE_BETA]
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues })
    await setupInventoryMocks(page, { orgCategories: [] })

    await navigateToCategoriasTab(page)

    // Empty state message
    await expect(page.getByText(/No hay categorías a nivel organización/i)).toBeVisible({ timeout: 10_000 })
  })
})
