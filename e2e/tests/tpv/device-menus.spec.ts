/**
 * E2E — Menú del aparato (B5): pestaña «Qué muestra cada aparato» en /devices?tab=menus.
 *   1. escribir y VER: elegir un menú en una fila guarda (PUT) y la fila muestra el nuevo conteo SIN recargar;
 *   2. plan Gratis: la pestaña enseña el candado de Pro, la página no desaparece.
 * Respuestas fingidas con la forma de `deviceMenus.service.ts`: prueban el navegador, no el server.
 */
import { test, expect, type Page } from '@playwright/test'

import { setupApiMocks } from '../../fixtures/api-mocks'
import { createMockVenue, StaffRole } from '../../fixtures/mock-data'

test.setTimeout(60_000)
test.use({ locale: 'es-MX', viewport: { width: 1400, height: 900 } })

const VENUE = createMockVenue({ id: 'venue-alpha', name: 'Testarudo Cafe', slug: 'venue-alpha' })
VENUE.permissions = [...VENUE.permissions, 'tpv:read', 'tpv:update', 'menu:create']
const PRO = { hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false } as const
const FREE = { hasPlan: false, state: 'none', planTier: 'GRATIS', grandfathered: false } as const

const EVERYTHING = { categories: 8, products: 120 }
const ROW_ANTES = {
  id: 'pos-1',
  name: 'Caja Cremería',
  type: 'POS_ANDROID',
  model: 'Sunmi D3',
  version: '2.22.2',
  areaName: 'Mostrador',
  needsAppUpdate: true,
  menus: [],
  sees: EVERYTHING,
  seesAfterUpdate: null,
}
// Tras elegir «Cremería»: la app es vieja, así que HOY ve todo y al actualizar verá 3 categorías · 40 productos (Ruling 11).
const ROW_DESPUES = { ...ROW_ANTES, menus: [{ id: 'menu-crem', name: 'Cremería' }], seesAfterUpdate: { categories: 3, products: 40 } }

async function mockMenus(page: Page) {
  const puts: unknown[] = []
  // El servidor guarda: tras el PUT, la relectura (invalidate) ya trae la fila nueva.
  let current = ROW_ANTES
  await page.route('**/api/v1/dashboard/venues/*/tpvs/menus/options**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        menus: [{ id: 'menu-crem', name: 'Cremería', appliesToOnline: false, categoryCount: 3 }],
        total: 1,
        page: 1,
        pageSize: 100,
      }),
    }),
  )
  await page.route('**/api/v1/dashboard/venues/*/tpvs/menus?**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ everything: EVERYTHING, terminals: [current], total: 1, page: 1, pageSize: 50 }),
    }),
  )
  await page.route('**/api/v1/dashboard/venues/*/tpv/*/menus', route => {
    if (route.request().method() !== 'PUT') return route.fallback()
    puts.push(route.request().postDataJSON())
    current = ROW_DESPUES
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROW_DESPUES) })
  })
  await page.route('**/api/v1/dashboard/venues/*/tpvs?**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { total: 0, page: 1, pageSize: 20, pageCount: 1 } }),
    }),
  )
  await page.route('**/api/v1/dashboard/venues/*/tpv-orders**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }),
  )
  return puts
}

test.describe('Menú del aparato — pestaña «Qué muestra cada aparato»', () => {
  test('elegir un menú guarda y la fila muestra el nuevo conteo sin recargar', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    const puts = await mockMenus(page)
    await page.goto('/venues/venue-alpha/devices?tab=menus')

    const row = page.getByTestId('device-menus-row-pos-1')
    await expect(row).toContainText('8 categorías · 120 productos', { timeout: 15_000 })
    await expect(row).not.toContainText('Al actualizar verá')

    await row.getByRole('combobox').click()
    await page.getByRole('option', { name: /Cremería/ }).click()

    await expect(row).toContainText('Al actualizar verá: 3 categorías · 40 productos')
    await expect(row).toContainText('8 categorías · 120 productos') // HOY sigue viendo todo
    await expect(row).toContainText('Actualiza la app para que lo aplique')
    expect(puts).toEqual([{ menuIds: ['menu-crem'] }])
  })

  test('plan Gratis: la pestaña enseña el candado de Pro y la página sigue ahí', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: FREE })
    await mockMenus(page)
    await page.goto('/venues/venue-alpha/devices?tab=menus')

    await expect(page.getByText(/Incluido en Pro/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('tab', { name: 'Qué muestra cada aparato' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Dispositivos' })).toBeVisible()
  })
})
