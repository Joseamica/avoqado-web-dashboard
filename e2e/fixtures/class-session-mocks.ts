/**
 * Mock API routes for CLASS product type E2E tests.
 *
 * Must be called AFTER setupApiMocks() (LIFO: these override the catch-all).
 *
 * Routes mocked:
 *   GET /api/v1/dashboard/venues/:venueId/product-types
 *   GET /api/v1/dashboard/product-types
 *   GET /api/v1/dashboard/venues/:venueId/inventory/should-use-inventory
 *   GET /api/v1/dashboard/venues/:venueId/menucategories
 *   GET /api/v1/dashboard/venues/:venueId/modifier-groups
 *   GET /api/v1/dashboard/venues/:venueId/products
 */

import { Page } from '@playwright/test'
import type { ProductType, ProductTypeConfig, ProductTypesResponse } from '../../src/services/inventory.service'

// ─── Types ──────────────────────────────────────────────────────

export interface SetupProductTypeMocksOptions {
  /** Include CLASS in the types list. Default: true */
  includeClass?: boolean
  /** Venue type to return in the response. Default: 'GYM' */
  venueType?: string
}

// ─── Factories ──────────────────────────────────────────────────

/**
 * Build the mock response returned by GET /product-types.
 *
 * Always includes: REGULAR, FOOD_AND_BEV, APPOINTMENTS_SERVICE
 * Adds CLASS when includeClass=true (default).
 *
 * The `recommended` array is derived from the venue type — for GYM venues
 * CLASS and APPOINTMENTS_SERVICE are recommended, matching real backend logic.
 */
export function createMockProductTypesResponse(
  options: SetupProductTypeMocksOptions = {},
): ProductTypesResponse {
  const { includeClass = true, venueType = 'GYM' } = options

  const allTypes: ProductTypeConfig[] = [
    {
      code: 'REGULAR',
      label: 'Regular Item',
      labelEs: 'Artículo Regular',
      description: 'A standard physical or digital item you sell.',
      descriptionEs: 'Un artículo físico o digital estándar que vendes.',
      fields: ['name', 'price', 'sku', 'inventory'],
      canTrackInventory: true,
      icon: 'Package',
    },
    {
      code: 'FOOD_AND_BEV',
      label: 'Food & Beverage',
      labelEs: 'Bebidas y alimentos preparados',
      description: 'Prepared food and beverages, with recipe cost tracking.',
      descriptionEs: 'Alimentos y bebidas preparados, con seguimiento de costos por receta.',
      hasAlcoholToggle: true,
      fields: ['name', 'price', 'sku', 'inventory'],
      canTrackInventory: true,
      icon: 'UtensilsCrossed',
    },
    {
      code: 'APPOINTMENTS_SERVICE',
      label: 'Service / Appointment',
      labelEs: 'Servicio / Cita',
      description: 'A bookable service with optional duration (haircut, consultation, etc.).',
      descriptionEs: 'Un servicio reservable con duración opcional (corte de cabello, consulta, etc.).',
      fields: ['name', 'price', 'duration'],
      canTrackInventory: false,
      icon: 'Calendar',
    },
  ]

  if (includeClass) {
    allTypes.push({
      code: 'CLASS',
      label: 'Class / Workshop',
      labelEs: 'Clase / Taller',
      description: 'A group session with a maximum capacity (yoga, fitness class, workshop).',
      descriptionEs: 'Una sesión grupal con capacidad máxima (yoga, clase de fitness, taller).',
      fields: ['name', 'price', 'maxParticipants'],
      canTrackInventory: false,
      icon: 'Users',
    })
  }

  const recommended: ProductType[] =
    venueType === 'GYM'
      ? (['APPOINTMENTS_SERVICE', ...(includeClass ? (['CLASS'] as ProductType[]) : [])] as ProductType[])
      : (['REGULAR'] as ProductType[])

  return {
    types: allTypes,
    venueType,
    recommended,
  }
}

// ─── Route setup helpers ─────────────────────────────────────────

/**
 * Register Playwright route mocks for the product-types endpoints.
 *
 * Call this AFTER setupApiMocks() so these routes take priority (LIFO).
 */
export async function setupProductTypeMocks(
  page: Page,
  options: SetupProductTypeMocksOptions = {},
): Promise<void> {
  const typesData = createMockProductTypesResponse(options)

  // Venue-specific endpoint: GET /api/v1/dashboard/venues/:id/product-types
  await page.route(
    (url) => url.pathname.includes('/api/') && url.pathname.includes('/product-types') && url.pathname.includes('/venues/'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: typesData }),
      }),
  )

  // Global admin endpoint: GET /api/v1/dashboard/product-types (no /venues/)
  await page.route(
    (url) =>
      url.pathname.includes('/api/') &&
      url.pathname.endsWith('/product-types') &&
      !url.pathname.includes('/venues/'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { types: typesData.types } }),
      }),
  )
}

/**
 * Register a Playwright route mock for the inventory recommendation endpoint.
 *
 * The wizard calls this when it opens to decide whether to suggest inventory tracking.
 * For CLASS and service types we always return hasInventoryFeature: false so the
 * inventory section recommendation hint is harmless.
 */
export async function setupInventoryRecommendationsMocks(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname.includes('/api/') && url.pathname.includes('/should-use-inventory'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            hasInventoryFeature: false,
            recommendation: 'wizard.step2.noFeatureRecommendation',
          },
        }),
      }),
  )
}

/**
 * Register a Playwright route mock for the menu categories endpoint.
 *
 * The wizard needs at least one category for the category dropdown to render.
 */
export async function setupMenuCategoriesMocks(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname.includes('/api/') && url.pathname.includes('/menucategories'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'cat-001', name: 'Clases de Yoga', displayOrder: 0 },
          { id: 'cat-002', name: 'Servicios Fitness', displayOrder: 1 },
          { id: 'cat-003', name: 'Talleres', displayOrder: 2 },
        ]),
      }),
  )
}

/**
 * Register a Playwright route mock for modifier groups (needed by the wizard dropdown).
 */
export async function setupModifierGroupsMocks(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname.includes('/api/') && url.pathname.includes('/modifier-groups'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
  )
}

/**
 * Register a Playwright route mock for the products list (so the Products page renders).
 */
export async function setupProductsListMock(page: Page): Promise<void> {
  await page.route(
    (url) =>
      url.pathname.includes('/api/') &&
      url.pathname.includes('/products') &&
      !url.pathname.includes('/product-types'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        }),
      }),
  )
}
