/**
 * E2E de «Pedidos en línea» (Bandeja y Menú en línea). Todo por `page.route()`, sin backend.
 *  (a) aceptar un pedido «Por aceptar» ⇒ la tarjeta pasa a «En preparación» SIN recargar;
 *  (b) prender un producto en «Menú en línea» ⇒ «N de M» cambia SIN recargar.
 * Los mocks son con ESTADO: la lista cambia sólo si la página re-lee después de la mutación (cazan una invalidación mal dirigida).
 * Se registran DESPUÉS de setupApiMocks (LIFO).
 */
import { expect, test, type Page } from '@playwright/test'

import { setupApiMocks } from '../../fixtures/api-mocks'
import { VENUE_ALPHA } from '../../fixtures/mock-data'

test.setTimeout(60_000)
test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('lang', 'es'))
})

const VENUE = {
  ...VENUE_ALPHA,
  permissions: [...VENUE_ALPHA.permissions, 'online-orders:manage', 'online-orders:pause'],
}
const PRO_PLAN = { hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false } as const
const BASE = '**/api/v1/dashboard/venues/venue-alpha/online-ordering'
const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })

async function setup(page: Page) {
  await setupApiMocks(page, { venues: [VENUE], planState: PRO_PLAN })
  // El panel de TanStack Query DevTools tapa la parte baja de la página: se oculta en cada navegación.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '.tsqd-parent-container{display:none!important}'
      document.head.appendChild(style)
    })
  })
}

test('aceptar un pedido lo pasa a «En preparación» sin recargar', async ({ page }) => {
  await setup(page)
  let status: 'PENDING_ACCEPTANCE' | 'ACCEPTED' = 'PENDING_ACCEPTANCE'
  let acceptBody: unknown = null

  await page.route(`${BASE}/orders?*`, route => {
    const pending = status === 'PENDING_ACCEPTANCE'
    return route.fulfill(
      json({
        serverTime: new Date().toISOString(),
        counts: { pending: pending ? 1 : 0, accepted: pending ? 0 : 1, ready: 0, active: 1, done: 0 },
        orders: [
          {
            orderId: 'ord-1',
            onlineOrderId: 'oo-1',
            orderNumber: 101,
            status,
            paymentMode: 'PAY_AT_PICKUP',
            customerName: 'Ana Pérez',
            customerPhone: '5512345678',
            note: null,
            createdAt: new Date().toISOString(),
            acceptDeadlineAt: pending ? new Date(Date.now() + 300_000).toISOString() : null,
            estimatedReadyAt: null,
            total: 206,
            remaining: 206,
            paymentStatus: 'PENDING',
            needsPrint: false,
            items: [{ name: 'Tacos al pastor', quantity: 2, note: null, modifiers: [] }],
          },
        ],
        truncated: false,
        nextCursor: null,
        store: { status: 'OPEN', reason: null, pausedUntil: null, manualPause: false },
      }),
    )
  })
  await page.route(`${BASE}/orders/ord-1/accept`, route => {
    acceptBody = route.request().postDataJSON()
    status = 'ACCEPTED'
    return route.fulfill(json({ status: 'ACCEPTED', estimatedReadyAt: new Date(Date.now() + 900_000).toISOString() }))
  })

  await page.goto('/venues/venue-alpha/online-ordering#bandeja')
  const card = page.getByTestId('order-ord-1')
  await expect(page.getByRole('heading', { name: /Por aceptar/ })).toContainText('(1)')
  await expect(card).toBeVisible()

  await card.getByRole('button', { name: 'Aceptar' }).click()
  await page.getByRole('button', { name: '15 min' }).click()

  // Sin recargar: la misma tarjeta aparece bajo «En preparación» y sus botones cambian a «Listo».
  await expect(page.getByRole('heading', { name: /En preparación/ })).toContainText('(1)')
  await expect(page.getByRole('heading', { name: /Por aceptar/ })).toContainText('(0)')
  await expect(card.getByRole('button', { name: 'Listo' })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Aceptar' })).toHaveCount(0)
  expect(acceptBody).toEqual({ estimatedMinutes: 15 })
})

test('prender un producto en «Menú en línea» cambia «N de M» sin recargar', async ({ page }) => {
  await setup(page)
  const products = [
    { id: 'p1', name: 'Hamburguesa', price: 120, imageUrl: null, active: true, availableOnline: true, categoryId: 'c1' },
    { id: 'p2', name: 'Papas', price: 50, imageUrl: null, active: true, availableOnline: false, categoryId: 'c1' },
    { id: 'p3', name: 'Refresco', price: 30, imageUrl: null, active: true, availableOnline: false, categoryId: 'c1' },
  ]
  let putBody: unknown = null

  await page.route(`${BASE}/menu/categories`, route => {
    const online = products.filter(p => p.availableOnline).length
    return route.fulfill(
      json({
        categories: [{ id: 'c1', name: 'Comida', active: true, total: 3, online, onlineWithoutPhoto: online }],
        totals: { total: 3, online, onlineWithoutPhoto: online },
        truncated: false,
      }),
    )
  })
  await page.route(`${BASE}/menu/products?*`, route => route.fulfill(json({ items: products, nextCursor: null, total: products.length })))
  await page.route(`${BASE}/menu/availability`, route => {
    putBody = route.request().postDataJSON()
    const { availableOnline, productIds } = putBody as { availableOnline: boolean; productIds: string[] }
    products.forEach(p => productIds.includes(p.id) && (p.availableOnline = availableOnline))
    return route.fulfill(json({ updated: productIds.length }))
  })

  await page.goto('/venues/venue-alpha/online-ordering#menu')
  await expect(page.getByText('1 de 3 productos en línea')).toBeVisible()

  await page.getByRole('button', { name: /Comida/ }).click()
  await page.getByRole('switch', { name: 'Mostrar Papas en línea' }).click()

  await expect(page.getByText('2 de 3 productos en línea')).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Mostrar Papas en línea' })).toBeChecked()
  expect(putBody).toEqual({ availableOnline: true, productIds: ['p2'] })
})
