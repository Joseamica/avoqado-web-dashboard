/**
 * E2E de «Pedidos en línea» (Bandeja y Menú en línea). Todo por `page.route()`, sin backend.
 *  (a) aceptar un pedido «Por aceptar» ⇒ la tarjeta pasa a «En preparación» SIN recargar;
 *  (b) prender un producto en «Menú en línea» ⇒ «N de M» cambia SIN recargar;
 *  (c) guardar «Configuración» con la respuesta REAL del PUT (sin `store` ni `requirements`) ⇒ la pestaña sigue en pie;
 *  (d) el aviso de plan vencido se va solo, sin recargar, cuando el plan se reactiva (el sondeo de la bandeja vuelve a pedir el plan).
 * Los mocks son con ESTADO: la lista cambia sólo si la página re-lee después de la mutación (cazan una invalidación mal dirigida).
 * Se registran DESPUÉS de setupApiMocks (LIFO).
 */
import { mkdirSync } from 'node:fs'

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
  permissions: [...VENUE_ALPHA.permissions, 'online-orders:manage', 'online-orders:pause', 'orders:cancel-unpaid', 'orders:update'],
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
  // Arranque en frío del servidor de dev: Vite compila la página al primer pedido. Se espera la app (no se oculta nada: si nunca sale, falla).
  await expect(page.getByRole('heading', { name: /Por aceptar/ })).toBeVisible({ timeout: 45_000 })
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

// ───────────── Tienda híbrida · «Nadie» confirma (folios que se pagan en caja) ─────────────
// Las capturas van FUERA del repo (evidencia visual de D4): 1280 y 375 px, claro y oscuro.
// Capturas de revisión: sólo si se pide con CAPTURAS_D4=<carpeta>; en CI (o sin la variable) no se escribe ningún archivo.
const shot = async (page: Page, file: string) => {
  const dir = process.env.CAPTURAS_D4
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: `${dir}/${file}`, fullPage: true })
}
const WEEK = Object.fromEntries(
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(d => [
    d,
    { enabled: true, ranges: [{ open: '07:00', close: '21:00' }] },
  ]),
)
const NOW = () => new Date().toISOString()

function nadieSettings(over: Record<string, unknown> = {}) {
  return {
    enabled: true,
    minOrderAmount: 0,
    defaultPrepMinutes: 20,
    acceptsPayAtPickup: true,
    acceptsCardOnline: false,
    manualPause: false,
    pausedUntil: null,
    hours: WEEK,
    lastInboxPollAt: null,
    requiresAcceptance: false,
    hasSavedSettings: true,
    suggestedRequiresAcceptance: false,
    lastToPayPollAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    store: { status: 'OPEN', reason: null, pausedUntil: null, manualPause: false },
    requirements: { address: true, phone: true, privacyNotice: true },
    ...over,
  }
}

const folio = (id: string, orderNumber: string, over: Record<string, unknown> = {}) => ({
  orderId: id,
  onlineOrderId: `oo-${id}`,
  orderNumber,
  status: 'PENDING_ACCEPTANCE',
  paymentMode: 'PAY_AT_PICKUP',
  customerName: 'Ana Pérez',
  customerPhone: null,
  note: null,
  createdAt: NOW(),
  acceptDeadlineAt: null,
  estimatedReadyAt: null,
  total: 206,
  remaining: 206,
  paymentStatus: 'PENDING',
  needsPrint: false,
  requiresAcceptance: false,
  items: [{ name: 'Café americano', quantity: 2, note: null, modifiers: [] }],
  ...over,
})

async function setupNadie(page: Page, opts: { settings?: Record<string, unknown>; theme?: 'light' | 'dark' } = {}) {
  await setup(page)
  const theme = opts.theme ?? 'light'
  await page.addInitScript(t => window.localStorage.setItem('vite-ui-theme', t), theme)
  await page.route('https://pedidos.avoqado.io/**', route =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<p>tienda</p>' }),
  )
  await page.route(`${BASE}/settings`, route => route.fulfill(json(nadieSettings(opts.settings))))
}

