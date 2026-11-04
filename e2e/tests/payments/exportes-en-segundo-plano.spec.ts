import { expect, test, type Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { createMockVenue, StaffRole } from '../../fixtures/mock-data'

// El panel de TanStack Query (dev) tapa botones: se oculta.
const sinDevtools = (page: Page) => page.addStyleTag({ content: '.tsqd-parent-container{display:none!important}' })

async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'es')
  })
  // Una cajera: tiene payments:read y NO reports:read (el servidor lo cubre en T10; aquí, que la pantalla no lo pida).
  await setupApiMocks(page, {
    userRole: StaffRole.CASHIER,
    venues: [createMockVenue({ id: 'venue-alpha', slug: 'venue-alpha', permissions: ['payments:read'] })],
  })
}

test('cobros grandes: 202 ⇒ barra con avance, aviso de campanita y correo, y «Descargar» al terminar, sin recargar', async ({ page }) => {
  await setup(page)
  await page.route(/\/api\/v1\/dashboard\/venues\/venue-alpha\/payments\?/, r => r.fulfill({ json: { data: [], meta: { total: 0, totalPages: 0, page: 1 } } }))
  await page.route(/\/api\/v1\/dashboard\/venues\/venue-alpha\/exports\?kind=cobros/, r => r.fulfill({ json: { success: true, data: [] } }))
  let cuerpo: any
  await page.route('**/api/v1/dashboard/venues/venue-alpha/exports/cobros', r => {
    cuerpo = r.request().postDataJSON()
    return r.fulfill({ status: 202, json: { success: true, data: { runId: 'run1', status: 'QUEUED', format: 'xlsx' } } })
  })
  let consultas = 0
  await page.route('**/api/v1/dashboard/venues/venue-alpha/exports/run1/status', r =>
    r.fulfill({
      json: {
        success: true,
        data: ++consultas < 3
          ? { status: 'RUNNING', processedRows: 500, totalRows: 4224, format: 'xlsx', waitingForPayments: false }
          : { status: 'READY', processedRows: 4224, totalRows: 4224, format: 'xlsx', waitingForPayments: false },
      },
    }),
  )
  await page.goto('/venues/venue-alpha/payments')
  await sinDevtools(page)
  await page.locator('[data-tour="payments-export-btn"]').click()
  await page.getByText('Excel', { exact: true }).click()
  await page.locator('[data-tour="export-dialog-submit"]').click()
  await expect(page.getByText('Armando 500 de 4,224 filas…')).toBeVisible()
  await expect(page.getByText(/te avisamos en la campanita y por correo/)).toBeVisible()
  await expect(page.locator('[data-tour="export-dialog-submit"]')).toBeDisabled()
  await expect(page.locator('[data-tour="export-run-download"]')).toBeVisible({ timeout: 10_000 })
  expect(cuerpo).toMatchObject({ format: 'xlsx', filters: { startDate: expect.any(String), endDate: expect.any(String) } })
  expect(cuerpo.columns).toContain('createdAt')
})

test('enlace del correo: la página del pedido descarga SOLA el archivo listo, con su nombre', async ({ page }) => {
  await setup(page)
  await page.route('**/api/v1/dashboard/venues/venue-alpha/exports/run1/status', r =>
    r.fulfill({ json: { success: true, data: { status: 'READY', processedRows: 4224, totalRows: 4224, format: 'csv', waitingForPayments: false } } }),
  )
  await page.route('**/api/v1/dashboard/venues/venue-alpha/exports/run1/download', r =>
    r.fulfill({ json: { success: true, data: { url: '/__descarga-de-prueba/payments-2026-11-03.csv', fileName: 'payments-2026-11-03.csv' } } }),
  )
  await page.route('**/__descarga-de-prueba/**', r =>
    r.fulfill({ status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment' }, body: 'Fecha,ID\r\n' }),
  )
  const descarga = page.waitForEvent('download')
  await page.goto('/venues/venue-alpha/exports/run1')
  expect((await descarga).suggestedFilename()).toBe('payments-2026-11-03.csv')
})

test('429 del servidor: el diálogo muestra su mensaje (el cuerpo del error llega como Blob)', async ({ page }) => {
  await setup(page)
  await page.route(/\/api\/v1\/dashboard\/venues\/venue-alpha\/payments\?/, r => r.fulfill({ json: { data: [], meta: { total: 0, totalPages: 0, page: 1 } } }))
  await page.route(/\/api\/v1\/dashboard\/venues\/venue-alpha\/exports\?kind=cobros/, r => r.fulfill({ json: { success: true, data: [] } }))
  await page.route('**/api/v1/dashboard/venues/venue-alpha/exports/cobros', r =>
    r.fulfill({ status: 429, json: { success: false, message: 'Ya tienes 3 exportes en curso; espera a que termine uno' } }),
  )
  await page.goto('/venues/venue-alpha/payments')
  await sinDevtools(page)
  await page.locator('[data-tour="payments-export-btn"]').click()
  await page.locator('[data-tour="export-dialog-submit"]').click()
  await expect(page.getByText('Ya tienes 3 exportes en curso; espera a que termine uno')).toBeVisible()
})
