/**
 * E2E — Menú del aparato (B5): pestaña «Qué muestra cada aparato» en /devices?tab=menus.
 *   1. escribir y VER: elegir un menú en una fila guarda (PUT) y la fila muestra el nuevo conteo SIN recargar;
 *   2. plan Gratis: la pestaña enseña el candado de Pro, la página no desaparece;
 *   3. (Codex r1 #3) con 101 menús, «Mostrar más menús» trae el 101 y se puede elegir;
 *   4. (Codex r1 #2) un 400 al guardar relee: el menú que ya no está deja de ofrecerse;
 *   5. (Codex r1 #1) mientras llega la página siguiente, las filas de la anterior no se editan.
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

const CREMERIA = { id: 'menu-crem', name: 'Cremería', appliesToOnline: false, categoryCount: 3 }
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
const pagina = (url: string) => Number(new URL(url).searchParams.get('page') ?? '1')

type Opciones = {
  /** Menús de la página `page` de opciones y su total; por omisión, sólo «Cremería». */
  opciones?: (page: number) => { menus: unknown[]; total: number }
  /** Aparatos de la página `page`; por omisión, la fila de la caja (antes o después del PUT). */
  aparatos?: (page: number) => Promise<{ terminals: unknown[]; total: number }> | { terminals: unknown[]; total: number }
  /** El PUT contesta 400 (menú que ya no está) en vez de guardar. */
  putFalla?: boolean
}

async function abrir(page: Page) {
  await page.goto('/venues/venue-alpha/devices?tab=menus')
  // En dev, las devtools de TanStack Query abren abiertas abajo y tapan las filas (mismo arreglo que commission-setup-panel).
  await page.addStyleTag({ content: '.tsqd-parent-container { display: none !important; }' })
}

async function mockMenus(page: Page, o: Opciones = {}) {
  const puts: unknown[] = []
  // El servidor guarda: tras el PUT, la relectura (invalidate) ya trae la fila nueva.
  let current = ROW_ANTES
  let menuBorrado = false
  await page.route('**/api/v1/dashboard/venues/*/tpvs/menus/options**', route => {
    const p = pagina(route.request().url())
    const { menus, total } = o.opciones?.(p) ?? (menuBorrado ? { menus: [], total: 0 } : { menus: [CREMERIA], total: 1 })
    return route.fulfill(json({ menus, total, page: p, pageSize: 100 }))
  })
  await page.route('**/api/v1/dashboard/venues/*/tpvs/menus?**', async route => {
    const p = pagina(route.request().url())
    const { terminals, total } = (await o.aparatos?.(p)) ?? { terminals: [current], total: 1 }
    return route.fulfill(json({ everything: EVERYTHING, terminals, total, page: p, pageSize: 50 }))
  })
  await page.route('**/api/v1/dashboard/venues/*/tpv/*/menus', route => {
    if (route.request().method() !== 'PUT') return route.fallback()
    puts.push(route.request().postDataJSON())
    if (o.putFalla) {
      // Otro dueño lo borró en «Menús» mientras esta pestaña seguía abierta.
      menuBorrado = true
      return route.fulfill(json({ message: 'Ese menú ya no está disponible para aparatos.' }, 400))
    }
    current = ROW_DESPUES
    return route.fulfill(json(ROW_DESPUES))
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
    await abrir(page)

    const row = page.getByTestId('device-menus-row-pos-1')
    await expect(row).toContainText('8 categorías · 120 productos', { timeout: 15_000 })
    await expect(row).not.toContainText('Al actualizar verá')
    // Con «Todos los menús» no hay nada que aplicar: no pide actualizar aunque la app sea vieja (Ruling 18).
    await expect(row).not.toContainText('Actualiza la app para que lo aplique')

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
    await abrir(page)

    await expect(page.getByText(/Incluido en Pro/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('tab', { name: 'Qué muestra cada aparato' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Dispositivos' })).toBeVisible()
  })

  test('con 101 menús, «Mostrar más menús» trae el 101 y se puede elegir', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    const cien = Array.from({ length: 100 }, (_, i) => ({
      id: `menu-${i + 1}`,
      name: `Menú ${i + 1}`,
      appliesToOnline: false,
      categoryCount: 1,
    }))
    const puts = await mockMenus(page, {
      opciones: p => ({
        menus: p === 1 ? cien : [{ id: 'menu-101', name: 'Menú 101', appliesToOnline: false, categoryCount: 2 }],
        total: 101,
      }),
    })
    await abrir(page)

    await expect(page.getByText('100 de 101 menús')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Mostrar más menús' }).click()
    await expect(page.getByText('101 de 101 menús')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mostrar más menús' })).toHaveCount(0)

    const row = page.getByTestId('device-menus-row-pos-1')
    await row.getByRole('combobox').click()
    await page.getByRole('option', { name: /Menú 101/ }).click()
    await expect.poll(() => puts).toEqual([{ menuIds: ['menu-101'] }])
  })

  test('un 400 al guardar relee: el menú que ya no está deja de ofrecerse', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    const puts = await mockMenus(page, { putFalla: true })
    await abrir(page)

    const row = page.getByTestId('device-menus-row-pos-1')
    await expect(row).toContainText('8 categorías · 120 productos', { timeout: 15_000 })
    await row.getByRole('combobox').click()
    await page.getByRole('option', { name: /Cremería/ }).click()
    await expect(page.getByText('Ese menú ya no está disponible para aparatos.').first()).toBeVisible()
    expect(puts).toEqual([{ menuIds: ['menu-crem'] }])
    // 🔴 La prueba: sin recargar, la pestaña ya sabe que no hay menús para aparatos y no vuelve a ofrecer «Cremería».
    await expect(page.getByRole('option', { name: /Cremería/ })).toHaveCount(0)
    await expect(page.getByTestId('device-menus-sin-menus')).toBeVisible()
    await expect(row).toContainText('Todos los menús')
  })

  test('mientras llega la página siguiente, las filas de la anterior no se editan', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    let suelta: () => void = () => {}
    const pagina2 = new Promise<void>(resolve => (suelta = resolve))
    await mockMenus(page, {
      aparatos: async p => {
        if (p === 1) return { terminals: [ROW_ANTES], total: 60 }
        await pagina2
        return { terminals: [{ ...ROW_ANTES, id: 'pos-51', name: 'Caja Cafetería' }], total: 60 }
      },
    })
    await abrir(page)

    const row = page.getByTestId('device-menus-row-pos-1')
    await expect(row.getByRole('combobox')).toBeEnabled({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Siguiente' }).click()
    // La fila de la página 1 sigue a la vista mientras carga, pero ya no se edita.
    await expect(row.getByRole('combobox')).toBeDisabled()
    suelta()
    await expect(page.getByTestId('device-menus-row-pos-51')).toBeVisible()
    await expect(page.getByTestId('device-menus-row-pos-51').getByRole('combobox')).toBeEnabled()
  })
})