async function mockToPay(page: Page, data: { toPay: unknown[]; toDeliver: unknown[]; requiresAcceptance?: boolean }) {
  await page.route(`${BASE}/orders/to-pay*`, route =>
    route.fulfill(
      json({
        serverTime: NOW(),
        enabled: true,
        requiresAcceptance: data.requiresAcceptance ?? false,
        showTile: true,
        pollSeconds: 10,
        counts: { toPay: data.toPay.length, toDeliver: data.toDeliver.length },
        toPay: data.toPay,
        toDeliver: data.toDeliver,
        nextCursors: { toPay: null, toDeliver: null },
        store: { status: 'OPEN', reason: null, pausedUntil: null, manualPause: false },
      }),
    ),
  )
  await page.route(`${BASE}/orders?*`, route =>
    route.fulfill(
      json({
        serverTime: NOW(),
        counts: { pending: 0, accepted: 0, ready: 0, active: 0, done: 0, acceptedTeam: 0 },
        orders: [],
        truncated: false,
        nextCursor: null,
        store: { status: 'OPEN', reason: null, pausedUntil: null, manualPause: false },
      }),
    ),
  )
}

/** Foto en 1280 y 375 px. La app hace scroll dentro de su propio contenedor, así que se alarga la ventana para que `fullPage` enseñe todo. */
async function shootBoth(page: Page, name: string, theme: string, ready: () => Promise<void>) {
  for (const [label, width, height] of [
    ['1280', 1280, 1600],
    ['375', 375, 2400],
  ] as const) {
    await page.setViewportSize({ width, height })
    await ready()
    await shot(page, `${name}-${label}-${theme}.png`)
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`Nadie · Configuración: «¿Quién confirma?» con aparato (${theme})`, async ({ page }) => {
    await setupNadie(page, { theme })
    await page.goto('/venues/venue-alpha/online-ordering#configuracion')
    const card = page.getByRole('group', { name: '¿Quién confirma los pedidos?' })
    await expect(card).toBeVisible()
    await expect(page.getByRole('radio', { name: /Nadie/ })).toBeChecked()
    await expect(page.getByText('Sugerido para tu giro')).toBeVisible()
    await expect(page.getByText('Con "Nadie", la clienta paga antes de que se prepare', { exact: false })).toBeVisible()
    const list = page.locator('[data-tour="online-ordering-no-one-checklist"]')
    await expect(list).toContainText('Para recibir pedidos con «Nadie»')
    await expect(list).toContainText('Horario de pedidos: lunes a domingo, 07:00–21:00')
    await expect(list).toContainText('Un aparato que cobra folios se conectó hace 5 min')
    await expect(list).not.toContainText('Qué hacer')
    await expect(page.getByRole('switch', { name: 'Pagar al recoger' })).toBeDisabled()
    await shootBoth(page, 'configuracion-nadie-con-aparato', theme, async () => {
      await expect(card).toBeVisible()
    })
  })
}

test('Nadie · Configuración: sin aparato la lista dice qué hacer y «Encender» no enciende', async ({ page }) => {
  await setupNadie(page, {
    settings: { enabled: false, lastToPayPollAt: null, store: { status: 'DISABLED', reason: null, pausedUntil: null, manualPause: false } },
  })
  await page.goto('/venues/venue-alpha/online-ordering#configuracion')
  const list = page.locator('[data-tour="online-ordering-no-one-checklist"]')
  await expect(list).toContainText('Ningún aparato puede cobrar folios todavía')
  await expect(list).toContainText('Qué hacer: Abre la terminal o el POS')
  await expect(page.getByText('Falta un aparato que cobre folios.')).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Encender la tienda' })).toBeDisabled()
  await expect(page.getByText('Todo listo', { exact: false })).toHaveCount(0)
  await shootBoth(page, 'configuracion-nadie-sin-aparato', 'light', async () => {
    await expect(list).toBeVisible()
  })
})

test('Nadie · Configuración: sin horario la lista manda a «Horario»', async ({ page }) => {
  await setupNadie(page, { settings: { hours: null } })
  await page.goto('/venues/venue-alpha/online-ordering#configuracion')
  const list = page.locator('[data-tour="online-ordering-no-one-checklist"]')
  await expect(list).toContainText('Pon tu horario')
  await expect(list.getByRole('link', { name: 'Ir a Horario' })).toHaveAttribute('href', '#oo-hours-card')
})

