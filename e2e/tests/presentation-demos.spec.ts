import { test, expect } from '@playwright/test'

test('six main products have HTML previews and clearly illustrative interactions without requests', async ({ page }) => {
  for (const name of ['resumen', 'plataforma']) {
    await page.goto(`/presentacion/avoqado-${name}.html`)
    await expect(page.locator('.avq-product-card')).toHaveCount(6)
    const operations: string[] = []
    page.on('request', request => { if (request.url().includes('/api/') || request.method() === 'POST') operations.push(request.url()) })
    const demo = page.locator('.avq-product-view .avq-demo')
    for (const id of ['dashboard', 'reservas', 'pedidos', 'checkout']) {
      const card = page.locator(`[data-card-product="${id}"]`)
      await expect(card.locator('img')).toHaveCount(0)
      await expect(card.locator('.avq-mini')).toBeVisible()
      await page.locator(`[data-hero-product="${id}"]`).click()
      await expect(demo).toHaveAttribute('data-demo', id)
      await expect(demo).toContainText('Ejemplo interactivo')
    }
    await page.locator('[data-product="dashboard"]').click()
    await demo.getByRole('button', { name: 'Inventario', exact: true }).click()
    await expect(demo.locator('[data-demo-output]')).toContainText('Existencias')
    await page.locator('[data-product="reservas"]').click()
    await demo.getByRole('button', { name: '11:30', exact: true }).click()
    await expect(demo.locator('[data-demo-output]')).toContainText('11:30')
    await expect(demo).toContainText('No se crea una reserva')
    await page.locator('[data-product="pedidos"]').click()
    await demo.getByRole('button', { name: 'Añadir café', exact: true }).click()
    await demo.getByRole('button', { name: 'Añadir café', exact: true }).click()
    await expect(demo.locator('[data-demo-output]')).toContainText('2 artículos')
    await demo.getByRole('button', { name: 'Vaciar ejemplo', exact: true }).click()
    await expect(demo.locator('[data-demo-output]')).toContainText('Tu carrito está vacío')
    await page.locator('[data-product="checkout"]').click()
    for (const mode of ['Código QR', 'En tu web', 'Liga de pago']) {
      await demo.getByRole('button', { name: mode, exact: true }).click()
      await expect(demo.locator('[data-demo-output]')).toContainText(mode)
    }
    await expect(demo).toContainText('Monto fijo o abierto')
    await expect(demo).toContainText('Propina opcional')
    await expect(demo.locator('input')).toHaveCount(0)
    expect(operations).toEqual([])
  }
})

test('HTML demos keep keyboard focus, reset local examples and work offline', async ({ page, context }) => {
  await page.goto('/presentacion/avoqado-resumen.html')
  await context.setOffline(true)
  const demo = page.locator('.avq-product-view .avq-demo')
  await page.locator('[data-product="reservas"]').click()
  const time = demo.getByRole('button', { name: '12:00', exact: true })
  await time.focus()
  await page.keyboard.press('Enter')
  await expect(time).toBeFocused()
  await expect(time).toHaveAttribute('aria-pressed', 'true')
  await expect(demo.locator('[data-demo-output]')).toContainText('12:00')
  await page.locator('[data-product="pedidos"]').click()
  await demo.getByRole('button', { name: 'Añadir café', exact: true }).click()
  await page.locator('[data-product="checkout"]').click()
  await page.locator('[data-product="pedidos"]').click()
  await expect(demo.locator('[data-demo-output]')).toContainText('Tu carrito está vacío')
  await context.setOffline(false)
})

test('each HTML example stays within the viewport and has usable controls at every shipped width', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [320, 390, 509, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    for (const name of ['resumen', 'plataforma']) {
      await page.goto(`/presentacion/avoqado-${name}.html`, { waitUntil: 'domcontentloaded' })
      for (const id of ['dashboard', 'reservas', 'pedidos', 'checkout']) {
        await page.locator(`[data-product="${id}"]`).click()
        const demo = page.locator('.avq-product-view .avq-demo')
        await expect(demo).toHaveAttribute('data-demo', id)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        expect(await demo.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
        for (const button of await demo.getByRole('button').all()) {
          expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
        }
      }
    }
  }
})
