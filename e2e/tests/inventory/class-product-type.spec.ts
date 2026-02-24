/**
 * E2E tests for CLASS product type implementation.
 *
 * After the Services tab was added, CLASS and APPOINTMENTS_SERVICE types are
 * created from MenuMaker > Services (not from Products). These tests verify:
 *   - Products type selector no longer shows CLASS / APPOINTMENTS_SERVICE
 *   - Creating CLASS from Services tab → wizard shows maxParticipants field
 *   - Creating APPOINTMENTS_SERVICE from Services tab → wizard shows duration field
 *   - Selecting REGULAR on Products → wizard shows inventory section
 *
 * Navigation paths:
 *   Products: /venues/venue-alpha/menumaker/products
 *   Services: /venues/venue-alpha/menumaker/services
 */

import { test, expect, Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import {
  StaffRole,
  createMockVenue,
} from '../../fixtures/mock-data'
import {
  setupProductTypeMocks,
  setupInventoryRecommendationsMocks,
  setupMenuCategoriesMocks,
  setupModifierGroupsMocks,
  setupProductsListMock,
} from '../../fixtures/class-session-mocks'

// ─── Config ──────────────────────────────────────────────────────

// Run sequentially to avoid parallel dev-server contention
test.describe.configure({ mode: 'serial' })
test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

// ─── Fixtures ────────────────────────────────────────────────────

/**
 * GYM venue — CLASS and APPOINTMENTS_SERVICE should appear as recommended types.
 * Permissions include full menu:create so the "New product" button renders.
 */
const GYM_VENUE = createMockVenue({
  id: 'venue-alpha',
  name: 'Gym Alpha',
  slug: 'venue-alpha',
  type: 'GYM',
  permissions: [
    'menu:read',
    'menu:create',
    'menu:update',
    'menu:delete',
    'teams:read',
    'settings:read',
    'settings:update',
    'reports:read',
  ],
})

// ─── Helpers ─────────────────────────────────────────────────────

async function setupMocks(page: Page): Promise<void> {
  // Hide TanStack Query devtools before page load to avoid overlay interference
  await page.addInitScript(() => {
    const style = document.createElement('style')
    style.textContent = '.tsqd-parent-container { display: none !important; }'
    if (document.head) {
      document.head.appendChild(style)
    } else {
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
    }
  })

  // Register mock routes (LIFO: catch-all first, specifics last)
  await setupApiMocks(page, {
    userRole: StaffRole.OWNER,
    venues: [GYM_VENUE],
  })

  // Register specific mocks AFTER setupApiMocks → higher priority in LIFO matching
  await setupProductsListMock(page)
  await setupModifierGroupsMocks(page)
  await setupMenuCategoriesMocks(page)
  await setupInventoryRecommendationsMocks(page)
  await setupProductTypeMocks(page, { includeClass: true, venueType: 'GYM' })
}

async function navigateToProducts(page: Page): Promise<void> {
  await page.goto('/venues/venue-alpha/menumaker/products')
  await page
    .getByRole('button', { name: /New product|Nuevo producto/i })
    .waitFor({ state: 'visible', timeout: 15_000 })
}

async function navigateToServices(page: Page): Promise<void> {
  await page.goto('/venues/venue-alpha/menumaker/services')
  await page
    .getByRole('button', { name: /Create service|Crear servicio/i })
    .waitFor({ state: 'visible', timeout: 15_000 })
}

/**
 * Open the ProductTypeSelectorModal on Products page and wait for types to load.
 */
async function openProductTypeSelectorModal(page: Page): Promise<void> {
  await page.getByRole('button', { name: /New product|Nuevo producto/i }).click()
  await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5_000 })
  await page
    .getByRole('button', { name: /Regular Item|Artículo Regular/i })
    .waitFor({ state: 'visible', timeout: 10_000 })
}

/**
 * Open the ServiceTypeSelectorDialog on Services page, select a type, then
 * click Next and wait for the wizard to be ready.
 */