for (const theme of ['light', 'dark'] as const) {
  test(`Nadie · Bandeja: «Por pagar» y «Por entregar» (${theme})`, async ({ page }) => {
    await setupNadie(page, { theme })
    await mockToPay(page, {
      toPay: [
        folio('f1', 'W7KQ2', { createdAt: new Date(Date.now() - 4 * 60_000).toISOString() }),
        folio('f2', 'WH3N8', {
          customerName: 'Luis Gómez',
          total: 300,
          remaining: 120,
          paymentStatus: 'PARTIAL',
          createdAt: new Date(Date.now() - 6 * 60_000).toISOString(),
        }),
      ],
      toDeliver: [
        folio('f3', 'WB4M9', {
          status: 'ACCEPTED',
          paymentStatus: 'PAID',
          remaining: 0,
          customerName: 'Marta Ruiz',
          paidAt: new Date(Date.now() - 3 * 60_000).toISOString(),
        }),
        folio('f4', 'WC5P6', { status: 'ACCEPTED', paymentStatus: 'PAID', remaining: 0, customerName: 'Jorge Soto' }),
      ],
    })
    await page.goto('/venues/venue-alpha/online-ordering#bandeja')
    const toPay = page.locator('[data-tour="online-inbox-toPay"]')
    const toDeliver = page.locator('[data-tour="online-inbox-toDeliver"]')
    await expect(toPay.getByRole('heading', { name: /Por pagar/ })).toContainText('(2)')
    await expect(toDeliver.getByRole('heading', { name: /Por entregar/ })).toContainText('(2)')
    await expect(page.getByText('Con «Nadie», los folios se cobran en caja', { exact: false })).toBeVisible()

    // Folio simple: «Cancelar folio»; con abono: «Falta» y «Se cobra en caja», SIN cancelar.
    const f1 = page.getByTestId('folio-f1')
    const f2 = page.getByTestId('folio-f2')
    await expect(f1.getByRole('button', { name: 'Cancelar folio' })).toBeVisible()
    await expect(f2).toContainText('Falta')
    await expect(f2).toContainText('Ya pagó')
    await expect(f2).toContainText('Se cobra en caja')
    await expect(f2.getByRole('button', { name: 'Cancelar folio' })).toHaveCount(0)
    await expect(f1.getByRole('button', { name: /Aceptar|Cobrar/ })).toHaveCount(0)

    // Por entregar: con `paidAt` dice «Pagado a las…», sin él «Pidió…».
    await expect(page.getByTestId('folio-f3')).toContainText('Pagado a las')
    await expect(page.getByTestId('folio-f4')).not.toContainText('Pagado a las')
    await expect(page.getByTestId('folio-f4')).toContainText('Pidió')
    await expect(page.getByTestId('folio-f3').getByRole('button', { name: 'Entregado' })).toBeVisible()
    await shootBoth(page, 'bandeja-nadie', theme, async () => {
      await expect(toDeliver).toBeVisible()
    })
  })
}

for (const theme of ['light', 'dark'] as const) {
  test(`Nadie · Bandeja: «Vence en N min» es ámbar con 5 min o menos, nunca rojo (${theme})`, async ({ page }) => {
    await setupNadie(page, { theme })
    await mockToPay(page, {
      toPay: [
        folio('f1', 'W7KQ2', { acceptDeadlineAt: new Date(Date.now() + 4 * 60_000).toISOString() }),
        folio('f2', 'WH3N8', { customerName: 'Luis Gómez', acceptDeadlineAt: new Date(Date.now() + 20 * 60_000).toISOString() }),
      ],
      toDeliver: [],
    })
    await page.goto('/venues/venue-alpha/online-ordering#bandeja')
    const soon = page.getByTestId('folio-f1').getByText(/^Vence en \d+ min$/)
    const later = page.getByTestId('folio-f2').getByText(/^Vence en \d+ min$/)
    await expect(soon).toHaveText('Vence en 4 min', { timeout: 45_000 })
    await expect(later).toHaveText('Vence en 20 min')
    await expect(soon).toHaveClass(/text-amber-/)
    await expect(soon).not.toHaveClass(/red|destructive/)
    await expect(later).not.toHaveClass(/amber|red|destructive/)
    await page.setViewportSize({ width: 1280, height: 1000 })
    await shot(page, `vence-en-1280-${theme}.png`)
  })
}

