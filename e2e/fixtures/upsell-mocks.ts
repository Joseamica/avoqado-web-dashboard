/**
 * Mock API routes for the Upsell "¿Algo más?" E2E tests (`src/pages/Promotions/Upsell.tsx`).
 *
 * Must be called AFTER setupApiMocks() (LIFO: these override the catch-all).
 *
 * 🔴 The catch-all in setupApiMocks answers `{}` to every unmatched /api/v1/**, and
 * `upsellService` reads `response.data.data` — without these routes the page's three
 * queries resolve to `undefined` and it stays on skeletons forever.
 *
 * Uses URL function matchers (same shape as promotions-mocks.ts) and requires '/api/'
 * in the pathname so the SPA's own document request to /promotions/upsell is never
 * swallowed by a route meant for the API.
 */

import type { Page } from '@playwright/test'

/** Check if this is an API request matching a given path segment */
function isApiPath(url: URL, segment: string): boolean {
  return url.pathname.includes('/api/') && url.pathname.includes(segment)
}

/**
 * Suggestable with no strings attached: not vetoed, active, not sold by weight and
 * without required modifier groups — `suggestabilityOf` returns `blocked: false`.
 */
export const UPSELL_PRODUCT_CAFE = {
  id: 'p-cafe',
  name: 'Café americano',
  price: 35,
  active: true,
  upsellEnabled: true,
  soldByWeight: false,
  modifierGroups: [],
}

/**
 * Suggestable BUT asks for required options (`PIDE_OPCIONES`, the only blocked
 * reason that is `resolvable` from the create dialog). "Grande" costs +$15, which
 * is exactly what makes the price preview worth its existence: the card ends up
 * showing $50.00, not the $35.00 on the product sheet.
 */
export const UPSELL_PRODUCT_AGUA = {
  id: 'p-agua',
  name: 'Agua Mineral 1L',
  price: 35,
  active: true,
  upsellEnabled: true,
  soldByWeight: false,
  modifierGroups: [
    {
      id: 'pmg-tamano',
      groupId: 'g-tamano',
      displayOrder: 0,
      group: {
        id: 'g-tamano',
        name: 'Tamaño',
        required: true,
        modifiers: [
          { id: 'm-chico', name: 'Chico', price: 0 },
          { id: 'm-grande', name: 'Grande', price: 15 },
        ],
      },
    },
  ],
}

/** Vetoed on its own product sheet: shows up grayed out, with the reason next to the name. */
export const UPSELL_PRODUCT_VETADO = {
  id: 'p-vetado',
  name: 'Ensalada de la casa',
  price: 120,
  active: true,
  upsellEnabled: false,
  soldByWeight: false,
  modifierGroups: [],
}

export interface SetupUpsellMocksOptions {
  /** Rules returned by GET /upsell-rules. Default: none (empty page). */
  rules?: unknown[]
  /** Catalog served to the create dialog. Default: the three products above. */
  products?: unknown[]
  /** Make POST /upsell-rules fail with a 400 + message (error path). */
  createFails?: boolean
}

export interface UpsellMocks {
  /** Body of the last POST /upsell-rules, or null if it was never called. */
  lastCreatePayload: () => Record<string, unknown> | null
}

export async function setupUpsellMocks(page: Page, opts: SetupUpsellMocksOptions = {}): Promise<UpsellMocks> {
  const products = opts.products ?? [UPSELL_PRODUCT_CAFE, UPSELL_PRODUCT_AGUA, UPSELL_PRODUCT_VETADO]
  let createPayload: Record<string, unknown> | null = null

  // ── Performance panel: no data yet, so it renders its empty state instead of numbers.
  await page.route(
    url => isApiPath(url, '/upsell-performance'),
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            hasData: false,
            shownCount: 0,
            acceptedCount: 0,
            acceptanceRate: 0,
            attributedSales: 0,
            holdoutCount: 0,
            avgTicketShown: 0,
            avgTicketHoldout: 0,
            measuredLift: null,
          },
        }),
      }),
  )

  // ── The three knobs. Only `counter` is live in the POS today.
  await page.route(
    url => isApiPath(url, '/upsell-surfaces'),
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { counter: true, tableOrdering: false, tablePaying: false } }),
      }),
  )

  // ── Rules: GET lists, POST creates (what the create modal exercises).
  await page.route(
    url => isApiPath(url, '/upsell-rules'),
    route => {
      if (route.request().method() === 'POST') {
        createPayload = route.request().postDataJSON()
        return opts.createFails
          ? route.fulfill({
              status: 400,
              contentType: 'application/json',
              body: JSON.stringify({ message: 'El producto sugerido ya no está disponible.' }),
            })
          : route.fulfill({
              status: 201,
              contentType: 'application/json',
              body: JSON.stringify({ data: { id: 'rule-nueva', ...createPayload } }),
            })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: opts.rules ?? [] }),
      })
    },
  )

  // ── Catalog behind both product selectors. `getProducts` (menu.service.ts) accepts
  //    `data.data` or a bare array; wrapped is what the real server sends.
  await page.route(
    url => isApiPath(url, '/products'),
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: products }),
      }),
  )

  return { lastCreatePayload: () => createPayload }
}
