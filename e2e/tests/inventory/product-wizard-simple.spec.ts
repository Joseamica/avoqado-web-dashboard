/** Browser contracts only: all API calls use the existing isolated fixture layer. */
import { writeFile } from 'node:fs/promises'
import { test, expect, type Page, type Route, type TestInfo } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { createMockVenue, StaffRole } from '../../fixtures/mock-data'
import { setupProductTypeMocks } from '../../fixtures/class-session-mocks'

const PATH = '/venues/venue-alpha/menumaker/products'
const CATEGORY = { id: 'cat-products', name: 'Productos', displayOrder: 0, active: true }
const VENUE = createMockVenue({ id: 'venue-alpha', slug: 'venue-alpha', name: 'Tienda Alpha', type: 'RETAIL_STORE',
  permissions: ['menu:read', 'menu:create', 'menu:update', 'menu:delete', 'teams:read', 'settings:read', 'reports:read'] })
const SIZES = [[320, 568], [390, 844], [667, 375], [768, 1024], [1024, 600], [1280, 650], [1366, 650], [640, 360]] as const
const target = (page: Page, name: string) => page.locator(`[data-tour="product-wizard-${name}"]`)
const ok = (route: Route, data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
type Product = Record<string, unknown>
const product = (extra: Product): Product => ({ venueId: VENUE.id, description: null, sku: null, gtin: null, cost: null,
  type: 'REGULAR', active: true, imageUrl: null, categoryId: CATEGORY.id, category: CATEGORY, trackInventory: false,
  inventoryMethod: null, modifierGroups: [], menus: [], productGroupId: null, variantOptions: null,
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...extra })

async function setup(page: Page, options: { free?: boolean; theme?: string; recipe?: boolean } = {}) {
  const state = { products: options.recipe ? [product({ id: 'recipe-product', name: 'Latte', price: 55, type: 'FOOD_AND_BEV', trackInventory: true, inventoryMethod: 'RECIPE' })] : [] as Product[], bodies: [] as Record<string, any>[] }
  await page.addInitScript(({ theme }) => {
    localStorage.setItem('lang', 'es')
    localStorage.setItem('vite-ui-theme', theme)
    // Existing local screenshot harness uses this to prevent development tools covering the app.
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '.tsqd-parent-container { display: none !important; }'
      document.head.appendChild(style)
    })
  }, { theme: options.theme ?? 'light' })
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: {
    hasPlan: !options.free, state: options.free ? 'none' : 'active', planTier: options.free ? 'GRATIS' : 'PREMIUM', grandfathered: false,
  } })
  await setupProductTypeMocks(page, { includeClass: false, venueType: 'RETAIL_STORE' })
  const route = (suffix: RegExp) => (url: URL) => url.pathname.startsWith('/api/v1/dashboard/venues/') && suffix.test(url.pathname)
  await page.route(route(/\/menucategories$/), r => r.fulfill({ json: [CATEGORY] }))
  await page.route(route(/\/modifier-groups$/), r => r.fulfill({ json: [] }))
  await page.route(route(/\/inventory\/should-use-inventory$/), r => ok(r, { hasInventoryFeature: true, recommendation: 'wizard.step2.useInventoryDesc' }))
  await page.route(route(/\/products$/), r => ok(r, state.products))
  await page.route(route(/\/products\/recipe-product$/), r => ok(r, state.products[0]))
  await page.route(route(/\/wizard\/progress$/), r => ok(r, { inventoryMethod: options.recipe ? 'RECIPE' : null, details: {} }))
  await page.route(route(/\/recipe$/), r => ok(r, { portionYield: 2, prepTime: 5, cookTime: 3, notes: 'Servir caliente',
    lines: [{ id: 'line1', rawMaterialId: 'rm1', rawMaterial: { name: 'Café molido' }, quantity: '0.04', unit: 'KILOGRAM', isOptional: false }] }))
  await page.route(route(/\/raw-materials$/), r => ok(r, []))
  await page.route(route(/\/product-options$/), r => ok(r, { items: [], total: 0, page: 1, pageSize: 25 }))
  await page.route(route(/\/inventory\/wizard\/complete$/), r => {
    const body = r.request().postDataJSON()
    state.bodies.push(body)
    const created = product({ id: `created-${state.bodies.length}`, ...body.product, trackInventory: body.inventory.useInventory,
      inventoryMethod: body.inventory.inventoryMethod ?? null })
    state.products.push(created)
    return ok(r, { productId: created.id }, 201)
  })
  await page.goto(PATH)
  await expect(page.locator('[data-tour="product-new-btn"]')).toBeVisible({ timeout: 20_000 })
  return state
}

