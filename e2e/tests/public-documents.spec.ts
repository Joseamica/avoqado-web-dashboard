import { test, expect, type Page } from '@playwright/test'

const id = 'cm123456789012345678901234'
const token = 'a'.repeat(64)
const endpoint = `**/api/v1/public/document-requests/${id}`
const document = { id: 'cm123456789012345678901235', key: 'address', fileName: 'domicilio.pdf', mimeType: 'application/pdf', sizeBytes: 12 }
const fixture = {
  id,
  provider: 'ANGELPAY',
  entityType: 'PERSONA_FISICA',
  status: 'DRAFT',
  expiresAt: '2026-10-31T00:00:00Z',
  requirements: [{ key: 'address', label: 'Comprobante de domicilio', description: 'Reciente y legible', required: true, maxFiles: 2 }],
  documents: [] as (typeof document)[],
  limits: { maxFileBytes: 8388608, maxTotalBytes: 67108864, maxFiles: 24, maxUploadAttempts: 40 },
}
const forbidden = /posthog|google-analytics|googletagmanager|bzrcdn|oaiq|sentry|\/auth\/status|\/socket\.io/i

async function intercept(page: Page) {
  const state = structuredClone(fixture)
  const requests: string[] = []
  const uploads: string[] = []
  const submissions: unknown[] = []
  page.on('request', request => requests.push(request.url()))
  await page.route('**/api/v1/**', route => route.fulfill({ status: 404, json: {} }))
  await page.route(`${endpoint}/submit`, async route => {
    submissions.push(route.request().postDataJSON())
    state.status = 'SUBMITTED'
    await route.fulfill({ json: { id, status: 'SUBMITTED' } })
  })
  await page.route(`${endpoint}/documents/address`, async route => {
    uploads.push(route.request().headers()['content-type'])
    state.documents = [document]
    if (uploads.length === 1) await route.abort('failed')
    else await route.fulfill({ json: { document } })
  })
  await page.route(endpoint, async route => {
    expect(route.request().headers()['x-document-token']).toBe(token)
    expect(route.request().headers()['cookie']).toBeUndefined()
    expect(route.request().url()).not.toContain(token)
    await route.fulfill({ json: state })
  })
  return { state, requests, uploads, submissions }
}

test.use({ viewport: { width: 390, height: 844 }, locale: 'es-MX', isMobile: true, hasTouch: true })

test('mobile link: lost upload response, retry, reload, submit, no login/telemetry', async ({ page }) => {
  const { state, requests, uploads, submissions } = await intercept(page)
  await page.goto(`/documentos/${id}#token=${token}`)
  await expect(page.getByRole('heading', { name: 'Tu próxima venta empieza aquí.' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/documentos/${id}$`))
  await page
    .getByLabel('Agregar archivo: Comprobante de domicilio')
    .setInputFiles({ name: 'domicilio.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nEOF') })
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click()
  await expect(page.getByText('Guardado', { exact: true })).toBeVisible()
  expect(uploads).toHaveLength(2)
  expect(uploads.every(value => value.startsWith('multipart/form-data; boundary='))).toBe(true)
  await expect(page.getByText('domicilio.pdf', { exact: true })).toHaveCount(1)
  await page.reload()
  await expect(page.getByText('domicilio.pdf')).toBeVisible()
  await page.getByLabel('Nombre del negocio', { exact: true }).fill('Mi negocio')
  await page.getByLabel('Tu nombre', { exact: true }).fill('Ana Pérez')
  await page.getByLabel('Correo electrónico', { exact: true }).fill('ana@example.com')
  await page.getByLabel('Celular (10 dígitos)', { exact: true }).fill('55 1234 5678')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Enviar documentos', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Recibimos tus documentos' })).toBeVisible()
  expect(submissions).toHaveLength(1)
  expect(submissions[0]).toMatchObject({ phone: '5512345678', privacyAccepted: true })
  state.documents = []
  state.requirements = []
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Recibimos tus documentos' })).toBeVisible()
  expect(requests.filter(url => forbidden.test(url))).toEqual([])
  expect(await page.locator('meta[name="referrer"]').getAttribute('content')).toBe('no-referrer')
  expect(await page.locator('meta[name="robots"]').getAttribute('content')).toContain('noindex')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('missing, expired, revoked links stay public and actionable', async ({ page }) => {
  const { requests } = await intercept(page)
  await page.goto(`/documentos/${id}`)
  await expect(page.getByRole('heading', { name: 'Abre la liga completa de WhatsApp' })).toBeVisible()
  for (const status of [404, 410]) {
    await page.route(endpoint, route => route.fulfill({ status, json: {} }))
    await page.goto(`/documentos/${id}#token=${token}`)
    await expect(page.getByText('Pide una nueva liga a quien te la envió.')).toBeVisible()
    expect(page.url()).not.toContain('/login')
  }
  expect(requests.filter(url => forbidden.test(url))).toEqual([])
})

test('offline keeps contact entries and disables sending until reconnection', async ({ page, context }) => {
  await intercept(page)
  await page.goto(`/documentos/${id}#token=${token}`)
  await page.getByLabel('Nombre del negocio', { exact: true }).fill('Mi negocio')
  await context.setOffline(true)
  await expect(page.getByText(/Sin conexión/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enviar documentos', exact: true })).toBeDisabled()
  await expect(page.getByLabel('Nombre del negocio', { exact: true })).toHaveValue('Mi negocio')
  await context.setOffline(false)
  await expect(page.getByText(/Sin conexión/)).not.toBeVisible()
})

test('history navigation from another route reloads a clean document entry without analytics', async ({ page }) => {
  const { requests } = await intercept(page)
  // Empty local page loads the same early guard while representing an existing SPA session.
  await page.route('**/privacy-test', route =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><head><script src="/document-privacy.js"></script></head><body>Fixture</body></html>',
    }),
  )
  await page.goto('/privacy-test')
  await page.evaluate(({ id, token }) => history.pushState({}, '', `/documentos/${id}#token=${token}`), { id, token })
  await expect(page.getByRole('heading', { name: 'Tu próxima venta empieza aquí.' })).toBeVisible()
  expect(requests.filter(url => forbidden.test(url))).toEqual([])
})

test('English and dark theme remain readable on mobile', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US', colorScheme: 'dark', viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const { requests } = await intercept(page)
  await page.goto(`/documentos/${id}#token=${token}`)
  await expect(page.getByRole('heading', { name: 'Your next sale starts here.' })).toBeVisible()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByLabel('Business name', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(requests.filter(url => forbidden.test(url))).toEqual([])
  await page.screenshot({ path: '../artifacts/public-documents-en-dark.png', fullPage: true })
  await context.close()
})
