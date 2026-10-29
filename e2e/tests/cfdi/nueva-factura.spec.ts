/**
 * E2E — «Nueva factura» desde Facturas (28-oct-2026). Las tres obligatorias del repo (testing-and-git.md):
 *   1. escribir y VER el resultado: facturar una venta desde «Nueva factura» pone la factura en la lista SIN recargar, aunque la lista
 *      tuviera un filtro puesto (Codex plan r1 #4); y al reabrir el buscador esa venta sale «Ya facturada»;
 *   2. el buscador va al servidor (con `conFactura=1` y sólo ventas cerradas) y conserva el foco;
 *   3. vacío ≠ sin resultados ≠ error del servidor.
 * Más: un Gerente (cfdi:issue + orders:read) ve el botón y un Mesero no; una venta con la cancelación de su factura en trámite se puede
 * elegir. Respuestas fingidas: prueban el navegador, no el servidor.
 */
import { expect, test, type Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { createMockVenue, StaffRole } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

const venueId = 'c111111111111111111111111'
const SLUG = 'factura-test'
const GERENTE = ['home:read', 'cfdi:view', 'cfdi:issue', 'orders:read']
const MESERO = ['home:read', 'orders:read']

interface Venta {
  id: string
  orderNumber: string
  total: number
  facturada: boolean
  facturaEnCancelacion: boolean
}

const ventaBase = (id: string, orderNumber: string, over: Partial<Venta> = {}): Venta & Record<string, unknown> => ({
  id,
  orderNumber,
  total: 232,
  facturada: false,
  facturaEnCancelacion: false,
  status: 'COMPLETED',
  paymentStatus: 'PAID',
  createdAt: '2026-10-27T18:00:00.000Z',
  completedAt: '2026-10-27T18:05:00.000Z',
  customerName: null,
  orderCustomers: [{ customer: { id: 'c444444444444444444444444', firstName: 'Ana', lastName: 'López', phone: null } }],
  ...over,
})

const facturaDe = (id: string, receptorNombre: string, receptorRfc: string, orderId: string | null) => ({
  id,
  type: 'INGRESO',
  status: 'STAMPED',
  flow: 'STAFF_B',
  isGlobal: false,
  orderId,
  receptorRfc,
  receptorNombre,
  serie: 'A',
  folio: id.slice(-3),
  uuid: `UUID-${id}`,
  subtotalCents: 20000,
  taxCents: 3200,
  totalCents: 23200,
  stampedAt: '2026-10-28T17:00:00.000Z' as string | null,
  createdAt: '2026-10-28T17:00:00.000Z',
  cancelStatus: null,
  xmlUrl: null,
  pdfUrl: null,
  globalPeriod: null,
})

interface Servidor {
  ventas: Array<ReturnType<typeof ventaBase>>
  facturas: Array<ReturnType<typeof facturaDe>>
  pedidasDeVentas: URL[]
  ventasFallan: boolean
}

async function fixture(page: Page, permissions: string[], ventas: Servidor['ventas']): Promise<Servidor> {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'es')
    localStorage.setItem('vite-ui-theme', 'light')
  })
  await setupApiMocks(page, {
    userRole: StaffRole.MANAGER,
    venues: [createMockVenue({ id: venueId, slug: SLUG, name: 'Café de prueba', permissions })],
  })
  const servidor: Servidor = {
    ventas,
    facturas: [
      facturaDe('c555555555555555555555001', 'PUBLICO EN GENERAL', 'XAXX010101000', null),
      // Codex código r1/r2: 20 intentos sin timbrar del mes, del MISMO RFC al que se va a facturar, llenan la primera página (el
      // servidor los pone primero).
      ...Array.from({ length: 20 }, (_, i) => ({
        ...facturaDe(`c5555555555555555555551${String(i).padStart(2, '0')}`, `PENDIENTE ${i}`, 'EKU9003173C9', null),
        status: 'STAMP_FAILED',
        stampedAt: null,
      })),
    ],
    pedidasDeVentas: [],
    ventasFallan: false,
  }

  // Lista de facturas, como el servidor: filtro de RFC, primero las NO timbradas (stampedAt null), luego la más reciente; paginada.
  await page.route(new RegExp(`/api/v1/dashboard/venues/${venueId}/cfdi(\\?.*)?$`), route => {
    const params = new URL(route.request().url()).searchParams
    const rfc = params.get('receptorRfc')
    const estatus = params.get('status')?.split(',')
    const page = Number(params.get('page') ?? 1)
    const pageSize = Number(params.get('pageSize') ?? 20)
    const todas = servidor.facturas
      .filter(f => !rfc || f.receptorRfc.includes(rfc))
      .filter(f => !estatus || estatus.includes(f.status))
      .sort((a, b) => (a.stampedAt === null ? -1 : b.stampedAt === null ? 1 : b.stampedAt.localeCompare(a.stampedAt)))
    const cfdis = todas.slice((page - 1) * pageSize, page * pageSize)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cfdis, total: todas.length, page, pageSize }),
    })
  })

  // Listado de ventas: busca por folio y dice si cada una ya está facturada.
  await page.route(new RegExp(`/api/v1/dashboard/venues/${venueId}/orders(\\?.*)?$`), route => {
    const url = new URL(route.request().url())
    servidor.pedidasDeVentas.push(url)
    if (servidor.ventasFallan) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'falla' }) })
    }
    const search = url.searchParams.get('search') ?? ''
    const data = servidor.ventas.filter(v => v.orderNumber.includes(search))
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data, meta: { total: data.length, page: 1, pageSize: 20, pageCount: 1, responseMode: 'paginated-v1' } }),
    })
  })

  // Facturar una venta: timbra, la venta queda facturada y la factura entra a la lista.
  await page.route(/\/api\/v1\/dashboard\/venues\/[^/]+\/orders\/[^/]+\/cfdi(\?.*)?$/, route => {
    if (route.request().method() !== 'POST') return route.fallback()
    const orderId = new URL(route.request().url()).pathname.split('/').slice(-2)[0]
    const body = route.request().postDataJSON() as { rfc: string; razonSocial: string }
    const cfdi = facturaDe('c555555555555555555555002', body.razonSocial, body.rfc, orderId)
    servidor.facturas.unshift(cfdi)
    servidor.ventas = servidor.ventas.map(v => (v.id === orderId ? { ...v, facturada: true } : v))
    // 🔴 La forma EXACTA de la respuesta real (`issueCfdiForOrderController`), con su `receptorRfc` aditivo. Una respuesta fingida
    // más rica que la real escondió una vez que el panel leía un campo que el servidor no mandaba.
    const { id, uuid, serie, folio, status, xmlUrl, pdfUrl, receptorRfc } = cfdi
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ cfdi: { id, uuid, serie, folio, status, xmlUrl, pdfUrl, receptorRfc } }),
    })
  })

  await page.goto(`/venues/${SLUG}/cfdi`)
  return servidor
}

