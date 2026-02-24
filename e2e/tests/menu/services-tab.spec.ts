/**
 * E2E tests for the Services tab in MenuMaker.
 *
 * Covers:
 *   1. Services tab is visible in MenuMaker navigation
 *   2. Services page renders with correct title and "Create service" button
 *   3. Services are listed (APPOINTMENTS_SERVICE and CLASS types only)
 *   4. Products page does NOT show service types
 *   5. Service type selector dialog shows two options
 *   6. Selecting APPOINTMENTS_SERVICE opens ServiceFormDialog with duration field
 *   7. Selecting CLASS opens ServiceFormDialog with maxParticipants field
 *   8. ProductTypeSelectorModal on Products page does NOT show service types
 *   9. Details column shows correct info for services and classes
 *  10. Submit APPOINTMENTS_SERVICE via ServiceFormDialog sends correct payload
 *  11. Submit CLASS via ServiceFormDialog sends correct payload
 *  12. Convert product to service sends correct payload
 *
 * Navigation path: /venues/venue-alpha/menumaker/services
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
} from '../../fixtures/class-session-mocks'

// ─── Config ──────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' })
test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

// ─── Fixtures ────────────────────────────────────────────────────

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

/** Mock services that should appear in the Services tab */
const MOCK_SERVICES = [
  {
    id: 'svc-001',
    venueId: 'venue-alpha',
    sku: 'SVC-001',
    name: 'Corte de cabello',
    description: 'Corte de cabello profesional',
    categoryId: '',
    type: 'APPOINTMENTS_SERVICE',
    price: 350,
    cost: null,
    taxRate: 0.16,
    imageUrl: null,
    displayOrder: 0,
    featured: false,
    tags: [],
    allergens: [],
    calories: null,
    prepTime: null,
    cookingNotes: null,
    trackInventory: false,
    inventoryMethod: null,
    unit: null,
    active: true,
    availableFrom: null,
    availableUntil: null,
    externalId: null,
    externalData: null,
    fromPOS: false,
    syncStatus: 'SYNCED',
    lastSyncAt: null,
    duration: 60,
    maxParticipants: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'svc-002',
    venueId: 'venue-alpha',
    sku: 'SVC-002',
    name: 'Clase de Yoga',
    description: 'Sesión grupal de yoga',
    categoryId: '',
    type: 'CLASS',
    price: 200,
    cost: null,
    taxRate: 0.16,
    imageUrl: null,
    displayOrder: 1,
    featured: false,
    tags: [],
    allergens: [],
    calories: null,
    prepTime: null,
    cookingNotes: null,
    trackInventory: false,
    inventoryMethod: null,
    unit: null,
    active: true,
    availableFrom: null,
    availableUntil: null,
    externalId: null,
    externalData: null,
    fromPOS: false,
    syncStatus: 'SYNCED',
    lastSyncAt: null,
    duration: null,
    maxParticipants: 15,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

/** Mock regular product that should NOT appear in Services tab */
const MOCK_REGULAR_PRODUCT = {
  id: 'prod-001',
  venueId: 'venue-alpha',
  sku: 'PROD-001',
  name: 'Proteína en polvo',
  description: 'Whey protein 1kg',
  categoryId: 'cat-001',
  category: { id: 'cat-001', name: 'Suplementos' },
  type: 'REGULAR',
  price: 800,
  cost: 400,
  taxRate: 0.16,
  imageUrl: null,
  displayOrder: 0,
  featured: false,
  tags: [],
  allergens: [],
  calories: null,
  prepTime: null,
  cookingNotes: null,
  trackInventory: false,
  inventoryMethod: null,
  unit: null,
  active: true,
  availableFrom: null,
  availableUntil: null,
  externalId: null,
  externalData: null,
  fromPOS: false,
  syncStatus: 'SYNCED',
  lastSyncAt: null,
  duration: null,
  maxParticipants: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const ALL_MOCK_PRODUCTS = [...MOCK_SERVICES, MOCK_REGULAR_PRODUCT]

// ─── Helpers ─────────────────────────────────────────────────────

/** Register products mock that returns a mix of services + regular products */
async function setupProductsWithServicesMock(page: Page): Promise<void> {
  await page.route(
    (url) =>
      url.pathname.includes('/api/') &&
      url.pathname.includes('/products') &&
      !url.pathname.includes('/product-types'),
    (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: {} }),
        })
      }
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'deleted' }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ALL_MOCK_PRODUCTS),
      })
    },
  )
}

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