async function open(page: Page, type = 'regular') {
  await page.locator('[data-tour="product-new-btn"]').click()
  await page.locator(`[data-tour="product-type-${type}"]`).click()
  await page.locator('[data-tour="product-type-next"]').click()
  await expect(page.locator('input#name')).toBeVisible()
}
async function fillCore(page: Page, name = 'Vaso') {
  await page.locator('input#name').fill(name)
  await page.locator('input#price').fill('55')
  await target(page, 'category').locator('input').click()
  await page.getByRole('option', { name: CATEGORY.name, exact: true }).click()
}

/** Measures actual browser geometry and scroll reachability, retaining values after resize. */
async function captureSizes(page: Page, info: TestInfo, phase: string, values: Record<string, string>) {
  const measurements = []
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height })
    const dialog = page.getByRole('dialog')
    const scroll = dialog.locator('[data-fsm-content]')
    await scroll.evaluate(el => { el.scrollTop = 0 })
    const header = dialog.locator('header')
    await expect(header).toBeVisible()
    const boxes = await header.evaluate(el => {
      const box = (node: Element) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height } }
      return { header: box(el), title: box(el.querySelector('h2')!), buttons: [...el.querySelectorAll('button')].map(box) }
    })
    for (const button of boxes.buttons) {
      expect(button.x).toBeGreaterThanOrEqual(0)
      expect(button.right).toBeLessThanOrEqual(width + 1)
      expect(button.bottom).toBeLessThanOrEqual(height)
      expect(button.height).toBeGreaterThanOrEqual(44)
      expect(button.right <= boxes.title.x + 1 || button.x >= boxes.title.right - 1).toBe(true)
    }
    const overflow = await scroll.evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth }))
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1)
    for (const [selector, value] of Object.entries(values)) {
      const field = page.locator(selector)
      await expect(field).toHaveValue(value)
      await field.scrollIntoViewIfNeeded()
      const b = await field.boundingBox()
      expect(b).not.toBeNull()
      expect(b!.y).toBeGreaterThanOrEqual(boxes.header.bottom - 1)
      expect(b!.y + b!.height).toBeLessThanOrEqual(height + 1)
      expect(b!.x).toBeGreaterThanOrEqual(0)
      expect(b!.x + b!.width).toBeLessThanOrEqual(width + 1)
    }
    await page.screenshot({ path: info.outputPath(`${phase}-${width}x${height}.png`) })
    measurements.push({ width, height, ...boxes, overflow, values })
  }
  const path = info.outputPath(`${phase}-measurements.json`)
  await writeFile(path, JSON.stringify(measurements, null, 2))
  await info.attach(`${phase}-measurements.json`, { path, contentType: 'application/json' })
}

test('simple creation appears without reload; quantity preserves the exact payload', async ({ page }) => {
  const state = await setup(page)
  let reloads = 0
  page.on('framenavigated', f => { if (f === page.mainFrame()) reloads++ })
  await open(page)
  await fillCore(page)
  await target(page, 'finish').click()
  await expect(page.locator('input#name')).toBeHidden()
  await expect(page.getByRole('cell', { name: 'Vaso', exact: true })).toBeVisible()
  expect(state.bodies).toHaveLength(1)
  expect(state.bodies[0]).toEqual({ product: { name: 'Vaso', description: '', price: 55, categoryId: CATEGORY.id, modifierGroupIds: [], printStationId: null, satProductKey: null, satUnitKey: null, soldByWeight: false, type: 'REGULAR' }, inventory: { useInventory: false } })
  expect(reloads).toBe(0)
  await open(page)
  await fillCore(page, 'Vaso con inventario')
  await target(page, 'add-inventory').click()
  await page.locator('#initialStock').fill('0')
  await page.locator('#costPerUnit').fill('12.5')
  await page.locator('#reorderPoint').fill('4')
  await page.locator('#lowStockThreshold').fill('2')
  await target(page, 'finish').click()
  await expect(page.locator('input#name')).toBeHidden()
  expect(state.bodies[1]).toEqual({ product: { name: 'Vaso con inventario', description: '', price: 55, categoryId: CATEGORY.id, modifierGroupIds: [], printStationId: null, satProductKey: null, satUnitKey: null, soldByWeight: false, type: 'REGULAR' }, inventory: { useInventory: true, inventoryMethod: 'QUANTITY' }, simpleStock: { initialStock: 0, costPerUnit: 12.5, reorderPoint: 4, lowStockThreshold: 2, unit: 'UNIT' } })
  expect(reloads).toBe(0)
})

