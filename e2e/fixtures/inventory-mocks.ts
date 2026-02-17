/**
 * Mock API routes for PlayTelecom inventory E2E tests.
 *
 * Must be called AFTER setupApiMocks() (LIFO: these override the catch-all).
 *
 * Uses URL function matchers for reliable matching across different API hosts.
 * All matchers require '/api/' in pathname to avoid intercepting page/asset requests.
 */

import { Page } from '@playwright/test'
import {
  MockItemCategory,
  ALL_MOCK_CATEGORIES,
  MOCK_ORG_CATEGORIES,
} from './mock-data'

export interface SetupInventoryMocksOptions {
  categories?: MockItemCategory[]
  orgCategories?: MockItemCategory[]
}

/** Check if this is an API request matching a given path segment */
function isApiPath(url: URL, segment: string): boolean {
  return url.pathname.includes('/api/') && url.pathname.includes(segment)
}

export async function setupInventoryMocks(
  page: Page,
  options: SetupInventoryMocksOptions = {},
) {
  const {
    categories = ALL_MOCK_CATEGORIES,
    orgCategories = MOCK_ORG_CATEGORIES,
  } = options

  // Org-level categories CRUD
  await page.route(
    (url) => isApiPath(url, '/org-item-categories'),
    async (route) => {
      const method = route.request().method()

      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { categories: orgCategories } }),
        })
      }

      if (method === 'POST') {
        const body = route.request().postDataJSON()
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: {
            id: 'cat-org-new',
            ...body,
            sortOrder: orgCategories.length,
            active: true,
            source: 'organization',
            totalItems: 0,
            availableItems: 0,
            soldItems: 0,
          } }),
        })
      }

      if (method === 'PUT') {
        const body = route.request().postDataJSON()
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { id: 'cat-org-001', ...body, active: true } }),
        })
      }

      if (method === 'DELETE') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { deleted: true, message: 'Categoría eliminada correctamente' } }),
        })
      }

      return route.fulfill({ status: 200, body: '{}' })
    },
  )

  // Merged item categories (venue + org) — but NOT org-item-categories
  await page.route(
    (url) => isApiPath(url, '/item-categories') && !url.pathname.includes('/org-item-categories'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { categories } }),
      }),
  )

  // Org bulk upload
  await page.route(
    (url) => isApiPath(url, '/org-bulk-upload'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, created: 3, duplicates: [], errors: [], total: 3 }),
      }),
  )

  // Venue bulk upload (but NOT org-bulk-upload)
  await page.route(
    (url) => isApiPath(url, '/bulk-upload') && !url.pathname.includes('/org-bulk-upload'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, created: 3, duplicates: [], errors: [], total: 3 }),
      }),
  )

  // Stock endpoints
  await page.route(
    (url) => isApiPath(url, '/stock/metrics'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalPieces: 175, totalValue: 12500, availablePieces: 145, soldToday: 5, soldThisWeek: 30,
        }),
      }),
  )

  await page.route(
    (url) => isApiPath(url, '/stock/chart'),
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )

  await page.route(
    (url) => isApiPath(url, '/stock/alerts'),
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )

  await page.route(
    (url) => isApiPath(url, '/stock/movements'),
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )

  await page.route(
    (url) => isApiPath(url, '/stock/categories'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          categories.map((c) => ({
            id: c.id, name: c.name, color: c.color,
            available: c.availableItems ?? 0, sold7d: c.soldItems ?? 0,
            suggestedPrice: c.suggestedPrice, coverage: 10, alertLevel: 'OK', minimumStock: null,
          })),
        ),
      }),
  )

  // TPV settings
  await page.route(
    (url) => isApiPath(url, '/settings/tpv'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          modules: {
            attendanceTracking: false, requireFacadePhoto: false, requireDepositPhoto: false,
            enableCashPayments: true, enableCardPayments: true, showReceiptAfterSale: true,
            showPriceOnScan: true, showStockCount: true,
          },
        }),
      }),
  )

  // Messages
  await page.route(
    (url) => isApiPath(url, '/messages'),
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )

  // Terminals
  await page.route(
    (url) => isApiPath(url, '/terminals'),
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )

  // Store performance
  await page.route(
    (url) => isApiPath(url, '/store-performance'),
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[]}' }),
  )

  // Goals
  await page.route(
    (url) => isApiPath(url, '/goals'),
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )

  // Features
  await page.route(
    (url) => isApiPath(url, '/features'),
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )

  // Organization stats and venues
  await page.route(
    (url) => isApiPath(url, '/organizations/') && url.pathname.includes('/stats'),
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )

  await page.route(
    (url) => isApiPath(url, '/organizations/') && url.pathname.includes('/venues'),
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
}
