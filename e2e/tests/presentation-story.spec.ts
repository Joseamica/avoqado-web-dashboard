import { test, expect } from '@playwright/test'

test('products and equipment change real visuals and specifications with keyboard', async ({ page }) => {
  await page.goto('/presentacion/avoqado-resumen.html')
  await page.getByRole('button', { name: 'Dashboard Web', exact: true }).click()
  await expect(page.locator('.avq-product-view h3')).toHaveText('Dashboard Web')
  await expect(page.locator('.avq-product-view .avq-demo')).toHaveAttribute('data-demo', 'dashboard')
  await page.getByRole('button', { name: 'Widget de Reservas', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.avq-product-view h3')).toHaveText('Widget de Reservas')
  await expect(page.locator('.avq-product-view .avq-demo')).toHaveAttribute('data-demo', 'reservas')
  await page.getByLabel('Elige tu equipo').selectOption('hw-cpad-11')
  await expect(page.locator('.avq-equipment-view h3')).toHaveText('Sunmi CPad 11"')
  await expect(page.locator('.avq-equipment-view')).toContainText('526 g')
  await expect(page.locator('.avq-equipment-view img')).toHaveAttribute('src', 'assets/eq-cpad-11.jpg')
})

test('rapid selection cannot replace the current product with an older image', async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/assets/eq-d3-una.jpg', async route => { await pending; await route.continue() })
  await page.goto('/presentacion/avoqado-plataforma.html', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'POS Android', exact: true }).click()
  await expect(page.locator('.avq-product-view [role="status"]')).toBeVisible()
  await page.getByRole('button', { name: 'Widget de Reservas', exact: true }).click()
  release()
  await expect(page.locator('.avq-product-view h3')).toHaveText('Widget de Reservas')
  await expect(page.locator('.avq-product-view .avq-demo')).toHaveAttribute('data-demo', 'reservas')
  await expect(page.locator('.avq-product-view img')).toHaveCount(0)
  await expect(page.locator('.avq-product-view .avq-story-loading')).toHaveCount(0)
})

test('failed image keeps the selected description readable and can be retried', async ({ page }) => {
  await page.route('**/assets/eq-d3-una.jpg', route => route.abort())
  await page.goto('/presentacion/avoqado-resumen.html')
  await page.getByRole('button', { name: 'POS Android', exact: true }).click()
  await expect(page.locator('.avq-product-view')).toContainText('No pudimos cargar la imagen')
  await expect(page.locator('.avq-product-view h3')).toHaveText('POS Android')
  await expect(page.locator('.avq-product-view ul li').first()).toBeVisible()
  await page.unroute('**/assets/eq-d3-una.jpg')
  await page.getByRole('button', { name: 'POS Android', exact: true }).click()
  await expect(page.locator('.avq-product-view img')).toBeVisible()
})

test('the current equipment image can be retried without choosing another model', async ({ page }) => {
  await page.route('**/assets/eq-cpad-11.jpg', route => route.abort())
  await page.goto('/presentacion/avoqado-resumen.html')
  const equipment = page.getByLabel('Elige tu equipo')
  await equipment.selectOption('hw-cpad-11')
  await expect(page.locator('.avq-equipment-view')).toContainText('No pudimos cargar la imagen')
  await expect(page.locator('.avq-equipment-view')).toContainText('526 g')
  await page.unroute('**/assets/eq-cpad-11.jpg')
  await page.locator('.avq-equipment-view').getByRole('button', { name: 'Reintentar imagen', exact: true }).click()
  await expect(page.locator('.avq-equipment-view img')).toBeVisible()
  await expect(equipment).toHaveValue('hw-cpad-11')
  await expect(equipment).toBeFocused()
})

