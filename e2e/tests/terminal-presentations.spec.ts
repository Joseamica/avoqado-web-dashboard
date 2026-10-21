import { test, expect } from '@playwright/test'

const pages = ['terminal-avoqado-resumen', 'terminal-avoqado']

test('both terminal documents explore actual equipment, payment descriptions and illustrative accounts', async ({ page }) => {
  for (const name of pages) {
    const operations: string[] = []
    page.on('request', request => { if (request.url().includes('/api/') || request.method() !== 'GET') operations.push(request.url()) })
    await page.goto(`/presentacion/${name}.html`)
    const root = page.locator('.avq-terminal')
    await expect(root).toBeVisible()
    await expect(root.locator('.avq-terminal-photo')).toHaveCount(3)
    await root.getByRole('button', { name: 'PAX A910S', exact: true }).click()
    await expect(root.locator('[data-terminal-profile="pax"]')).toContainText('Bluetooth')
    await expect(root.locator('[data-terminal-id="pax"] img')).toHaveAttribute('src', 'assets/pax-terminal.png')
    await root.getByRole('button', { name: 'N62 · compacta', exact: true }).click()
    await expect(root.locator('[data-terminal-profile="n62"]')).toBeVisible()
    await expect(root.locator('[data-terminal-profile="n86"]')).toBeHidden()
    const zoom = root.locator('[data-terminal-id="n62"]').getByRole('button', { name: /Ampliar/ })
    await zoom.click()
    await expect(page.getByRole('dialog')).toContainText('N62')
    await expect(page.getByRole('dialog').getByRole('img')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(zoom).toBeFocused()
    await root.getByRole('button', { name: /Santander/ }).click()
    await expect(root.locator('[data-terminal-output]')).toContainText('Cuenta de ingresos')
    await expect(root).toContainText('Ejemplo interactivo')
    await expect(root).toContainText('No se envía dinero')
    await expect(root.locator('input')).toHaveCount(0)
    const contactless = page.locator('.avq-payment').filter({ has: page.getByText('Contactless', { exact: true }) })
    await contactless.locator('summary').click()
    await expect(contactless.locator('p')).toContainText('reloj')
    await expect(page.getByRole('link', { name: 'Descargar PDF', exact: true })).toHaveAttribute('href', `${name}.pdf`)
    const pdf = await page.request.get(`/presentacion/${name}.pdf`)
    expect(pdf.headers()['content-type']).toContain('application/pdf')
    expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF')
    expect(operations).toEqual([])
  }
})

test('terminal controls fit all widths, preserve keyboard focus and work offline after loading', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [320, 390, 509, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    for (const name of pages) {
      await page.goto(`/presentacion/${name}.html`)
      const root = page.locator('.avq-terminal')
      await expect(root).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      for (const button of await root.locator('[data-terminal-select], [data-terminal-account]').all()) {
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      }
      const device = root.getByRole('button', { name: 'N62 · compacta', exact: true })
      await device.focus()
      await page.keyboard.press('Enter')
      await expect(device).toHaveAttribute('aria-pressed', 'true')
      await expect(device).toBeFocused()
    }
  }
  await context.setOffline(true)
  const bank = page.locator('[data-terminal-account]').last()
  await bank.focus()
  await page.keyboard.press('Space')
  await expect(bank).toHaveAttribute('aria-pressed', 'true')
  await expect(bank).toBeFocused()
  await expect(page.locator('[data-terminal-output]')).toContainText('Inbursa')
  await context.setOffline(false)
})

test('terminal images recover in hero, source equipment and zoom without blocking selection', async ({ page }) => {
  for (const name of pages) {
    let fail = true
    await page.route('**/assets/nexgo86-avoqado.png', route => fail ? route.abort() : route.continue())
    await page.goto(`/presentacion/${name}.html`)
    const hero = page.locator('.avq-terminal-photo[data-terminal-id="n86"]')
    await expect(hero).toContainText('No pudimos cargar')
    await expect(hero.getByRole('button', { name: 'Reintentar imagen' })).toBeVisible()
    const source = page.locator('.devstage:has(img[src$="nexgo86-avoqado.png"]), .dev .im:has(img[src$="nexgo86-avoqado.png"])').first()
    await source.scrollIntoViewIfNeeded()
    await expect(source).toContainText('No pudimos cargar')
    fail = false
    await source.getByRole('button', { name: 'Reintentar imagen' }).click()
    await expect(source.getByRole('img')).toBeVisible()
    await hero.getByRole('button', { name: 'Reintentar imagen' }).click()
    await expect(hero.getByRole('img')).toBeVisible()
    fail = true
    await hero.getByRole('button', { name: /Ampliar/ }).click()
    await expect(page.getByRole('dialog')).toContainText('No pudimos cargar')
    await page.keyboard.press('Escape')
    fail = false
    await hero.getByRole('button', { name: /Ampliar/ }).click()
    await expect(page.getByRole('dialog').getByRole('img')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.unroute('**/assets/nexgo86-avoqado.png')
  }
})

test('terminal sources remain readable without enhancement and preserve print geometry', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 844 } })
  const page = await context.newPage()
  for (const name of pages) {
    await page.goto(`/presentacion/${name}.html`)
    await expect(page.locator('.avq-terminal')).toBeHidden()
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Descargar PDF' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.locator('body')).toContainText('0.8%')
    await expect(page.locator('body')).toContainText('2.2%')
    await expect(page.locator('body')).toContainText('Constancia de Situación Fiscal')
    await expect(page.locator('body')).toContainText('validación de identidad y expediente')
    await expect(page.locator('body')).not.toContainText('Misma tasa')
    await page.emulateMedia({ media: 'print' })
    const geometry = await page.locator(name.endsWith('resumen') ? '.page' : '.slide').first().boundingBox()
    expect(geometry!.width).toBeCloseTo(name.endsWith('resumen') ? 816 : 1279.97, 0)
    expect(geometry!.height).toBeCloseTo(name.endsWith('resumen') ? 1056 : 720, 0)
    await page.emulateMedia({ media: 'screen' })
  }
  await context.close()
})

test('every source photo can recover and every terminal index destination is visible', async ({ page }) => {
  for (const name of pages) {
    let fail = true
    const photos = /\/(eq-pax-a910s\.jpg|(pax-terminal|nexgo86-avoqado|nexgo62-avoqado|n86-cobrar|dashboard-demo|sunmi-t3pro-pantalla-pos)\.png)$/
    await page.route('**/assets/**', route => fail && photos.test(route.request().url()) ? route.abort() : route.continue())
    await page.goto(`/presentacion/${name}.html`)
    const pictures = page.locator('.avq-terminal-page main img')
    const count = await pictures.evaluateAll(images => images.filter(image => /\/(eq-pax-a910s\.jpg|(pax-terminal|nexgo86-avoqado|nexgo62-avoqado|n86-cobrar|dashboard-demo|sunmi-t3pro-pantalla-pos)\.png)$/.test((image as HTMLImageElement).src)).length)
    const retries = page.getByRole('button', { name: 'Reintentar imagen', exact: true })
    await expect(retries).toHaveCount(count)
    fail = false
    for (let remaining = count; remaining > 0; remaining--) {
      await retries.first().click()
      await expect(retries).toHaveCount(remaining - 1)
    }
    const index = page.locator('.avq-index')
    await index.locator('summary').click()
    const targets = await index.locator('a').evaluateAll(links => links.map(link => (link as HTMLAnchorElement).hash))
    for (const target of targets) await expect(page.locator(target)).toBeVisible()
    await page.unroute('**/assets/**')
  }
})