async function selectServiceTypeAndOpenWizard(page: Page, labelPattern: RegExp): Promise<void> {
  // Open service type selector
  await page.getByRole('button', { name: /Create service|Crear servicio/i }).click()
  await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5_000 })

  // Click the type option
  await page.getByRole('button', { name: labelPattern }).click()

  // Click Next
  await page.getByRole('button', { name: /Next|Siguiente/i }).click()

  // Wait for wizard — the product name input is always rendered first
  await page.locator('input#name').waitFor({ state: 'visible', timeout: 10_000 })

  // Allow time for conditional sections to render
  await page.waitForTimeout(500)
}

/**
 * Select a product type on the Products page type selector and open wizard.
 */
async function selectProductTypeAndOpenWizard(page: Page, labelPattern: RegExp): Promise<void> {
  await page.getByRole('button', { name: labelPattern }).click()
  await page.getByRole('button', { name: /Next|Siguiente/i }).click()
  await page.locator('input#name').waitFor({ state: 'visible', timeout: 10_000 })
  await page.waitForTimeout(500)
}

// ─── Tests ───────────────────────────────────────────────────────

test.describe('Product Type Selector — CLASS type', () => {
  test('1 — Products type selector should NOT show CLASS or APPOINTMENTS_SERVICE', async ({ page }) => {
    await setupMocks(page)
    await navigateToProducts(page)
    await openProductTypeSelectorModal(page)

    // Regular and Food & Bev should be visible
    await expect(
      page.getByRole('button', { name: /Regular Item|Artículo Regular/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Food & Beverage|Bebidas y alimentos preparados/i }),
    ).toBeVisible()

    // CLASS and APPOINTMENTS_SERVICE should NOT be visible (moved to Services tab)
    await expect(
      page.getByRole('button', { name: /Class \/ Workshop|Clase \/ Taller/i }),
    ).not.toBeVisible()
    await expect(
      page.getByRole('button', { name: /Service \/ Appointment|Servicio \/ Cita/i }),
    ).not.toBeVisible()
  })

  test('2 — should show maxParticipants field when CLASS type is selected from Services', async ({ page }) => {
    await setupMocks(page)
    await navigateToServices(page)

    await selectServiceTypeAndOpenWizard(page, /Clase \/ Taller|Class \/ Workshop/i)

    // maxParticipants input must be visible
    await expect(page.locator('#maxParticipants')).toBeVisible({ timeout: 5_000 })

    // The inventory toggle switch must NOT be visible for CLASS type
    await expect(page.locator('#track-inventory-left')).not.toBeVisible()

    // duration field must NOT be visible for CLASS type
    await expect(page.locator('#duration')).not.toBeVisible()
  })

  test('3 — should show duration field when APPOINTMENTS_SERVICE type is selected from Services', async ({ page }) => {
    await setupMocks(page)
    await navigateToServices(page)

    await selectServiceTypeAndOpenWizard(page, /Servicio con cita|Appointment service/i)

    // duration input must be visible
    await expect(page.locator('#duration')).toBeVisible({ timeout: 5_000 })

    // Inventory toggle must NOT be visible for APPOINTMENTS_SERVICE
    await expect(page.locator('#track-inventory-left')).not.toBeVisible()

    // maxParticipants must NOT be visible for APPOINTMENTS_SERVICE
    await expect(page.locator('#maxParticipants')).not.toBeVisible()
  })

  test('4 — should show inventory section for REGULAR type on Products page', async ({ page }) => {
    await setupMocks(page)
    await navigateToProducts(page)
    await openProductTypeSelectorModal(page)

    await selectProductTypeAndOpenWizard(page, /Regular Item|Artículo Regular/i)

    // Inventory toggle switch must be visible for REGULAR type
    await expect(page.locator('#track-inventory-left')).toBeVisible({ timeout: 5_000 })

    // CLASS-specific field must NOT be present
    await expect(page.locator('#maxParticipants')).not.toBeVisible()

    // Service-specific field must NOT be present
    await expect(page.locator('#duration')).not.toBeVisible()
  })

  test('5 — regression: APPOINTMENTS_SERVICE should have no maxParticipants and no inventory', async ({ page }) => {
    await setupMocks(page)
    await navigateToServices(page)

    await selectServiceTypeAndOpenWizard(page, /Servicio con cita|Appointment service/i)

    // Combined regression check: only duration is present
    await expect(page.locator('#duration')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('#maxParticipants')).not.toBeVisible()
    await expect(page.locator('#track-inventory-left')).not.toBeVisible()
  })
})
