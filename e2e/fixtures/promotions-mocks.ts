/**
 * Mock API routes for the Promotions (Combos y paquetes / bundles) E2E tests.
 *
 * Must be called AFTER setupApiMocks() (LIFO: these override the catch-all).
 *
 * Uses URL function matchers for reliable matching across different API hosts.
 * All matchers require '/api/' in pathname to avoid intercepting page/asset requests
 * (the SPA's own goto() pathname also contains '/promotions' — without the guard
 * this route would swallow the document request and the page would never load).
 */

import type { Page } from '@playwright/test'

/** Check if this is an API request matching a given path segment */
function isApiPath(url: URL, segment: string): boolean {
  return url.pathname.includes('/api/') && url.pathname.includes(segment)
}

const promo = (over: Record<string, unknown> = {}) => ({
  id: 'promo-1',
  name: 'Combo del día',
  description: null,
  imageUrl: null,
  type: 'BUNDLE',
  pricingMode: 'FIXED_TOTAL',
  price: 99,
  status: 'DRAFT',
  displayOrder: 0,
  validFrom: null,
  validUntil: null,
  daysOfWeek: [],
  timeFrom: null,
  timeUntil: null,
  createdAt: '2026-08-14T00:00:00Z',
  updatedAt: '2026-08-14T00:00:00Z',
  groups: [{ id: 'g1', name: 'Plato', options: [{ id: 'o1', productId: 'p1', quantity: 1, chargedQuantity: 1, priceDelta: 0 }] }],
  ...over,
})

export interface SetupPromotionMocksOptions {
  publishFails?: boolean
}

export async function setupPromotionMocks(page: Page, opts: SetupPromotionMocksOptions = {}) {
  // ── Promotions resource: catch-all FIRST (LIFO: specific routes registered
  // after take priority), excluding /publish so the dedicated route below wins.
  await page.route(
    url => isApiPath(url, '/promotions') && !url.pathname.endsWith('/publish'),
    route => {
      const method = route.request().method()
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [promo(), promo({ id: 'promo-2', name: 'Martes 2x1', pricingMode: 'PER_UNIT', price: 0, status: 'PUBLISHED' })],
            meta: { totalCount: 2, pageSize: 100, currentPage: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
          }),
        })
      }
      if (method === 'POST') {
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(promo({ id: 'promo-nuevo' })) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(promo()) })
    },
  )

  // ── Publish — the interesting behavior under test (success vs. 400 w/ errors[])
  await page.route(
    url => isApiPath(url, '/promotions') && url.pathname.endsWith('/publish'),
    route =>
      opts.publishFails
        ? route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ errors: ['El producto p1 está desactivado.', 'El grupo "Plato" no tiene opciones.'] }),
          })
        : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(promo({ status: 'PUBLISHED' })) }),
  )

  // ── Products — consumed by useDiscountFormData (useDiscountFormData.ts:14) to
  // populate the group's product SelectTrigger. Without this the selector stays
  // empty and the create flow can't complete (schema requires a productId).
  await page.route(
    url => isApiPath(url, '/products') && !isApiPath(url, '/promotions'),
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'p1', name: 'Hamburguesa mock' }]),
      }),
  )

  // ── Menu categories — also fetched by useDiscountFormData. getMenuCategories
  // returns response.data directly (menu.service.ts) and the hook does
  // `(categories || []).map(...)` — the generic catch-all in setupApiMocks
  // fulfills unmatched /api/v1/** with `{}`, and `{}.map` throws, crashing the
  // editor. Must explicitly return an array here.
  await page.route(
    url => isApiPath(url, '/menucategories'),
    route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  )
}
