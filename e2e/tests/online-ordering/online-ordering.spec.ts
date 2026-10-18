/**
 * E2E de «Pedidos en línea» (Bandeja y Menú en línea). Todo por `page.route()`, sin backend.
 *  (a) aceptar un pedido «Por aceptar» ⇒ la tarjeta pasa a «En preparación» SIN recargar;
 *  (b) prender un producto en «Menú en línea» ⇒ «N de M» cambia SIN recargar;
 *  (c) guardar «Configuración» con la respuesta REAL del PUT (sin `store` ni `requirements`) ⇒ la pestaña sigue en pie;
 *  (d) el aviso de plan vencido se va solo, sin recargar, cuando el plan se reactiva (el sondeo de la bandeja vuelve a pedir el plan).
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

test('guardar Configuración con la respuesta real del PUT (sin store ni requirements) deja la pestaña en pie', async ({ page }) => {
  await setup(page)
  // La vista previa pide la tienda a otro dominio: se responde en vacío para no depender de la red.
  await page.route('https://pedidos.avoqado.io/**', route =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<p>tienda</p>' }),
  )
  const settings = {
    enabled: false,
    minOrderAmount: 50,
    defaultPrepMinutes: 20,
    acceptsPayAtPickup: true,
    manualPause: false,
    pausedUntil: null,
    hours: null,
    lastInboxPollAt: null,
  }
  // El GET trae la vista completa; el PUT de hoy contesta SÓLO los ajustes (la forma que tumbaba la pestaña).
  const view = () => ({
    ...settings,
    store: { status: settings.enabled ? 'OPEN' : 'DISABLED', reason: null, pausedUntil: null, manualPause: false },
    requirements: { address: true, phone: true, privacyNotice: true },
  })
  let gets = 0
  let putBody: unknown = null
  await page.route(`${BASE}/settings`, route => {
    if (route.request().method() === 'PUT') {
      putBody = route.request().postDataJSON()
      Object.assign(settings, putBody)
      return route.fulfill(json({ ...settings }))
    }
    gets += 1
    return route.fulfill(json(view()))
  })

  await page.goto('/venues/venue-alpha/online-ordering#configuracion')
  const min = page.getByLabel('Pedido mínimo (MXN)')
  const status = page.locator('[data-tour="online-ordering-store-status"]')
  await expect(min).toHaveValue('50')
  await expect(status).toContainText('Apagada')

  await min.fill('80')
  await page.getByRole('button', { name: 'Guardar' }).click()

  // 🔴 Sin recargar: la pestaña sigue en pie, con lo guardado, y volvió a leer el GET.
  await expect(page.getByText('Configuración guardada', { exact: true })).toBeVisible()
  await expect(page.getByText('¡Ups!')).toHaveCount(0)
  await expect(min).toHaveValue('80')
  await expect(status).toContainText('Apagada')
  await expect(page.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  await expect.poll(() => gets).toBeGreaterThanOrEqual(2)
  expect(putBody).toEqual({ minOrderAmount: 80 })
})

test('el aviso de plan vencido se va solo, sin recargar, al reactivar el plan', async ({ page }) => {
  test.setTimeout(90_000)
  await setup(page)
  let tier: 'FREE' | 'PRO' = 'FREE'
  await page.route('**/api/v1/dashboard/venues/*/plan-tier', route =>
    route.fulfill(json({ tier, grandfathered: false, exempt: false, grantedFeatureCodes: tier === 'PRO' ? ['ONLINE_ORDERING'] : [] })),
  )
  await page.route(`${BASE}/orders?*`, route =>
    route.fulfill(
      json({
        serverTime: new Date().toISOString(),
        counts: { pending: 0, accepted: 0, ready: 0, active: 0, done: 0 },
        orders: [],
        truncated: false,
        nextCursor: null,
        store: { status: 'OPEN', reason: null, pausedUntil: null, manualPause: false },
      }),
    ),
  )

  await page.goto('/venues/venue-alpha/online-ordering#bandeja')
  await expect(page.getByText('Tu plan no incluye Pedidos en línea')).toBeVisible()
  await expect(page.getByText('Sin plan: no llegan pedidos nuevos')).toBeVisible()

  // El plan se reactiva fuera del panel: el siguiente sondeo (10 s) lo lee y el aviso se va SIN recargar.
  tier = 'PRO'
  await expect(page.getByText('Tu plan no incluye Pedidos en línea')).toHaveCount(0, { timeout: 30_000 })
  await expect(page.locator('[data-testid="online-inbox"]')).toContainText('Abierta')
})
