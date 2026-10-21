import { test, expect } from '@playwright/test'

test('summary explains terms and preserves visible plan/status when collapsed', async ({ page }) => {
  await page.goto('/presentacion/avoqado-resumen.html')
  await page.getByRole('button', { name: 'POS: ver explicación', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('órdenes')
  await page.screenshot({ path: test.info().outputPath('summary-description.png') })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'POS: ver explicación', exact: true })).toBeFocused()
  const inventory = page.locator('.avq-feature').filter({ has: page.locator('summary', { hasText: /^Inventario/ }) })
  await inventory.locator('summary').click()
  await expect(inventory).toContainText('PEPS')
  await expect(page.locator('.avq-feature summary').filter({ hasText: 'Pedidos en línea' })).toContainText('Ya disponible')
  await expect(page.locator('.avq-feature summary').filter({ hasText: 'Delivery' })).toContainText('Premium')
  await expect(page.locator('.avq-feature summary').filter({ hasText: /^POS/ })).toContainText('Funciones Pro')
  await expect(page.locator('.avq-feature summary').filter({ hasText: /^Inventario/ })).toContainText('Incluye un piloto')
  await expect(page.getByRole('link', { name: 'Descargar PDF', exact: true })).toHaveAttribute('href', 'avoqado-resumen.pdf')
})

test('deck index, equipment links and image viewer work with keyboard and restore focus', async ({ page }) => {
  await page.goto('/presentacion/avoqado-plataforma.html')
  await page.locator('.avq-index > summary').click()
  await page.getByRole('link', { name: 'Inventario que se cuida solo.', exact: true }).click()
  await expect(page).toHaveURL(/#seccion-7$/)
  const hardware = page.locator('#hw-d3-una')
  const zoom = hardware.getByRole('button', { name: /Ampliar/ })
  await zoom.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Sunmi D3 una pantalla')
  await expect(dialog).toContainText('15.6')
  await expect(dialog.locator('img')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('equipment-detail.png') })
  await page.keyboard.press('Escape')
  await expect(zoom).toBeFocused()
  await expect(page.locator('a[href="#hw-pax"]').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Descargar PDF', exact: true })).toHaveAttribute('href', 'avoqado-plataforma.pdf')
})

test('formula labels retain compact proportions inside generous touch targets', async ({ page }) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    for (const name of ['resumen', 'plataforma']) {
      await page.goto(`/presentacion/avoqado-${name}.html`)
      const terms = await page.locator('.formula .avq-term').evaluateAll(buttons => buttons.map(button => {
        const target = button.getBoundingClientRect()
        const label = (button.querySelector('.c, .fc') ?? button).getBoundingClientRect()
        return { text: button.textContent?.trim(), width: target.width, height: target.height, labelHeight: label.height }
      }))
      expect(terms).toHaveLength(11)
      for (const term of terms) {
        expect(term.labelHeight, `${name} ${width}px ${term.text}: visible label`).toBeLessThanOrEqual(width <= 640 ? 44 : 34)
        expect(term.width, `${term.text}: touch width`).toBeGreaterThanOrEqual(44)
        expect(term.height, `${term.text}: touch height`).toBeGreaterThanOrEqual(44)
      }
      await page.getByRole('button', { name: 'CRM: ver explicación', exact: true }).click()
      await expect(page.getByRole('dialog')).toContainText('puntos, referidos')
      await page.keyboard.press('Escape')
    }
  }
})

test('mobile formula fills aligned rows below the logo with readable labels', async ({ page }) => {
  for (const width of [320, 390, 509, 640]) {
    await page.setViewportSize({ width, height: 844 })
    for (const name of ['resumen', 'plataforma']) {
      await page.goto(`/presentacion/avoqado-${name}.html`)
      const formula = page.locator('.formula').first()
      const labels = await formula.locator('.avq-term').evaluateAll(buttons => buttons.map(button => {
        const label = button.firstElementChild!
        const box = label.getBoundingClientRect()
        return {
          width: box.width, height: box.height, fontSize: parseFloat(getComputedStyle(label).fontSize),
          clipped: label.scrollWidth > label.clientWidth,
        }
      }))
      expect(labels).toHaveLength(11)
      for (const label of labels) {
        expect(label.width).toBeCloseTo(labels[0].width, 0)
        expect(label.height).toBeGreaterThanOrEqual(44)
        expect(label.fontSize).toBeGreaterThanOrEqual(14)
        expect(label.clipped).toBe(false)
      }
      await expect(formula.locator(':scope > .p:visible, :scope > .fp:visible')).toHaveCount(0)
      if (name === 'resumen') {
        const logo = await page.locator('.top:visible > img').boundingBox()
        const header = await page.locator('.top:visible').boundingBox()
        const row = await formula.boundingBox()
        expect(row!.y).toBeGreaterThanOrEqual(logo!.y + logo!.height + 12)
        expect(row!.width).toBeCloseTo(header!.width, 0)
      }
      await page.getByRole('button', { name: 'ERP: ver explicación', exact: true }).click()
      await expect(page.getByRole('dialog')).toContainText('PEPS')
      await page.keyboard.press('Escape')
    }
  }
})