test('Nadie · Bandeja: «Cancelar folio» pide confirmar y el folio sale', async ({ page }) => {
  await setupNadie(page)
  let cancelled = false
  let cancelCalls = 0
  await page.route(`${BASE}/orders/f1/cancel`, route => {
    cancelCalls += 1
    cancelled = true
    return route.fulfill(json({ status: 'CANCELLED_BY_STAFF' }))
  })
  await page.route(`${BASE}/orders/to-pay*`, route =>
    route.fulfill(
      json({
        serverTime: NOW(),
        enabled: true,
        requiresAcceptance: false,
        showTile: true,
        pollSeconds: 10,
        counts: { toPay: cancelled ? 0 : 1, toDeliver: 0 },
        toPay: cancelled ? [] : [folio('f1', 'W7KQ2')],
        toDeliver: [],
        nextCursors: { toPay: null, toDeliver: null },
        store: { status: 'OPEN', reason: null, pausedUntil: null, manualPause: false },
      }),
    ),
  )
  await page.route(`${BASE}/orders?*`, route =>
    route.fulfill(
      json({
        serverTime: NOW(),
        counts: { pending: 0, accepted: 0, ready: 0, active: 0, done: 0 },
        orders: [],
        truncated: false,
        nextCursor: null,
        store: { status: 'OPEN', reason: null, pausedUntil: null, manualPause: false },
      }),
    ),
  )
  await page.goto('/venues/venue-alpha/online-ordering#bandeja')
  await page.getByTestId('folio-f1').getByRole('button', { name: 'Cancelar folio' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('¿Cancelar el folio')
  await expect(dialog).toContainText('lo verá cancelado en su celular')
  // «No» no cancela nada.
  await dialog.getByRole('button', { name: 'No' }).click()
  await expect(dialog).toHaveCount(0)
  expect(cancelCalls).toBe(0)
  await page.getByTestId('folio-f1').getByRole('button', { name: 'Cancelar folio' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.waitForTimeout(500) // deja terminar la animación de entrada antes de la foto
  await shot(page, 'dialogo-cancelar-folio-1280-light.png')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, cancelar' }).click()
  await expect(page.getByTestId('folio-f1')).toHaveCount(0)
  expect(cancelCalls).toBe(1)
})

test('«Mi equipo» no muestra nada nuevo: ni nota, ni «Por pagar», ni «Por entregar»', async ({ page }) => {
  await setup(page)
  await page.route(`${BASE}/settings`, route =>
    route.fulfill(
      json(nadieSettings({ requiresAcceptance: true, hasSavedSettings: true, suggestedRequiresAcceptance: true, lastToPayPollAt: null })),
    ),
  )
  // El panel de «Mi equipo» no tiene folios: el servidor puede contestar vacío o 403 y no debe notarse.
  await page.route(`${BASE}/orders/to-pay*`, route =>
    route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ success: false }) }),
  )
  await page.route(`${BASE}/orders?*`, route =>
    route.fulfill(
      json({
        serverTime: NOW(),
        counts: { pending: 0, accepted: 0, ready: 0, active: 0, done: 0 },
        orders: [],
        truncated: false,
        nextCursor: null,
        store: { status: 'OPEN', reason: null, pausedUntil: null, manualPause: false },
      }),
    ),
  )
  await page.goto('/venues/venue-alpha/online-ordering#bandeja')
  await expect(page.getByRole('heading', { name: /Por aceptar/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Por pagar/ })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /Por entregar/ })).toHaveCount(0)
  await expect(page.getByText('Con «Nadie», los folios se cobran en caja', { exact: false })).toHaveCount(0)
  await expect(page.getByText('¡Ups!')).toHaveCount(0)

  await page.goto('/venues/venue-alpha/online-ordering#configuracion')
  await expect(page.getByRole('radio', { name: /Mi equipo/ })).toBeChecked()
  await expect(page.locator('[data-tour="online-ordering-no-one-checklist"]')).toHaveCount(0)
})
