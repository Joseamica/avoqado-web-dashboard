import { test, expect } from '@playwright/test'
import { readFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const fixturePath = process.env.DOCUMENT_REQUEST_FIXTURES
const api = process.env.DOCUMENT_REQUEST_API || 'http://127.0.0.1:4117'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api)) throw new Error('Live document QA requires a local disposable API')
const fixtures: { request: { id: string; provider: string; entityType: string }; uploadUrl: string }[] = fixturePath
  ? JSON.parse(readFileSync(fixturePath, 'utf8'))
  : []
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n')
test.use({ viewport: { width: 390, height: 844 }, locale: 'es-MX', isMobile: true, hasTouch: true })

test('live QA fixtures are explicitly provided', () => {
  test.skip(!fixturePath, 'Set DOCUMENT_REQUEST_FIXTURES for local API+disposable DB QA')
  expect(fixtures).toHaveLength(4)
})
for (const fixture of fixtures) {
  test(`live mobile ${fixture.request.provider} ${fixture.request.entityType}`, async ({ page, request }) => {
    const link = new URL(fixture.uploadUrl)
    const token = new URLSearchParams(link.hash.slice(1)).get('token')!
    const endpoint = `${api}/api/v1/public/document-requests/${fixture.request.id}`
    const headers = { 'X-Document-Token': token }
    const snapshot = await request.get(endpoint, { headers })
    expect(snapshot.status()).toBe(200)
    const data = await snapshot.json()
    expect(data.status).toBe('DRAFT')
    const artifacts = path.resolve('../artifacts')
    mkdirSync(artifacts, { recursive: true })
    const unwanted: string[] = []
    page.on('request', req => {
      if (/posthog|google-analytics|googletagmanager|bzrcdn|sentry|\/auth\/|socket\.io/i.test(req.url())) unwanted.push(req.url())
    })
    await page.goto(`${link.pathname}${link.hash}`)
    if (data.status !== 'SUBMITTED') {
      await expect(page.getByRole('heading', { name: 'Tu próxima venta empieza aquí.' })).toBeVisible()
      for (const requirement of data.requirements as { key: string; label: string; required: boolean }[]) {
        if (!requirement.required || data.documents.some((document: { key: string }) => document.key === requirement.key)) continue
        if (
          fixture.request.provider === 'ANGELPAY' &&
          fixture.request.entityType === 'PERSONA_FISICA' &&
          requirement.key === data.requirements[0].key
        ) {
          const failure = await request.post(`${api}/__qa/fail-next-storage`)
          expect(failure.status()).toBe(200)
          await page
            .getByLabel(`Agregar archivo: ${requirement.label}`, { exact: true })
            .setInputFiles({ name: 'uncertain.pdf', mimeType: 'application/pdf', buffer: pdf })
          const section = page.locator(`[data-tour="documents-${requirement.key}"]`)
          await expect(section.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible()
          await page.reload()
          await expect(section.getByText('uncertain.pdf', { exact: true })).toBeVisible()
          await expect(
            section.getByText('Esta carga quedó sin confirmar. Quítala y vuelve a elegir el archivo para continuar.'),
          ).toBeVisible()
          await expect(section.getByRole('button', { name: 'Reintentar', exact: true })).toHaveCount(0)
          await expect(page.getByRole('button', { name: 'Enviar documentos', exact: true })).toBeDisabled()
          await page.screenshot({ path: path.join(artifacts, 'public-documents-restored-pending.png'), fullPage: true })
          await section.getByRole('button', { name: 'Quitar', exact: true }).click()
          await expect(page.getByText('uncertain.pdf', { exact: true })).toHaveCount(0)
          await expect(page.getByLabel(`Agregar archivo: ${requirement.label}`, { exact: true })).toBeEnabled()
        }
        await page
          .getByLabel(`Agregar archivo: ${requirement.label}`, { exact: true })
          .setInputFiles({ name: `${requirement.key}.pdf`, mimeType: 'application/pdf', buffer: pdf })
        await expect(page.getByText(`${requirement.key}.pdf`, { exact: true })).toBeVisible()
        await expect(page.locator(`[data-tour="documents-${requirement.key}"]`).getByText('Guardado', { exact: true })).toBeVisible()
        await expect(page.getByLabel(`Agregar archivo: ${requirement.label}`, { exact: true })).toBeEnabled()
      }
      const saved = await request.get(endpoint, { headers })
      const confirmed = await saved.json()
      expect(confirmed.documents.length).toBeGreaterThanOrEqual(
        data.requirements.filter((requirement: { required: boolean }) => requirement.required).length,
      )
      await page.reload()
      for (const document of confirmed.documents) await expect(page.getByText(document.fileName, { exact: true })).toBeVisible()
      await page.getByLabel('Nombre del negocio', { exact: true }).fill('Negocio de prueba local')
      await page.getByLabel('Tu nombre', { exact: true }).fill('Ana Prueba')
      await page.getByLabel('Correo electrónico', { exact: true }).fill('qa@example.invalid')
      await page.getByLabel('Celular (10 dígitos)', { exact: true }).fill('55 1234 5678')
      await page.getByRole('checkbox').check()
      await page.screenshot({
        path: path.join(artifacts, `public-documents-${fixture.request.provider}-${fixture.request.entityType}.png`),
        fullPage: true,
      })
      await expect(page.getByRole('button', { name: 'Enviar documentos', exact: true })).toBeEnabled()
      await page.getByRole('button', { name: 'Enviar documentos', exact: true }).click()
    }
    await expect(page.getByRole('heading', { name: 'Recibimos tus documentos' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Recibimos tus documentos' })).toBeVisible()
    await expect(page.getByRole('textbox')).toHaveCount(0)
    const submitted = await request.get(endpoint, { headers })
    const receipt = await submitted.json()
    expect(receipt.status).toBe('SUBMITTED')
    expect(receipt.documents).toEqual([])
    expect(receipt.requirements).toEqual([])
    expect(receipt.email).toBeUndefined()
    expect(unwanted).toEqual([])
  })
}