test('both pages reflow at 320 and 390 pixels and keep the PDF available', async ({ page }) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    for (const name of ['resumen', 'plataforma']) {
      await page.goto(`/presentacion/avoqado-${name}.html`)
      await expect(page.getByRole('link', { name: 'Descargar PDF', exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const title = page.locator('h1').first()
      expect(await title.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(28)
      if (width === 390 && name === 'resumen') await page.screenshot({ path: test.info().outputPath('summary-mobile.png') })
    }
  }
})

test('missing expanded image has an honest error and can be retried', async ({ page }) => {
  await page.goto('/presentacion/avoqado-plataforma.html')
  const zoom = page.locator('#hw-d3-una').getByRole('button', { name: /Ampliar/ })
  await page.route('**/assets/eq-d3-una.jpg', route => route.abort())
  await zoom.click()
  await expect(page.getByRole('dialog')).toContainText('No pudimos cargar la imagen')
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.unroute('**/assets/eq-d3-una.jpg')
  await zoom.click()
  await expect(page.getByRole('dialog').locator('img')).toBeVisible()
})

test('slow equipment image shows loading and becomes visible when it arrives', async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/assets/eq-d3-una.jpg', async route => {
    await pending
    await route.continue()
  })
  await page.goto('/presentacion/avoqado-plataforma.html', { waitUntil: 'domcontentloaded' })
  await page.locator('#hw-d3-una').getByRole('button', { name: /Ampliar/ }).click()
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Cargando imagen…')
  release()
  await expect(page.getByRole('dialog').locator('img')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('status')).toBeHidden()
})

test('without JavaScript content and native index remain readable', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto('/presentacion/avoqado-resumen.html')
  await expect(page.locator('.chips')).toContainText('Inventario')
  await expect(page.locator('.chips')).toContainText('PEPS')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.goto('/presentacion/avoqado-plataforma.html')
  await page.locator('.avq-index > summary').click()
  await page.getByRole('link', { name: 'Inventario que se cuida solo.', exact: true }).click()
  await expect(page).toHaveURL(/#seccion-7$/)
  const destination = page.getByRole('heading', { name: 'Inventario que se cuida solo.', exact: true })
  await expect(destination).toBeInViewport()
  const geometry = await destination.evaluate(el => ({
    top: el.getBoundingClientRect().top,
    toolbarBottom: document.querySelector('.avq-toolbar')!.getBoundingClientRect().bottom,
  }))
  expect(geometry.top).toBeGreaterThanOrEqual(Math.max(0, geometry.toolbarBottom))
  await page.screenshot({ path: test.info().outputPath('no-js-navigation.png') })
  await context.close()
})

test('print preserves the original sheet and hides added controls', async ({ page }) => {
  await page.goto('/presentacion/avoqado-resumen.html')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.avq-toolbar')).toBeHidden()
  await expect(page.locator('.avq-feature').first()).toBeHidden()
  await expect(page.locator('.chips')).toBeVisible()
  expect(await page.locator('.page').evaluate(el => Math.round(el.getBoundingClientRect().height))).toBe(1056)
  await page.goto('/presentacion/avoqado-plataforma.html')
  expect(await page.locator('.slide').first().evaluate(el => Math.round(el.getBoundingClientRect().height))).toBe(720)
  await expect(page.locator('.avq-toolbar')).toBeHidden()
})

test('loaded descriptions keep working offline and PDF download works when online', async ({ page, context }) => {
  await page.goto('/presentacion/avoqado-resumen.html')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Descargar PDF', exact: true }).click(),
  ])
  expect(download.suggestedFilename()).toBe('avoqado-resumen.pdf')
  expect(await download.failure()).toBeNull()
  await context.setOffline(true)
  await page.getByRole('button', { name: 'CFDI: ver explicación', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('facturación SAT nativa')
  await page.keyboard.press('Escape')
  await context.setOffline(false)
})