test('hero deals six products and selecting a card prepares its matching product', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const name of ['resumen', 'plataforma']) {
    await page.goto(`/presentacion/avoqado-${name}.html`)
    const cards = page.locator('.avq-product-card')
    await expect(cards).toHaveCount(6)
    await expect(page.locator('.avq-connections')).toHaveCount(0)
    for (const id of ['dashboard', 'reservas', 'tpv', 'pos', 'pedidos', 'checkout']) {
      const card = page.locator(`.avq-product-card[data-card-product="${id}"]`)
      const trigger = page.locator(`[data-hero-product="${id}"]`)
      await trigger.focus()
      await page.keyboard.press('Enter')
      await expect(trigger).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator(`.avq-product-controls [data-product="${id}"]`)).toHaveAttribute('aria-pressed', 'true')
      await expect(card.locator('.avq-card-image, .avq-mini')).toBeVisible()
    }
    await page.locator('.avq-product-card[data-card-product="reservas"]').scrollIntoViewIfNeeded()
    const visiblePhoto = await page.locator('.avq-product-card[data-card-product="reservas"]').evaluate(img => {
      const box = img.getBoundingClientRect()
      for (let row = 1; row < 10; row++) for (let col = 1; col < 10; col++) {
        const point = { x: box.x + box.width * col / 10, y: box.y + box.height * row / 10 }
        if (img.contains(document.elementFromPoint(point.x, point.y))) return point
      }
      return null
    })
    expect(visiblePhoto).not.toBeNull()
    await page.mouse.click(visiblePhoto!.x, visiblePhoto!.y)
    await expect(page.locator('[data-hero-product="reservas"]')).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('link', { name: 'Explorar Avoqado', exact: true }).click()
    await expect(page.locator('.avq-product-view h3')).toHaveText('Widget de Reservas')
  }
})

test('every hero card explains a failed download and retries the same image', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  for (const name of ['resumen', 'plataforma']) {
    for (const [id, image] of [['pos', 'eq-d3-doble-15.jpg'], ['tpv', 'eq-pax-a910s.jpg']]) {
      await page.route(`**/assets/${image}`, route => route.abort())
      await page.goto(`/presentacion/avoqado-${name}.html`)
      const card = page.locator(`.avq-product-card[data-card-product="${id}"]`)
      const trigger = page.locator(`[data-hero-product="${id}"]`)
      await trigger.click()
      await expect(card).toContainText('No pudimos cargar la imagen')
      await expect.poll(() => card.evaluate(el => {
        const cardBox = el.getBoundingClientRect()
        const retryBox = el.querySelector('.avq-story-retry')!.getBoundingClientRect()
        return retryBox.bottom <= cardBox.bottom
      })).toBe(true)
      await page.unroute(`**/assets/${image}`)
      await card.getByRole('button', { name: 'Reintentar imagen', exact: true }).click()
      await expect(card.locator('img')).toBeVisible()
      await expect(trigger).toBeFocused()
    }
  }
})

test('reduced motion and narrow viewports preserve all interactions', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [320, 390, 509, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    for (const name of ['resumen', 'plataforma']) {
      await page.goto(`/presentacion/avoqado-${name}.html`)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expect(page.locator('.avq-story-hero')).toBeVisible()
      for (const card of await page.locator('.avq-product-card').all()) {
        const visual = card.locator('.avq-card-image, .avq-mini')
        await expect(visual).toBeVisible()
        expect((await visual.boundingBox())!.height).toBeGreaterThan(60)
        const trigger = page.locator(`[data-hero-product="${await card.getAttribute('data-card-product')}"]`)
        await trigger.click()
        await expect(trigger).toHaveAttribute('aria-pressed', 'true')
      }
      expect(await page.locator('.avq-story').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0)
      const control = page.getByRole('button', { name: 'TPV', exact: true })
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      await control.click()
      await expect(page.locator('.avq-product-view h3')).toHaveText('TPV')
    }
  }
  await context.setOffline(true)
  await page.getByRole('button', { name: 'POS Android', exact: true }).click()
  await expect(page.locator('.avq-product-view h3')).toHaveText('POS Android')
  await page.getByLabel('Elige tu equipo').selectOption('hw-cpad-11')
  await expect(page.locator('.avq-equipment-view')).toContainText('526 g')
  await context.setOffline(false)
})

test('story script failing leaves the original public presentation readable', async ({ page }) => {
  await page.route('**/presentation-story.js', route => route.abort())
  await page.goto('/presentacion/avoqado-resumen.html')
  await expect(page.locator('.page .hero')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Descargar PDF', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'ERP: ver explicación', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('PEPS')
})