const VENTAS = () => [
  ventaBase('c666666666666666666666001', 'ORD-1001', { facturada: true }),
  ventaBase('c666666666666666666666002', 'ORD-1002'),
  ventaBase('c666666666666666666666003', 'ORD-1003', { facturaEnCancelacion: true }),
]

test('un Gerente factura una venta desde «Nueva factura» y la ve sin recargar, aunque hubiera un filtro y pendientes', async ({ page }) => {
  const servidor = await fixture(page, GERENTE, VENTAS())
  await expect(page.getByRole('heading', { name: 'Facturas' })).toBeVisible({ timeout: 20_000 })

  // Un filtro puesto (RFC) que dejaría fuera la factura nueva.
  await page.getByRole('button', { name: 'RFC receptor' }).click()
  await page.getByLabel('RFC receptor').fill('XAXX')
  await expect(page.getByText('PUBLICO EN GENERAL')).toBeVisible()

  await page.getByRole('button', { name: 'Nueva factura' }).click()
  const buscador = page.getByRole('dialog')
  await expect(buscador.getByText('ORD-1001')).toBeVisible()
  await expect(buscador.getByText('Ya facturada')).toBeVisible()
  await expect(buscador.getByRole('button', { name: 'Facturar la venta ORD-1001' })).toHaveCount(0)
  // En cancelación: avisa pero se puede elegir.
  await expect(buscador.getByText(/Su factura se está cancelando/)).toBeVisible()
  await expect(buscador.getByRole('button', { name: 'Facturar la venta ORD-1003' })).toBeEnabled()

  // Pidió sólo ventas cerradas y con su estado de factura.
  const primera = servidor.pedidasDeVentas[0]
  expect(primera.searchParams.get('statuses')).toBe('COMPLETED')
  expect(primera.searchParams.get('conFactura')).toBe('1')
  expect(primera.searchParams.get('responseMode')).toBe('paginated-v1')

  // El buscador va al servidor y no pierde el foco.
  await buscador.getByRole('button', { name: 'Buscar' }).click()
  const caja = buscador.getByLabel('Buscar')
  await caja.fill('1002')
  await expect(caja).toBeFocused()
  await expect(caja).toHaveValue('1002')
  await expect.poll(() => servidor.pedidasDeVentas.some(u => u.searchParams.get('search') === '1002')).toBe(true)
  await expect(buscador.getByText('ORD-1001')).toHaveCount(0)

  await buscador.getByRole('button', { name: 'Facturar la venta ORD-1002' }).click()

  // La ventana de «Facturar» de siempre.
  await expect(page.getByRole('dialog', { name: 'Facturar cuenta' })).toBeVisible()
  await page.locator('[data-tour="cfdi-receptor-rfc"]').fill('EKU9003173C9')
  await page.locator('[data-tour="cfdi-receptor-razon-social"]').fill('ESCUELA KEMPER URGATE')
  await page.locator('[data-tour="cfdi-receptor-cp"]').fill('42501')
  await page.locator('[data-tour="cfdi-receptor-regimen"] [role="combobox"]').click()
  await page.getByRole('option', { name: /^601/ }).click()
  await page.locator('[data-tour="cfdi-receptor-uso"] [role="combobox"]').click()
  await page.getByRole('option', { name: /^G03/ }).click()
  await page.locator('[data-tour="cfdi-issue-submit"]').click()

  // 🔴 La prueba: la factura nueva en la lista, sin recargar, aunque había un filtro de RFC y 20 pendientes que el servidor pone
  // primero. La lista queda buscando por el RFC de la factura nueva.
  await expect(page.getByText('ESCUELA KEMPER URGATE')).toBeVisible()
  await expect(page.getByLabel('RFC receptor')).toHaveValue('EKU9003173C9')
  await expect(page.getByText('PENDIENTE 0')).toHaveCount(0)

  // Y al reabrir el buscador, esa venta ya sale «Ya facturada».
  await page.getByRole('button', { name: 'Nueva factura' }).click()
  await expect(page.getByRole('dialog').getByText('ORD-1002')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Facturar la venta ORD-1002' })).toHaveCount(0)
})

test('un Mesero sin permiso de facturar no ve «Nueva factura»', async ({ page }) => {
  await fixture(page, [...MESERO, 'cfdi:view'], VENTAS())
  await expect(page.getByRole('heading', { name: 'Facturas' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: 'Nueva factura' })).toHaveCount(0)
})

test('vacío, sin resultados y error del servidor se ven distintos', async ({ page }) => {
  const servidor = await fixture(page, GERENTE, [])
  await page.getByRole('button', { name: 'Nueva factura' }).click({ timeout: 20_000 })
  const buscador = page.getByRole('dialog')
  await expect(buscador.getByText('Todavía no hay ventas cerradas para facturar.')).toBeVisible()

  servidor.ventas = VENTAS()
  await buscador.getByRole('button', { name: 'Buscar' }).click()
  await buscador.getByLabel('Buscar').fill('9999')
  await expect(buscador.getByText('Ninguna venta coincide con «9999».')).toBeVisible()

  servidor.ventasFallan = true
  await buscador.getByLabel('Buscar').fill('8888')
  await expect(buscador.getByText('No se pudieron cargar las ventas.')).toBeVisible({ timeout: 10_000 })
  await expect(buscador.getByText('Ninguna venta coincide')).toHaveCount(0)

  // «Reintentar» vuelve a preguntar y ya contesta.
  servidor.ventasFallan = false
  await buscador.getByRole('button', { name: 'Reintentar' }).click()
  await expect(buscador.getByText('Ninguna venta coincide con «8888».')).toBeVisible()
})