async function setupAllMocks(page: Page): Promise<void> {
  await hideDevtools(page)
  await setupApiMocks(page, {
    userRole: StaffRole.OWNER,
    venues: [GYM_VENUE],
  })
  await setupProductsWithServicesMock(page)
  await setupModifierGroupsMocks(page)
  await setupMenuCategoriesMocks(page)
  await setupInventoryRecommendationsMocks(page)
  await setupProductTypeMocks(page, { includeClass: true, venueType: 'GYM' })
}

async function navigateToServices(page: Page): Promise<void> {
  await page.goto('/venues/venue-alpha/menumaker/services')
  await page
    .getByRole('button', { name: /Create service|Crear servicio/i })
    .waitFor({ state: 'visible', timeout: 15_000 })
}

async function navigateToProducts(page: Page): Promise<void> {
  await page.goto('/venues/venue-alpha/menumaker/products')
  await page
    .getByRole('button', { name: /New product|Nuevo producto/i })
    .waitFor({ state: 'visible', timeout: 15_000 })
}

// ─── Tests ───────────────────────────────────────────────────────

test.describe('Services Tab in MenuMaker', () => {
  test('1 — Services nav link is visible in MenuMaker', async ({ page }) => {
    await setupAllMocks(page)
    await page.goto('/venues/venue-alpha/menumaker/services')

    // Target the <a> nav link specifically (not breadcrumb span)
    const servicesLink = page.locator('nav a', { hasText: /Services|Servicios/i })
    await expect(servicesLink).toBeVisible({ timeout: 10_000 })
  })

  test('2 — Services page shows title and create button', async ({ page }) => {
    await setupAllMocks(page)
    await navigateToServices(page)

    // Title
    await expect(page.getByText(/Servicios|Services/i).first()).toBeVisible()

    // Create button
    await expect(
      page.getByRole('button', { name: /Create service|Crear servicio/i }),
    ).toBeVisible()
  })

  test('3 — Services page lists only service-type products', async ({ page }) => {
    await setupAllMocks(page)
    await navigateToServices(page)

    // Service items should be visible
    await expect(page.getByText('Corte de cabello')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Clase de Yoga')).toBeVisible()

    // Regular product should NOT be visible
    await expect(page.getByText('Proteína en polvo')).not.toBeVisible()
  })

  test('4 — Products page does NOT show service types', async ({ page }) => {
    await setupAllMocks(page)
    await navigateToProducts(page)

    // Regular product should be visible
    await expect(page.getByText('Proteína en polvo')).toBeVisible({ timeout: 10_000 })

    // Service items should NOT be visible
    await expect(page.getByText('Corte de cabello')).not.toBeVisible()
    await expect(page.getByText('Clase de Yoga')).not.toBeVisible()
  })

  test('5 — Service type selector shows two options', async ({ page }) => {
    await setupAllMocks(page)
    await navigateToServices(page)

    // Click create button
    await page.getByRole('button', { name: /Create service|Crear servicio/i }).click()

    // Wait for dialog
    await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5_000 })

    // Two type options should be visible
    await expect(
      page.getByRole('button', { name: /Servicio con cita|Appointment service/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Clase \/ Taller|Class \/ Workshop/i }),
    ).toBeVisible()
  })

  test('6 — Selecting APPOINTMENTS_SERVICE opens ServiceFormDialog with duration field', async ({ page }) => {
    await setupAllMocks(page)
    await navigateToServices(page)

    // Open type selector
    await page.getByRole('button', { name: /Create service|Crear servicio/i }).click()
    await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5_000 })

    // Select service type
    await page.getByRole('button', { name: /Servicio con cita|Appointment service/i }).click()

    // Click Next
    await page.getByRole('button', { name: /Next|Siguiente/i }).click()

    // Wait for ServiceFormDialog (FullScreenModal) to open with name input
    await page.locator('input#name').waitFor({ state: 'visible', timeout: 10_000 })
    await page.waitForTimeout(500)

    // Duration field should be visible
    await expect(page.locator('#duration')).toBeVisible({ timeout: 5_000 })

    // No maxParticipants
    await expect(page.locator('#maxParticipants')).not.toBeVisible()
  })

  test('7 — Selecting CLASS opens ServiceFormDialog with maxParticipants field', async ({ page }) => {
    await setupAllMocks(page)
    await navigateToServices(page)

    // Open type selector
    await page.getByRole('button', { name: /Create service|Crear servicio/i }).click()
    await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5_000 })

    // Select class type
    await page.getByRole('button', { name: /Clase \/ Taller|Class \/ Workshop/i }).click()

    // Click Next
    await page.getByRole('button', { name: /Next|Siguiente/i }).click()

    // Wait for ServiceFormDialog (FullScreenModal)
    await page.locator('input#name').waitFor({ state: 'visible', timeout: 10_000 })
    await page.waitForTimeout(500)

    // maxParticipants field should be visible
    await expect(page.locator('#maxParticipants')).toBeVisible({ timeout: 5_000 })

    // No duration
    await expect(page.locator('#duration')).not.toBeVisible()
  })

  test('8 — ProductTypeSelectorModal on Products page excludes service types', async ({ page }) => {
    await setupAllMocks(page)
    await navigateToProducts(page)

    // Open type selector
    await page.getByRole('button', { name: /New product|Nuevo producto/i }).click()
    await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5_000 })

    // Wait for types to load
    await page
      .getByRole('button', { name: /Regular Item|Artículo Regular/i })
      .waitFor({ state: 'visible', timeout: 10_000 })

    // Regular and Food & Bev should be visible
    await expect(
      page.getByRole('button', { name: /Regular Item|Artículo Regular/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Food & Beverage|Bebidas y alimentos preparados/i }),
    ).toBeVisible()

    // Service types should NOT be visible
    await expect(
      page.getByRole('button', { name: /Service \/ Appointment|Servicio \/ Cita/i }),
    ).not.toBeVisible()
    await expect(
      page.getByRole('button', { name: /Class \/ Workshop|Clase \/ Taller/i }),
    ).not.toBeVisible()
  })

  test('9 — Details column shows duration for services and participants for classes', async ({ page }) => {
    await setupAllMocks(page)
    await navigateToServices(page)

    // Duration should show for the appointment service
    await expect(page.getByText('60 min')).toBeVisible({ timeout: 10_000 })

    // Participants should show for the class
    await expect(page.getByText(/15 participantes|15 participants/i)).toBeVisible()
  })

  test('10 — Submit APPOINTMENTS_SERVICE via ServiceFormDialog sends correct payload', async ({ page }) => {
    await setupAllMocks(page)

    // Intercept the wizard complete POST and capture the payload
    let capturedPayload: any = null
    await page.route(
      (url) => url.pathname.includes('/api/') && url.pathname.includes('/wizard/complete'),
      (route) => {
        capturedPayload = JSON.parse(route.request().postData() || '{}')
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { id: 'new-svc-001', name: capturedPayload?.product?.name || 'Test' },
          }),
        })
      },
    )

    await navigateToServices(page)

    // Open type selector → select Servicio con cita
    await page.getByRole('button', { name: /Create service|Crear servicio/i }).click()
    await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5_000 })
    await page.getByRole('button', { name: /Servicio con cita|Appointment service/i }).click()
    await page.getByRole('button', { name: /Next|Siguiente/i }).click()

    // Wait for ServiceFormDialog (FullScreenModal) with name input
    await page.locator('input#name').waitFor({ state: 'visible', timeout: 10_000 })
    await page.waitForTimeout(500)

    // Fill required fields
    await page.locator('input#name').fill('Masaje relajante')
    await page.locator('input#price').fill('500')
    await page.locator('input#duration').fill('90')

    // Select a category — scope to dialog to avoid hitting DataTable's rows-per-page combobox
    const dialog = page.locator('[role="dialog"]')
    const categoryTrigger = dialog.locator('[role="combobox"]')
    await categoryTrigger.click()

    // Wait for popover dropdown items and select first category
    await page.locator('[cmdk-item]').first().waitFor({ state: 'visible', timeout: 5_000 })
    await page.locator('[cmdk-item]').first().click()
    await page.waitForTimeout(300)

    // Submit via the header Create button
    await page.getByRole('button', { name: /^Crear$|^Create$/i }).click()

    // Wait for the POST to be intercepted
    await page.waitForTimeout(1_000)

    // Verify the payload
    expect(capturedPayload).not.toBeNull()
    expect(capturedPayload.product.name).toBe('Masaje relajante')
    expect(capturedPayload.product.price).toBe(500)
    expect(capturedPayload.product.duration).toBe(90)
    expect(capturedPayload.product.categoryId).toBeTruthy()
    expect(capturedPayload.inventory.useInventory).toBe(false)
  })

  test('11 — Submit CLASS via ServiceFormDialog sends correct payload with maxParticipants', async ({ page }) => {
    await setupAllMocks(page)

    // Intercept the wizard complete POST and capture the payload
    let capturedPayload: any = null
    await page.route(
      (url) => url.pathname.includes('/api/') && url.pathname.includes('/wizard/complete'),
      (route) => {
        capturedPayload = JSON.parse(route.request().postData() || '{}')
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { id: 'new-svc-002', name: capturedPayload?.product?.name || 'Test' },
          }),
        })
      },
    )

    await navigateToServices(page)

    // Open type selector → select Clase
    await page.getByRole('button', { name: /Create service|Crear servicio/i }).click()
    await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5_000 })
    await page.getByRole('button', { name: /Clase \/ Taller|Class \/ Workshop/i }).click()
    await page.getByRole('button', { name: /Next|Siguiente/i }).click()

    // Wait for ServiceFormDialog (FullScreenModal)
    await page.locator('input#name').waitFor({ state: 'visible', timeout: 10_000 })
    await page.waitForTimeout(500)

    // Fill required fields
    await page.locator('input#name').fill('Yoga Matutino')
    await page.locator('input#price').fill('200')
    await page.locator('input#maxParticipants').fill('20')

    // Select a category — scope to dialog to avoid hitting DataTable's rows-per-page combobox
    const dialog = page.locator('[role="dialog"]')
    const categoryTrigger = dialog.locator('[role="combobox"]')
    await categoryTrigger.click()

    // Wait for popover dropdown items and select first category
    await page.locator('[cmdk-item]').first().waitFor({ state: 'visible', timeout: 5_000 })
    await page.locator('[cmdk-item]').first().click()
    await page.waitForTimeout(300)

    // Submit via the header Create button
    await page.getByRole('button', { name: /^Crear$|^Create$/i }).click()

    // Wait for the POST to be intercepted
    await page.waitForTimeout(1_000)

    // Verify the payload
    expect(capturedPayload).not.toBeNull()
    expect(capturedPayload.product.name).toBe('Yoga Matutino')
    expect(capturedPayload.product.price).toBe(200)
    expect(capturedPayload.product.maxParticipants).toBe(20)
    expect(capturedPayload.product.categoryId).toBeTruthy()
    expect(capturedPayload.inventory.useInventory).toBe(false)
  })

  test('12 — Convert product to service sends correct payload', async ({ page }) => {
    await setupAllMocks(page)

    // Intercept the PUT to capture the convert payload
    let capturedConvertPayload: any = null
    await page.route(
      (url) =>
        url.pathname.includes('/api/') &&
        url.pathname.includes('/products/prod-001') &&
        !url.pathname.includes('/product-types'),
      (route) => {
        if (route.request().method() === 'PUT') {
          capturedConvertPayload = JSON.parse(route.request().postData() || '{}')
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { ...MOCK_REGULAR_PRODUCT, type: capturedConvertPayload.type } }),
          })
        }
        return route.continue()
      },
    )

    await navigateToProducts(page)

    // Open actions dropdown for the regular product
    const productRow = page.getByText('Proteína en polvo').locator('..')
    await productRow.locator('button').filter({ has: page.locator('.sr-only') }).click()

    // Click "Convertir a servicio"
    await page.getByRole('menuitem', { name: /Convertir a servicio|Convert to service/i }).click()

    // Wait for convert dialog
    await page.locator('[role="alertdialog"]').waitFor({ state: 'visible', timeout: 5_000 })

    // Select APPOINTMENTS_SERVICE
    await page.getByRole('button', { name: /Servicio con cita|Appointment service/i }).click()

    // Click Convert
    await page.getByRole('button', { name: /^Convertir$|^Convert$/i }).click()

    // Wait for the PUT to be intercepted
    await page.waitForTimeout(1_000)

    // Verify the payload
    expect(capturedConvertPayload).not.toBeNull()
    expect(capturedConvertPayload.type).toBe('APPOINTMENTS_SERVICE')
    expect(capturedConvertPayload.trackInventory).toBe(false)
  })
})