for (const [width, height] of [[320, 568], [1024, 600]]) {
  test(`missing category scrolls to its inline error and can be corrected at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const state = await setup(page)
    await open(page)
    await page.locator('input#name').fill('Libreta sin categoría')
    await page.locator('input#price').fill('149')
    await target(page, 'add-description').click()
    await page.locator('#description').fill('Conservar este texto')
    const scroll = page.getByRole('dialog').locator('[data-fsm-content]')
    const category = target(page, 'category')
    const error = category.getByRole('alert')
    for (let attempt = 0; attempt < 2; attempt++) {
      await scroll.evaluate(el => { el.scrollTop = el.scrollHeight })
      await target(page, 'finish').click()
      await expect(error).toHaveText('La categoría es requerida')
      await expect.poll(async () => {
        const field = await category.locator('input').boundingBox()
        const message = await error.boundingBox()
        return !!field && !!message && field.y >= 64 && message.y >= field.y + field.height && message.y + message.height <= height
      }).toBe(true)
    }
    expect(state.bodies).toHaveLength(0)
    await expect(page.locator('#description')).toHaveValue('Conservar este texto')
    await category.locator('input').click()
    await page.getByRole('option', { name: CATEGORY.name, exact: true }).click()
    await expect(error).toHaveCount(0)
    await target(page, 'finish').click()
    await expect(page.getByRole('cell', { name: 'Libreta sin categoría', exact: true })).toBeVisible()
    expect(state.bodies).toHaveLength(1)
  })
}

test('existing recipe opens with its saved values', async ({ page }) => {
  await setup(page, { recipe: true })
  await page.getByRole('cell', { name: 'Latte', exact: true }).click()
  await expect(page.locator('#portionYield')).toHaveValue('2')
  await page.getByRole('button', { name: 'Opciones avanzadas', exact: true }).click()
  await expect(page.locator('#prepTime')).toHaveValue('5')
  await expect(page.locator('#notes')).toHaveValue('Servir caliente')
  await expect(target(page, 'ingredients')).toContainText('Café molido')
  await expect(target(page, 'add-recipe')).toHaveCount(0)
})

test('plan denial stays visible and disabled', async ({ page }) => {
  await setup(page, { free: true })
  await open(page)
  await expect(target(page, 'add-variants')).toBeDisabled()
  await expect(target(page, 'add-variants')).toContainText('Pro')
  await expect(target(page, 'add-recipe')).toBeDisabled()
  await expect(target(page, 'add-recipe')).toContainText('Premium')
  await expect(page.locator('#portionYield')).toHaveCount(0)
})

test('cancel removal keeps values, confirm removes only that section', async ({ page }) => {
  await setup(page)
  await open(page)
  await fillCore(page)
  await target(page, 'add-description').click()
  await page.locator('#description').fill('Resistente')
  await target(page, 'add-codes').click()
  await page.locator('#sku').fill('VASO-55')
  await target(page, 'optional-description').getByRole('button', { name: 'Quitar sección', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.locator('#description')).toHaveValue('Resistente')
  await target(page, 'optional-description').getByRole('button', { name: 'Quitar sección', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Quitar', exact: true }).click()
  await expect(page.locator('#description')).toHaveCount(0)
  await expect(page.locator('#sku')).toHaveValue('VASO-55')
  await expect(page.locator('#name')).toHaveValue('Vaso')
  await target(page, 'add-description').click()
  await expect(page.locator('#description')).toHaveValue('')
})

for (const theme of ['light', 'dark']) {
  for (const phase of ['core', 'inventory', 'variants']) {
    test(`${theme}: ${phase} preserves captured values through all eight viewport sizes`, async ({ page }, info) => {
      test.setTimeout(120_000)
      await setup(page, { theme })
      if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
      else await expect(page.locator('html')).not.toHaveClass(/dark/)
      await open(page)
      await fillCore(page, phase === 'variants' ? 'Playera' : 'Vaso')
      const values: Record<string, string> = { '#name': phase === 'variants' ? 'Playera' : 'Vaso', '#price': '55' }
      if (phase === 'inventory') {
        await target(page, 'add-inventory').click()
        await page.locator('#initialStock').fill('20')
        await page.locator('#costPerUnit').fill('12.5')
        values['#initialStock'] = '20'
        values['#costPerUnit'] = '12.5'
      }
      if (phase === 'variants') {
        await target(page, 'add-variants').click()
        await page.locator('#producto-con-variantes').check()
        await page.getByLabel('Nombre de la opción', { exact: true }).fill('Talla')
        const input = page.getByLabel('Valores de la opción', { exact: true })
        for (const value of ['S', 'M', 'L']) { await input.fill(value); await input.press('Enter') }
        await page.getByLabel('Precio para todas las variantes', { exact: true }).fill('199')
        await page.getByRole('button', { name: 'Aplicar a todas', exact: true }).click()
        delete values['#price']
        for (const value of ['S', 'M', 'L']) values[`input[aria-label="Precio de Playera · ${value}"]`] = '199'
      }
      await captureSizes(page, info, phase, values)
    })
  }
}

for (const kind of ['product', 'recipe']) {
  test(`${kind} tour reaches completion with every targeted field mounted`, async ({ page }) => {
    await setup(page)
    await page.getByRole('button', { name: '¿Cómo crear un producto?' }).click()
    await page.getByRole('menuitem', { name: kind === 'product' ? /Producto simple/ : /Producto con receta/ }).click()
    const popover = page.locator('.driver-popover')
    await expect(popover).toBeVisible()
    const keys = kind === 'product'
      ? ['product-new-btn', 'product-type-regular', 'product-wizard-name', 'product-wizard-optional-description', 'product-wizard-price', 'product-wizard-sku', 'product-wizard-gtin', 'product-wizard-category', 'product-wizard-track-inventory', 'product-wizard-initial-stock', 'product-wizard-finish']
      : ['product-new-btn', 'product-type-food', 'product-wizard-name', 'product-wizard-price', 'product-wizard-sku', 'product-wizard-gtin', 'product-wizard-category', 'product-wizard-track-inventory', 'product-wizard-method-recipe', 'product-wizard-portion-yield', 'product-wizard-ingredients', 'product-wizard-add-ingredient', 'product-wizard-finish']
    // React can repaint className; driver links its exact active target to this popover through ARIA.
    await popover.locator('.driver-popover-next-btn').click()
    for (const [index, key] of keys.entries()) {
      const field = page.locator(`[data-tour="${key}"]${key === 'product-wizard-optional-description' ? ' textarea' : ''}`)
      await expect(field).toBeVisible()
      await expect(field).toHaveAttribute('aria-controls', 'driver-popover-content')
      await expect(field).toHaveAttribute('aria-expanded', 'true')
      await expect(popover.locator('.driver-popover-progress-text')).toHaveText(`Paso ${index + 2} de ${keys.length + 2}`)
      const title = await popover.locator('.driver-popover-title').textContent()
      await popover.locator('.driver-popover-next-btn').click()
      await expect(popover.locator('.driver-popover-title')).not.toHaveText(title ?? '')
    }
    await expect(popover.locator('.driver-popover-title')).toHaveText(kind === 'product' ? '🎉 ¡Felicidades!' : '🎉 ¡Listo!')
    await popover.locator('.driver-popover-next-btn').click()
    await expect(popover).toBeHidden()
    await expect(target(page, 'initial-stock')).toBeVisible({ visible: kind === 'product' })
    if (kind === 'recipe') await expect(target(page, 'ingredients')).toBeVisible()
  })
}

test('validation brings a later variant price below the header into view', async ({ page }) => {
  await setup(page)
  await open(page)
  await fillCore(page, 'Playera')
  await target(page, 'add-variants').click()
  await page.locator('#producto-con-variantes').check()
  await page.getByLabel('Nombre de la opción', { exact: true }).fill('Talla')
  const input = page.getByLabel('Valores de la opción', { exact: true })
  for (const value of ['S', 'M', 'L', 'XL', 'XXL', 'XXXL']) { await input.fill(value); await input.press('Enter') }
  await page.getByLabel('Precio para todas las variantes', { exact: true }).fill('199')
  await page.getByRole('button', { name: 'Aplicar a todas', exact: true }).click()
  const last = page.getByLabel('Precio de Playera · XXXL', { exact: true })
  await last.fill('')
  await page.setViewportSize({ width: 640, height: 360 })
  await page.getByRole('dialog').locator('[data-fsm-content]').evaluate(el => { el.scrollTop = 0 })
  const before = await last.boundingBox()
  expect(before!.y).toBeGreaterThan(360)
  await target(page, 'finish').click()
  await expect(last).toBeFocused()
  await expect.poll(async () => {
    const b = await last.boundingBox()
    return b!.y >= 64 && b!.y + b!.height <= 360
  }).toBe(true)
})
